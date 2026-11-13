// 백엔드 미리 깨우기(배포 연동). 시간 제한·재시도 계약(S5)을 바꾸지 않는 부가 동작이다. AC 태그는 없다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WAKE_TIMEOUT_MS, wakeApi } from "./wake-api";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("wakeApi", () => {
  it("백엔드의 /health로 인증 없는 GET 한 번만 보낸다", () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}"));
    wakeApi({ baseUrl: "https://api.example.test", fetchImpl });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.example.test/health");
    expect(init).toMatchObject({ method: "GET", cache: "no-store", credentials: "omit" });
    // 신원 키 같은 인증 정보를 싣지 않는다.
    expect(init.headers).toBeUndefined();
  });

  it("실패해도(네트워크 오류·잠든 서버) 예외나 미처리 거부를 만들지 않는다", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("network"));
    expect(() => wakeApi({ baseUrl: "https://api.example.test", fetchImpl })).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("너무 오래 걸리면 연결을 끊는다(90초)", async () => {
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });
    wakeApi({ baseUrl: "https://api.example.test", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(WAKE_TIMEOUT_MS - 1);
    expect(signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(signal!.aborted).toBe(true);
  });

  it("주소 설정이 없으면(환경 변수 누락) 아무것도 보내지 않고 예외도 없다", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    try {
      const fetchImpl = vi.fn();
      expect(() => wakeApi({ fetchImpl })).not.toThrow();
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
