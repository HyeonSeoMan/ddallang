import type { ReactNode } from "react";
import { css, cx } from "styled-system/css";
import type { Tone } from "./badge";

const toneClass: Record<Tone, string> = {
  neutral: css({ bg: "neutralBg", color: "neutralText" }),
  info: css({ bg: "infoBg", color: "infoText" }),
  success: css({ bg: "successBg", color: "successText" }),
  warning: css({ bg: "warningBg", color: "warningText" }),
  error: css({ bg: "errorBg", color: "errorText" }),
};

/** 오류·경고는 `role="alert"`, 그 밖은 `role="status"`로 안내한다. */
export function Banner({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  const urgent = tone === "error" || tone === "warning";
  return (
    <div
      role={urgent ? "alert" : "status"}
      className={cx(css({ p: "4", borderRadius: "md", fontWeight: "semibold", boxShadow: "chip" }), toneClass[tone])}
    >
      {children}
    </div>
  );
}
