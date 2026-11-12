import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bearerHeader, createApiClient, MUTATION_TIMEOUT_MS, READ_TIMEOUT_MS } from "./client";
import { ApiError, NetworkError } from "./errors";
import { ERROR_CODES, isKnownErrorCode, VALIDATION_REASON_CODES } from "./types";

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init,
  });
}

function setup(fetchMock: FetchMock, now = () => 1_000_000) {
  return createApiClient({ baseUrl: "http://api.test/", fetch: fetchMock, now });
}

describe("API 클라이언트", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("성공 응답을 파싱하고 모르는 필드는 그대로 둔다(소비자가 무시)", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json({ room: { id: "r1", extra: 1 } }));
    const res = await setup(fetchMock).request<{ room: { id: string } }>({
      method: "GET",
      path: "/rooms/r1",
    });
    expect(res.status).toBe(200);
    expect(res.data.room.id).toBe("r1");
    expect(res.replayed).toBe(false);
  });

  it("헤더는 호출자가 넘긴 값을 쓰고 키는 URL에 없다", async () => {
    const key = "A".repeat(43);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json({ participants: [] }));
    await setup(fetchMock).request({
      method: "GET",
      path: "/rooms/r1/participants",
      query: { participantId: "p1", skipped: undefined },
      headers: bearerHeader(key),
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/rooms/r1/participants?participantId=p1");
    expect(String(url)).not.toContain(key);
    expect((init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${key}`);
  });

  it("본문은 JSON으로 보내고 Content-Type을 붙인다", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json({}, { status: 201 }));
    await setup(fetchMock).request({ method: "POST", path: "/rooms", body: { name: "a" } });
    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.body).toBe('{"name":"a"}');
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("Idempotent-Replayed: true를 읽는다", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ transaction: {} }, { headers: { "Idempotent-Replayed": "true" } }));
    const res = await setup(fetchMock).request({ method: "POST", path: "/x", body: {} });
    expect(res.replayed).toBe(true);
  });

  it.each(ERROR_CODES)("오류 코드 %s를 ApiError로 정규화한다", async (code) => {
    const details = [{ field: "nickname", code: "REQUIRED" }];
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      json({ error: { code, message: "안내", details } }, { status: 409 }),
    );
    const error = await setup(fetchMock)
      .request({ method: "GET", path: "/x" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(409);
    expect(apiError.code).toBe(code);
    expect(apiError.message).toBe("안내");
    expect(apiError.details).toEqual(details);
    expect(isKnownErrorCode(apiError.code)).toBe(true);
  });

  it("검증 사유 코드 목록이 Spec의 11개와 같다", () => {
    expect(VALIDATION_REASON_CODES).toHaveLength(11);
  });

  it("details가 없으면 빈 배열, 한도·serverTime 항목은 그대로 둔다", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ error: { code: "GAME_ENDED", message: "m" } }, { status: 409 }))
      .mockResolvedValueOnce(
        json(
          { error: { code: "IDEMPOTENCY_KEY_EXPIRED", message: "m", details: [{ serverTime: "2026-11-08T03:21:45.123Z" }] } },
          { status: 409 },
        ),
      );
    const client = setup(fetchMock);
    const first = (await client
      .request({ method: "POST", path: "/x" })
      .catch((e: unknown) => e)) as ApiError;
    expect(first.details).toEqual([]);
    const second = (await client
      .request({ method: "POST", path: "/x" })
      .catch((e: unknown) => e)) as ApiError;
    expect(second.details[0]?.serverTime).toBe("2026-11-08T03:21:45.123Z");
  });

  it("429의 Retry-After(초)를 읽는다", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      json(
        { error: { code: "CONNECTION_LIMIT_EXCEEDED", message: "m" } },
        { status: 429, headers: { "Retry-After": "30" } },
      ),
    );
    const error = (await setup(fetchMock)
      .request({ method: "GET", path: "/x" })
      .catch((e: unknown) => e)) as ApiError;
    expect(error.retryAfterSeconds).toBe(30);
  });

  it("형식에 맞지 않는 오류 본문은 UNKNOWN_ERROR로 다룬다", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 }));
    const error = (await setup(fetchMock)
      .request({ method: "GET", path: "/x" })
      .catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("UNKNOWN_ERROR");
    expect(error.status).toBe(502);
    expect(isKnownErrorCode(error.code)).toBe(false);
  });

  it("네트워크 오류는 NetworkError(network)이며 재시도하지 않는다", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await setup(fetchMock)
      .request({ method: "POST", path: "/x" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).reason).toBe("network");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("5xx도 자동 재시도하지 않는다", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ error: { code: "INTERNAL", message: "m" } }, { status: 500 }));
    await setup(fetchMock).request({ method: "GET", path: "/x" }).catch(() => undefined);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  function hangingFetch(): FetchMock {
    return vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
  }

  it("조회는 10초, 변경은 30초에 NetworkError(timeout)가 된다", async () => {
    const client = setup(hangingFetch());
    const read = client.request({ method: "GET", path: "/x" }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    const readError = (await read) as NetworkError;
    expect(readError).toBeInstanceOf(NetworkError);
    expect(readError.reason).toBe("timeout");

    const mutation = client.request({ method: "POST", path: "/x" }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(MUTATION_TIMEOUT_MS - 1);
    let settled = false;
    void mutation.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(((await mutation) as NetworkError).reason).toBe("timeout");
  });

  it("호출자가 취소하면 NetworkError가 아니라 중단 오류를 그대로 던진다", async () => {
    const controller = new AbortController();
    const client = setup(hangingFetch());
    const pending = client
      .request({ method: "GET", path: "/x", signal: controller.signal })
      .catch((e: unknown) => e);
    controller.abort();
    const error = await pending;
    expect(error).not.toBeInstanceOf(NetworkError);
    expect((error as DOMException).name).toBe("AbortError");
  });

  it("가장 최근 응답의 Date로 시계 차이를 추정한다", async () => {
    let clock = 1_000_000;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, { headers: { Date: new Date(1_000_000 + 7_000).toUTCString() } }))
      .mockResolvedValueOnce(json({}, { headers: { Date: new Date(1_000_000 - 3_000).toUTCString() } }))
      .mockResolvedValueOnce(json({}));
    const client = setup(fetchMock, () => clock);
    expect(client.getClockOffsetMs()).toBeNull();
    expect(client.serverNow()).toBe(clock);

    await client.request({ method: "GET", path: "/a" });
    // Date는 초 단위라 ms가 잘린다.
    expect(client.getClockOffsetMs()).toBe(Math.floor((1_000_000 + 7_000) / 1000) * 1000 - 1_000_000);

    await client.request({ method: "GET", path: "/b" });
    expect(client.getClockOffsetMs()).toBe(Math.floor((1_000_000 - 3_000) / 1000) * 1000 - 1_000_000);

    // Date가 없는 응답은 이전 값을 유지한다.
    const before = client.getClockOffsetMs();
    await client.request({ method: "GET", path: "/c" });
    expect(client.getClockOffsetMs()).toBe(before);

    clock += 5_000;
    expect(client.serverNow()).toBe(clock + before!);
  });

  it("오류 응답의 Date도 시계 보정에 쓴다", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      json(
        { error: { code: "VALIDATION_FAILED", message: "m" } },
        { status: 422, headers: { Date: new Date(1_060_000).toUTCString() } },
      ),
    );
    const client = setup(fetchMock);
    await client.request({ method: "POST", path: "/x" }).catch(() => undefined);
    expect(client.getClockOffsetMs()).toBe(Math.floor(1_060_000 / 1000) * 1000 - 1_000_000);
  });
});
