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

const bandClass = css({ px: "4", py: "3", borderRadius: "tile", fontSize: "sm", fontWeight: "semibold" });

/**
 * 오류·경고는 `role="alert"`, 그 밖은 `role="status"`로 안내한다. 모양은 카드 폭의 띠다(FD-18).
 * `icon`은 장식이라 왼쪽에 두기만 하며, 없으면 마크업이 아이콘 없는 띠와 같다.
 */
export function Banner({ tone = "info", icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  const urgent = tone === "error" || tone === "warning";
  if (!icon) {
    return (
      <div role={urgent ? "alert" : "status"} className={cx(bandClass, toneClass[tone])}>
        {children}
      </div>
    );
  }
  return (
    <div
      role={urgent ? "alert" : "status"}
      className={cx(bandClass, css({ display: "flex", alignItems: "flex-start", gap: "2.5" }), toneClass[tone])}
    >
      <span aria-hidden="true" className={css({ display: "flex", flex: "none", lineHeight: "0" })}>
        {icon}
      </span>
      <div className={css({ flex: "1", minW: "0" })}>{children}</div>
    </div>
  );
}
