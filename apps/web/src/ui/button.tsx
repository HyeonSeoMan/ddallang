import type { ComponentProps } from "react";
import { css, cx } from "styled-system/css";

type Variant = "primary" | "accent" | "secondary" | "danger";

const base = css({
  minH: "touch",
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

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
}

/** 터치 목표 44px 이상. 폼 안에서 우연히 제출되지 않도록 기본 `type`은 `button`이다. */
export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cx(base, variants[variant], className)} {...props} />;
}
