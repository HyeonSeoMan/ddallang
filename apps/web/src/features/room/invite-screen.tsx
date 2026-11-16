"use client";

import { useAtomValue, useStore } from "jotai";
import { type FormEvent, type ReactNode, type RefObject, useEffect, useReducer, useRef, useState } from "react";
import { css } from "styled-system/css";
import {
  ApiError,
  bearerHeader,
  getApiClient,
  type InviteLookup,
  type InviteRoom,
  NetworkError,
  type Participant,
  type RoomSummary,
} from "@/lib/api";
import { acquireIdentityKey, discardIdentityKey, getStoredKey } from "@/lib/identity";
import { validateRoomText } from "@/lib/validation/room-text";
import { Badge } from "@/ui/badge";
import { Banner } from "@/ui/banner";
import { BrandHeader, cardClass } from "@/ui/brand-header";
import { Button } from "@/ui/button";
import { TextField } from "@/ui/text-field";
import type { RoomConnection as RoomConnectionHandle } from "@/features/realtime/connection";
import { useRoomConnection } from "@/features/realtime/use-room-connection";
import { initialInviteStage, type InviteStage, inviteReducer } from "./invite-stage";
import {
  ACCESS_LOST_NEXT_ENDED,
  ACCESS_LOST_NEXT_IN_PROGRESS,
  ACCESS_LOST_NOTICE,
  IDENTITY_KEY_NOTICE,
  reasonMessage,
} from "./messages";
import { RoomShell } from "./room-shell";
import { sessionAtom, setConnectionAtom } from "./state";

const NETWORK_MESSAGE = "응답을 받지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.";

const KEY_FAILURE_MESSAGES = {
  "locks-unsupported": "이 브라우저에서는 입장할 수 없습니다.",
  "storage-failed":
    "브라우저 저장소를 사용할 수 없어 입장할 수 없습니다. 저장소 차단(시크릿 모드 등)을 해제해 주세요.",
  "key-not-confirmed": "신원 정보를 이 브라우저에 저장했지만 확인하지 못해 입장할 수 없습니다.",
} as const;

interface JoinResult {
  room: RoomSummary;
  me: Participant;
}

/**
 * `/invite/{inviteCode}` 화면(FE-S1-2, S1 §4.2·§4.3·§9). 한 화면이 확인 중 → 닉네임 입력 → 입장 중 → 방 화면
 * 단계로 바뀐다(FD-2). 입장 전에는 방 이름·정산 단위·진행 상태만 보인다. 방 코드 입력·최근 방 목록은 없다.
 */
/**
 * 입장 화면과 방 화면의 틀. 방 단계에서는 현재 페이지(`children`: 현황·기록·정산·방)를 `RoomShell` 안에 그린다.
 * 라우트 레이아웃에 있어 페이지를 옮겨도 입장 상태와 실시간 연결이 유지된다.
 */
export function InviteScreen({ inviteCode, children }: { inviteCode: string; children?: ReactNode }) {
  const store = useStore();
  const [state, dispatch] = useReducer(
    inviteReducer,
    initialInviteStage,
    (initial): InviteStage =>
      // 방을 방금 만들었다면 응답의 room·me가 이미 세션에 있다(추가 입장 요청 없음).
      store.get(sessionAtom)?.inviteCode === inviteCode ? { stage: "room" } : initial,
  );
  const [preview, setPreview] = useState<InviteRoom | null>(null);
  const [nickname, setNickname] = useState("");
  const [nicknameErrors, setNicknameErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** 이미 멤버라 닉네임 없이 복원 입장 중인가. */
  const [restoring, setRestoring] = useState(false);
  /** 접근 상실 배너(FD-21). 다음 입장 시도 전까지 한 번 보인다. */
  const [accessLost, setAccessLost] = useState(false);
  const revoking = useRef(false);
  /** 방 화면의 실시간 연결. 접근 상실이면 세션을 비우기 전에 먼저 멈춘다(FD-21). */
  const connection = useRef<RoomConnectionHandle | null>(null);

  const api = getApiClient();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** 입장 요청. 같은 신원 키의 재시도는 복원(200)이라 안전하다. 닉네임은 새 멤버일 때만 보낸다. */
  async function join(nicknameToSend: string | undefined): Promise<JoinResult> {
    const key = await acquireIdentityKey(inviteCode);
    if (!key.ok) throw new KeyFailure(key.reason);
    const { data } = await api.request<JoinResult>({
      method: "POST",
      path: `/invites/${encodeURIComponent(inviteCode)}/members`,
      body: nicknameToSend === undefined ? {} : { nickname: nicknameToSend },
      headers: bearerHeader(key.key),
    });
    return data;
  }

  /**
   * 접근 상실의 단일 처리기(FD-21): 세션·스냅샷을 비워 방 화면을 닫고(스트림·갱신은 언마운트로 끝나며 다시 연결하지
   * 않는다) 그 요청에 쓴 키를 조건부로 지운 뒤(FD-20) 초대 조회부터 다시 한다. 여러 입구가 겹쳐도 한 번만 처리한다.
   */
  async function onIdentityRevoked(usedKey: string) {
    if (revoking.current) return;
    revoking.current = true;
    connection.current?.stop(); // 스트림·갱신 주기를 버린다. 다시 연결하지 않는다(S5 §6.3 5)
    store.set(sessionAtom, null);
    store.set(setConnectionAtom, "disconnected");
    setAccessLost(true);
    setNotice(null);
    setRestoring(false);
    await discardIdentityKey(inviteCode, usedKey);
    revoking.current = false;
    if (!mounted.current) return;
    dispatch({ type: "ACCESS_REVOKED" });
    setAttempt((n) => n + 1);
  }
  const revokedHandler = useRef(onIdentityRevoked);
  useEffect(() => {
    revokedHandler.current = onIdentityRevoked;
  });
  // REST 입구: 어떤 요청이든 `401 IDENTITY_REVOKED`를 받으면 같은 처리기로 간다.
  useEffect(() => api.onIdentityRevoked((usedKey) => void revokedHandler.current(usedKey)), [api]);

  function enterRoom(result: JoinResult) {
    store.set(sessionAtom, { inviteCode, roomId: result.room.id, me: result.me });
    dispatch({ type: "JOINED" });
  }

  // 1) 초대 링크 조회. 저장된 키가 있으면 Authorization을 실어 신원 상태(`identity`)를 확인한다.
  useEffect(() => {
    if (state.stage !== "checking") return;
    let cancelled = false;
    (async () => {
      try {
        const stored = getStoredKey(inviteCode);
        const { data } = await api.request<InviteLookup>({
          method: "GET",
          path: `/invites/${encodeURIComponent(inviteCode)}`,
          headers: stored ? bearerHeader(stored) : undefined,
        });
        if (cancelled) return;
        setPreview(data.room);
        if (data.identity === "REVOKED" && stored) {
          // 초대 조회 입구(S1 §4.2): 키를 지우고 신원 없음으로 간다. 후보 목록은 이 응답에 이미 있다.
          setAccessLost(true);
          await discardIdentityKey(inviteCode, stored);
          if (cancelled) return;
        }
        // 연결됨(`PARTICIPANT`)만 복원한다. 대기·이어받기 분기는 FE-M3(FD-22).
        const isParticipant = data.identity === "PARTICIPANT";
        setRestoring(isParticipant);
        dispatch({ type: "CHECKED", isMember: isParticipant });
      } catch (error) {
        if (cancelled) return;
        dispatch({ type: "CHECK_FAILED", code: errorCode(error) });
        setNotice(errorMessage(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.stage, inviteCode, attempt, api]);

  // 2) 이미 입장한 브라우저는 닉네임 없이 복원한다(AC-ROOM-005-1). 조회 effect와 분리해야 한다:
  //    CHECKED로 단계가 바뀌면 조회 effect가 정리되므로, 복원 응답이 늦게 오면 결과가 버려진다.
  useEffect(() => {
    if (state.stage !== "joining" || !restoring) return;
    let cancelled = false;
    (async () => {
      try {
        const joined = await join(undefined);
        if (cancelled) return;
        setRestoring(false);
        enterRoom(joined);
      } catch (error) {
        if (cancelled || isRevoked(error)) return; // 접근 상실 처리기가 맡는다
        setRestoring(false);
        dispatch({ type: "RESTORE_FAILED", code: errorCode(error) });
        setNotice(errorMessage(error));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `join`·`enterRoom`은 매 렌더의 같은 로직이며 단계 전환 때만 실행한다.
  }, [state.stage, restoring, inviteCode]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (state.stage !== "nickname") return;
    const check = validateRoomText(nickname);
    setNotice(null);
    setNicknameErrors(check.reasons.map((code) => reasonMessage(code)));
    if (check.reasons.length > 0) return;

    dispatch({ type: "SUBMIT_NICKNAME" });
    setAccessLost(false);
    try {
      const joined = await join(check.value);
      if (mounted.current) enterRoom(joined);
    } catch (error) {
      if (!mounted.current || isRevoked(error)) return; // 접근 상실 처리기가 맡는다
      dispatch({ type: "JOIN_REJECTED" }); // 닉네임을 유지한 채 입력 단계로 돌아간다
      if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
        setNicknameErrors(
          error.details.filter((d) => d.field === "nickname").map((d) => reasonMessage(d.code)),
        );
      } else {
        // NICKNAME_TAKEN·PARTICIPANT_LIMIT_EXCEEDED 등: 서버 message를 그대로 보인다. 목록은 조회하지 않는다.
        setNotice(errorMessage(error));
      }
    }
  }

  const ended = preview?.status === "ENDED";

  return (
    <main data-invite-code={inviteCode} data-stage={state.stage}>
      {state.stage !== "room" ? (
      <div className={css({ maxW: "md", mx: "auto", p: "4" })}>
        <BrandHeader />

        <div className={cardClass}>
        {preview ? (
          // 방 미리보기(방향 문서 §5.6): 방 정보 규칙(§5.5)과 같은 순서·크기. 진행 중 배지는 info로 통일.
          <section
            aria-label="방 정보"
            className={css({ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2.5", mb: "5" })}
          >
            <p className={css({ fontSize: "xl", fontWeight: "bold", overflowWrap: "anywhere" })}>{preview.name}</p>
            <p>정산 단위: {preview.unit}</p>
            <Badge tone={ended ? "neutral" : "info"}>{ended ? "게임 종료" : "진행 중"}</Badge>
            {ended ? (
              <p className={css({ color: "inkMuted", fontSize: "sm", fontWeight: "medium" })}>
                종료된 방입니다. 입장하면 최종 정산을 볼 수 있습니다.
              </p>
            ) : null}
          </section>
        ) : null}

        {accessLost ? (
          <div className={css({ mb: "4" })}>
            <Banner tone="warning">
              {ACCESS_LOST_NOTICE}{" "}
              {preview ? (ended ? ACCESS_LOST_NEXT_ENDED : ACCESS_LOST_NEXT_IN_PROGRESS) : null}
            </Banner>
          </div>
        ) : null}

        {state.stage === "checking" ? <p>확인 중…</p> : null}

        {state.stage === "joining" ? <p>입장 중…</p> : null}

        {state.stage === "nickname" ? (
          <form onSubmit={onSubmit} noValidate className={css({ display: "flex", flexDirection: "column", gap: "4" })}>
            <TextField
              label="닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              errors={nicknameErrors}
              autoComplete="off"
            />
            <p className={css({ color: "inkMuted", fontSize: "sm", fontWeight: "medium" })}>{IDENTITY_KEY_NOTICE}</p>
            {notice ? <Banner tone="error">{notice}</Banner> : null}
            <Button type="submit" size="large">
              입장
            </Button>
          </form>
        ) : null}

        {state.stage === "error" ? (
          <div className={css({ display: "flex", flexDirection: "column", gap: "3" })}>
            <Banner tone="error">{notice ?? "입장할 수 없습니다."}</Banner>
            {state.code === "NETWORK_ERROR" || state.code === "TIMEOUT" ? (
              <Button
                onClick={() => {
                  setNotice(null);
                  dispatch({ type: "RETRY" });
                  setAttempt((n) => n + 1);
                }}
              >
                다시 시도
              </Button>
            ) : null}
          </div>
        ) : null}
        </div>
      </div>
      ) : null}

      {state.stage === "room" ? (
        <RoomScreen
          inviteCode={inviteCode}
          connectionRef={connection}
          onAccessRevoked={(usedKey) => void onIdentityRevoked(usedKey)}
        >
          {children}
        </RoomScreen>
      ) : null}
    </main>
  );
}

/** 입장(복원)에 성공한 뒤의 방 화면. 스트림을 연결하고 서버 유래 영역은 연결 게이트 뒤에 둔다. */
function RoomScreen({
  inviteCode,
  connectionRef,
  onAccessRevoked,
  children,
}: {
  inviteCode: string;
  connectionRef: RefObject<RoomConnectionHandle | null>;
  onAccessRevoked: (usedKey: string) => void;
  children?: ReactNode;
}) {
  const session = useAtomValue(sessionAtom);
  return session?.inviteCode === inviteCode ? (
    <>
      <RoomConnection
        inviteCode={inviteCode}
        roomId={session.roomId}
        connectionRef={connectionRef}
        onAccessRevoked={onAccessRevoked}
      />
      <RoomShell inviteCode={inviteCode}>{children}</RoomShell>
    </>
  ) : null;
}

function RoomConnection({
  inviteCode,
  roomId,
  connectionRef,
  onAccessRevoked,
}: {
  inviteCode: string;
  roomId: string;
  connectionRef: RefObject<RoomConnectionHandle | null>;
  onAccessRevoked: (usedKey: string) => void;
}) {
  useRoomConnection(inviteCode, roomId, onAccessRevoked, connectionRef);
  return null;
}

function isRevoked(error: unknown): boolean {
  return error instanceof ApiError && error.code === "IDENTITY_REVOKED";
}

class KeyFailure extends Error {
  constructor(readonly reason: keyof typeof KEY_FAILURE_MESSAGES) {
    super(KEY_FAILURE_MESSAGES[reason]);
  }
}

function errorCode(error: unknown): string {
  if (error instanceof ApiError) return error.code;
  if (error instanceof NetworkError) return error.reason === "timeout" ? "TIMEOUT" : "NETWORK_ERROR";
  if (error instanceof KeyFailure) return `KEY_${error.reason}`;
  return "UNKNOWN_ERROR";
}

/** 서버 오류는 `message`를 그대로 보이고, 네트워크·저장소 오류는 클라이언트 안내를 쓴다. */
function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof KeyFailure) return error.message;
  if (error instanceof NetworkError) return NETWORK_MESSAGE;
  return "알 수 없는 오류가 발생했습니다.";
}
