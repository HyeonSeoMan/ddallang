import type { ComponentProps } from "react";
import { css, cx } from "styled-system/css";

type Variant = "primary" | "secondary" | "danger";

const base = css({
  minH: "touch",
  minW: "touch",
  px: "4",
  borderRadius: "md",
  fontWeight: "semibold",
  cursor: "pointer",
  _disabled: { opacity: 0.6, cursor: "not-allowed" },
});

const variants: Record<Variant, string> = {
  primary: css({ bg: "primary", color: "primaryText" }),
  secondary: css({ bg: "secondary", color: "secondaryText" }),
  danger: css({ bg: "danger", color: "dangerText" }),
};

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
}

/** 터치 목표 44px 이상. 폼 안에서 우연히 제출되지 않도록 기본 `type`은 `button`이다. */
export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cx(base, variants[variant], className)} {...props} />;
}
