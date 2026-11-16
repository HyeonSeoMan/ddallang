// 실서버 시나리오 도우미(FE-S5-6): 측정 대상이 아닌 준비 단계(방·참여자·거래 채우기)와 변경을 보내는 구동기.
// 앱 코드(`@/lib/api`)는 쓰지 않고 `fetch`로 직접 보낸다: 준비·구동 요청은 화면이 아니라 "다른 사용자의 변경"이다.
import { randomBytes } from "node:crypto";
import type { Claim, MyClaim, Participant, Room } from "@/lib/api";

export const baseUrl = () => {
  const value = process.env.LATENCY_API_BASE_URL;
  if (!value) throw new Error("LATENCY_API_BASE_URL이 필요합니다(실서버 주소).");
  return value.replace(/\/$/, "");
};

/** 신원 키: CSPRNG 32바이트 base64url(43자). */
export const newKey = () => randomBytes(32).toString("base64url");

export interface Called<T = Record<string, any>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  status: number;
  body: T;
}

export async function call<T = Record<string, any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
  method: string,
  path: string,
  key: string,
  body?: unknown,
  withIdempotency = false,
): Promise<Called<T>> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(withIdempotency
        ? {
            "Idempotency-Key": randomBytes(16).toString("base64url"),
            "Idempotency-First-Attempt-At": new Date().toISOString(),
          }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as T };
}

async function ok<T>(label: string, pending: Promise<Called<T>>): Promise<T> {
  const res = await pending;
  if (res.status >= 300) throw new Error(`${label} 실패 ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export interface Member {
  key: string;
  me: Participant;
}

export interface LiveRoom {
  room: Room;
  host: Member;
  /** 신원이 연결된 참여자(방장 포함). 측정에서는 모두 SSE로 연결한다. */
  members: Member[];
  /** 방의 참여자 전체(`order` 순): 신원이 연결된 참여자 뒤에 직접 추가한 참여자. */
  participants: Participant[];
}

/**
 * 신원이 연결된 참여자 `connected`명(방장 `참0` + 입장 `참1`…)과 직접 추가한 참여자 `added`명(`추가1`…)인 방.
 * v0.3.0은 참여자 하나로 한도 10명을 센다(S1 I6, P-3). 측정 조건(S5 §6.7)의 "참여자 10명이 SSE로 연결"은 `connected = 10`.
 */
export async function createLiveRoom(
  connected: number,
  options: { unit?: string; added?: number } = {},
): Promise<LiveRoom> {
  const added = options.added ?? 0;
  if (connected < 1 || connected + added > 10) throw new Error(`참여자 한도 10명을 넘는 구성: ${connected}+${added}`);
  const hostKey = newKey();
  const created = await ok<{ room: Room; me: Participant }>(
    "방 생성",
    call("POST", "/rooms", hostKey, { name: "지연 측정", unit: options.unit ?? "원", nickname: "참0" }),
  );
  const host: Member = { key: hostKey, me: created.me };
  const members = [host];
  for (let n = 1; n < connected; n++) members.push(await joinRoom(created.room.inviteCode, `참${n}`));
  const participants = members.map((m) => m.me);
  for (let n = 1; n <= added; n++) {
    participants.push((await registerParticipant(host, created.room.id, `추가${n}`)).participant);
  }
  return { room: created.room, host, members, participants };
}

/** 새 키로 입장해 새 참여자가 된다(S1 §4.3 신원 없음 → 201). */
export async function joinRoom(inviteCode: string, nickname: string, key = newKey()): Promise<Member> {
  const joined = await ok<{ me: Participant }>(
    `입장 ${nickname}`,
    call("POST", `/invites/${inviteCode}/members`, key, { nickname }),
  );
  return { key, me: joined.me };
}

/** 방 밖의 브라우저(`key`)가 이어받기를 요청한다(S1 §4.9). */
export const requestClaim = (live: LiveRoom, key: string, nickname: string) =>
  ok<{ claim: MyClaim }>("이어받기 요청", call("POST", `/invites/${live.room.inviteCode}/claims`, key, { nickname }));

export const cancelClaim = (live: LiveRoom, key: string, claimId: string) =>
  ok<{ claim: MyClaim }>("이어받기 취소", call("POST", `/invites/${live.room.inviteCode}/claims/${claimId}/cancel`, key));

export const approveClaim = (live: LiveRoom, claimId: string) =>
  ok<{ claim: Claim; participant: Participant }>("이어받기 승인", call("POST", `/rooms/${live.room.id}/claims/${claimId}/approve`, live.host.key));

export const rejectClaim = (live: LiveRoom, claimId: string) =>
  ok<{ claim: Claim }>("이어받기 거절", call("POST", `/rooms/${live.room.id}/claims/${claimId}/reject`, live.host.key));

export const registerParticipant = (host: Member, roomId: string, nickname: string) =>
  ok<{ participant: Participant }>(
    "참여자 등록",
    call("POST", `/rooms/${roomId}/participants`, host.key, { nickname }, false),
  );

export const setParticipantStatus = (host: Member, roomId: string, id: string, status: "ACTIVE" | "INACTIVE") =>
  ok("참여자 상태 변경", call("PATCH", `/rooms/${roomId}/participants/${id}`, host.key, { status }));

/** 거래 생성. 기본은 방장이 참여자 0 → 1에게 100을 지급한다. 지급·수취·금액·작성 접속자는 바꿀 수 있다. */
export const createTransaction = (
  live: LiveRoom,
  reason: string,
  options: { payer?: number; payee?: number; amount?: number; as?: Member } = {},
) =>
  ok<{ transaction: { id: string } }>(
    "거래 생성",
    call(
      "POST",
      `/rooms/${live.room.id}/transactions`,
      (options.as ?? live.host).key,
      {
        payerId: live.participants[options.payer ?? 0]!.id,
        payeeId: live.participants[options.payee ?? 1]!.id,
        amount: options.amount ?? 100,
        reason,
      },
      true,
    ),
  );

export const updateTransaction = (live: LiveRoom, id: string, reason: string, amount = 200) =>
  ok(
    "거래 수정",
    call(
      "PUT",
      `/rooms/${live.room.id}/transactions/${id}`,
      live.host.key,
      { amount, reason },
      true,
    ),
  );

export const deleteTransaction = (live: LiveRoom, id: string) =>
  ok("거래 삭제", call("DELETE", `/rooms/${live.room.id}/transactions/${id}`, live.host.key, undefined, true));

export const endGame = (live: LiveRoom) =>
  ok("게임 종료", call("POST", `/rooms/${live.room.id}/end`, live.host.key, undefined, true));

/** 거래 `count`건을 채운다(사유 `채움-N`). 서버 쓰기만 하므로 동시성을 제한해 병렬로 보낸다. */
export async function seedTransactions(live: LiveRoom, count: number, start = 1): Promise<void> {
  let next = start;
  const end = start + count;
  const worker = async () => {
    while (next < end) {
      const n = next++;
      await createTransaction(live, `채움-${n}`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
}

/** 가장 최근 거래 `limit`건(서버 정렬 그대로: 최신 먼저). */
export async function recentTransactions(live: LiveRoom, limit: number) {
  const body = await ok<{ transactions: Array<{ id: string; reason: string | null }> }>(
    "거래 목록",
    call("GET", `/rooms/${live.room.id}/transactions`, live.host.key),
  );
  return body.transactions.slice(0, limit);
}
