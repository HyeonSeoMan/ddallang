"use client";

import { type ReactNode, useRef, useState } from "react";
import { copyText } from "@/lib/copy";

interface Feedback {
  text: string;
  /** 시도마다 올라간다. 같은 결과가 반복돼도 `aria-live` 영역이 새 변경으로 읽히도록 노드를 바꾼다. */
  seq: number;
}

/**
 * 복사 결과 안내(FD-14, S4 §6.5). 복사를 시작하면 이전 결과를 지우고, **그 시도의 쓰기가 끝난 뒤에만** 결과를 보인다.
 * 연속으로 눌러 시도가 겹치면 마지막 시도의 결과만 반영한다(먼저 끝난 이전 시도의 성공이 현재 시도의 결과로 보이지 않는다).
 * 반환값 `status`를 `aria-live` 영역 안에 그린다.
 */
export function useCopyFeedback(messages: { success: string; failure: string }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const latest = useRef(0);

  async function copy(text: string): Promise<void> {
    const attempt = ++latest.current;
    setFeedback(null); // 이전 결과(성공 문구 포함)는 새 시도가 끝날 때까지 보이지 않는다
    const result = await copyText(text);
    if (attempt !== latest.current) return; // 더 나중에 시작한 시도가 있다
    setFeedback({ text: result.ok ? messages.success : messages.failure, seq: attempt });
  }

  const status: ReactNode = feedback ? <span key={feedback.seq}>{feedback.text}</span> : null;
  return { copy, status };
}
