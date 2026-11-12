"use client";

import { useAtomValue, useStore } from "jotai";
import { type FormEvent, useEffect, useReducer, useRef, useState } from "react";
import { css } from "styled-system/css";
import {
  ApiError,
  bearerHeader,
  getApiClient,
  type InviteRoom,
  NetworkError,
  type RoomMember,
  type RoomSummary,
} from "@/lib/api";
import { acquireIdentityKey, getStoredKey } from "@/lib/identity";
import { validateRoomText } from "@/lib/validation/room-text";
import { Badge } from "@/ui/badge";
import { Banner } from "@/ui/banner";
import { BrandHeader, cardClass } from "@/ui/brand-header";
import { Button } from "@/ui/button";
import { TextField } from "@/ui/text-field";
import { ConnectionBanner } from "@/features/realtime/connection-banner";
import { useRoomConnection } from "@/features/realtime/use-room-connection";
import { BalancesSection } from "@/features/balances/balances-section";
import { TransactionActions } from "@/features/transactions/transaction-actions";
import { TransactionForm } from "@/features/transactions/transaction-form";
import { RecordTransactionButton } from "@/features/transactions/record-button";
import { TransactionsSection } from "@/features/transactions/transactions-section";
import { EndGame } from "@/features/settlement/end-game";
import { SettlementSection } from "@/features/settlement/settlement-section";
import { ParticipantsSection } from "@/features/participants/participants-section";
import { initialInviteStage, type InviteStage, inviteReducer } from "./invite-stage";
import { IDENTITY_KEY_NOTICE, reasonMessage } from "./messages";
import { RoomInfo } from "./room-info";
import { RoomLayout } from "./room-layout";
import { sessionAtom, snapshotAtom } from "./state";

const NETWORK_MESSAGE = "응답을 받지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.";

const KEY_FAILURE_MESSAGES = {
  "locks-unsupported": "이 브라우저에서는 입장할 수 없습니다.",
  "storage-failed":
    "브라우저 저장소를 사용할 수 없어 입장할 수 없습니다. 저장소 차단(시크릿 모드 등)을 해제해 주세요.",
  "key-not-confirmed": "신원 정보를 이 브라우저에 저장했지만 확인하지 못해 입장할 수 없습니다.",
} as const;

interface JoinResult {
  room: RoomSummary;
  me: RoomMember;
}

/**
 * `/invite/{inviteCode}` 화면(FE-S1-2, S1 §4.2·§4.3·§9). 한 화면이 확인 중 → 닉네임 입력 → 입장 중 → 방 화면
 * 단계로 바뀐다(FD-2). 입장 전에는 방 이름·정산 단위·진행 상태만 보인다. 방 코드 입력·최근 방 목록은 없다.
 */
export function InviteScreen({ inviteCode }: { inviteCode: string }) {
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

  function enterRoom(result: JoinResult) {
    store.set(sessionAtom, { inviteCode, roomId: result.room.id, me: result.me });
    dispatch({ type: "JOINED" });
  }

  // 1) 초대 링크 조회. 저장된 키가 있으면 Authorization을 실어 isMember를 확인한다.
  useEffect(() => {
    if (state.stage !== "checking") return;
    let cancelled = false;
    (async () => {
      try {
        const stored = getStoredKey(inviteCode);
        const { data } = await api.request<{ room: InviteRoom; isMember: boolean }>({
          method: "GET",
          path: `/invites/${encodeURIComponent(inviteCode)}`,
          headers: stored ? bearerHeader(stored) : undefined,
        });
        if (cancelled) return;
        setPreview(data.room);
        setRestoring(data.isMember);
        dispatch({ type: "CHECKED", isMember: data.isMember });
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
        if (cancelled) return;
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
    try {
      const joined = await join(check.value);
      if (mounted.current) enterRoom(joined);
    } catch (error) {
      if (!mounted.current) return;
      dispatch({ type: "JOIN_REJECTED" }); // 닉네임을 유지한 채 입력 단계로 돌아간다
      if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
        setNicknameErrors(
          error.details.filter((d) => d.field === "nickname").map((d) => reasonMessage(d.code)),
        );
      } else {
        // NICKNAME_TAKEN·MEMBER_LIMIT_EXCEEDED 등: 서버 message를 그대로 보인다. 목록은 조회하지 않는다.
        setNotice(errorMessage(error));
      }
    }
  }

  const ended = preview?.status === "ENDED";

  return (
    <main data-invite-code={inviteCode} data-stage={state.stage}>
      <div className={css({ maxW: "md", mx: "auto", p: "4" })}>
        <BrandHeader />

        <div className={state.stage === "room" ? undefined : cardClass}>
        {preview && state.stage !== "room" ? (
          <section aria-label="방 정보" className={css({ mb: "4" })}>
            <p className={css({ fontSize: "lg", fontWeight: "bold" })}>{preview.name}</p>
            <p>정산 단위: {preview.unit}</p>
            <Badge tone={ended ? "neutral" : "success"}>{ended ? "게임 종료" : "진행 중"}</Badge>
            {ended ? (
              <p className={css({ mt: "2" })}>
                종료된 방입니다. 입장하면 최종 정산을 볼 수 있습니다.
              </p>
            ) : null}
          </section>
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
            <p className={css({ color: "inkMuted", fontSize: "sm" })}>{IDENTITY_KEY_NOTICE}</p>
            {notice ? <Banner tone="error">{notice}</Banner> : null}
            <Button type="submit">입장</Button>
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

      {state.stage === "room" ? <RoomScreen inviteCode={inviteCode} /> : null}
    </main>
  );
}

/** 입장(복원)에 성공한 뒤의 방 화면. 스트림을 연결하고 서버 유래 영역은 연결 게이트 뒤에 둔다. */
function RoomScreen({ inviteCode }: { inviteCode: string }) {
  const session = useAtomValue(sessionAtom);
  return session?.inviteCode === inviteCode ? (
    <>
      <RoomConnection inviteCode={inviteCode} roomId={session.roomId} />
      <RoomBody />
    </>
  ) : null;
}

function RoomBody() {
  const snapshot = useAtomValue(snapshotAtom);
  // 정산 영역의 이름은 서버가 정한 `kind`를 따른다(예상 정산 / 최종 정산). 데이터가 보일 때만 적용된다.
  const titles = snapshot ? { settlement: snapshot.settlement.kind === "FINAL" ? "최종 정산" : "예상 정산" } : {};
  return (
    <RoomLayout
      banner={<ConnectionBanner />}
      titles={titles}
      floating={<RecordTransactionButton />}
      slots={{
        info: (
          <>
            <RoomInfo />
            <EndGame />
          </>
        ),
        balances: <BalancesSection />,
        settlement: <SettlementSection />,
        entry: <TransactionForm />,
        transactions: (
          <TransactionsSection
            renderActions={(transaction, { me, room, summary }) => (
              <TransactionActions transaction={transaction} me={me} room={room} summary={summary} />
            )}
          />
        ),
        participants: <ParticipantsSection />,
      }}
    />
  );
}

function RoomConnection({ inviteCode, roomId }: { inviteCode: string; roomId: string }) {
  useRoomConnection(inviteCode, roomId);
  return null;
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
