// 갱신 주기의 조회(S5 §6.4): 5개, 방장은 대기 중인 이어받기 요청까지 6개(FD-25, S5-C2). 한꺼번에 시작하고,
// 모두 2xx일 때만 하나의 스냅샷으로 만든다.
import {
  type ApiClient,
  type ApiResponse,
  type Balance,
  bearerHeader,
  type Claim,
  type Participant,
  type Room,
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
  /**
   * 요청자가 방장인가. 방장만 대기 중인 이어받기 요청 목록을 함께 조회한다(비방장은 조회하지 않는다). 방장 여부는
   * 바뀌지 않으므로(S1 I1) 입장 응답의 `me.isHost`를 쓴다.
   */
  isHost: boolean;
}

export type SnapshotResult =
  | { ok: true; snapshot: RoomSnapshot }
  /** 방 `status`와 정산 `kind`가 서로 다른 시점이다. 반영하지 않고 다시 갱신한다(S4 §6.4). */
  | { ok: false; reason: "status-mismatch" };

/**
 * 5개(방장 6개)를 동시에 요청한다. 하나라도 실패하면(네트워크·10초 초과·4xx·5xx) 첫 오류를 던지고 일부도 반영하지 않는다.
 */
export async function fetchRoomSnapshot(
  api: ApiClient,
  request: SnapshotRequest,
  signal?: AbortSignal,
): Promise<SnapshotResult> {
  const base = `/rooms/${encodeURIComponent(request.roomId)}`;
  const headers = bearerHeader(request.identityKey);
  // 하나라도 실패하면 그 즉시 실패를 알리고(나머지를 기다리지 않는다) 남은 요청을 중단한다.
  // 실패를 늦게 알리면 그동안 이전 스냅샷과 `connected`가 유지되어 오래된 데이터가 보인다(S5 §6.5).
  const inner = new AbortController();
  const forward = () => inner.abort();
  if (signal?.aborted) inner.abort();
  else signal?.addEventListener("abort", forward, { once: true });
  const getInner = <T>(path: string, query?: Record<string, string | undefined>) =>
    api.request<T>({ method: "GET", path: `${base}${path}`, query, headers, signal: inner.signal });

  let responses: [
    ApiResponse<{ room: Room; me: Participant }>,
    ApiResponse<{ participants: Participant[] }>,
    ApiResponse<{ balances: Balance[] }>,
    ApiResponse<{ transactions: Transaction[]; nextCursor: string | null }>,
    ApiResponse<{ settlement: Settlement }>,
    ApiResponse<{ claims: Claim[] }> | null,
  ];
  try {
    responses = await Promise.all([
      getInner<{ room: Room; me: Participant }>(""),
      getInner<{ participants: Participant[] }>("/participants"),
      getInner<{ balances: Balance[] }>("/balances"),
      getInner<{ transactions: Transaction[]; nextCursor: string | null }>("/transactions", {
        participantId: request.participantId ?? undefined,
      }),
      getInner<{ settlement: Settlement }>("/settlement"),
      request.isHost ? getInner<{ claims: Claim[] }>("/claims") : Promise.resolve(null),
    ]);
  } catch (error) {
    inner.abort();
    throw error;
  } finally {
    signal?.removeEventListener("abort", forward);
  }
  const [room, participants, balances, transactions, settlement, claims] = responses.map((r) => r?.data ?? null) as [
    { room: Room; me: Participant },
    { participants: Participant[] },
    { balances: Balance[] },
    { transactions: Transaction[]; nextCursor: string | null },
    { settlement: Settlement },
    { claims: Claim[] } | null,
  ];

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
      transactionFilter: request.participantId,
      settlement: settlement.settlement,
      claims: claims?.claims ?? [],
    },
  };
}
