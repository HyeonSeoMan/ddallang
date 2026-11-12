import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient, NetworkError } from "@/lib/api";
import { useFakeClock, type FakeClock } from "@/test/fake-clock";
import { installFakeStorage } from "@/test/fake-storage";
import { createMutationManager, KEY_LIFETIME_MS, type MutationRequest } from "./manager";

const T0 = Date.parse("2026-11-08T03:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

type Call = { headers: Record<string, string>; body: unknown };

function setup(options: { serverOffsetMs?: number | "unknown"; syncClock?: boolean } = {}) {
  const calls: Call[] = [];
  const responses: Array<() => Response | Promise<Response>> = [];
  const serverOffset = options.serverOffsetMs ?? 0;
  const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
    calls.push({ headers: init!.headers as Record<string, string>, body: init!.body });
    const next = responses.shift();
    if (!next) throw new Error("응답이 준비되지 않았습니다");
    // 실제 fetch처럼 중단 신호를 받으면 거부한다(시간 초과 시험).
    return Promise.race([
      Promise.resolve().then(next),
      new Promise<never>((_resolve, reject) => {
        init!.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
    ]);
  });
  const dateHeader = (): Record<string, string> =>
    serverOffset === "unknown" ? {} : { Date: new Date(Date.now() + serverOffset).toUTCString() };
  const ok = (body: unknown = { ok: true }, headers: Record<string, string> = {}) => () =>
    new Response(JSON.stringify(body), { status: 201, headers: { ...dateHeader(), ...headers } });
  const fail = (code: string, status = 409) => () =>
    new Response(JSON.stringify({ error: { code, message: "m", details: [] } }), {
      status,
      headers: dateHeader(),
    });
  const api = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock });
  const syncClock = options.syncClock
    ? () => api.request({ method: "GET", path: "/rooms/room-1" })
    : undefined;
  if (options.syncClock) responses.push(ok({ room: {} }));
  const manager = createMutationManager({ api, syncClock });
  return { api, manager, calls, responses, ok, fail, fetchMock };
}

const create = (amount = 100): MutationRequest => ({
  method: "POST",
  path: "/rooms/room-1/transactions",
  body: { payerId: "p-1", payeeId: "p-2", amount },
  headers: { Authorization: "Bearer test" },
});
const SCOPE = "create:room-1";

describe("변경 요청 매니저", () => {
  let clock: FakeClock;
  beforeEach(() => {
    clock = useFakeClock(T0);
  });
  afterEach(() => clock.restore());

  async function prime(env: ReturnType<typeof setup>) {
    // 서버 시계 차이를 알아 둔다(방 조회 응답의 Date).
    env.responses.push(env.ok({ room: {} }));
    await env.api.request({ method: "GET", path: "/rooms/room-1" });
    env.calls.length = 0;
  }

  it("새 시도에 CSPRNG 키와 보정한 시각(RFC 3339 UTC 밀리초)을 붙인다", async () => {
    const env = setup();
    await prime(env);
    env.responses.push(env.ok({ transaction: { id: "t" } }));
    const outcome = await env.manager.submit(SCOPE, create());
    expect(outcome).toMatchObject({ status: "success", replayed: false, httpStatus: 201 });
    const { headers } = env.calls[0]!;
    expect(headers["Idempotency-Key"]).toMatch(KEY_PATTERN);
    expect(headers["Idempotency-Key"]).toHaveLength(22);
    expect(headers["Idempotency-First-Attempt-At"]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(headers.Authorization).toBe("Bearer test"); // 호출자의 헤더는 그대로
  });

  it("[AC-TXN-007-1] 진행 중이면 같은 작업의 중복 제출을 보내지 않는다", async () => {
    const env = setup();
    await prime(env);
    let release!: () => void;
    env.responses.push(
      () => new Promise<Response>((resolve) => (release = () => resolve(env.ok()()))),
    );
    const first = env.manager.submit(SCOPE, create());
    await vi.advanceTimersByTimeAsync(0);
    expect(env.manager.getState(SCOPE)).toEqual({ status: "in-progress" });
    await expect(env.manager.submit(SCOPE, create())).resolves.toEqual({ status: "in-progress" });
    expect(env.calls).toHaveLength(1);
    release();
    await first;
    expect(env.manager.getState(SCOPE)).toEqual({ status: "idle" });
  });

  it("[AC-TXN-007-5] 결과 불명 뒤 같은 내용의 수동 재시도는 같은 키·같은 시각이다", async () => {
    const env = setup();
    await prime(env);
    env.responses.push(() => {
      throw new TypeError("Failed to fetch");
    });
    const first = await env.manager.submit(SCOPE, create());
    expect(first.status).toBe("unknown");
    expect(first.status === "unknown" && first.error).toBeInstanceOf(NetworkError);
    await clock.advance(5 * 60 * 1000);

    env.responses.push(env.ok({ transaction: {} }, { "Idempotent-Replayed": "true" }));
    const second = await env.manager.submit(SCOPE, create());
    expect(second).toMatchObject({ status: "success", replayed: true });
    expect(env.calls[1]!.headers["Idempotency-Key"]).toBe(env.calls[0]!.headers["Idempotency-Key"]);
    expect(env.calls[1]!.headers["Idempotency-First-Attempt-At"]).toBe(
      env.calls[0]!.headers["Idempotency-First-Attempt-At"],
    );
  });

  it("[AC-TXN-007-6] 내용이 바뀌면 새 키와 새 시각을 쓴다", async () => {
    const env = setup();
    await prime(env);
    env.responses.push(() => {
      throw new TypeError("Failed to fetch");
    });
    await env.manager.submit(SCOPE, create(100));
    await clock.advance(1000);
    env.responses.push(env.ok());
    await env.manager.submit(SCOPE, create(200));
    expect(env.calls[1]!.headers["Idempotency-Key"]).not.toBe(env.calls[0]!.headers["Idempotency-Key"]);
    expect(env.calls[1]!.headers["Idempotency-First-Attempt-At"]).not.toBe(
      env.calls[0]!.headers["Idempotency-First-Attempt-At"],
    );
  });

  it("본문 키 순서만 달라도 같은 내용이다", async () => {
    const env = setup();
    await prime(env);
    env.responses.push(() => {
      throw new TypeError("Failed to fetch");
    });
    await env.manager.submit(SCOPE, { method: "POST", path: "/x", body: { a: 1, b: 2 } });
    env.responses.push(env.ok());
    await env.manager.submit(SCOPE, { method: "POST", path: "/x", body: { b: 2, a: 1 } });
    expect(env.calls[1]!.headers["Idempotency-Key"]).toBe(env.calls[0]!.headers["Idempotency-Key"]);
  });

  it("성공하면 키를 버리고 다음 저장은 새 키를 쓴다", async () => {
    const env = setup();
    await prime(env);
    env.responses.push(env.ok(), env.ok());
    await env.manager.submit(SCOPE, create());
    await env.manager.submit(SCOPE, create());
    expect(env.calls[1]!.headers["Idempotency-Key"]).not.toBe(env.calls[0]!.headers["Idempotency-Key"]);
  });

  it("확정 거부(409·422)는 사유와 함께 돌려주고 키를 버리며 자동 재전송하지 않는다", async () => {
    const env = setup();
    await prime(env);
    env.responses.push(env.fail("TRANSACTION_LIMIT_EXCEEDED"));
    const outcome = await env.manager.submit(SCOPE, create());
    expect(outcome.status).toBe("rejected");
    expect(outcome.status === "rejected" && outcome.error).toBeInstanceOf(ApiError);
    expect(outcome.status === "rejected" && outcome.error.code).toBe("TRANSACTION_LIMIT_EXCEEDED");
    expect(env.calls).toHaveLength(1);
    expect(env.manager.getState(SCOPE)).toEqual({ status: "idle" });
  });

  it("2xx인데 본문을 해석하지 못하면 결과 불명이며 키를 버리지 않는다(중복 거래 방지)", async () => {
    const env = setup();
    await prime(env);
    env.responses.push(() => new Response("{broken", { status: 201 }));
    const first = await env.manager.submit(SCOPE, create());
    expect(first.status).toBe("unknown");
    expect(first.status === "unknown" && first.error).toMatchObject({ code: "INVALID_RESPONSE" });
    env.responses.push(env.ok());
    await env.manager.submit(SCOPE, create());
    expect(env.calls[1]!.headers["Idempotency-Key"]).toBe(env.calls[0]!.headers["Idempotency-Key"]);
  });

  it("24시간 이내에는 confirmNewAttempt를 줘도 같은 키로 재시도한다", async () => {
    const env = setup();
    await prime(env);
    env.responses.push(() => {
      throw new TypeError("Failed to fetch");
    });
    await env.manager.submit(SCOPE, create());
    env.responses.push(env.ok());
    await env.manager.submit(SCOPE, create(), { confirmNewAttempt: true });
    expect(env.calls[1]!.headers["Idempotency-Key"]).toBe(env.calls[0]!.headers["Idempotency-Key"]);
  });

  it("차이를 모르고 동기화 함수도 없으면 기기 시각으로 보내지 않는다", async () => {
    const env = setup({ serverOffsetMs: "unknown" });
    const outcome = await env.manager.submit(SCOPE, create());
    expect(outcome).toMatchObject({ status: "not-sent", reason: "clock-unknown" });
    expect(env.fetchMock).not.toHaveBeenCalled();
  });

  it("5xx는 결과 불명으로 다루고 같은 키로 재시도할 수 있다", async () => {
    const env = setup();
    await prime(env);
    env.responses.push(env.fail("INTERNAL", 503));
    const first = await env.manager.submit(SCOPE, create());
    expect(first.status).toBe("unknown");
    env.responses.push(env.ok());
    await env.manager.submit(SCOPE, create());
    expect(env.calls[1]!.headers["Idempotency-Key"]).toBe(env.calls[0]!.headers["Idempotency-Key"]);
  });

  it("결과 불명(시간 초과)도 성공으로 표시하지 않는다", async () => {
    const env = setup();
    await prime(env);
    env.responses.push(() => new Promise<Response>(() => undefined)); // 응답이 오지 않는다
    const pending = env.manager.submit(SCOPE, create());
    await clock.advance(30_000);
    const outcome = await pending;
    expect(outcome.status).toBe("unknown");
    expect(outcome.status === "unknown" && outcome.error).toMatchObject({ reason: "timeout" });
  });

  describe("24시간 경계", () => {
    async function unknownAttempt() {
      const env = setup();
      await prime(env);
      env.responses.push(() => {
        throw new TypeError("Failed to fetch");
      });
      await env.manager.submit(SCOPE, create());
      env.calls.length = 0;
      return env;
    }

    it("[AC-TXN-008-3] 24시간 이내(1ms 전)는 같은 키로 보낸다", async () => {
      const env = await unknownAttempt();
      await clock.advance(KEY_LIFETIME_MS - 1);
      expect(env.manager.getState(SCOPE)).toMatchObject({ status: "unknown", expired: false });
      env.responses.push(env.ok());
      expect((await env.manager.submit(SCOPE, create())).status).toBe("success");
      expect(env.calls).toHaveLength(1);
    });

    it("[AC-TXN-007-12] 24시간이 지나면 새 키로 자동 재전송하지 않고 확인을 기다린다", async () => {
      const env = await unknownAttempt();
      await clock.advance(KEY_LIFETIME_MS);
      expect(env.manager.getState(SCOPE)).toMatchObject({ status: "unknown", expired: true });
      const outcome = await env.manager.submit(SCOPE, create());
      expect(outcome).toMatchObject({ status: "needs-confirmation", reason: "expired" });
      expect(env.calls).toHaveLength(0);
      // 사용자가 목록에 없음을 확인하고 직접 다시 저장하면 새 키·새 시각이다.
      env.responses.push(env.ok());
      const fresh = await env.manager.submit(SCOPE, create(), { confirmNewAttempt: true });
      expect(fresh.status).toBe("success");
      expect(env.calls).toHaveLength(1);
      expect(Date.parse(env.calls[0]!.headers["Idempotency-First-Attempt-At"]!)).toBeGreaterThanOrEqual(
        T0 + KEY_LIFETIME_MS,
      );
    });

    it("내용이 바뀐 요청은 새 시도이므로 만료 확인 없이 보낸다", async () => {
      const env = await unknownAttempt();
      await clock.advance(KEY_LIFETIME_MS + HOUR);
      env.responses.push(env.ok());
      expect((await env.manager.submit(SCOPE, create(999))).status).toBe("success");
    });

    it("시도를 버리면 상태가 idle이 된다", async () => {
      const env = await unknownAttempt();
      env.manager.discard(SCOPE);
      expect(env.manager.getState(SCOPE)).toEqual({ status: "idle" });
    });
  });

  describe("시계 오차 보정(S2 §5.4 표)", () => {
    // 기기 시계를 `deviceSkewMs`만큼 틀리게 하고 서버는 정확하다. 보정하면 서버 시각이 헤더에 실린다.
    async function firstAttemptAt(deviceSkewMs: number) {
      const env = setup({ serverOffsetMs: -deviceSkewMs });
      await prime(env);
      env.responses.push(env.ok());
      const trueTime = Date.now() - deviceSkewMs;
      await env.manager.submit(SCOPE, create());
      const sent = Date.parse(env.calls[0]!.headers["Idempotency-First-Attempt-At"]!);
      return { sent, trueTime };
    }

    it.each([
      ["정확", 0],
      ["느림 1시간", -HOUR],
      ["느림 24시간 이상", -25 * HOUR],
      ["빠름 5분 이내", 4 * 60 * 1000],
      ["빠름 10분", 10 * 60 * 1000],
    ])("%s: 보정한 현재 시각을 보낸다(초 단위 Date 오차 1초 이내)", async (_name, skew) => {
      const { sent, trueTime } = await firstAttemptAt(skew);
      expect(Math.abs(sent - trueTime)).toBeLessThanOrEqual(1000);
      // 보정하지 않았다면 기기 시각(= 참 시각 + 오차)이 실렸을 것이다. 오차가 있는 행은 그와 달라야 한다.
      if (skew !== 0) expect(Math.abs(sent - (trueTime + skew))).toBeGreaterThan(1000);
    });

    it("차이를 모르면 방 조회로 먼저 알아낸 뒤 보낸다", async () => {
      const env = setup({ syncClock: true });
      env.responses.push(env.ok({ transaction: {} }));
      const outcome = await env.manager.submit(SCOPE, create());
      expect(outcome.status).toBe("success");
      expect(env.fetchMock.mock.calls[0]![0]).toContain("/rooms/room-1");
      expect(env.fetchMock.mock.calls[1]![0]).toContain("/transactions");
    });

    it("차이를 알아내지 못하면 요청을 보내지 않는다", async () => {
      const env = setup({ serverOffsetMs: "unknown", syncClock: true });
      const outcome = await env.manager.submit(SCOPE, create());
      expect(outcome).toMatchObject({ status: "not-sent", reason: "clock-unknown" });
      expect(env.fetchMock).toHaveBeenCalledTimes(1); // 방 조회뿐
    });

    it("방 조회가 실패하면 요청을 보내지 않는다", async () => {
      const env = setup();
      const failing = createMutationManager({
        api: env.api,
        syncClock: () => Promise.reject(new NetworkError("network")),
      });
      const outcome = await failing.submit(SCOPE, create());
      expect(outcome).toMatchObject({ status: "not-sent", reason: "clock-unknown" });
      expect(env.fetchMock).not.toHaveBeenCalled();
    });
  });

  it("[AC-SYS-002-4] 키·시각을 저장소에 쓰지 않는다(새로고침하면 사라진다)", async () => {
    const storage = installFakeStorage();
    const env = setup();
    await prime(env);
    env.responses.push(() => {
      throw new TypeError("Failed to fetch");
    });
    await env.manager.submit(SCOPE, create());
    expect(storage.keys()).toEqual([]);
    // 새 매니저(새로고침에 해당)는 이전 시도를 모른다.
    const reloaded = createMutationManager({ api: env.api });
    expect(reloaded.getState(SCOPE)).toEqual({ status: "idle" });
  });

  it("종료 요청도 같은 규칙(헤더·재시도)을 쓴다", async () => {
    const env = setup();
    await prime(env);
    const end: MutationRequest = { method: "POST", path: "/rooms/room-1/end", headers: { Authorization: "Bearer t" } };
    env.responses.push(() => {
      throw new TypeError("Failed to fetch");
    });
    await env.manager.submit("end:room-1", end);
    env.responses.push(env.ok({ roomId: "room-1", status: "ENDED" }));
    await env.manager.submit("end:room-1", end);
    expect(env.calls[1]!.headers["Idempotency-Key"]).toBe(env.calls[0]!.headers["Idempotency-Key"]);
  });
});
