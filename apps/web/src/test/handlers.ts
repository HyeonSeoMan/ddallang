import { delay, http, HttpResponse, type HttpHandler, type JsonBodyType } from "msw";
import type { ApiErrorDetail } from "@/lib/api/errors";
import { type ErrorCode } from "@/lib/api/types";
import { TEST_API_BASE_URL } from "./fixtures";

export function apiUrl(path: string): string {
  return TEST_API_BASE_URL + path;
}

/** 오류 코드별 HTTP 상태(S1 §3.4, S2 §3.6, S5 §3.3). */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  HOST_ONLY: 403,
  NOT_AUTHOR_OR_HOST: 403,
  ROOM_NOT_FOUND: 404,
  INVITE_NOT_FOUND: 404,
  PARTICIPANT_NOT_FOUND: 404,
  TRANSACTION_NOT_FOUND: 404,
  ROUTE_NOT_FOUND: 404,
  NOT_SUPPORTED: 405,
  GAME_ENDED: 409,
  NICKNAME_TAKEN: 409,
  MEMBER_LIMIT_EXCEEDED: 409,
  PARTICIPANT_LIMIT_EXCEEDED: 409,
  TRANSACTION_DELETED: 409,
  PARTICIPANT_INACTIVE: 409,
  TRANSACTION_LIMIT_EXCEEDED: 409,
  IDEMPOTENCY_CONFLICT: 409,
  IDEMPOTENCY_KEY_EXPIRED: 409,
  VALIDATION_FAILED: 422,
  CONNECTION_LIMIT_EXCEEDED: 429,
};

/** 서버 오류 응답(`{ error: { code, message, details[] } }`)을 만든다. */
export function errorResponse(
  code: ErrorCode,
  options: { message?: string; details?: ApiErrorDetail[]; headers?: Record<string, string> } = {},
): Response {
  return HttpResponse.json(
    { error: { code, message: options.message ?? `${code} 안내`, details: options.details ?? [] } },
    { status: ERROR_STATUS[code], headers: options.headers },
  );
}

type Method = "get" | "post" | "put" | "patch" | "delete";

/** 항상 같은 JSON을 돌려주는 처리기. */
export function jsonHandler(method: Method, path: string, body: JsonBodyType, status = 200): HttpHandler {
  return http[method](apiUrl(path), () => HttpResponse.json(body, { status }));
}

/** 항상 같은 오류 코드를 돌려주는 처리기(시나리오 도우미). */
export function errorHandler(
  method: Method,
  path: string,
  code: ErrorCode,
  options?: Parameters<typeof errorResponse>[1],
): HttpHandler {
  return http[method](apiUrl(path), () => errorResponse(code, options));
}

/** 응답을 지연시키는 처리기(진행 중 상태·시간 초과 시험). */
export function slowHandler(method: Method, path: string, ms: number, body: JsonBodyType): HttpHandler {
  return http[method](apiUrl(path), async () => {
    await delay(ms);
    return HttpResponse.json(body);
  });
}

/** 연결 자체가 실패하는 처리기(네트워크 오류). */
export function networkErrorHandler(method: Method, path: string): HttpHandler {
  return http[method](apiUrl(path), () => HttpResponse.error());
}
