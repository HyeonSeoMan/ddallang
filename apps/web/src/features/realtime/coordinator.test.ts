import { describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@/features/room/state";
import * as fixtures from "@/test/fixtures";
import { createCoordinator, mismatchRetryDelay } from "./coordinator";
import type { SnapshotResult } from "./snapshot";
import type { SseItem } from "./sse-parser";

function snapshot(epoch = 1, label = "x"): RoomSnapshot {
  return {
    epoch,
    room: { ...fixtures.room, name: label },
    me: fixtures.hostMember,
    participants: fixtures.participants,
    balances: fixtures.balances,
    transactions: fixtures.transactions,
    nextCursor: null,
    settlement: fixtures.expectedSettlement,
  };
}

const ev = (event: string, data: unknown, malformed = false): SseItem => ({
  kind: "event",
  id: null,
  event,
  data,
  malformed,
});
const ready = (revision: number) => ev("ready", { revision });
const change = (event: string, revision: number) => ev(event, { revision });
const beat = (revision: number) => ev("heartbeat", { revision });

interface Deferred {
  resolve(result: SnapshotResult): void;
  reject(error: unknown): void;
}

function setup(options: { apply?: (s: RoomSnapshot) => boolean } = {}) {
  const pending: Deferred[] = [];
  let started = 0;
  const applied: RoomSnapshot[] = [];
  const signals: AbortSignal[] = [];
  const fetchSnapshot = vi.fn((signal: AbortSignal) => {
    signals.push(signal);
    started += 1;
    return new Promise<SnapshotResult>((resolve, reject) => pending.push({ resolve, reject }));
  });
  const deps = {
    fetchSnapshot,
    applySnapshot: vi.fn((s: RoomSnapshot) => {
      const accepted = options.apply?.(s) ?? true;
      if (accepted) applied.push(s);
      return accepted;
    }),
    onCycleSucceeded: vi.fn(),
    onRefreshFailed: vi.fn(),
  };
  const coordinator = createCoordinator(deps);
  const succeed = async (label = "x", epoch = 1) => {
    pending.shift()!.resolve({ ok: true, snapshot: snapshot(epoch, label) });
    await flush();
  };
  return { coordinator, deps, applied, pending, succeed, signals, started: () => started };
}

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

describe("갱신 코디네이터", () => {
  it("ready: seen = R, dirty = 참으로 재동기화하고 성공하면 dirty가 거짓이 된다", async () => {
    const env = setup();
    env.coordinator.handle(ready(7));
    expect(env.coordinator.state).toMatchObject({ seen: 7, dirty: true, ready: true });
    expect(env.started()).toBe(1);
    await env.succeed();
    expect(env.coordinator.state).toMatchObject({ dirty: false, running: false });
    expect(env.applied).toHaveLength(1);
    expect(env.deps.onCycleSucceeded).toHaveBeenCalledOnce();
  });

  it("ready 이전의 항목은 무시한다(스트림 연결 → ready → 재동기화 순서)", () => {
    const env = setup();
    env.coordinator.handle(change("transaction.created", 5));
    env.coordinator.handle(beat(9));
    expect(env.started()).toBe(0);
    expect(env.coordinator.state.ready).toBe(false);
  });

  it("[AC-VIEW-005-1] 거래 생성 알림이 오면 5개 조회 전체를 다시 하고 스냅샷을 교체한다", async () => {
    const env = setup();
    env.coordinator.handle(ready(1));
    await env.succeed("처음");
    env.coordinator.handle(change("transaction.created", 2));
    expect(env.coordinator.state).toMatchObject({ seen: 2, dirty: true });
    await env.succeed("갱신 뒤");
    expect(env.applied.map((s) => s.room.name)).toEqual(["처음", "갱신 뒤"]);
  });

  it.each(["transaction.updated", "transaction.deleted", "participant.created", "participant.status_changed", "room.ended"])(
    "[AC-VIEW-005-2] %s 알림도 같은 갱신을 일으킨다",
    async (event) => {
      const env = setup();
      env.coordinator.handle(ready(1));
      await env.succeed();
      env.coordinator.handle(change(event, 2));
      expect(env.started()).toBe(2);
    },
  );

  it("중복(revision ≤ seen)과 순서가 뒤바뀐 과거 이벤트는 무시한다", async () => {
    const env = setup();
    env.coordinator.handle(ready(5));
    await env.succeed();
    env.coordinator.handle(change("transaction.created", 5)); // 중복
    env.coordinator.handle(change("transaction.created", 3)); // 과거
    expect(env.started()).toBe(1);
    env.coordinator.handle(change("transaction.created", 8)); // 앞선 것을 먼저 받는다
    env.coordinator.handle(change("transaction.created", 7)); // 뒤바뀜: 무시
    await env.succeed();
    expect(env.coordinator.state.seen).toBe(8);
    expect(env.started()).toBe(2);
  });

  it("누락(revision > seen + 1)도 갱신하고 seen을 올린다", async () => {
    const env = setup();
    env.coordinator.handle(ready(1));
    await env.succeed();
    env.coordinator.handle(change("transaction.created", 9));
    expect(env.coordinator.state.seen).toBe(9);
    expect(env.started()).toBe(2);
  });

  it("하트비트: H > seen이면 누락이므로 갱신하고, H ≤ seen이면 아무것도 하지 않는다", async () => {
    const env = setup();
    env.coordinator.handle(ready(4));
    await env.succeed();
    env.coordinator.handle(beat(4));
    env.coordinator.handle(beat(2));
    expect(env.started()).toBe(1);
    env.coordinator.handle(beat(6));
    expect(env.coordinator.state.seen).toBe(6);
    expect(env.started()).toBe(2);
  });

  it("알 수 없는 이벤트: revision이 있으면 변경 이벤트처럼, 없으면 dirty로 갱신한다", async () => {
    const env = setup();
    env.coordinator.handle(ready(1));
    await env.succeed();
    env.coordinator.handle(ev("future.event", { revision: 1 })); // 중복이라 무시
    expect(env.started()).toBe(1);
    env.coordinator.handle(ev("future.event", { revision: 2, extra: true }));
    await env.succeed();
    env.coordinator.handle(ev("future.event", { note: "no revision" }));
    expect(env.started()).toBe(3);
  });

  it("해석 실패(malformed)·잘린 이벤트는 dirty로 갱신한다(heartbeat 포함)", async () => {
    const env = setup();
    env.coordinator.handle(ready(1));
    await env.succeed();
    env.coordinator.handle(ev("transaction.created", null, true));
    await env.succeed();
    env.coordinator.handle(ev("heartbeat", null, true));
    expect(env.started()).toBe(3);
  });

  it("주석 줄은 아무것도 일으키지 않는다", async () => {
    const env = setup();
    env.coordinator.handle(ready(1));
    await env.succeed();
    env.coordinator.handle({ kind: "comment", text: "keep-alive" });
    expect(env.started()).toBe(1);
  });

  it("합치기: 주기가 진행 중일 때 온 여러 변경은 끝난 뒤 한 주기만 더 한다", async () => {
    const env = setup();
    env.coordinator.handle(ready(1));
    env.coordinator.handle(change("transaction.created", 2));
    env.coordinator.handle(change("transaction.created", 3));
    env.coordinator.handle(change("transaction.updated", 4));
    expect(env.started()).toBe(1); // 한 번에 한 주기
    await env.succeed("첫 주기");
    // 주기 도중 알려진 변경이 있었으므로 dirty가 남아 한 주기를 더 한다.
    expect(env.coordinator.state.dirty).toBe(true);
    expect(env.started()).toBe(2);
    await env.succeed("추가 주기");
    expect(env.coordinator.state.dirty).toBe(false);
    expect(env.started()).toBe(2);
    expect(env.applied.map((s) => s.room.name)).toEqual(["첫 주기", "추가 주기"]);
  });

  it("시작할 때 이미 알려진 변경만 dirty를 끈다(주기 도중 새 변경은 남는다)", async () => {
    const env = setup();
    env.coordinator.handle(ready(1));
    await flush();
    env.coordinator.handle(change("transaction.created", 2)); // 주기 도중
    await env.succeed();
    expect(env.coordinator.state.dirty).toBe(true);
  });

  it("갱신이 실패하면 아무것도 반영하지 않고 실패를 알리며 이후 이벤트로 다시 조회하지 않는다", async () => {
    const env = setup();
    const error = new Error("503");
    env.coordinator.handle(ready(1));
    env.pending.shift()!.reject(error);
    await flush();
    expect(env.applied).toHaveLength(0);
    expect(env.deps.onRefreshFailed).toHaveBeenCalledWith(error);
    expect(env.coordinator.state.dirty).toBe(true); // 복구는 재연결이 한다
    env.coordinator.handle(change("transaction.created", 2));
    expect(env.started()).toBe(1);
  });

  it("dispose 뒤에 도착한 이전 주기의 응답은 반영하지 않는다(재접속 뒤 늦은 응답)", async () => {
    const env = setup();
    env.coordinator.handle(ready(1));
    env.coordinator.dispose();
    await env.succeed("늦게 온 응답");
    expect(env.applied).toHaveLength(0);
    expect(env.deps.onCycleSucceeded).not.toHaveBeenCalled();
    // 실패도 dispose 뒤에는 알리지 않는다.
    const other = setup();
    other.coordinator.handle(ready(1));
    other.coordinator.dispose();
    other.pending.shift()!.reject(new Error("late"));
    await flush();
    expect(other.deps.onRefreshFailed).not.toHaveBeenCalled();
  });

  it("연결 세대가 현재가 아니라서 반영을 거부하면 멈춘다", async () => {
    const env = setup({ apply: () => false });
    env.coordinator.handle(ready(1));
    await env.succeed("오래된 세대", 0);
    expect(env.deps.onCycleSucceeded).not.toHaveBeenCalled();
    env.coordinator.handle(change("transaction.created", 2));
    expect(env.started()).toBe(1);
  });

  it("dispose하면 진행 중인 조회를 중단한다(끊김·언마운트 뒤에 요청이 남지 않는다)", async () => {
    const env = setup();
    env.coordinator.handle(ready(1));
    expect(env.signals[0]!.aborted).toBe(false);
    env.coordinator.dispose();
    expect(env.signals[0]!.aborted).toBe(true);
  });

  describe("방 상태와 정산 종류 불일치", () => {
    it("반영하지 않고 짧은 대기 뒤 다시 조회하며 연결 실패로 알리지 않고, 일치하면 반영한다", async () => {
      vi.useFakeTimers();
      try {
        const env = setup();
        env.coordinator.handle(ready(1));
        env.pending.shift()!.resolve({ ok: false, reason: "status-mismatch" });
        await vi.advanceTimersByTimeAsync(mismatchRetryDelay(1) - 1);
        expect(env.started()).toBe(1); // 대기 중
        await vi.advanceTimersByTimeAsync(1);
        expect(env.started()).toBe(2);
        expect(env.applied).toHaveLength(0);
        await env.succeed("일치");
        expect(env.applied).toHaveLength(1);
        expect(env.coordinator.state.dirty).toBe(false);
        expect(env.deps.onRefreshFailed).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("계속 어긋나도 연결 실패로 보지 않고 대기를 늘려(최대 3초) 재조회한다", async () => {
      expect([1, 2, 3, 4, 5, 9].map(mismatchRetryDelay)).toEqual([250, 500, 1000, 2000, 3000, 3000]);
      vi.useFakeTimers();
      try {
        const env = setup();
        env.coordinator.handle(ready(1));
        for (let i = 1; i <= 6; i += 1) {
          env.pending.shift()!.resolve({ ok: false, reason: "status-mismatch" });
          await vi.advanceTimersByTimeAsync(mismatchRetryDelay(i));
        }
        expect(env.started()).toBe(7);
        expect(env.applied).toHaveLength(0);
        expect(env.deps.onRefreshFailed).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
