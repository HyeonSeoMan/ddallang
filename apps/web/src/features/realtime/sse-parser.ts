// SSE 파서(FE-S5-1, FD-8): 입력 조각 → 이벤트. 시간·네트워크와 분리된 순수 파서다.
// 조각 경계가 어디든(멀티바이트 문자 중간은 TextDecoder가 이어 붙인다) 같은 이벤트 열이 나온다.

export type SseItem =
  | {
      kind: "event";
      /** `id:` 줄. 없으면 `null`(`ready`·`heartbeat`에는 붙지 않는다). */
      id: string | null;
      /** `event:` 줄. 없으면 SSE 기본값 `message`. */
      event: string;
      /** `data:`를 한 줄 JSON으로 해석한 값. `data`가 없으면 `null`. */
      data: unknown;
      /** `data` 해석에 실패했거나 스트림이 이벤트 도중 끊겼다. 호출자는 이를 변경 알림처럼 다룬다(S5 §6.3 4). */
      malformed: boolean;
    }
  /** `:`로 시작하는 주석 줄(수신 시각 갱신에만 쓴다). */
  | { kind: "comment"; text: string };

export interface SseParser {
  /** 디코딩한 텍스트 조각을 먹이고, 완성된 항목을 돌려준다. */
  feed(text: string): SseItem[];
  /** 스트림이 끝났을 때 호출한다. 빈 줄로 끝나지 않은 잘린 이벤트는 `malformed`로 돌려준다. */
  end(): SseItem[];
}

interface Pending {
  id: string | null;
  event: string | null;
  data: string[];
  hasField: boolean;
}

const emptyPending = (): Pending => ({ id: null, event: null, data: [], hasField: false });

function dispatch(pending: Pending, truncated: boolean): SseItem {
  let data: unknown = null;
  let malformed = truncated;
  if (pending.data.length > 0) {
    try {
      data = JSON.parse(pending.data.join("\n"));
    } catch {
      malformed = true;
    }
  }
  return { kind: "event", id: pending.id, event: pending.event ?? "message", data, malformed };
}

export function createSseParser(): SseParser {
  let line = "";
  let skipLF = false; // 직전 조각이 `\r`로 끝났다면 이어지는 `\n`은 같은 줄바꿈이다
  let atStart = true; // 스트림 맨 앞의 BOM(U+FEFF)은 버린다(SSE 스트림 규격)
  let pending = emptyPending();

  function processLine(raw: string, out: SseItem[]) {
    if (raw === "") {
      if (pending.hasField) out.push(dispatch(pending, false));
      pending = emptyPending();
      return;
    }
    if (raw.startsWith(":")) {
      out.push({ kind: "comment", text: raw.slice(1).replace(/^ /, "") });
      return;
    }
    const colon = raw.indexOf(":");
    const field = colon === -1 ? raw : raw.slice(0, colon);
    let value = colon === -1 ? "" : raw.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "id") {
      pending.id = value;
      pending.hasField = true;
    } else if (field === "event") {
      pending.event = value;
      pending.hasField = true;
    } else if (field === "data") {
      pending.data.push(value);
      pending.hasField = true;
    }
    // `retry` 등 그 밖의 필드는 무시한다.
  }

  return {
    feed(text) {
      const out: SseItem[] = [];
      if (atStart && text.length > 0) {
        atStart = false;
        if (text.startsWith("\uFEFF")) text = text.slice(1);
      }
      for (const ch of text) {
        if (skipLF) {
          skipLF = false;
          if (ch === "\n") continue;
        }
        if (ch === "\n" || ch === "\r") {
          if (ch === "\r") skipLF = true;
          const complete = line;
          line = "";
          processLine(complete, out);
        } else {
          line += ch;
        }
      }
      return out;
    },
    end() {
      const out: SseItem[] = [];
      // 줄바꿈 없이 끝난 마지막 줄도 한 줄로 받아들인 뒤, 빈 줄로 닫히지 않은 이벤트는 잘린 것이다.
      if (line !== "") {
        const last = line;
        line = "";
        processLine(last, out);
      }
      if (pending.hasField) out.push(dispatch(pending, true));
      pending = emptyPending();
      return out;
    },
  };
}
