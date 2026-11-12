// 가짜 SSE 스트림(FD-8, FD-16): 조각 단위로 밀어 넣고, 끊고, 지연시킨다.

export interface SseEventInit {
  id?: string | number;
  event?: string;
  data?: unknown;
}

/** SSE 형식 문자열(`id`·`event`·`data` 줄과 빈 줄). `data`는 한 줄 JSON이다. */
export function formatSseEvent({ id, event, data }: SseEventInit): string {
  let text = "";
  if (id !== undefined) text += `id: ${id}\n`;
  if (event !== undefined) text += `event: ${event}\n`;
  if (data !== undefined) text += `data: ${JSON.stringify(data)}\n`;
  return text + "\n";
}

/** 바이트 열을 주어진 경계에서 잘라 조각 배열로 만든다(경계는 오름차순, 범위 밖은 무시). */
export function splitBytesAt(bytes: Uint8Array, boundaries: number[]): Uint8Array[] {
  const cuts = [...new Set(boundaries)]
    .filter((b) => b > 0 && b < bytes.length)
    .sort((a, b) => a - b);
  const chunks: Uint8Array[] = [];
  let start = 0;
  for (const cut of cuts) {
    chunks.push(bytes.slice(start, cut));
    start = cut;
  }
  chunks.push(bytes.slice(start));
  return chunks;
}

export interface FakeSse {
  /** `fetch`가 돌려줄 `200 text/event-stream` 응답. */
  response(): Response;
  /** 원시 문자열 또는 바이트 조각을 그대로 밀어 넣는다. */
  push(chunk: string | Uint8Array): void;
  pushEvent(init: SseEventInit): void;
  /** `: heartbeat` 같은 주석 줄. */
  pushComment(text?: string): void;
  /** 서버가 정상적으로 스트림을 닫는다. */
  close(): void;
  /** 스트림이 오류로 끊긴다(연결 끊김). */
  error(reason?: unknown): void;
  /** 클라이언트가 취소(`AbortController`)했는지. */
  readonly cancelled: boolean;
}

export function createFakeSse(): FakeSse {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let cancelled = false;
  let finished = false;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      cancelled = true;
      finished = true;
    },
  });

  const push = (chunk: string | Uint8Array) => {
    if (finished) return;
    controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
  };

  return {
    response: () =>
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" },
      }),
    push,
    pushEvent: (init) => push(formatSseEvent(init)),
    pushComment: (text = "heartbeat") => push(`: ${text}\n\n`),
    close: () => {
      if (finished) return;
      finished = true;
      controller.close();
    },
    error: (reason = new TypeError("network error")) => {
      if (finished) return;
      finished = true;
      controller.error(reason);
    },
    get cancelled() {
      return cancelled;
    },
  };
}
