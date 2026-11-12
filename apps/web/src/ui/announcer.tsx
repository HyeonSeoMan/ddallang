"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { css } from "styled-system/css";

export interface AnnounceOptions {
  /** 긴급 안내(`aria-live="assertive"`). 기본은 `polite`. */
  assertive?: boolean;
}

type Announce = (message: string, options?: AnnounceOptions) => void;

const AnnouncerContext = createContext<Announce | null>(null);

interface Message {
  text: string;
  seq: number;
}

const srOnly = css({
  position: "absolute",
  width: "1px",
  height: "1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
});

/** `aria-live` 알림 영역. 같은 문구를 다시 알려도 읽히도록 매번 새 노드로 바꾼다. */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState<Message>({ text: "", seq: 0 });
  const [assertive, setAssertive] = useState<Message>({ text: "", seq: 0 });

  const announce = useCallback<Announce>((message, options) => {
    const set = options?.assertive ? setAssertive : setPolite;
    set((prev) => ({ text: message, seq: prev.seq + 1 }));
  }, []);
  const value = useMemo(() => announce, [announce]);

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className={srOnly}>
        <span key={polite.seq}>{polite.text}</span>
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className={srOnly}>
        <span key={assertive.seq}>{assertive.text}</span>
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnounce(): Announce {
  const announce = useContext(AnnouncerContext);
  if (!announce) throw new Error("useAnnounce는 AnnouncerProvider 안에서만 쓸 수 있습니다.");
  return announce;
}
