"use client";

import { css } from "styled-system/css";
import { useCanMutate } from "@/features/room/server-data-gate";
import { Button } from "@/ui/button";

const CONTROL = "select:not([disabled]), input:not([disabled]), textarea:not([disabled])";

/** 마지막 구역이 버튼 뒤에 가려지지 않도록 확보하는 여백(버튼 높이 + 여유). */
export const RECORD_BUTTON_CLEARANCE_PX = 104;

/**
 * 화면 아래 고정 `거래 기록하기` 버튼(U-6, FD-18 (4)). 누르면 거래 입력 구역으로 이동하고 첫 입력에 포커스를 둔다.
 * 새 화면·시트를 열지 않는다(U-7). 거래 입력 폼과 같은 조건(`canMutate`)에서만 보인다: 게임이 종료되었거나
 * 연결이 끊겨 서버 유래 영역이 가려진 동안은 폼이 없으므로 이 버튼도 없다(S2 §9, S4 §9, S5 §6.5).
 */
export function RecordTransactionButton() {
  const canMutate = useCanMutate();
  if (!canMutate) return null;

  function goToEntry() {
    const section = document.querySelector<HTMLElement>('[data-section="entry"]');
    if (!section) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    section.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    section.querySelector<HTMLElement>(CONTROL)?.focus({ preventScroll: true });
  }

  return (
    <>
      <div aria-hidden="true" data-testid="record-button-clearance" style={{ height: RECORD_BUTTON_CLEARANCE_PX }} />
      <div
        className={css({
          position: "fixed",
          left: "0",
          right: "0",
          bottom: "0",
          pointerEvents: "none",
          pt: "10",
          pb: "calc(16px + env(safe-area-inset-bottom, 0px))",
          px: "calc(16px + env(safe-area-inset-left, 0px))",
          background: "linear-gradient(transparent, token(colors.canvas) 55%)",
        })}
      >
        <div className={css({ maxW: "md", mx: "auto", pointerEvents: "auto" })}>
          <Button variant="primary" size="large" onClick={goToEntry}>
            거래 기록하기
          </Button>
        </div>
      </div>
    </>
  );
}
