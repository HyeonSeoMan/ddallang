// SSE 스트림 클라이언트(FE-S5-1, S5 §3.2·§9, FD-8): `fetch` 스트리밍으로 연다. `EventSource`는 쓰지 않는다.
import { type ApiError, apiErrorFromResponse } from "@/lib/api";
import { createSseParser, type SseItem } from "./sse-parser";

export type EventStreamEnd =
  /** 스트림이 열리기 전 HTTP 오류(401·404·422·429+`Retry-After`·5xx). */
  | { kind: "rejected"; error: ApiError }
  /** 스트림이 열리기 전 네트워크 오류. */
  | { kind: "network" }
  /** 서버가 스트림을 정상적으로 닫았다. */
  | { kind: "ended" }
  /** 스트림을 읽다가 오류로 끊겼다. */
  | { kind: "broken" }
  /** 호출자가 `AbortController`로 중단했다. */
  | { kind: "aborted" };

export interface EventStreamOptions {
  url: string;
  /** `Authorization: Bearer`로만 보낸다. URL·쿼리·쿠키에 싣지 않는다. */
  identityKey: string;
  signal: AbortSignal;
  fetch?: typeof fetch;
  /** 응답 헤더(200)를 받아 스트림이 열렸다. */
  onOpen(): void;
  /** 바이트를 받을 때마다(주석 줄·불완전한 조각 포함) 호출한다. "마지막 수신 시각" 갱신용. */
  onActivity(): void;
  onItem(item: SseItem): void;
}

async function readErrorPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** 스트림이 끝날 때까지 읽고 끝난 방식을 돌려준다. 예외를 던지지 않는다. */
export async function runEventStream(options: EventStreamOptions): Promise<EventStreamEnd> {
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  let response: Response;
  try {
    response = await doFetch(options.url, {
      method: "GET",
      headers: { Authorization: `Bearer ${options.identityKey}`, Accept: "text/event-stream" },
      cache: "no-store",
      signal: options.signal,
    });
  } catch {
    return options.signal.aborted ? { kind: "aborted" } : { kind: "network" };
  }

  if (!response.ok) {
    return { kind: "rejected", error: apiErrorFromResponse(response, await readErrorPayload(response)) };
  }
  if (!response.body) return { kind: "broken" };

  options.onOpen();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      options.onActivity();
      for (const item of parser.feed(decoder.decode(value, { stream: true }))) options.onItem(item);
    }
    for (const item of parser.feed(decoder.decode())) options.onItem(item);
    for (const item of parser.end()) options.onItem(item);
    return { kind: "ended" };
  } catch {
    return options.signal.aborted ? { kind: "aborted" } : { kind: "broken" };
  }
}
