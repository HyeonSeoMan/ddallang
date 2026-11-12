// 실서버 시나리오 도우미(FE-S5-6): 측정 대상이 아닌 준비 단계(방·참여자·거래 채우기)와 변경을 보내는 구동기.
// 앱 코드(`@/lib/api`)는 쓰지 않고 `fetch`로 직접 보낸다: 준비·구동 요청은 화면이 아니라 "다른 사용자의 변경"이다.
import { randomBytes } from "node:crypto";
import type { Participant, Room, RoomMember } from "@/lib/api";

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
  me: RoomMember;
}

export interface LiveRoom {
  room: Room;
  host: Member;
  /** 방장 포함 접속자 10명(방 한도). */
  members: Member[];
  participants: Participant[];
}

/** 방장 + 접속자 9명이 입장하고 참여자가 `participants`명 등록된 방(S5 §6.7 측정 조건의 접속자 10명). */
export async function createLiveRoom(participantCount: number, unit = "원"): Promise<LiveRoom> {
  const hostKey = newKey();
  const created = await ok<{ room: Room; me: RoomMember }>(
    "방 생성",
    call("POST", "/rooms", hostKey, { name: "지연 측정", unit, nickname: "방장" }),
  );
  const host: Member = { key: hostKey, me: created.me };
  const members = [host];
  for (let n = 1; n < 10; n++) {
    const key = newKey();
    const joined = await ok<{ me: RoomMember }>(
      `입장 ${n}`,
      call("POST", `/invites/${created.room.inviteCode}/members`, key, { nickname: `접속${n}` }),
    );
    members.push({ key, me: joined.me });
  }
  const participants: Participant[] = [];
  for (let n = 0; n < participantCount; n++) {
    participants.push((await registerParticipant(host, created.room.id, `참${n}`)).participant);
  }
  return { room: created.room, host, members, participants };
}

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
