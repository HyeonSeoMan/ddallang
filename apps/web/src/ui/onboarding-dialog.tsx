"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { css } from "styled-system/css";
import { Button } from "./button";
import { trapTab } from "./focus-trap";
import { srOnly } from "./sr-only";

export interface OnboardingSlide {
  title: string;
  body: string;
  Icon: (props: { size?: number }) => ReactNode;
}

/**
 * 온보딩 대화상자(DV-25·DV-26): 화면 아래 시트 모양의 대화상자에서 소개 장을 차례로 넘겨 본다. 확인 대화상자(FD-11)처럼
 * `aria-modal`, 포커스 가둠, 닫을 때 포커스 복귀를 지키고(다른 대화상자가 뜨면 그쪽에 양보한다), `Esc`·`건너뛰기`·마지막 장의 `시작하기`가 모두 닫기다.
 * 바깥 클릭으로는 닫히지 않는다. 장이 바뀌면 제목·본문을 알림 영역으로 읽힌다.
 */
export function OnboardingDialog({ slides, onClose }: { slides: readonly OnboardingSlide[]; onClose: () => void }) {
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
    // 확인 대화상자처럼 저절로 뜨는 다른 대화상자가 있으면 그쪽에 포커스와 `Esc`를 양보한다.
    // 서로 포커스를 되찾으려 하면 끝없이 반복된다.
    const inOtherModal = (node: EventTarget | null) =>
      node instanceof Element &&
      !dialogRef.current?.contains(node) &&
      node.closest('[aria-modal="true"]') !== null;
    // 마우스로 대화상자 밖을 눌러 포커스가 빠져나가면 되돌린다.
    const keepFocusInside = (event: FocusEvent) => {
      if (inOtherModal(event.target)) return;
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) nextRef.current?.focus();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || inOtherModal(document.activeElement)) return;
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

  const last = index === slides.length - 1;
  const { title, body, Icon } = slides[index]!;

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
              {index + 1} / {slides.length}
            </span>
            <span className={srOnly}>
              {slides.length}장 중 {index + 1}번째
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
