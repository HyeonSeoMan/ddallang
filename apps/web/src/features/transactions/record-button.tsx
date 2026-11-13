"use client";

import { useAtomValue } from "jotai";
import Link from "next/link";
import { css, cx } from "styled-system/css";
import { roomBasePath } from "@/features/room/room-header";
import { useCanMutate } from "@/features/room/server-data-gate";
import { sessionAtom } from "@/features/room/state";
import { buttonClass } from "@/ui/button";

/** 마지막 카드가 버튼 뒤에 가려지지 않도록 확보하는 여백(버튼 높이 + 여유). */
export const RECORD_BUTTON_CLEARANCE_PX = 104;

/**
 * 현황 아래에 고정된 `거래 기록하기` 버튼(U-6). 기록 페이지로 이동하는 링크이며 모양만 버튼이다.
 * 거래 입력 폼과 같은 조건(`canMutate`)에서만 보인다: 게임이 종료되었거나 연결이 끊겨 서버 유래 영역이 가려진
 * 동안은 폼이 없으므로 이 버튼도 없다(S2 §9, S4 §9, S5 §6.5).
 */
export function RecordTransactionButton() {
  const canMutate = useCanMutate();
  const session = useAtomValue(sessionAtom);
  if (!canMutate || !session) return null;

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
          <Link
            href={`${roomBasePath(session.inviteCode)}/record`}
            className={cx(
              buttonClass({ variant: "primary", size: "large" }),
              css({ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }),
            )}
          >
            거래 기록하기
          </Link>
        </div>
      </div>
    </>
  );
}
