// 요청자 주기 조회(FE-M4, FD-23, S5 §6.8) — 가짜 시계 시험.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MyClaim } from "@/lib/api";
import { NetworkError } from "@/lib/api";
import { type FakeClock, useFakeClock } from "@/test/fake-clock";
import * as fixtures from "@/test/fixtures";
import { CLAIM_POLL_INTERVAL_MS, CLAIM_POLL_TIMEOUT_MS, createClaimPoller } from "./claim-polling";

const claim = (status: MyClaim["status"] = "PENDING"): MyClaim => ({ ...fixtures.pendingMyClaim, status });

function harness() {
  let visible = true;
  const listeners: Record<string, Set<() => void>> = { online: new Set(), visibilitychange: new Set(), offline: new Set() };
  const calls: AbortSignal[] = [];
  const seen: MyClaim[] = [];
  /** 다음 조회들의 결과. 비어 있으면 PENDING. 함수면 그 Promise를 쓴다. */
  const responses: Array<MyClaim | Error | ((signal: AbortSignal) => Promise<MyClaim>)> = [];
  const poller = createClaimPoller({
    fetchClaim: (signal) => {
      calls.push(signal);
      const next = responses.shift() ?? claim();
      if (typeof next === "function") return next(signal);
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    },
    onClaim: (c) => seen.push(c),
    env: {
      on: (type, listener) => {
        listeners[type]!.add(listener);
        return () => listeners[type]!.delete(listener);
      },
      isVisible: () => visible,
    },
  });
  return {
    poller,
    calls,
    seen,
    responses,
    listenerCount: () => Object.values(listeners).reduce((n, set) => n + set.size, 0),
    setVisible(value: boolean) {
      visible = value;
      listeners.visibilitychange!.forEach((l) => l());
    },
    online: () => listeners.online!.forEach((l) => l()),
  };
}

describe("요청자 주기 조회 (FD-23)", () => {
  let clock: FakeClock;
  beforeEach(() => {
    clock = useFakeClock();
  });
  afterEach(() => clock.restore());

  it("[AC-VIEW-005-9] 대기 중에는 2초 간격으로 조회한다", async () => {
    const h = harness();
    h.poller.start();
    expect(h.calls).toHaveLength(0);
    await clock.advance(CLAIM_POLL_INTERVAL_MS);
    expect(h.calls).toHaveLength(1);
    await clock.advance(CLAIM_POLL_INTERVAL_MS);
    expect(h.calls).toHaveLength(2);
    await clock.advance(CLAIM_POLL_INTERVAL_MS * 3);
    expect(h.calls).toHaveLength(5);
    expect(h.seen.every((c) => c.status === "PENDING")).toBe(true);
    h.poller.stop();
  });

  it("화면이 숨겨진 동안은 조회하지 않고, 다시 보이면 즉시 한 번 조회한 뒤 간격을 잇는다", async () => {
    const h = harness();
    h.poller.start();
    await clock.advance(CLAIM_POLL_INTERVAL_MS);
    expect(h.calls).toHaveLength(1);
    h.setVisible(false);
    await clock.advance(CLAIM_POLL_INTERVAL_MS * 10);
    expect(h.calls).toHaveLength(1);
    h.setVisible(true);
    await clock.advance(0);
    expect(h.calls).toHaveLength(2);
    await clock.advance(CLAIM_POLL_INTERVAL_MS);
    expect(h.calls).toHaveLength(3);
    h.poller.stop();
  });

  it("online 이벤트에서 즉시 한 번 조회한다", async () => {
    const h = harness();
    h.poller.start();
    h.online();
    await clock.advance(0);
    expect(h.calls).toHaveLength(1);
    h.poller.stop();
  });

  it("실패(네트워크·오류 응답)는 다음 간격에 다시 조회한다", async () => {
    const h = harness();
    h.responses.push(new NetworkError("network"), new Error("503"));
    h.poller.start();
    await clock.advance(CLAIM_POLL_INTERVAL_MS);
    await clock.advance(CLAIM_POLL_INTERVAL_MS);
    await clock.advance(CLAIM_POLL_INTERVAL_MS);
    expect(h.calls).toHaveLength(3);
    expect(h.seen).toHaveLength(1); // 세 번째에서 성공
    h.poller.stop();
  });

  it("요청당 10초 제한: 응답이 오지 않는 동안 겹쳐 보내지 않고, 시간 초과 뒤 다음 간격에 다시 조회한다", async () => {
    expect(CLAIM_POLL_TIMEOUT_MS).toBe(10_000);
    const h = harness();
    // 첫 조회는 10초 뒤 시간 초과로 실패한다(실제 클라이언트는 `timeoutMs`로 NetworkError(timeout)를 던진다).
    h.responses.push(
      () => new Promise<MyClaim>((_, reject) => setTimeout(() => reject(new NetworkError("timeout")), CLAIM_POLL_TIMEOUT_MS)),
    );
    h.poller.start();
    await clock.advance(CLAIM_POLL_INTERVAL_MS);
    expect(h.calls).toHaveLength(1);
    h.online(); // 진행 중이면 즉시 조회도 겹치지 않는다
    await clock.advance(CLAIM_POLL_TIMEOUT_MS - 1);
    expect(h.calls).toHaveLength(1);
    await clock.advance(1);
    await clock.advance(CLAIM_POLL_INTERVAL_MS);
    expect(h.calls).toHaveLength(2);
    h.poller.stop();
  });

  it.each(["APPROVED", "REJECTED", "CANCELED"] as const)("결과(%s)가 나오면 알리고 멈춘다", async (status) => {
    const h = harness();
    h.responses.push(claim(status));
    h.poller.start();
    await clock.advance(CLAIM_POLL_INTERVAL_MS);
    expect(h.seen.map((c) => c.status)).toEqual([status]);
    await clock.advance(CLAIM_POLL_INTERVAL_MS * 5);
    h.online();
    h.setVisible(true);
    await clock.advance(0);
    expect(h.calls).toHaveLength(1);
    expect(h.listenerCount()).toBe(0);
  });

  it("stop은 진행 중인 조회를 중단하고 늦은 결과를 알리지 않는다", async () => {
    const h = harness();
    let resolve!: (c: MyClaim) => void;
    h.responses.push(() => new Promise<MyClaim>((r) => (resolve = r)));
    h.poller.start();
    await clock.advance(CLAIM_POLL_INTERVAL_MS);
    h.poller.stop();
    expect(h.calls[0]!.aborted).toBe(true);
    resolve(claim("APPROVED"));
    await clock.advance(CLAIM_POLL_INTERVAL_MS * 3);
    expect(h.seen).toHaveLength(0);
    expect(h.calls).toHaveLength(1);
  });
});
