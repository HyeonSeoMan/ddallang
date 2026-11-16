import type { ComponentProps } from "react";
import { css, cx } from "styled-system/css";

/**
 * 버튼 변형(FD-18 1.3.0). 모두 납작하고 그림자가 없다.
 * - `primary`: 초록 채움(주요 행동)
 * - `secondary`: 회색 알약(보조 행동)
 * - `secondaryBlock`: 회색 전폭(`더 보기`·`정산 복사`)
 * - `dangerText`: 회색 알약 + 빨강 글자(삭제)
 * - `danger`: 흰 바탕 + 빨강 테두리(게임 종료)
 * - `dangerSolid`: 빨강 채움(확인 대화상자의 실행)
 */
type Variant = "primary" | "secondary" | "secondaryBlock" | "dangerText" | "danger" | "dangerSolid";

const base = css({
  minW: "touch",
  px: "5",
  borderRadius: "md",
  borderWidth: "1px",
  borderColor: "transparent",
  fontWeight: "bold",
  cursor: "pointer",
  transition: "background-color 80ms ease",
  // 비활성은 종류와 상관없이 같은 모양이다. 비활성 이유 문구·속성 처리는 호출하는 쪽이 그대로 맡는다.
  _disabled: { bg: "disabledBg", color: "disabledText", borderColor: "transparent", cursor: "not-allowed" },
});

const pill = css({ borderRadius: "full", px: "4", fontSize: "sm", fontWeight: "semibold" });

const variants: Record<Variant, string> = {
  primary: css({ bg: "primary", color: "primaryText", _active: { bg: "primaryPressed" } }),
  secondary: cx(pill, css({ bg: "paperSubtle", color: "ink" })),
  secondaryBlock: css({ bg: "paperSubtle", color: "ink", w: "full", fontWeight: "semibold" }),
  dangerText: cx(pill, css({ bg: "paperSubtle", color: "danger" })),
  danger: css({ bg: "paper", color: "danger", borderColor: "danger" }),
  dangerSolid: css({ bg: "danger", color: "dangerText" }),
};

/** 높이는 크기 변형이 정한다(같은 속성을 `className`으로 덮어쓰면 클래스 순서에 따라 지는 일이 생긴다). */
type Size = "default" | "large";

const sizes: Record<Size, string> = {
  default: css({ minH: "touch" }),
  // 페이지 아래 행동(저장, 거래 기록하기): 높이 52px, 화면 폭 전체.
  large: css({ minH: "52px", fontSize: "md", w: "full" }),
};

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
}

/** 버튼 모양의 클래스. 이동 동작은 `<a>`(링크)가 맡고 모양만 버튼을 따를 때 쓴다. */
export function buttonClass({ variant = "primary", size = "default" }: { variant?: Variant; size?: Size } = {}): string {
  return cx(base, variants[variant], sizes[size]);
}

/** 터치 목표 44px 이상. 폼 안에서 우연히 제출되지 않도록 기본 `type`은 `button`이다. */
export function Button({ variant = "primary", size = "default", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cx(buttonClass({ variant, size }), className)} {...props} />;
}
