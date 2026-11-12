/** `details[]`의 한 항목. 검증 사유·한도·서버 시각 중 해당하는 필드만 온다. */
export interface ApiErrorDetail {
  field?: string;
  code?: string;
  limit?: number;
  serverTime?: string;
}

/** 서버가 응답한 오류(`{ error: { code, message, details[] } }`). 분기는 `code`, 표시는 `message`다. */
export class ApiError extends Error {
  readonly status: number;
  /** 서버가 보낸 코드. 알 수 없는 값도 그대로 보존한다(`isKnownErrorCode`로 확인). */
  readonly code: string;
  readonly details: ApiErrorDetail[];
  /** 응답 `Retry-After`(초). 없거나 숫자가 아니면 `null`. */
  readonly retryAfterSeconds: number | null;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    retryAfterSeconds?: number | null;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }
}

/** 응답을 받지 못한 경우. 변경 요청이면 서버에서 처리됐는지 알 수 없다(결과 불명). */
export class NetworkError extends Error {
  readonly reason: "network" | "timeout";

  constructor(reason: "network" | "timeout") {
    super(reason === "timeout" ? "요청 시간이 초과되었습니다." : "네트워크 오류가 발생했습니다.");
    this.name = "NetworkError";
    this.reason = reason;
  }
}
