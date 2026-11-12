import type { ReactNode } from "react";
import { css, cx } from "styled-system/css";

export type Tone = "neutral" | "info" | "success" | "warning" | "error";

const toneClass: Record<Tone, string> = {
  neutral: css({ bg: "neutralBg", color: "neutralText" }),
  info: css({ bg: "infoBg", color: "infoText" }),
  success: css({ bg: "successBg", color: "successText" }),
  warning: css({ bg: "warningBg", color: "warningText" }),
  error: css({ bg: "errorBg", color: "errorText" }),
};

/** 상태는 색에만 의존하지 않고 항상 텍스트로 쓴다(OQ-033 D). */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        css({ display: "inline-block", px: "3", py: "1", borderRadius: "full", fontSize: "sm", fontWeight: "bold", boxShadow: "chip" }),
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}
