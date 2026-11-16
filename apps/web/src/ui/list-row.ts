import { css } from "styled-system/css";

/**
 * 목록 행(방향 문서 §4, DV-11): 아바타 40px · 이름(위)+메타(아래) · 오른쪽 금액. 행 높이 64px 이상, 행 사이 간격 4px.
 * 이름 칸은 최소 120px이고 긴 이름은 칸 안에서 줄바꿈한다. 이름 칸과 금액이 한 줄에 들지 않으면 금액이 다음 줄
 * 오른쪽으로 내려간다(금액 안에서는 줄바꿈하지 않는다, FD-10).
 */
export const listClass = css({ display: "flex", flexDirection: "column", gap: "1" });

export const rowClass = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  columnGap: "3",
  rowGap: "1",
  minH: "64px",
});

export const rowBodyClass = css({ flex: "1 1 120px", minW: "120px", display: "flex", flexDirection: "column", gap: "0.5" });

export const rowTitleClass = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "1.5",
  overflowWrap: "anywhere",
});

export const rowMetaClass = css({ fontSize: "sm", fontWeight: "medium", color: "inkMuted", overflowWrap: "anywhere" });

/** 금액 칸: 오른쪽 끝, 줄이 넘치면 다음 줄 오른쪽. */
export const rowAmountClass = css({ ml: "auto" });

/** 행 아래 카드 폭 전체로 펼치는 영역(수정 폼, 행 오류 문구). */
export const rowFullClass = css({ flexBasis: "100%" });
