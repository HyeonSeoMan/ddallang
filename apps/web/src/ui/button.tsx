import type { ComponentProps } from "react";
import { css, cx } from "styled-system/css";

type Variant = "primary" | "accent" | "secondary" | "danger";

const base = css({
  minW: "touch",
  px: "5",
  borderRadius: "md",
  fontWeight: "bold",
  cursor: "pointer",
  transition: "transform 80ms ease, box-shadow 80ms ease",
  _active: { transform: "translateY(2px)", boxShadow: "buttonPressed" },
  _disabled: { opacity: 0.6, cursor: "not-allowed", boxShadow: "none", transform: "none" },
});

const variants: Record<Variant, string> = {
  primary: css({ bg: "primary", color: "primaryText", boxShadow: "button" }),
  accent: css({ bg: "accent", color: "accentText", boxShadow: "buttonAccent" }),
  secondary: css({ bg: "secondary", color: "secondaryText", boxShadow: "chip" }),
  danger: css({ bg: "danger", color: "dangerText", boxShadow: "chip" }),
};

/** 높이는 크기 변형이 정한다(같은 속성을 `className`으로 덮어쓰면 클래스 순서에 따라 지는 일이 생긴다). */
type Size = "default" | "large";

const sizes: Record<Size, string> = {
  default: css({ minH: "touch" }),
  large: css({ minH: "14", fontSize: "lg", w: "full" }),
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
