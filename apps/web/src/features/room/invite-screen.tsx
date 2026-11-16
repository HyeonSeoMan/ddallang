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
  type MyClaim,
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
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { TextField } from "@/ui/text-field";
import type { RoomConnection as RoomConnectionHandle } from "@/features/realtime/connection";
import { browserEnv, useRoomConnection } from "@/features/realtime/use-room-connection";
import { CLAIM_POLL_TIMEOUT_MS, createClaimPoller } from "./claim-polling";
import { initialInviteState, type InviteState, inviteReducer, roomInviteState } from "./invite-stage";
import {
  ACCESS_LOST_NEXT_ENDED,
  ACCESS_LOST_NEXT_IN_PROGRESS,
  ACCESS_LOST_NOTICE,
  CLAIM_CONFIRM_BODY,
  CLAIM_GUIDE,
  CLAIMABLE_HINT,
  claimConfirmTitle,
  ENDED_NO_JOIN,
  IDENTITY_KEY_NOTICE,
  inviteNoticeContent,
  reasonMessage,
  RESULT_UNCONFIRMED,
  WAITING_TITLE,
  waitingBody,
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

const columnClass = css({ display: "flex", flexDirection: "column", gap: "3" });
const hintClass = css({ color: "inkMuted", fontSize: "sm", fontWeight: "medium" });

/**
 * `/invite/{inviteCode}` 화면(FE-S1-2 → 2.0.0 FE-M3, S1 §4.2·§4.3·§4.9~§4.11·§9). 한 화면이 상태기계(FD-22)의
 * 단계대로 바뀐다. 입장 전에는 방 이름·정산 단위·진행 상태와 이어받기 후보 닉네임만 보이고(AC-ROOM-004-1),
 * 승인 대기 중에는 방 정보도 보이지 않는다. 방 코드 입력·최근 방 목록은 없다.
 *
 * 입장 화면과 방 화면의 틀이기도 하다. 방 단계에서는 현재 페이지(`children`)를 `RoomShell` 안에 그린다.
 * 라우트 레이아웃에 있어 페이지를 옮겨도 입장 상태와 실시간 연결이 유지된다.
 */
export function InviteScreen({ inviteCode, children }: { inviteCode: string; children?: ReactNode }) {
  const store = useStore();
  const [state, dispatch] = useReducer(
    inviteReducer,
    initialInviteState,
    (initial): InviteState =>
      // 방을 방금 만들었다면 응답의 room·me가 이미 세션에 있다(추가 입장 요청 없음).
      store.get(sessionAtom)?.inviteCode === inviteCode ? roomInviteState : initial,
  );
  const view = state.view;
  const [preview, setPreview] = useState<InviteRoom | null>(null);
  const [nickname, setNickname] = useState("");
  const [nicknameErrors, setNicknameErrors] = useState<string[]>([]);
  /** 오류 단계의 안내(서버 message 또는 클라이언트 문구). */
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  /** 접근 상실 배너(FD-21). 다음 입장·이어받기 시도 전까지 한 번 보인다. */
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

  const invitePath = `/invites/${encodeURIComponent(inviteCode)}`;

  /** 입장 요청. 같은 신원 키의 재시도는 복원(200)이라 안전하다. 닉네임은 새 참여자일 때만 보낸다. */
  async function join(nicknameToSend: string | undefined): Promise<JoinResult> {
    const key = await acquireIdentityKey(inviteCode);
    if (!key.ok) throw new KeyFailure(key.reason);
    const { data } = await api.request<JoinResult>({
      method: "POST",
      path: `${invitePath}/members`,
      body: nicknameToSend === undefined ? {} : { nickname: nicknameToSend },
      headers: bearerHeader(key.key),
    });
    return data;
  }

  /**
   * 접근 상실의 단일 처리기(FD-21): 연결을 멈추고 세션·스냅샷을 비워 방 화면을 닫은 뒤 그 요청에 쓴 키를 조건부로
   * 지우고(FD-20) 초대 조회부터 다시 한다. 여러 입구가 겹쳐도 한 번만 처리한다.
   */
  async function onIdentityRevoked(usedKey: string) {
    if (revoking.current) return;
    revoking.current = true;
    connection.current?.stop(); // 스트림·갱신 주기를 버린다. 다시 연결하지 않는다(S5 §6.3 5)
    store.set(sessionAtom, null);
    store.set(setConnectionAtom, "disconnected");
    setAccessLost(true);
    setErrorNotice(null);
    await discardIdentityKey(inviteCode, usedKey);
    revoking.current = false;
    if (mounted.current) dispatch({ type: "ACCESS_REVOKED" });
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

  // 1) 초대 조회. 단계가 `checking`이 될 때마다 한 번 한다. 저장된 키가 있으면 실어 신원 상태를 확인한다.
  useEffect(() => {
    if (view.stage !== "checking") return;
    let cancelled = false;
    (async () => {
      try {
        const stored = getStoredKey(inviteCode);
        const { data } = await api.request<InviteLookup>({
          method: "GET",
          path: invitePath,
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
        dispatch({ type: "CHECKED", lookup: data });
      } catch (error) {
        if (cancelled) return;
        dispatch({ type: "CHECK_FAILED", code: errorCode(error) });
        setErrorNotice(errorMessage(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, inviteCode, invitePath, api]);

  // 2) 연결된 키(또는 승인된 요청)는 닉네임 없이 입장 요청으로 복원한다(AC-ROOM-005-1, S5 §6.8).
  //    조회 effect와 분리해야 한다: 단계가 바뀌면 조회 effect가 정리되므로 늦은 복원 응답이 버려진다.
  useEffect(() => {
    if (view.stage !== "restoring") return;
    let cancelled = false;
    (async () => {
      try {
        const joined = await join(undefined);
        if (!cancelled) enterRoom(joined);
      } catch (error) {
        if (cancelled || isRevoked(error)) return; // 접근 상실 처리기가 맡는다
        dispatch({ type: "RESTORE_FAILED", code: errorCode(error) });
        setErrorNotice(errorMessage(error));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `join`·`enterRoom`은 매 렌더의 같은 로직이며 단계 전환 때만 실행한다.
  }, [view, inviteCode]);

  // 3) 취소의 결과 불명·`CLAIM_ALREADY_RESOLVED` 뒤: 내 요청 조회(S1 §4.10)를 즉시 한 번 해 현재 상태로 전이한다.
  useEffect(() => {
    if (view.stage !== "cancel-checking") return;
    let cancelled = false;
    (async () => {
      try {
        const key = getStoredKey(inviteCode);
        const { data } = await api.request<{ claim: MyClaim }>({
          method: "GET",
          path: `${invitePath}/claims/${encodeURIComponent(view.claim.id)}`,
          headers: key ? bearerHeader(key) : undefined,
        });
        if (!cancelled) dispatch({ type: "CLAIM_STATUS", claim: data.claim, source: "check" });
      } catch (error) {
        if (!cancelled && !isRevoked(error)) dispatch({ type: "CLAIM_STATUS_FAILED" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, inviteCode, invitePath, api]);

  // 4) 요청자 주기 조회(FD-23, S5 §6.8): 대기(취소 중·취소 확인 중 포함) 동안 같은 요청을 2초 간격으로 조회한다.
  //    단계가 대기 ↔ 취소 사이를 오가도 같은 요청이면 다시 시작하지 않는다(취소 중에도 멈추지 않는다).
  const pollingClaimId =
    view.stage === "waiting" || view.stage === "canceling" || view.stage === "cancel-checking" ? view.claim.id : null;
  useEffect(() => {
    if (pollingClaimId === null) return;
    const poller = createClaimPoller({
      async fetchClaim(signal) {
        const key = getStoredKey(inviteCode);
        const { data } = await api.request<{ claim: MyClaim }>({
          method: "GET",
          path: `${invitePath}/claims/${encodeURIComponent(pollingClaimId)}`,
          headers: key ? bearerHeader(key) : undefined,
          timeoutMs: CLAIM_POLL_TIMEOUT_MS,
          signal,
        });
        return data.claim;
      },
      onClaim: (claim) => dispatch({ type: "CLAIM_STATUS", claim, source: "poll" }),
      env: browserEnv(),
    });
    poller.start();
    return () => poller.stop();
  }, [pollingClaimId, inviteCode, invitePath, api]);

  async function onSubmitNickname(event: FormEvent) {
    event.preventDefault();
    if (view.stage !== "nickname") return;
    const check = validateRoomText(nickname);
    setNicknameErrors(check.reasons.map((code) => reasonMessage(code)));
    if (check.reasons.length > 0) return;

    dispatch({ type: "SUBMIT_NICKNAME" });
    setAccessLost(false);
    try {
      const joined = await join(check.value);
      if (mounted.current) enterRoom(joined);
    } catch (error) {
      if (!mounted.current || isRevoked(error)) return; // 접근 상실 처리기가 맡는다
      if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
        setNicknameErrors(
          error.details.filter((d) => d.field === "nickname").map((d) => reasonMessage(d.code)),
        );
      }
      // NICKNAME_TAKEN·PARTICIPANT_LIMIT_EXCEEDED 등: 서버 message를 그대로 보인다. 목록은 조회하지 않는다.
      dispatch({ type: "JOIN_REJECTED", code: errorCode(error), message: errorMessage(error) });
    }
  }

  /** 이어받기 요청(S1 §4.9). 키는 입장과 같은 배타 구간에서 얻는다(FD-20). 결과 불명이면 자동 재전송하지 않는다. */
  async function onConfirmClaim() {
    if (view.stage !== "confirm") return;
    const target = view.nickname;
    dispatch({ type: "CONFIRM_CLAIM" });
    setAccessLost(false);
    try {
      const key = await acquireIdentityKey(inviteCode);
      if (!key.ok) throw new KeyFailure(key.reason);
      const { data } = await api.request<{ claim: MyClaim }>({
        method: "POST",
        path: `${invitePath}/claims`,
        body: { nickname: target },
        headers: bearerHeader(key.key),
      });
      if (mounted.current) dispatch({ type: "CLAIM_CREATED", claim: data.claim });
    } catch (error) {
      if (!mounted.current || isRevoked(error)) return;
      if (isResultUnknown(error)) dispatch({ type: "CLAIM_LOST" });
      else dispatch({ type: "CLAIM_REJECTED", code: errorCode(error), message: errorMessage(error) });
    }
  }

  /** 요청 취소(S1 §4.11). 결과 불명·이미 처리됨이면 내 요청 조회로 현재 상태를 확인한다(§6.5). */
  async function onCancelClaim() {
    if (view.stage !== "waiting") return;
    const claim = view.claim;
    dispatch({ type: "CANCEL" });
    try {
      const key = getStoredKey(inviteCode);
      const { data } = await api.request<{ claim: MyClaim }>({
        method: "POST",
        path: `${invitePath}/claims/${encodeURIComponent(claim.id)}/cancel`,
        headers: key ? bearerHeader(key) : undefined,
      });
      if (mounted.current) dispatch({ type: "CANCELED", claim: data.claim });
    } catch (error) {
      if (!mounted.current || isRevoked(error)) return;
      // 결과 불명과 이미 처리됨만 내 요청 조회로 확인한다(S1 §6.5). 그 밖의 거부는 서버 안내를 보인다.
      if (isResultUnknown(error) || (error instanceof ApiError && error.code === "CLAIM_ALREADY_RESOLVED")) {
        dispatch({ type: "CANCEL_UNCERTAIN" });
      } else {
        dispatch({ type: "CANCEL_FAILED", message: errorMessage(error) });
      }
    }
  }

  const ended = state.ended || preview?.status === "ENDED";
  const waiting = view.stage === "waiting" || view.stage === "canceling" || view.stage === "cancel-checking";
  const notice = state.notice ? inviteNoticeContent(state.notice) : null;
  const noticeBanner = notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null;
  const claimableHint =
    state.notice?.kind === "server" && state.notice.claimable ? (
      <div className={columnClass}>
        <p className={hintClass}>{CLAIMABLE_HINT}</p>
        <Button variant="secondary" onClick={() => dispatch({ type: "CHOOSE_CLAIM" })}>
          이어받기로 가기
        </Button>
      </div>
    ) : null;

  return (
    <main data-invite-code={inviteCode} data-stage={view.stage}>
      {view.stage !== "room" ? (
        <div className={css({ maxW: "md", mx: "auto", p: "4" })}>
          <BrandHeader />

          <div className={cardClass}>
            {preview && !waiting ? (
              // 방 미리보기(방향 문서 §5.6): 입장 전 공개 범위는 방 이름·정산 단위·진행 상태뿐이다(S1 §4.2).
              <section
                aria-label="방 정보"
                className={css({ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2.5", mb: "5" })}
              >
                <p className={css({ fontSize: "xl", fontWeight: "bold", overflowWrap: "anywhere" })}>{preview.name}</p>
                <p>정산 단위: {preview.unit}</p>
                <Badge tone={ended ? "neutral" : "info"}>{ended ? "게임 종료" : "진행 중"}</Badge>
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

            {view.stage === "checking" ? <p>확인 중…</p> : null}
            {view.stage === "joining" || view.stage === "restoring" ? <p>입장 중…</p> : null}

            {view.stage === "choose" ? (
              <div className={columnClass}>
                {noticeBanner}
                {ended ? (
                  <p className={css({ fontWeight: "semibold" })}>{ENDED_NO_JOIN}</p>
                ) : (
                  <Button variant="secondaryBlock" size="large" onClick={() => dispatch({ type: "CHOOSE_JOIN" })}>
                    새로 입장하기
                  </Button>
                )}
                {state.candidates.length > 0 ? (
                  <>
                    <Button variant="secondaryBlock" size="large" onClick={() => dispatch({ type: "CHOOSE_CLAIM" })}>
                      기존 참여자 이어받기
                    </Button>
                    <p className={hintClass}>{CLAIM_GUIDE}</p>
                  </>
                ) : null}
              </div>
            ) : null}

            {view.stage === "nickname" || view.stage === "joining" ? (
              <form
                onSubmit={onSubmitNickname}
                noValidate
                hidden={view.stage === "joining"}
                className={css({ display: "flex", flexDirection: "column", gap: "4" })}
              >
                <TextField
                  label="닉네임"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  errors={nicknameErrors}
                  autoComplete="off"
                />
                <p className={hintClass}>{IDENTITY_KEY_NOTICE}</p>
                {noticeBanner}
                {claimableHint}
                <Button type="submit" size="large">
                  입장
                </Button>
                <Button variant="secondaryBlock" onClick={() => dispatch({ type: "BACK" })}>
                  뒤로
                </Button>
              </form>
            ) : null}

            {view.stage === "candidates" || view.stage === "confirm" || view.stage === "requesting" ? (
              <section aria-labelledby="claim-candidates" className={columnClass}>
                <h2 id="claim-candidates" className={css({ fontSize: "lg", fontWeight: "bold" })}>
                  이어받을 참여자 선택
                </h2>
                {noticeBanner}
                <ul className={columnClass} aria-label="이어받기 후보">
                  {state.candidates.map((candidate) => (
                    <li key={candidate}>
                      <Button
                        variant="secondaryBlock"
                        onClick={() => dispatch({ type: "SELECT_CANDIDATE", nickname: candidate })}
                      >
                        {candidate}
                      </Button>
                    </li>
                  ))}
                </ul>
                <p className={hintClass}>{IDENTITY_KEY_NOTICE}</p>
                <Button variant="secondary" onClick={() => dispatch({ type: "BACK" })}>
                  뒤로
                </Button>
                {view.stage === "requesting" ? <p>요청 중…</p> : null}
              </section>
            ) : null}

            {waiting ? (
              <section aria-labelledby="claim-waiting" className={columnClass}>
                <h2 id="claim-waiting" className={css({ fontSize: "lg", fontWeight: "bold" })}>
                  {WAITING_TITLE}
                </h2>
                <p>{waitingBody(view.claim.nickname)}</p>
                {noticeBanner}
                <Button variant="secondaryBlock" disabled={view.stage !== "waiting"} onClick={() => void onCancelClaim()}>
                  요청 취소
                </Button>
              </section>
            ) : null}

            {view.stage === "unconfirmed" ? (
              <div className={columnClass}>
                <Banner tone="warning">{RESULT_UNCONFIRMED}</Banner>
                <Button onClick={() => dispatch({ type: "RECHECK" })}>다시 확인</Button>
              </div>
            ) : null}

            {view.stage === "error" ? (
              <div className={columnClass}>
                <Banner tone="error">{errorNotice ?? "입장할 수 없습니다."}</Banner>
                {view.code === "NETWORK_ERROR" || view.code === "TIMEOUT" ? (
                  <Button
                    onClick={() => {
                      setErrorNotice(null);
                      dispatch({ type: "RETRY" });
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

      <ConfirmDialog
        open={view.stage === "confirm" || view.stage === "requesting"}
        title={view.stage === "confirm" || view.stage === "requesting" ? claimConfirmTitle(view.nickname) : ""}
        description={CLAIM_CONFIRM_BODY}
        confirmLabel="요청"
        busy={view.stage === "requesting"}
        onConfirm={() => void onConfirmClaim()}
        onCancel={() => dispatch({ type: "BACK" })}
      />

      {view.stage === "room" ? (
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

/**
 * 처리됐는지 알 수 없는 응답: 응답을 받지 못했거나(`NetworkError`), 게이트웨이·서버 오류(5xx)이거나, 2xx인데 본문을
 * 해석하지 못했다. 같은 키로 자동 재전송하지 않고 현재 상태를 다시 조회한다(S1 §6.5).
 */
function isResultUnknown(error: unknown): boolean {
  return (
    error instanceof NetworkError ||
    (error instanceof ApiError && (error.status >= 500 || error.code === "INVALID_RESPONSE"))
  );
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
