import { ApiError, type ApiErrorDetail, NetworkError } from "./errors";

/** 갱신 조회 10초(S5 §6.4), 변경 요청 30초(FD-5 제안). */
export const READ_TIMEOUT_MS = 10_000;
export const MUTATION_TIMEOUT_MS = 30_000;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  method: HttpMethod;
  /** `/rooms/{id}` 같은 경로. 쿼리는 `query`로 넘긴다. */
  path: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
  /** `Authorization`, `Idempotency-*` 등. 호출자가 만들어 넘기며 URL에는 싣지 않는다. */
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ApiResponse<T> {
  status: number;
  data: T;
  /** `Idempotent-Replayed: true` 응답이면 true(저장된 응답의 재전송). */
  replayed: boolean;
}

export interface ApiClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  now?: () => number;
}

export function bearerHeader(identityKey: string): Record<string, string> {
  return { Authorization: `Bearer ${identityKey}` };
}

function parseRetryAfter(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value.trim())) return null;
  return Number(value.trim());
}

function toDetails(value: unknown): ApiErrorDetail[] {
  if (!Array.isArray(value)) return [];
  return value.filter((d): d is ApiErrorDetail => typeof d === "object" && d !== null);
}

/** 오류 응답(`{ error: { code, message, details[] } }`)을 `ApiError`로 정규화한다. SSE 연결 실패도 같은 규칙을 쓴다. */
export function apiErrorFromResponse(response: Response, payload: unknown): ApiError {
  const error = (payload as { error?: Record<string, unknown> } | undefined)?.error;
  return new ApiError({
    status: response.status,
    code: typeof error?.code === "string" ? error.code : "UNKNOWN_ERROR",
    message: typeof error?.message === "string" ? error.message : "요청을 처리하지 못했습니다.",
    details: toDetails(error?.details),
    retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After")),
  });
}

export interface ApiClient {
  request<T>(options: RequestOptions): Promise<ApiResponse<T>>;
  /** 가장 최근 응답의 `Date`로 추정한 `서버 시각 − 기기 시각`(ms). 응답을 받은 적이 없으면 `null`. */
  getClockOffsetMs(): number | null;
  /** 보정한 현재 시각(ms). 차이를 모르면 기기 시각을 그대로 쓴다. */
  serverNow(): number;
}

/**
 * 모든 요청의 단일 진입점(FD-5). 자동 재시도를 하지 않으며 모르는 응답 필드는 무시한다.
 * 키·헤더는 호출자가 인자로 넘기고, URL(경로·쿼리)에는 싣지 않는다.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const now = options.now ?? Date.now;
  let clockOffsetMs: number | null = null;

  function recordServerDate(response: Response) {
    const header = response.headers.get("Date");
    if (!header) return;
    const serverTime = Date.parse(header);
    if (Number.isNaN(serverTime)) return;
    clockOffsetMs = serverTime - now();
  }

  async function request<T>(req: RequestOptions): Promise<ApiResponse<T>> {
    const url = new URL(baseUrl + req.path);
    for (const [name, value] of Object.entries(req.query ?? {})) {
      if (value !== undefined) url.searchParams.set(name, value);
    }

    const headers: Record<string, string> = { Accept: "application/json", ...req.headers };
    let body: string | undefined;
    if (req.body !== undefined) {
      body = JSON.stringify(req.body);
      headers["Content-Type"] = "application/json";
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeoutMs = req.timeoutMs ?? (req.method === "GET" ? READ_TIMEOUT_MS : MUTATION_TIMEOUT_MS);
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onCallerAbort = () => controller.abort();
    if (req.signal) {
      if (req.signal.aborted) controller.abort();
      else req.signal.addEventListener("abort", onCallerAbort, { once: true });
    }

    let response: Response;
    let payload: unknown;
    try {
      response = await doFetch(url.toString(), {
        method: req.method,
        headers,
        body,
        signal: controller.signal,
        cache: "no-store",
      });
      recordServerDate(response);
      // 본문을 다 읽을 때까지 시간 제한이 적용된다.
      const text = await response.text();
      try {
        payload = text === "" ? undefined : JSON.parse(text);
      } catch {
        if (response.ok) {
          throw new ApiError({
            status: response.status,
            code: "INVALID_RESPONSE",
            message: "서버 응답을 해석할 수 없습니다.",
          });
        }
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (timedOut) throw new NetworkError("timeout");
      if (req.signal?.aborted) throw error; // 호출자가 취소했다. 네트워크 오류가 아니다.
      throw new NetworkError("network");
    } finally {
      clearTimeout(timer);
      req.signal?.removeEventListener("abort", onCallerAbort);
    }

    if (!response.ok) throw apiErrorFromResponse(response, payload);

    return {
      status: response.status,
      data: payload as T,
      replayed: response.headers.get("Idempotent-Replayed") === "true",
    };
  }

  return {
    request,
    getClockOffsetMs: () => clockOffsetMs,
    serverNow: () => now() + (clockOffsetMs ?? 0),
  };
}
