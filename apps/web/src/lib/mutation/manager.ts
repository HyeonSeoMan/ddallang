// 변경 요청 매니저(FE-F8, FD-7): 거래 생성·수정·삭제와 게임 종료가 공유하는 요청 시도 관리.
// Idempotency Key와 최초 시도 시각은 메모리에만 두며 저장소에 쓰지 않는다(새로고침하면 사라진다).
import {
  type ApiClient,
  ApiError,
  type HttpMethod,
  type ApiResponse,
  NetworkError,
} from "@/lib/api";
import { encodeBase64Url } from "@/lib/identity/key";

/** 최초 시도 후 이 시간이 지나면 같은 입력을 자동으로 새 키로 보내지 않는다(S2 §5.4). */
export const KEY_LIFETIME_MS = 24 * 60 * 60 * 1000;

export interface MutationRequest {
  method: HttpMethod;
  path: string;
  body?: unknown;
  /** `Authorization` 등. 키·시각 헤더는 매니저가 붙인다. */
  headers?: Record<string, string>;
}

export type MutationOutcome<T> =
  /** 성공. `replayed`면 서버가 저장된 응답을 다시 보낸 것이다(`Idempotent-Replayed`). */
  | { status: "success"; data: T; replayed: boolean; httpStatus: number }
  /** 서버가 확정 거부했다. 키를 버렸고 자동 재전송은 없다. */
  | { status: "rejected"; error: ApiError }
  /** 결과 불명(네트워크·시간 초과·5xx). 성공으로 표시하지 않고 같은 키로 수동 재시도할 수 있다. */
  | { status: "unknown"; error: NetworkError | ApiError }
  /** 같은 작업이 진행 중이라 보내지 않았다(중복 제출 차단). */
  | { status: "in-progress" }
  /** 첫 시도 후 24시간이 지났다. 새 키를 자동으로 만들지 않고 사용자 확인을 기다린다. */
  | { status: "needs-confirmation"; reason: "expired"; firstAttemptAt: number }
  /** 서버 시계 차이를 알아내지 못해 보내지 않았다. */
  | { status: "not-sent"; reason: "clock-unknown"; error: unknown };

export interface SubmitOptions {
  /**
   * 사용자가 "목록에 없음을 확인하고 직접 다시 저장"했음을 뜻한다. 기존 시도를 버리고 새 키·새 시각으로 보낸다.
   * 24시간이 지난 `needs-confirmation` 뒤에만 효력이 있다. 그 전에는 무시하고 같은 키로 재시도한다.
   */
  confirmNewAttempt?: boolean;
}

export type AttemptState =
  | { status: "idle" }
  | { status: "in-progress" }
  | { status: "unknown"; firstAttemptAt: number; expired: boolean };

interface Attempt {
  key: string;
  firstAttemptAt: number;
  fingerprint: string;
  state: "in-progress" | "unknown";
}

export interface MutationManagerOptions {
  api: ApiClient;
  /**
   * 서버 시계 차이를 아직 모를 때 응답 하나를 받아 알아내는 함수(예: 방 조회).
   * 호출 뒤에도 차이를 모르면 요청을 보내지 않는다.
   */
  syncClock?: () => Promise<unknown>;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function fingerprintOf(request: MutationRequest): string {
  return stableStringify([request.method, request.path, request.body ?? null]);
}

/** CSPRNG 16바이트의 base64url(22자). 정규식 `^[A-Za-z0-9_-]{16,64}$`를 만족한다(S2 §5.1). */
function newKey(): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

/** RFC 3339 UTC 밀리초(예: `2026-11-08T03:21:45.123Z`). */
function formatFirstAttemptAt(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * 결과를 알 수 없는 오류인가. 서버가 처리 여부를 확정해 주지 않은 5xx, 그리고 2xx인데 본문을
 * 해석하지 못한 경우(`INVALID_RESPONSE`)다. 후자는 서버가 이미 저장했을 수 있어 키를 버리면 중복이 생긴다.
 * (Spec은 응답 없음만 명시한다. 안전한 쪽으로 같은 키 재시도를 허용하는 구현 선택이다.)
 */
function isUnknownResult(error: ApiError): boolean {
  return error.status >= 500 || (error.status >= 200 && error.status < 300);
}

export interface MutationManager {
  /**
   * 변경 요청을 보낸다. `scope`는 같은 논리적 작업을 가리키는 이름이다
   * (예: 거래 생성 폼 `create:{roomId}`, 수정 `update:{transactionId}`, 삭제 `delete:{transactionId}`, 종료 `end:{roomId}`).
   * 자동 재전송은 하지 않는다. 같은 입력의 재시도는 호출자(사용자 동작)가 다시 `submit`을 부르는 것이다.
   */
  submit<T>(scope: string, request: MutationRequest, options?: SubmitOptions): Promise<MutationOutcome<T>>;
  getState(scope: string): AttemptState;
  /** 시도를 버린다(예: 목록에서 이미 저장됐음을 확인했거나 사용자가 취소). */
  discard(scope: string): void;
}

export function createMutationManager(options: MutationManagerOptions): MutationManager {
  const { api } = options;
  const attempts = new Map<string, Attempt>();
  /** `submit`이 시작되어 아직 끝나지 않은 작업 범위. 시계 동기화를 기다리는 동안의 중복 호출도 막는다. */
  const inflight = new Set<string>();

  const isExpired = (attempt: Attempt) => api.serverNow() - attempt.firstAttemptAt >= KEY_LIFETIME_MS;

  async function submit<T>(
    scope: string,
    request: MutationRequest,
    submitOptions: SubmitOptions = {},
  ): Promise<MutationOutcome<T>> {
    // 시계 동기화(`syncClock`)를 기다리는 동안에도 같은 작업의 두 번째 호출은 막는다. 그렇지 않으면 서로 다른 키로
    // 두 번 보내 거래가 중복될 수 있다(검수 R-F04, AC-TXN-007-1).
    if (inflight.has(scope) || attempts.get(scope)?.state === "in-progress") return { status: "in-progress" };
    inflight.add(scope);
    try {
      return await submitExclusive<T>(scope, request, submitOptions);
    } finally {
      inflight.delete(scope);
    }
  }

  async function submitExclusive<T>(
    scope: string,
    request: MutationRequest,
    submitOptions: SubmitOptions,
  ): Promise<MutationOutcome<T>> {
    const existing = attempts.get(scope);

    const fingerprint = fingerprintOf(request);
    let attempt: Attempt | undefined;

    const confirmed = submitOptions.confirmNewAttempt === true && existing !== undefined && isExpired(existing);
    if (existing && !confirmed && existing.fingerprint === fingerprint) {
      if (isExpired(existing)) {
        return { status: "needs-confirmation", reason: "expired", firstAttemptAt: existing.firstAttemptAt };
      }
      attempt = existing; // 같은 내용의 수동 재시도: 같은 키·같은 시각
    } else if (existing) {
      attempts.delete(scope); // 내용이 바뀌었거나 사용자가 새 시도를 확인했다
    }

    if (!attempt) {
      if (api.getClockOffsetMs() === null && options.syncClock) {
        try {
          await options.syncClock();
        } catch (error) {
          return { status: "not-sent", reason: "clock-unknown", error };
        }
      }
      // 차이를 알아내지 못하면(동기화 함수가 없는 경우 포함) 기기 시각으로 보내지 않는다(S2 §9).
      if (api.getClockOffsetMs() === null) {
        return { status: "not-sent", reason: "clock-unknown", error: new Error("서버 시각을 알 수 없습니다.") };
      }
      attempt = { key: newKey(), firstAttemptAt: api.serverNow(), fingerprint, state: "in-progress" };
    }

    attempt.state = "in-progress";
    attempts.set(scope, attempt);

    try {
      const response: ApiResponse<T> = await api.request<T>({
        method: request.method,
        path: request.path,
        body: request.body,
        headers: {
          ...request.headers,
          "Idempotency-Key": attempt.key,
          "Idempotency-First-Attempt-At": formatFirstAttemptAt(attempt.firstAttemptAt),
        },
      });
      attempts.delete(scope);
      return { status: "success", data: response.data, replayed: response.replayed, httpStatus: response.status };
    } catch (error) {
      if (error instanceof ApiError && !isUnknownResult(error)) {
        attempts.delete(scope);
        return { status: "rejected", error };
      }
      if (error instanceof NetworkError || error instanceof ApiError) {
        attempt.state = "unknown";
        return { status: "unknown", error };
      }
      // 요청을 보낸 뒤의 취소·예기치 않은 오류: 서버가 처리했을 수 있으므로 키를 버리지 않는다.
      attempt.state = "unknown";
      throw error;
    }
  }

  return {
    submit,
    getState(scope) {
      if (inflight.has(scope)) return { status: "in-progress" };
      const attempt = attempts.get(scope);
      if (!attempt) return { status: "idle" };
      if (attempt.state === "in-progress") return { status: "in-progress" };
      return { status: "unknown", firstAttemptAt: attempt.firstAttemptAt, expired: isExpired(attempt) };
    },
    discard(scope) {
      attempts.delete(scope);
    },
  };
}
