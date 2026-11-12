import { http, HttpResponse } from "msw";
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { createElement } from "react";
import { createApiClient, ApiError, ERROR_CODES, getApiClient, type ApiClient } from "@/lib/api";
import { expectNoA11yViolations } from "./a11y";
import { mockClipboard, removeClipboard } from "./clipboard";
import { useFakeClock } from "./fake-clock";
import { FakeLockManager, installFakeLocks } from "./fake-locks";
import { createFakeSse, formatSseEvent, splitBytesAt } from "./fake-sse";
import { FakeStorage, installFakeStorage } from "./fake-storage";
import * as fixtures from "./fixtures";
import {
  apiUrl,
  ERROR_STATUS,
  errorHandler,
  errorResponse,
  jsonHandler,
  networkErrorHandler,
  slowHandler,
} from "./handlers";
import { server } from "./msw-server";
import { createFakeBackend } from "./stateful-server";

const client = (): ApiClient => createApiClient({ baseUrl: fixtures.TEST_API_BASE_URL });

describe("MSW 서버와 처리기", () => {
  it("fixture를 돌려주고 모든 오류 코드의 상태가 정의되어 있다", async () => {
    server.use(jsonHandler("get", `/rooms/${fixtures.room.id}`, { room: fixtures.room, me: fixtures.hostMember }));
    const res = await client().request<{ room: { id: string } }>({ method: "GET", path: "/rooms/room-1" });
    expect(res.data.room.id).toBe("room-1");
    expect(Object.keys(ERROR_STATUS).sort()).toEqual([...ERROR_CODES].sort());
  });

  it("오류 처리기는 ApiError로 정규화된다(헤더 포함)", async () => {
    server.use(
      errorHandler("get", "/x", "CONNECTION_LIMIT_EXCEEDED", { headers: { "Retry-After": "30" } }),
    );
    const error = (await client().request({ method: "GET", path: "/x" }).catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe("CONNECTION_LIMIT_EXCEEDED");
    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBe(30);
    expect(errorResponse("HOST_ONLY").status).toBe(403);
  });

  it("처리기가 없는 요청은 실패한다", async () => {
    await expect(client().request({ method: "GET", path: "/unmocked" })).rejects.toBeDefined();
  });

  it("네트워크 오류·느린 응답 처리기", async () => {
    server.use(networkErrorHandler("get", "/net"));
    await expect(client().request({ method: "GET", path: "/net" })).rejects.toMatchObject({
      name: "NetworkError",
    });
    server.use(slowHandler("get", "/slow", 50, { ok: true }));
    const res = await client().request<{ ok: boolean }>({ method: "GET", path: "/slow" });
    expect(res.data.ok).toBe(true);
  });

  it("앱이 쓰는 공유 클라이언트가 시험 환경의 주소를 쓴다", () => {
    expect(getApiClient()).toBe(getApiClient());
  });
});

describe("가짜 SSE 스트림", () => {
  async function readAll(response: Response): Promise<string> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      text += decoder.decode(value, { stream: true });
    }
  }

  it("이벤트·주석·원시 조각을 밀어 넣고 닫는다", async () => {
    const sse = createFakeSse();
    sse.pushEvent({ id: 3, event: "transaction.created", data: { revision: 3 } });
    sse.pushComment();
    sse.push("data: x\n\n");
    sse.close();
    const text = await readAll(sse.response());
    expect(text).toBe(
      'id: 3\nevent: transaction.created\ndata: {"revision":3}\n\n: heartbeat\n\ndata: x\n\n',
    );
  });

  it("오류로 끊으면 읽기가 실패하고, 취소 여부를 알 수 있다", async () => {
    const sse = createFakeSse();
    const response = sse.response();
    sse.error();
    await expect(readAll(response)).rejects.toThrow();

    const other = createFakeSse();
    await other.response().body!.cancel();
    expect(other.cancelled).toBe(true);
  });

  it("[속성] 임의 조각 경계에서도 같은 바이트를 전달한다(UTF-8 멀티바이트 경계 포함)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 0, maxLength: 40 }), fc.array(fc.nat(200)), async (text, cuts) => {
        const bytes = new TextEncoder().encode(formatSseEvent({ event: "e", data: { text } }));
        const sse = createFakeSse();
        for (const chunk of splitBytesAt(bytes, cuts)) sse.push(chunk);
        sse.close();
        const got = new Uint8Array(await new Response(sse.response().body).arrayBuffer());
        expect(Array.from(got)).toEqual(Array.from(bytes));
      }),
      { numRuns: 60 },
    );
  });

  it("splitBytesAt은 범위 밖·중복 경계를 무시한다", () => {
    const parts = splitBytesAt(new Uint8Array([1, 2, 3, 4]), [0, 2, 2, 9]);
    expect(parts.map((p) => Array.from(p))).toEqual([[1, 2], [3, 4]]);
  });
});

describe("가짜 시계", () => {
  afterEach(() => vi.useRealTimers());

  it("시간을 앞으로 보내 타이머를 실행하고 기기 시각만 바꿀 수 있다", async () => {
    const clock = useFakeClock("2026-11-08T03:00:00.000Z");
    const fired = vi.fn();
    setTimeout(fired, 1_000);
    await clock.advance(999);
    expect(fired).not.toHaveBeenCalled();
    await clock.advance(1);
    expect(fired).toHaveBeenCalledOnce();
    const before = clock.now();
    clock.setSystemTime(before - 3_600_000);
    expect(clock.now()).toBe(before - 3_600_000);
    clock.restore();
  });
});

describe("가짜 저장소", () => {
  it("읽고 쓰며, 실패·쓰기 무시를 흉내 낸다", () => {
    const storage = installFakeStorage();
    localStorage.setItem("a", "1");
    expect(localStorage.getItem("a")).toBe("1");
    expect(storage.keys()).toEqual(["a"]);
    localStorage.removeItem("a");
    expect(localStorage.getItem("a")).toBeNull();

    expect(() => new FakeStorage({ failOnSet: true }).setItem("a", "1")).toThrow();
    expect(() => new FakeStorage({ failOnGet: true }).getItem("a")).toThrow();
    expect(() => new FakeStorage({ failOnRemove: true }).removeItem("a")).toThrow();
    const dropping = new FakeStorage({ dropWrites: true });
    dropping.setItem("a", "1");
    expect(dropping.getItem("a")).toBeNull();
  });
});

describe("가짜 Web Locks", () => {
  it("같은 이름의 요청을 한 번에 하나씩만 실행한다", async () => {
    const manager = new FakeLockManager();
    installFakeLocks(manager);
    const order: string[] = [];
    const task = (label: string) =>
      navigator.locks.request("lock-a", async () => {
        order.push(`start ${label}`);
        await new Promise((r) => setTimeout(r, 5));
        order.push(`end ${label}`);
      });
    await Promise.all([task("1"), task("2")]);
    expect(order).toEqual(["start 1", "end 1", "start 2", "end 2"]);
    expect(manager.maxConcurrent.get("lock-a")).toBe(1);
  });

  it("다른 이름은 서로 막지 않고, 미지원 환경을 흉내 낼 수 있다", async () => {
    const manager = new FakeLockManager();
    installFakeLocks(manager);
    let release!: () => void;
    const held = navigator.locks.request("a", () => new Promise<void>((r) => (release = r)));
    await expect(navigator.locks.request("b", () => "ok")).resolves.toBe("ok");
    release();
    await held;

    installFakeLocks(null);
    expect(navigator.locks).toBeUndefined();
  });
});

describe("클립보드 모의", () => {
  it("쓰기 성공·실패·완료 시점 제어·미지원", async () => {
    const ok = mockClipboard();
    await navigator.clipboard.writeText("a,b");
    expect(ok.written).toEqual(["a,b"]);

    mockClipboard({ fail: true });
    await expect(navigator.clipboard.writeText("x")).rejects.toThrow();

    const manual = mockClipboard({ manual: true });
    let done = false;
    void navigator.clipboard.writeText("late").then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    manual.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(done).toBe(true);
    expect(manual.written).toEqual(["late"]);

    removeClipboard();
    expect(navigator.clipboard).toBeUndefined();
  });
});

describe("접근성 검사 도우미", () => {
  it("올바른 마크업은 통과하고 라벨 없는 입력은 실패한다", async () => {
    const good = render(
      createElement("main", null, createElement("label", null, "이름", createElement("input", { type: "text" }))),
    );
    await expectNoA11yViolations(good.container);
    good.unmount();

    const bad = render(createElement("main", null, createElement("input", { type: "text" })));
    await expect(expectNoA11yViolations(bad.container)).rejects.toThrow();
  });
});

describe("상태 있는 가짜 서버", () => {
  it("조회 응답과 스트림 이벤트의 revision이 맞고, 지연·실패를 제어할 수 있다", async () => {
    const backend = createFakeBackend();
    server.use(...backend.handlers);
    const api = client();

    const room = await api.request<{ room: { id: string } }>({ method: "GET", path: "/rooms/room-1" });
    expect(room.data.room.id).toBe("room-1");
    expect(backend.requests.room).toBe(1);

    const stream = await fetch(apiUrl("/rooms/room-1/events"));
    const reader = stream.body!.getReader();
    const decoder = new TextDecoder();
    const ready = decoder.decode((await reader.read()).value);
    expect(ready).toContain("event: ready");
    expect(ready).toContain('"revision":1');

    expect(backend.commit("transaction.created", { transactionId: "t-9" })).toBe(2);
    const created = decoder.decode((await reader.read()).value);
    expect(created).toContain("id: 2");
    expect(created).toContain('"transactionId":"t-9"');

    backend.failing.add("balances");
    await expect(api.request({ method: "GET", path: "/rooms/room-1/balances" })).rejects.toMatchObject({
      status: 503,
    });
    backend.failing.delete("balances");
    const balances = await api.request<{ balances: unknown[] }>({ method: "GET", path: "/rooms/room-1/balances" });
    expect(balances.data.balances).toHaveLength(3);
    expect(backend.requests.balances).toBe(2);
  });

  it("알 수 없는 방은 ROOM_NOT_FOUND다", async () => {
    server.use(...createFakeBackend().handlers, http.get(apiUrl("/other"), () => HttpResponse.json({})));
    const error = (await client()
      .request({ method: "GET", path: "/rooms/zzz/balances" })
      .catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe("ROOM_NOT_FOUND");
  });
});
