import type { ComponentProps } from "react";
import { cva, cx } from "styled-system/css";

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

/** 높이는 변형이 정한다(주·위험 52px, 회색 전폭 48px, 알약 44px). `large`는 52px·전폭이다. */
type Size = "default" | "large";

// 공통 모양과 변형을 한 `cva`로 병합한다. 원자 클래스를 `cx`로 이어 붙이면 같은 속성(테두리 색·모서리·여백)끼리는
// 생성된 CSS의 순서가 이겨 변형 값이 무시될 수 있다.
const pill = { borderRadius: "full", px: "4", fontSize: "sm", fontWeight: "semibold" } as const;

const button = cva({
  base: {
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
  },
  variants: {
    variant: {
      primary: { minH: "52px", bg: "primary", color: "primaryText", "&:active:not(:disabled)": { bg: "primaryPressed" } },
      secondary: { ...pill, minH: "touch", bg: "paperSubtle", color: "ink" },
      secondaryBlock: { minH: "48px", bg: "paperSubtle", color: "ink", w: "full", fontWeight: "semibold" },
      dangerText: { ...pill, minH: "touch", bg: "paperSubtle", color: "danger" },
      danger: { minH: "52px", bg: "paper", color: "danger", borderColor: "danger" },
      dangerSolid: { minH: "52px", bg: "danger", color: "dangerText" },
    },
    size: {
      default: {},
      // 페이지 아래 행동(저장, 거래 기록하기): 높이 52px, 화면 폭 전체.
      large: { minH: "52px", fontSize: "md", w: "full" },
    },
  },
  defaultVariants: { variant: "primary", size: "default" },
});

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
}

/** 버튼 모양의 클래스. 이동 동작은 `<a>`(링크)가 맡고 모양만 버튼을 따를 때 쓴다. */
export function buttonClass({ variant = "primary", size = "default" }: { variant?: Variant; size?: Size } = {}): string {
  return button({ variant, size });
}

/** 터치 목표 44px 이상. 폼 안에서 우연히 제출되지 않도록 기본 `type`은 `button`이다. */
export function Button({ variant = "primary", size = "default", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cx(buttonClass({ variant, size }), className)} {...props} />;
}
