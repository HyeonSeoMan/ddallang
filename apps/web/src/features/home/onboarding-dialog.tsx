"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { css } from "styled-system/css";
import { Button } from "@/ui/button";
import { trapTab } from "@/ui/focus-trap";
import { BagIcon, BellIcon, PeopleIcon } from "@/ui/icons";

const SLIDES: ReadonlyArray<{ title: string; body: string; Icon: (props: { size?: number }) => ReactNode }> = [
  {
    title: "모임의 돈·점수를 함께 기록해요",
    body: "포커, 마작, 보드게임처럼 여럿이 돈이나 점수를 주고받는 자리에서 누가 누구에게 얼마를 줬는지 한곳에 모아요.",
    Icon: BellIcon,
  },
  {
    title: "가입 없이 링크 하나로",
    body: "방을 만들고 초대 링크나 QR을 보내면 친구는 닉네임만 넣고 들어와요. 기록은 모두의 화면에 바로 보여요.",
    Icon: PeopleIcon,
  },
  {
    title: "끝나면 정산까지 한 번에",
    body: "게임을 끝내면 각자의 손익과 누가 누구에게 얼마를 보내면 되는지 알려 줘요. 결과는 복사해서 단톡방에 붙여 넣으면 돼요.",
    Icon: BagIcon,
  },
];

const srOnly = css({
  position: "absolute",
  width: "1px",
  height: "1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
});

/**
 * 첫 방문 소개(DV-25): 화면 아래 시트 모양의 대화상자에서 세 장을 넘겨 본다. 확인 대화상자(FD-11)처럼
 * `aria-modal`, 포커스 가둠, 닫을 때 포커스 복귀를 지키고, `Esc`·`건너뛰기`·마지막 장의 `시작하기`가 모두 닫기다.
 * 바깥 클릭으로는 닫히지 않는다. 장이 바뀌면 제목·본문을 알림 영역으로 읽힌다.
 */
export function OnboardingDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(0);
  // 문서 수준 Esc 리스너가 항상 최신 값을 보도록 ref로 들고 있다.
  const latestClose = useRef(onClose);
  useEffect(() => {
    latestClose.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    nextRef.current?.focus();
    // 마우스로 대화상자 밖을 눌러 포커스가 빠져나가면 되돌린다.
    const keepFocusInside = (event: FocusEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) nextRef.current?.focus();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      latestClose.current();
    };
    document.addEventListener("focusin", keepFocusInside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("focusin", keepFocusInside);
      document.removeEventListener("keydown", onEscape);
      previouslyFocused?.focus?.();
    };
  }, []);

  const last = index === SLIDES.length - 1;
  const { title, body, Icon } = SLIDES[index]!;

  return createPortal(
    <div
      className={css({
        position: "fixed",
        inset: "0",
        bg: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        p: "4",
        pb: "max(16px, env(safe-area-inset-bottom))",
      })}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        onKeyDown={(event) => trapTab(event, dialogRef.current)}
        className={css({ bg: "paper", color: "ink", borderRadius: "lg", p: "6", maxW: "md", w: "full", boxShadow: "float" })}
      >
        <div
          aria-live="polite"
          className={css({ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "2", mb: "5" })}
        >
          <Icon size={64} />
          <p className={css({ color: "inkMuted", fontSize: "sm", fontWeight: "semibold" })}>
            <span aria-hidden="true">
              {index + 1} / {SLIDES.length}
            </span>
            <span className={srOnly}>
              {SLIDES.length}장 중 {index + 1}번째
            </span>
          </p>
          <h2 id={titleId} className={css({ fontSize: "xl", fontWeight: "bold", wordBreak: "keep-all" })}>
            {title}
          </h2>
          <p id={bodyId} className={css({ color: "inkMuted", wordBreak: "keep-all" })}>
            {body}
          </p>
        </div>
        <div className={css({ display: "flex", gap: "2", "& > button": { flex: "1" } })}>
          {!last && (
            <Button variant="secondaryBlock" size="large" onClick={onClose}>
              건너뛰기
            </Button>
          )}
          <Button ref={nextRef} size="large" onClick={() => (last ? onClose() : setIndex(index + 1))}>
            {last ? "시작하기" : "다음"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
