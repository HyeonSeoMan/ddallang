// 상태 있는 가짜 서버(FD-16): 갱신 주기 시나리오 전용이며 작게 유지한다.
// `revision`·이벤트·조회 응답이 서로 맞아야 하는 시험만 쓴다. 순손익·정산은 시험이 정한 값을 그대로 돌려준다.
import { delay, http, HttpResponse, type JsonBodyType } from "msw";
import type { Balance, Participant, Room, Settlement, Transaction } from "@/lib/api";
import { createFakeSse, type FakeSse } from "./fake-sse";
import * as fixtures from "./fixtures";
import { apiUrl, errorResponse } from "./handlers";

export type ReadEndpoint = "room" | "participants" | "balances" | "transactions" | "settlement";

export interface FakeBackend {
  room: Room;
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
  /** 마지막 `/events` 연결. 시험이 이벤트를 밀어 넣는다. */
  stream: FakeSse | null;
  /** 변경 하나를 반영한다: `revision`을 올리고 이벤트를 스트림으로 보낸다. */
  commit(event: string, extra?: Record<string, unknown>): number;
  handlers: ReturnType<typeof http.get>[];
}

export function createFakeBackend(): FakeBackend {
  const backend: FakeBackend = {
    room: structuredClone(fixtures.room),
    participants: structuredClone(fixtures.participants),
    balances: structuredClone(fixtures.balances),
    transactions: structuredClone(fixtures.transactions),
    settlement: structuredClone(fixtures.expectedSettlement),
    revision: 1,
    latency: {},
    failing: new Set(),
    requests: { room: 0, participants: 0, balances: 0, transactions: 0, settlement: 0 },
    stream: null,
    commit(event, extra = {}) {
      backend.revision += 1;
      backend.stream?.pushEvent({
        id: backend.revision,
        event,
        data: {
          roomId: backend.room.id,
          revision: backend.revision,
          serverTime: new Date().toISOString(),
          ...extra,
        },
      });
      return backend.revision;
    },
    handlers: [],
  };

  const read = (endpoint: ReadEndpoint, path: string, body: () => JsonBodyType) =>
    http.get(apiUrl(`/rooms/${fixtures.room.id}${path}`), async () => {
      backend.requests[endpoint] += 1;
      const wait = backend.latency[endpoint];
      if (wait) await delay(wait);
      if (backend.failing.has(endpoint)) return new HttpResponse(null, { status: 503 });
      return HttpResponse.json(structuredClone(body()));
    });

  backend.handlers = [
    read("room", "", () => ({ room: backend.room, me: fixtures.hostMember })),
    read("participants", "/participants", () => ({ participants: backend.participants })),
    read("balances", "/balances", () => ({ balances: backend.balances })),
    read("transactions", "/transactions", () => ({
      transactions: backend.transactions.slice(0, 20),
      nextCursor: null,
    })),
    read("settlement", "/settlement", () => ({ settlement: backend.settlement })),
    http.get(apiUrl(`/rooms/${fixtures.room.id}/events`), () => {
      const sse = createFakeSse();
      backend.stream = sse;
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
    http.get(apiUrl("/rooms/:roomId/*"), () => errorResponse("ROOM_NOT_FOUND")),
  ] as ReturnType<typeof http.get>[];

  return backend;
}
