// 실서버 연동 점검용 네트워크 조작(FE-I1): 앱은 전역 `fetch`를 늦게 묶으므로(`fetch(...args)`) 래퍼로 가로챌 수 있다.
// 접속자 키 단위로 스트림을 끊거나 연결을 막고, 변경 요청의 응답만 잃어버린다(서버에는 반영됨).
export interface Logged {
  method: string;
  path: string;
  idempotencyKey: string | null;
  status: number | null;
  replayed: boolean;
}

export interface NetworkControl {
  /** 이 접속자의 열린 스트림을 네트워크 오류로 끊는다. */
  cut(key: string): void;
  /** 이 접속자의 새 스트림 연결을 막는다(네트워크 오류). */
  block(key: string): void;
  unblock(key: string): void;
  /** 이 접속자의 다음 `POST …/transactions`는 서버가 처리한 뒤 응답을 잃는다(한 번). */
  dropNextTransactionResponse(key: string): void;
  log: Logged[];
  restore(): void;
}

export function installNetworkControl(): NetworkControl {
  const realFetch = globalThis.fetch;
  const controllers = new Map<string, Array<TransformStreamDefaultController<Uint8Array>>>();
  const blocked = new Set<string>();
  const dropOnce = new Set<string>();
  const log: Logged[] = [];

  // `vi.unstubAllGlobals()`는 다른 시험 도구(가짜 저장소)의 전역까지 되돌리므로 `fetch`만 직접 바꾸고 되돌린다.
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const headers = new Headers(init?.headers);
    const key = headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.pathname.endsWith("/events")) {
      if (blocked.has(key)) throw new TypeError("Failed to fetch");
      const response = await realFetch(input, init);
      if (!response.body) return response;
      let controller!: TransformStreamDefaultController<Uint8Array>;
      const piped = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          start(c) {
            controller = c;
          },
          transform(chunk, c) {
            c.enqueue(chunk);
          },
        }),
      );
      controllers.set(key, [...(controllers.get(key) ?? []), controller]);
      return new Response(piped, { status: response.status, headers: response.headers });
    }

    const entry: Logged = {
      method,
      path: url.pathname,
      idempotencyKey: headers.get("Idempotency-Key"),
      status: null,
      replayed: false,
    };
    log.push(entry);
    const response = await realFetch(input, init);
    entry.status = response.status;
    entry.replayed = response.headers.get("Idempotent-Replayed") === "true";
    if (method === "POST" && url.pathname.endsWith("/transactions") && dropOnce.delete(key)) {
      throw new TypeError("Failed to fetch"); // 서버는 처리했지만 응답이 도착하지 않았다
    }
    return response;
  };

  return {
    cut(key) {
      for (const c of controllers.get(key) ?? []) {
        try {
          c.error(new TypeError("network error"));
        } catch {
          // 이미 닫힌 스트림
        }
      }
      controllers.delete(key);
    },
    block: (key) => void blocked.add(key),
    unblock: (key) => void blocked.delete(key),
    dropNextTransactionResponse: (key) => void dropOnce.add(key),
    log,
    restore: () => {
      globalThis.fetch = realFetch;
    },
  };
}

/** 객체의 모든 키 경로(배열은 `[]`로 합친다). 응답 모양 비교용. */
export function keyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => keyPaths(item, `${prefix}[]`));
  if (value === null || typeof value !== "object") return prefix ? [prefix] : [];
  return Object.entries(value).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    const nested = keyPaths(v, path);
    return nested.length > 0 ? nested : [path];
  });
}
