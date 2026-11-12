// 갱신 주기의 5개 조회(S5 §6.4): 한꺼번에 시작하고, 모두 2xx일 때만 하나의 스냅샷으로 만든다.
import {
  type ApiClient,
  type ApiResponse,
  type Balance,
  bearerHeader,
  type Participant,
  type Room,
  type RoomMember,
  type Settlement,
  type Transaction,
} from "@/lib/api";
import type { RoomSnapshot } from "@/features/room/state";

export interface SnapshotRequest {
  roomId: string;
  identityKey: string;
  /** 현재 선택된 참여자 필터. 거래 목록의 새 순회(첫 페이지)가 이 필터를 유지한다(AC-VIEW-005-7). */
  participantId: string | null;
  /** 이 조회를 시작한 연결 세대. 스냅샷에 기록되어 늦은 응답을 걸러내는 데 쓴다. */
  epoch: number;
}

export type SnapshotResult =
  | { ok: true; snapshot: RoomSnapshot }
  /** 방 `status`와 정산 `kind`가 서로 다른 시점이다. 반영하지 않고 다시 갱신한다(S4 §6.4). */
  | { ok: false; reason: "status-mismatch" };

/**
 * 5개를 동시에 요청한다. 하나라도 실패하면(네트워크·10초 초과·4xx·5xx) 첫 오류를 던지고 일부도 반영하지 않는다.
 */
export async function fetchRoomSnapshot(
  api: ApiClient,
  request: SnapshotRequest,
): Promise<SnapshotResult> {
  const base = `/rooms/${encodeURIComponent(request.roomId)}`;
  const headers = bearerHeader(request.identityKey);
  const get = <T>(path: string, query?: Record<string, string | undefined>) =>
    api.request<T>({ method: "GET", path: `${base}${path}`, query, headers });

  const results = await Promise.allSettled([
    get<{ room: Room; me: RoomMember }>(""),
    get<{ participants: Participant[] }>("/participants"),
    get<{ balances: Balance[] }>("/balances"),
    get<{ transactions: Transaction[]; nextCursor: string | null }>("/transactions", {
      participantId: request.participantId ?? undefined,
    }),
    get<{ settlement: Settlement }>("/settlement"),
  ]);

  // 하나라도 실패했으면 첫 오류를 던지고 일부도 반영하지 않는다.
  for (const result of results) {
    if (result.status === "rejected") throw result.reason;
  }
  const [roomResult, participantsResult, balancesResult, transactionsResult, settlementResult] = results;
  const room = (roomResult as PromiseFulfilledResult<ApiResponse<{ room: Room; me: RoomMember }>>).value.data;
  const participants = (participantsResult as PromiseFulfilledResult<ApiResponse<{ participants: Participant[] }>>).value.data;
  const balances = (balancesResult as PromiseFulfilledResult<ApiResponse<{ balances: Balance[] }>>).value.data;
  const transactions = (
    transactionsResult as PromiseFulfilledResult<
      ApiResponse<{ transactions: Transaction[]; nextCursor: string | null }>
    >
  ).value.data;
  const settlement = (settlementResult as PromiseFulfilledResult<ApiResponse<{ settlement: Settlement }>>).value.data;

  const expectedKind = room.room.status === "ENDED" ? "FINAL" : "EXPECTED";
  if (settlement.settlement.kind !== expectedKind) return { ok: false, reason: "status-mismatch" };

  return {
    ok: true,
    snapshot: {
      epoch: request.epoch,
      room: room.room,
      me: room.me,
      participants: participants.participants,
      balances: balances.balances,
      transactions: transactions.transactions,
      nextCursor: transactions.nextCursor,
      settlement: settlement.settlement,
    },
  };
}
