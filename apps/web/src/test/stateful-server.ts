// 상태 있는 가짜 서버(FD-16): 갱신 주기 시나리오 전용이며 작게 유지한다.
// `revision`·이벤트·조회 응답이 서로 맞아야 하는 시험만 쓴다. 순손익·정산은 시험이 정한 값을 그대로 돌려준다.
import { delay, type HttpHandler, http, HttpResponse, type JsonBodyType } from "msw";
import type { Balance, Participant, Room, RoomMember, Settlement, Transaction } from "@/lib/api";
import { createFakeSse, type FakeSse } from "./fake-sse";
import * as fixtures from "./fixtures";
import { apiUrl, errorResponse } from "./handlers";

export type WriteOperation =
  | "createTransaction"
  | "updateTransaction"
  | "deleteTransaction"
  | "registerParticipant"
  | "setParticipantStatus"
  | "endGame";

export type ReadEndpoint = "room" | "participants" | "balances" | "transactions" | "settlement";

export interface FakeBackend {
  room: Room;
  /** 방 조회가 돌려주는 접속자(기본 방장). 비방장 시험은 서버 응답을 바꾼다. */
  me: RoomMember;
  participants: Participant[];
  balances: Balance[];
  transactions: Transaction[];
  settlement: Settlement;
  revision: number;
  /** 엔드포인트별 응답 지연(ms). */
  latency: Partial<Record<ReadEndpoint, number>>;
  /** 이 엔드포인트가 5xx로 실패한다. */
  failing: Set<ReadEndpoint>;
  /** 지금까지 받은 조회 요청 수(엔드포인트별). */
  requests: Record<ReadEndpoint, number>;
  /** 조회 엔드포인트별로 받은 쿼리 문자열 기록(정산·손익·방 조회에 쿼리가 없는지 검증용). */
  searches: Record<ReadEndpoint, string[]>;
  /** 거래 목록 조회 쿼리 기록(필터·커서 검증용). */
  transactionQueries: Array<{ participantId: string | null; cursor: string | null }>;
  /** 마지막 `/events` 연결. 시험이 이벤트를 밀어 넣는다. */
  stream: FakeSse | null;
  /** 지금까지 열린 모든 `/events` 연결(접속자 여럿). 변경 이벤트는 모든 연결로 간다. */
  streams: FakeSse[];
  /** true이면 `/events`가 503으로 실패한다(특정 접속자를 끊어 둘 때). */
  blockEvents: boolean;
  /** 변경(쓰기) 요청을 처리한 뒤·이벤트를 보내기 전에 호출된다. 시험이 순손익·정산 같은 파생 값을 정한다. */
  afterChange: (() => void) | null;
  /** 이 쓰기 작업은 서버에 반영하되 응답을 유실시킨다(네트워크 오류). 한 번 쓰이면 해제된다. */
  dropResponseOnce: Set<WriteOperation>;
  /** 쓰기 요청이 받은 Idempotency-Key 기록. */
  writes: Array<{ operation: string; key: string | null }>;
  /** 변경 하나를 반영한다: `revision`을 올리고 이벤트를 스트림으로 보낸다. */
  commit(event: string, extra?: Record<string, unknown>): number;
  handlers: HttpHandler[];
}

export function createFakeBackend(): FakeBackend {
  const backend: FakeBackend = {
    room: structuredClone(fixtures.room),
    me: structuredClone(fixtures.hostMember),
    participants: structuredClone(fixtures.participants),
    balances: structuredClone(fixtures.balances),
    transactions: structuredClone(fixtures.transactions),
    settlement: structuredClone(fixtures.expectedSettlement),
    revision: 1,
    latency: {},
    failing: new Set(),
    requests: { room: 0, participants: 0, balances: 0, transactions: 0, settlement: 0 },
    searches: { room: [], participants: [], balances: [], transactions: [], settlement: [] },
    transactionQueries: [],
    stream: null,
    streams: [],
    blockEvents: false,
    afterChange: null,
    dropResponseOnce: new Set(),
    writes: [],
    commit(event, extra = {}) {
      backend.revision += 1;
      for (const stream of backend.streams) {
        stream.pushEvent({
          id: backend.revision,
          event,
          data: {
            roomId: backend.room.id,
            revision: backend.revision,
            serverTime: new Date().toISOString(),
            ...extra,
          },
        });
      }
      return backend.revision;
    },
    handlers: [],
  };

  let sequence = 100;
  const base = `/rooms/${fixtures.room.id}`;
  /** 변경을 서버에 반영한 뒤(파생 값 갱신 → 이벤트) 응답을 만든다. 응답 유실 설정이면 반영하고도 네트워크 오류를 낸다. */
  const write = (
    operation: WriteOperation,
    request: Request,
    apply: () => { event: string; extra?: Record<string, unknown>; response: () => Response },
  ): Response => {
    backend.writes.push({ operation, key: request.headers.get("Idempotency-Key") });
    const { event, extra, response } = apply();
    backend.afterChange?.();
    backend.commit(event, extra);
    if (backend.dropResponseOnce.delete(operation)) return HttpResponse.error();
    return response();
  };

  const read = (endpoint: ReadEndpoint, path: string, body: () => JsonBodyType) =>
    http.get(apiUrl(`/rooms/${fixtures.room.id}${path}`), async ({ request }) => {
      backend.requests[endpoint] += 1;
      backend.searches[endpoint].push(new URL(request.url).search);
      const wait = backend.latency[endpoint];
      if (wait) await delay(wait);
      if (backend.failing.has(endpoint)) return new HttpResponse(null, { status: 503 });
      return HttpResponse.json(structuredClone(body()));
    });

  backend.handlers = [
    read("room", "", () => ({ room: backend.room, me: backend.me })),
    read("participants", "/participants", () => ({ participants: backend.participants })),
    read("balances", "/balances", () => ({ balances: backend.balances })),
    // 거래 목록: 필터(`participantId`)와 20건 단위 커서(`c<offset>`)를 흉내 낸다. 서버의 정렬 규칙은 다시 구현하지 않고
    // 시험이 정한 `backend.transactions` 순서를 그대로 쓴다. `c-bad` 같은 커서는 cursor 오류(422)다.
    http.get(apiUrl(`/rooms/${fixtures.room.id}/transactions`), async ({ request }) => {
      backend.requests.transactions += 1;
      const url = new URL(request.url);
      const participantId = url.searchParams.get("participantId");
      const cursor = url.searchParams.get("cursor");
      backend.transactionQueries.push({ participantId, cursor });
      backend.searches.transactions.push(url.search);
      const wait = backend.latency.transactions;
      if (wait) await delay(wait);
      if (backend.failing.has("transactions")) return new HttpResponse(null, { status: 503 });
      let offset = 0;
      if (cursor !== null) {
        const match = /^c(\d+)$/.exec(cursor);
        if (!match) {
          return errorResponse("VALIDATION_FAILED", { details: [{ field: "cursor", code: "INVALID_VALUE" }] });
        }
        offset = Number(match[1]);
      }
      const all = participantId
        ? backend.transactions.filter((t) => t.payerId === participantId || t.payeeId === participantId)
        : backend.transactions;
      const page = all.slice(offset, offset + 20);
      return HttpResponse.json({
        transactions: structuredClone(page),
        nextCursor: offset + 20 < all.length ? `c${offset + 20}` : null,
      });
    }),
    read("settlement", "/settlement", () => ({ settlement: backend.settlement })),
    http.get(apiUrl(`/rooms/${fixtures.room.id}/events`), () => {
      if (backend.blockEvents) return new HttpResponse(null, { status: 503 });
      const sse = createFakeSse();
      backend.stream = sse;
      backend.streams.push(sse);
      sse.pushEvent({
        event: "ready",
        data: {
          roomId: backend.room.id,
          revision: backend.revision,
          serverTime: new Date().toISOString(),
        },
      });
      return sse.response();
    }),
    // ---- 변경(쓰기) 요청: 서버의 비즈니스 규칙을 다시 구현하지 않고 목록·상태만 바꾸고 이벤트를 보낸다.
    http.post(apiUrl(`${base}/transactions`), async ({ request }) => {
      const body = (await request.json()) as Partial<Transaction>;
      return write("createTransaction", request, () => {
        const now = new Date().toISOString();
        const transaction: Transaction = {
          id: `t-${++sequence}`,
          payerId: body.payerId!,
          payeeId: body.payeeId!,
          amount: body.amount!,
          reason: body.reason ?? null,
          round: body.round ?? null,
          authorId: fixtures.hostMember.id,
          createdAt: now,
          updatedAt: now,
        };
        backend.transactions.unshift(transaction);
        return {
          event: "transaction.created",
          extra: { transactionId: transaction.id },
          response: () => HttpResponse.json({ transaction }, { status: 201 }),
        };
      });
    }),
    http.put(apiUrl(`${base}/transactions/:transactionId`), async ({ request, params }) => {
      const body = (await request.json()) as Partial<Transaction>;
      const target = backend.transactions.find((t) => t.id === params.transactionId);
      if (!target) return errorResponse("TRANSACTION_NOT_FOUND");
      return write("updateTransaction", request, () => {
        Object.assign(target, { amount: body.amount, reason: body.reason ?? null, round: body.round ?? null, updatedAt: new Date().toISOString() });
        return { event: "transaction.updated", extra: { transactionId: target.id }, response: () => HttpResponse.json({ transaction: target }) };
      });
    }),
    http.delete(apiUrl(`${base}/transactions/:transactionId`), ({ request, params }) => {
      const index = backend.transactions.findIndex((t) => t.id === params.transactionId);
      if (index < 0) return errorResponse("TRANSACTION_NOT_FOUND");
      return write("deleteTransaction", request, () => {
        const [removed] = backend.transactions.splice(index, 1);
        return {
          event: "transaction.deleted",
          extra: { transactionId: removed!.id },
          response: () => HttpResponse.json({ transactionId: removed!.id, deletedAt: new Date().toISOString() }),
        };
      });
    }),
    http.post(apiUrl(`${base}/participants`), async ({ request }) => {
      const body = (await request.json()) as { nickname: string };
      return write("registerParticipant", request, () => {
        const participant: Participant = {
          id: `p-${++sequence}`,
          roomId: backend.room.id,
          nickname: body.nickname,
          status: "ACTIVE",
          order: backend.participants.length + 1,
          createdAt: new Date().toISOString(),
        };
        backend.participants.push(participant);
        return { event: "participant.created", extra: { participantId: participant.id }, response: () => HttpResponse.json({ participant }, { status: 201 }) };
      });
    }),
    http.patch(apiUrl(`${base}/participants/:participantId`), async ({ request, params }) => {
      const body = (await request.json()) as { status: Participant["status"] };
      const target = backend.participants.find((p) => p.id === params.participantId);
      if (!target) return errorResponse("PARTICIPANT_NOT_FOUND");
      return write("setParticipantStatus", request, () => {
        target.status = body.status;
        return { event: "participant.status_changed", extra: { participantId: target.id }, response: () => HttpResponse.json({ participant: target }) };
      });
    }),
    http.post(apiUrl(`${base}/end`), ({ request }) => {
      if (backend.room.status === "ENDED") return errorResponse("GAME_ENDED", { message: "이미 종료된 게임입니다" });
      return write("endGame", request, () => {
        backend.room = { ...backend.room, status: "ENDED" };
        backend.settlement = { ...backend.settlement, kind: "FINAL" };
        return { event: "room.ended", response: () => HttpResponse.json({ roomId: backend.room.id, status: "ENDED" }) };
      });
    }),
    http.get(apiUrl("/rooms/:roomId/*"), () => errorResponse("ROOM_NOT_FOUND")),
  ] as HttpHandler[];

  return backend;
}
