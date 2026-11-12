import { describe, expect, it, vi } from "vitest";
import { createFakeSse, formatSseEvent, splitBytesAt } from "@/test/fake-sse";
import { errorResponse } from "@/test/handlers";
import { type EventStreamEnd, runEventStream } from "./event-stream";
import type { SseItem } from "./sse-parser";

const URL_ = "http://api.test/rooms/room-1/events";
const KEY = "k".repeat(43);

function setup(fetchImpl: typeof fetch) {
  const controller = new AbortController();
  const items: SseItem[] = [];
  const onOpen = vi.fn();
  const onActivity = vi.fn();
  const run = (): Promise<EventStreamEnd> =>
    runEventStream({
      url: URL_,
      identityKey: KEY,
      signal: controller.signal,
      fetch: fetchImpl,
      onOpen,
      onActivity,
      onItem: (i) => items.push(i),
    });
  return { controller, items, onOpen, onActivity, run };
}

describe("SSE 스트림 클라이언트", () => {
  it("Authorization·Accept 헤더로 연결하고 키를 URL에 싣지 않는다", async () => {
    const sse = createFakeSse();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(sse.response());
    const env = setup(fetchMock);
    const done = env.run();
    sse.close();
    await done;
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(URL_);
    expect(String(url)).not.toContain(KEY);
    expect(init!.headers).toEqual({ Authorization: `Bearer ${KEY}`, Accept: "text/event-stream" });
    expect(init!.method).toBe("GET");
  });

  it("열림·수신·이벤트 항목을 알리고 서버가 닫으면 ended다(주석 줄도 수신 시각 갱신)", async () => {
    const sse = createFakeSse();
    const env = setup(vi.fn<typeof fetch>().mockResolvedValue(sse.response()));
    const done = env.run();
    sse.pushEvent({ event: "ready", data: { revision: 1 } });
    sse.pushComment();
    sse.pushEvent({ id: 2, event: "transaction.created", data: { revision: 2 } });
    sse.close();
    expect(await done).toEqual({ kind: "ended" });
    expect(env.onOpen).toHaveBeenCalledOnce();
    expect(env.onActivity).toHaveBeenCalledTimes(3);
    expect(env.items.map((i) => (i.kind === "event" ? i.event : "comment"))).toEqual([
      "ready",
      "comment",
      "transaction.created",
    ]);
  });

  it("멀티바이트 문자가 조각 경계에서 갈라져도 온전히 해석한다", async () => {
    const sse = createFakeSse();
    const env = setup(vi.fn<typeof fetch>().mockResolvedValue(sse.response()));
    const done = env.run();
    const bytes = new TextEncoder().encode(formatSseEvent({ event: "x", data: { text: "한글😀" } }));
    for (const chunk of splitBytesAt(bytes, [14, 17, 21, 22])) sse.push(chunk);
    sse.close();
    await done;
    expect(env.items[0]).toMatchObject({ event: "x", data: { text: "한글😀" }, malformed: false });
  });

  it("빈 줄 없이 끊긴 이벤트는 malformed로 알린다", async () => {
    const sse = createFakeSse();
    const env = setup(vi.fn<typeof fetch>().mockResolvedValue(sse.response()));
    const done = env.run();
    sse.push('id: 4\nevent: transaction.created\ndata: {"rev');
    sse.close();
    await done;
    expect(env.items).toEqual([
      { kind: "event", id: "4", event: "transaction.created", data: null, malformed: true },
    ]);
  });

  it("열기 전 오류 응답은 상태·코드·Retry-After를 구분해 돌려준다", async () => {
    const cases: Array<[number, Parameters<typeof errorResponse>[0], Record<string, string>?]> = [
      [401, "UNAUTHENTICATED"],
      [404, "ROOM_NOT_FOUND"],
      [422, "VALIDATION_FAILED"],
      [429, "CONNECTION_LIMIT_EXCEEDED", { "Retry-After": "30" }],
    ];
    for (const [status, code, headers] of cases) {
      const env = setup(vi.fn<typeof fetch>().mockResolvedValue(errorResponse(code, { headers })));
      const end = await env.run();
      expect(end.kind).toBe("rejected");
      if (end.kind !== "rejected") continue;
      expect(end.error.status).toBe(status);
      expect(end.error.code).toBe(code);
      expect(end.error.retryAfterSeconds).toBe(headers ? 30 : null);
      expect(env.onOpen).not.toHaveBeenCalled();
    }
  });

  it("5xx(JSON 아님)도 rejected이고 네트워크 오류는 network다", async () => {
    const server = setup(vi.fn<typeof fetch>().mockResolvedValue(new Response("bad gateway", { status: 502 })));
    const end = await server.run();
    expect(end).toMatchObject({ kind: "rejected", error: { status: 502, code: "UNKNOWN_ERROR" } });

    const net = setup(vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await net.run()).toEqual({ kind: "network" });
  });

  it("스트림을 읽다가 오류로 끊기면 broken이다", async () => {
    const sse = createFakeSse();
    const env = setup(vi.fn<typeof fetch>().mockResolvedValue(sse.response()));
    const done = env.run();
    sse.pushEvent({ event: "ready", data: { revision: 1 } });
    await new Promise((resolve) => setTimeout(resolve, 0)); // 읽힌 뒤에 끊는다(대기 중인 조각은 오류로 버려진다)
    sse.error();
    expect(await done).toEqual({ kind: "broken" });
    expect(env.items).toHaveLength(1);
  });

  it("AbortController로 중단하면 aborted다", async () => {
    const sse = createFakeSse();
    const response = sse.response();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      init!.signal!.addEventListener("abort", () => sse.error(new DOMException("aborted", "AbortError")));
      return response;
    });
    const env = setup(fetchMock);
    const done = env.run();
    await new Promise((resolve) => setTimeout(resolve, 0));
    env.controller.abort();
    expect(await done).toEqual({ kind: "aborted" });
  });

  it("연결 전에 중단하면 aborted다", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new DOMException("aborted", "AbortError"));
    const env = setup(fetchMock);
    env.controller.abort();
    expect(await env.run()).toEqual({ kind: "aborted" });
  });

  it("EventSource를 쓰지 않는다(전역에 없어도 동작)", async () => {
    vi.stubGlobal("EventSource", undefined);
    const sse = createFakeSse();
    const env = setup(vi.fn<typeof fetch>().mockResolvedValue(sse.response()));
    const done = env.run();
    sse.close();
    expect(await done).toEqual({ kind: "ended" });
  });
});
