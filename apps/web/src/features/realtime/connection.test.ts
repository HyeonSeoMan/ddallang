import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { type FakeClock, useFakeClock } from "@/test/fake-clock";
import type { Coordinator } from "./coordinator";
import {
  type ConnectionDeps,
  type ConnectionPhase,
  createRoomConnection,
  DEFAULT_LIMIT_WAIT_MS,
  HIDDEN_LIMIT_MS,
  RECOVERED_NOTICE_MS,
  reconnectDelay,
  STALE_AFTER_MS,
  type StreamHandlers,
} from "./connection";
import type { EventStreamEnd } from "./event-stream";
import type { SseItem } from "./sse-parser";

const T0 = Date.parse("2026-11-08T03:00:00.000Z");
const flush = async () => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
};

interface Stream {
  handlers: StreamHandlers;
  resolve(end: EventStreamEnd): void;
}
interface FakeCoordinator {
  api: Coordinator;
  epoch: number;
  hooks: { onCycleSucceeded(): void; onRefreshFailed(error: unknown): void };
  handled: SseItem[];
  disposed: boolean;
}

function harness(options: { random?: number; online?: boolean } = {}) {
  let online = options.online ?? true;
  let visible = true;
  const listeners: Record<string, Set<() => void>> = {
    online: new Set(),
    offline: new Set(),
    visibilitychange: new Set(),
  };
  const streams: Stream[] = [];
  const coordinators: FakeCoordinator[] = [];
  const phases: ConnectionPhase[] = [];
  const connected: boolean[] = [];
  let epoch = 0;

  const deps: ConnectionDeps = {
    openStream: (handlers) =>
      new Promise<EventStreamEnd>((resolve) => {
        streams.push({ handlers, resolve });
        handlers.signal.addEventListener("abort", () => resolve({ kind: "aborted" }));
      }),
    createCoordinator: (e, hooks) => {
      const fake: FakeCoordinator = {
        epoch: e,
        hooks,
        handled: [],
        disposed: false,
        api: {
          handle: (item) => fake.handled.push(item),
          dispose: () => {
            fake.disposed = true;
          },
          state: { seen: 0, dirty: false, running: false, ready: false },
        },
      };
      coordinators.push(fake);
      return fake.api;
    },
    setConnected: (value) => connected.push(value),
    startEpoch: () => ++epoch,
    setPhase: (phase) => phases.push(phase),
    now: () => Date.now(),
    random: () => options.random ?? 0.5,
    env: {
      on: (type, listener) => {
        listeners[type]!.add(listener);
        return () => listeners[type]!.delete(listener);
      },
      isOnline: () => online,
      isVisible: () => visible,
    },
  };

  const connection = createRoomConnection(deps);
  const emit = (type: string) => listeners[type]!.forEach((l) => l());
  const readyItem: SseItem = { kind: "event", id: null, event: "ready", data: { revision: 1 }, malformed: false };
  return {
    connection,
    streams,
    coordinators,
    phases,
    connected,
    listeners,
    lastPhase: () => phases[phases.length - 1],
    lastConnected: () => connected[connected.length - 1],
    setOnline(value: boolean) {
      online = value;
      emit(value ? "online" : "offline");
    },
    setVisible(value: boolean) {
      visible = value;
      emit("visibilitychange");
    },
    /** 스트림 i를 열고 ready를 받는다. */
    async openAndReady(index = streams.length - 1) {
      streams[index]!.handlers.onOpen();
      streams[index]!.handlers.onActivity();
      streams[index]!.handlers.onItem(readyItem);
      await flush();
    },
    cycleOk: (index = coordinators.length - 1) => coordinators[index]!.hooks.onCycleSucceeded(),
    cycleFail: (error: unknown, index = coordinators.length - 1) => coordinators[index]!.hooks.onRefreshFailed(error),
    async end(end: EventStreamEnd, index = streams.length - 1) {
      streams[index]!.resolve(end);
      await flush();
    },
  };
}

describe("연결 제어·재연결", () => {
  let clock: FakeClock;
  beforeEach(() => {
    clock = useFakeClock(T0);
  });
  afterEach(() => clock.restore());

  it("reconnectDelay: 1초에서 시작해 2배씩 늘고 최대 30초, ±20% 무작위", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 9].map((n) => reconnectDelay(n, 0.5))).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000,
    ]);
    expect(reconnectDelay(0, 0)).toBe(800);
    expect(reconnectDelay(0, 0.999999)).toBe(1200);
    expect(reconnectDelay(5, 0)).toBe(24000);
    expect(reconnectDelay(5, 0.999999)).toBe(36000);
  });

  describe("연결과 세대", () => {
    it("start 뒤 연결 중이고, 열리면 connected, ready마다 새 세대와 코디네이터를 만든다", async () => {
      const h = harness();
      h.connection.start();
      expect(h.lastPhase()).toBe("connecting");
      expect(h.streams).toHaveLength(1);
      await h.openAndReady();
      expect(h.lastConnected()).toBe(true);
      expect(h.coordinators).toHaveLength(1);
      expect(h.coordinators[0]!.epoch).toBe(1);
      expect(h.coordinators[0]!.handled[0]).toMatchObject({ event: "ready" });

      // 같은 연결에서 두 번째 ready: 이전 코디네이터는 버리고 새 세대로 전체 재동기화한다.
      h.streams[0]!.handlers.onItem({ kind: "event", id: null, event: "ready", data: { revision: 5 }, malformed: false });
      expect(h.coordinators).toHaveLength(2);
      expect(h.coordinators[0]!.disposed).toBe(true);
      expect(h.coordinators[1]!.epoch).toBe(2);
    });

    it("이벤트는 현재 코디네이터로 전달된다", async () => {
      const h = harness();
      h.connection.start();
      await h.openAndReady();
      const change: SseItem = { kind: "event", id: "2", event: "transaction.created", data: { revision: 2 }, malformed: false };
      h.streams[0]!.handlers.onItem(change);
      expect(h.coordinators[0]!.handled).toContain(change);
    });

    it("첫 갱신 주기가 성공하면 connected 단계가 된다(처음에는 복구 표시 없음)", async () => {
      const h = harness();
      h.connection.start();
      await h.openAndReady();
      h.cycleOk();
      expect(h.lastPhase()).toBe("connected");
      expect(h.phases).not.toContain("recovered");
    });
  });

  describe("끊김 판정과 재연결", () => {
    it("[AC-SYS-001-2] 스트림이 끝나면 즉시 disconnected(스냅샷 비움)이고 1초(±20%) 뒤 다시 연결한다", async () => {
      const h = harness();
      h.connection.start();
      await h.openAndReady();
      h.cycleOk();
      await h.end({ kind: "ended" });
      expect(h.lastConnected()).toBe(false); // 데이터 영역 즉시 숨김
      expect(h.lastPhase()).toBe("reconnecting");
      expect(h.coordinators[0]!.disposed).toBe(true);
      await clock.advance(999);
      expect(h.streams).toHaveLength(1);
      await clock.advance(1);
      expect(h.streams).toHaveLength(2);
    });

    it("마지막 수신 40초 뒤에도 아무것도 없으면 끊김으로 보고 스트림을 중단한다", async () => {
      const h = harness();
      h.connection.start();
      await h.openAndReady();
      await clock.advance(STALE_AFTER_MS - 1);
      expect(h.lastConnected()).toBe(true);
      await clock.advance(1);
      expect(h.lastConnected()).toBe(false);
      expect(h.streams[0]!.handlers.signal.aborted).toBe(true);
    });

    it("어떤 수신(주석 줄 포함)이든 40초 시한을 다시 시작한다", async () => {
      const h = harness();
      h.connection.start();
      await h.openAndReady();
      await clock.advance(30_000);
      h.streams[0]!.handlers.onActivity(); // 하트비트 주석
      await clock.advance(30_000);
      expect(h.lastConnected()).toBe(true);
      await clock.advance(10_000);
      expect(h.lastConnected()).toBe(false);
    });

    it("재연결 간격: 1·2·4·8·16·30·30초로 늘어난다", async () => {
      const h = harness();
      h.connection.start();
      for (const expected of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
        await h.end({ kind: "network" });
        const before = h.streams.length;
        await clock.advance(expected - 1);
        expect(h.streams.length).toBe(before);
        await clock.advance(1);
        expect(h.streams.length).toBe(before + 1);
      }
    });

    it("무작위 ±20%가 간격에 반영된다", async () => {
      const low = harness({ random: 0 });
      low.connection.start();
      await low.end({ kind: "network" });
      await clock.advance(799);
      expect(low.streams).toHaveLength(1);
      await clock.advance(1);
      expect(low.streams).toHaveLength(2);
    });

    it("갱신만 실패하는 반복에서는 간격이 초기화되지 않고 계속 늘어난다", async () => {
      const h = harness();
      h.connection.start();
      const delays = [1000, 2000, 4000];
      for (const delay of delays) {
        await h.openAndReady(); // 스트림 연결은 성공
        h.cycleFail(new ApiError({ status: 503, code: "X", message: "m" })); // 갱신 실패
        expect(h.lastConnected()).toBe(false);
        expect(h.streams[h.streams.length - 1]!.handlers.signal.aborted).toBe(true);
        const before = h.streams.length;
        await clock.advance(delay - 1);
        expect(h.streams).toHaveLength(before);
        await clock.advance(1);
        expect(h.streams).toHaveLength(before + 1);
      }
    });

    it("재연결 뒤 첫 갱신 주기가 성공해야 간격이 1초로 돌아가고 복구 표시가 3초 보인다", async () => {
      const h = harness();
      h.connection.start();
      await h.end({ kind: "network" });
      await clock.advance(1000);
      await h.end({ kind: "network" });
      await clock.advance(2000); // 세 번째 연결
      await h.openAndReady();
      h.cycleOk();
      expect(h.lastPhase()).toBe("recovered");
      await clock.advance(RECOVERED_NOTICE_MS - 1);
      expect(h.lastPhase()).toBe("recovered");
      await clock.advance(1);
      expect(h.lastPhase()).toBe("connected");

      // 다음 끊김은 다시 1초부터 시작한다.
      await h.end({ kind: "ended" });
      const before = h.streams.length;
      await clock.advance(1000);
      expect(h.streams).toHaveLength(before + 1);
    });

    it("끊김 중에 도착한 이전 연결의 이벤트·응답은 새 연결에 영향이 없다", async () => {
      const h = harness();
      h.connection.start();
      await h.openAndReady();
      const staleHandlers = h.streams[0]!.handlers;
      const staleCoordinator = h.coordinators[0]!;
      await h.end({ kind: "ended" });
      await clock.advance(1000);
      await h.openAndReady(1);
      const stale: SseItem = { kind: "event", id: "9", event: "transaction.created", data: { revision: 9 }, malformed: false };
      staleHandlers.onItem(stale);
      staleHandlers.onActivity();
      expect(h.coordinators[1]!.handled).not.toContain(stale);
      expect(staleCoordinator.handled).not.toContain(stale);
      staleCoordinator.hooks.onCycleSucceeded(); // 이전 연결의 늦은 성공 알림도 무시
      expect(h.lastPhase()).not.toBe("connected");
    });

    it("재접속 직후 새 세대가 시작되며 이전 스냅샷은 갱신 성공 전에 보이지 않는다(connected=false → 새 세대)", async () => {
      const h = harness();
      h.connection.start();
      await h.openAndReady();
      h.cycleOk();
      await h.end({ kind: "broken" });
      expect(h.lastConnected()).toBe(false);
      await clock.advance(1000);
      h.streams[1]!.handlers.onOpen();
      h.streams[1]!.handlers.onItem({ kind: "event", id: null, event: "ready", data: { revision: 3 }, malformed: false });
      expect(h.coordinators[1]!.epoch).toBe(2); // 새 세대. 스냅샷은 startEpoch가 비운다
      expect(h.lastPhase()).toBe("reconnecting"); // 첫 갱신 성공 전
    });
  });

  describe("열기 전 오류", () => {
    it.each([401, 404])("%s는 재시도 없이 접근 불가 상태가 된다", async (status) => {
      const h = harness();
      h.connection.start();
      await h.end({ kind: "rejected", error: new ApiError({ status, code: "X", message: "m" }) });
      expect(h.lastPhase()).toBe("inaccessible");
      expect(h.lastConnected()).toBe(false);
      await clock.advance(5 * 60_000);
      expect(h.streams).toHaveLength(1);
      h.setOnline(true); // 이벤트로도 다시 시도하지 않는다
      h.setVisible(true);
      expect(h.streams).toHaveLength(1);
    });

    it("갱신 중 401·404도 재시도 없이 접근 불가다", async () => {
      const h = harness();
      h.connection.start();
      await h.openAndReady();
      h.cycleFail(new ApiError({ status: 404, code: "ROOM_NOT_FOUND", message: "m" }));
      expect(h.lastPhase()).toBe("inaccessible");
      await clock.advance(60_000);
      expect(h.streams).toHaveLength(1);
    });

    it("429는 Retry-After(30초) 이상 간격으로만 재시도하고 한도 안내 상태다", async () => {
      const h = harness();
      h.connection.start();
      await h.end({
        kind: "rejected",
        error: new ApiError({ status: 429, code: "CONNECTION_LIMIT_EXCEEDED", message: "m", retryAfterSeconds: 30 }),
      });
      expect(h.lastPhase()).toBe("limit");
      expect(h.lastConnected()).toBe(false);
      await clock.advance(29_999);
      expect(h.streams).toHaveLength(1);
      await clock.advance(1);
      expect(h.streams).toHaveLength(2);
    });

    it("429 대기 중에는 online·visibilitychange로 앞당겨 시도하지 않는다", async () => {
      const h = harness();
      h.connection.start();
      await h.end({
        kind: "rejected",
        error: new ApiError({ status: 429, code: "CONNECTION_LIMIT_EXCEEDED", message: "m", retryAfterSeconds: 30 }),
      });
      h.setVisible(false);
      h.setVisible(true);
      h.setOnline(true);
      expect(h.streams).toHaveLength(1);
    });

    it("Retry-After가 없어도 기본 30초를 지키고, 더 긴 값은 그대로 따른다", async () => {
      const h = harness();
      h.connection.start();
      await h.end({ kind: "rejected", error: new ApiError({ status: 429, code: "X", message: "m" }) });
      await clock.advance(DEFAULT_LIMIT_WAIT_MS);
      expect(h.streams).toHaveLength(2);
      await h.end({
        kind: "rejected",
        error: new ApiError({ status: 429, code: "X", message: "m", retryAfterSeconds: 90 }),
      });
      await clock.advance(89_999);
      expect(h.streams).toHaveLength(2);
      await clock.advance(1);
      expect(h.streams).toHaveLength(3);
    });

    it("5xx와 네트워크 오류는 일반 간격으로 계속 재시도한다", async () => {
      const h = harness();
      h.connection.start();
      await h.end({ kind: "rejected", error: new ApiError({ status: 503, code: "X", message: "m" }) });
      expect(h.lastPhase()).toBe("reconnecting");
      await clock.advance(1000);
      expect(h.streams).toHaveLength(2);
    });
  });

  describe("즉시 시도(online·visibilitychange)", () => {
    it("offline이면 즉시 끊김(데이터 숨김)이고 재시도 타이머 없이 기다리다 online에서 바로 연결한다", async () => {
      const h = harness();
      h.connection.start();
      await h.openAndReady();
      h.cycleOk();
      h.setOnline(false);
      expect(h.lastConnected()).toBe(false);
      expect(h.lastPhase()).toBe("offline");
      await clock.advance(10 * 60_000);
      expect(h.streams).toHaveLength(1); // 오프라인 동안 시도하지 않는다
      h.setOnline(true);
      expect(h.streams).toHaveLength(2);
    });

    it("처음부터 오프라인이면 연결하지 않고 offline이다", async () => {
      const h = harness({ online: false });
      h.connection.start();
      expect(h.streams).toHaveLength(0);
      expect(h.lastPhase()).toBe("offline");
      h.setOnline(true);
      expect(h.streams).toHaveLength(1);
    });

    it("백오프 대기 중 online·visibilitychange(보임)는 기다리지 않고 즉시 시도한다", async () => {
      const h = harness();
      h.connection.start();
      await h.end({ kind: "network" });
      h.setOnline(true);
      expect(h.streams).toHaveLength(2);

      await h.end({ kind: "network" });
      h.setVisible(false);
      h.setVisible(true);
      expect(h.streams).toHaveLength(3);
    });

    it("이미 연결 중이거나 건강한 연결이면 새로 시작하지 않는다", async () => {
      const h = harness();
      h.connection.start();
      h.setOnline(true);
      h.setVisible(true);
      expect(h.streams).toHaveLength(1); // 연결 시도 중
      await h.openAndReady();
      await clock.advance(5000);
      h.setOnline(true);
      h.setVisible(false);
      await clock.advance(1000);
      h.setVisible(true);
      expect(h.streams).toHaveLength(1);
      expect(h.lastConnected()).toBe(true);
    });

    it(`숨김이 ${HIDDEN_LIMIT_MS / 1000}초를 넘었다가 보이면 즉시 끊김 처리하고 바로 재연결한다`, async () => {
      const h = harness();
      h.connection.start();
      await h.openAndReady();
      h.cycleOk();
      h.setVisible(false);
      clock.setSystemTime(Date.now() + HIDDEN_LIMIT_MS + 1); // 숨겨진 동안 타이머는 돌지 않았다
      h.setVisible(true);
      expect(h.connected).toContain(false);
      expect(h.coordinators[0]!.disposed).toBe(true);
      expect(h.streams).toHaveLength(2); // 대기 없이 즉시
    });

    it("숨김이 15초 이내면 연결을 유지한다", async () => {
      const h = harness();
      h.connection.start();
      await h.openAndReady();
      h.setVisible(false);
      await clock.advance(HIDDEN_LIMIT_MS);
      h.streams[0]!.handlers.onActivity();
      h.setVisible(true);
      expect(h.streams).toHaveLength(1);
      expect(h.lastConnected()).toBe(true);
    });

    it("마지막 수신이 40초를 넘었으면 보이는 즉시 끊김 처리한다", async () => {
      const h = harness();
      h.connection.start();
      await h.openAndReady();
      clock.setSystemTime(Date.now() + STALE_AFTER_MS + 1); // 타이머를 돌리지 않고 시각만 지났다
      h.setOnline(true);
      expect(h.streams).toHaveLength(2);
      expect(h.coordinators[0]!.disposed).toBe(true);
    });
  });

  describe("정지", () => {
    it("stop은 스트림을 중단하고 타이머·이벤트 구독을 정리하며 더 이상 연결하지 않는다", async () => {
      const h = harness();
      h.connection.start();
      await h.openAndReady();
      h.connection.stop();
      expect(h.streams[0]!.handlers.signal.aborted).toBe(true);
      expect(h.lastConnected()).toBe(false);
      expect(h.listeners.online!.size + h.listeners.offline!.size + h.listeners.visibilitychange!.size).toBe(0);
      await clock.advance(10 * 60_000);
      expect(h.streams).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("백오프 대기 중 stop하면 예약된 재연결이 취소된다", async () => {
      const h = harness();
      h.connection.start();
      await h.end({ kind: "network" });
      h.connection.stop();
      await clock.advance(60_000);
      expect(h.streams).toHaveLength(1);
    });
  });
});
