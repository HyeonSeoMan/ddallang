// 디자인 토큰(FE-F5, OQ-033 A). 디자인 원본이 없어 최소 토큰만 둔다(사용자 결정 U-1, 최종 UI 승인이 아님).
// 색은 모두 텍스트 대비 4.5:1 이상인 쌍으로 쓰며 `tokens.test.ts`가 계산해 확인한다.

export const colors = {
  paper: "#ffffff",
  paperSubtle: "#f3f4f6",
  ink: "#1f2933",
  inkMuted: "#52606d",
  line: "#8896a5",
  primary: "#1d4ed8",
  primaryText: "#ffffff",
  danger: "#b91c1c",
  dangerText: "#ffffff",
  secondary: "#e4e7eb",
  secondaryText: "#1f2933",
  infoBg: "#dbeafe",
  infoText: "#1e3a8a",
  successBg: "#dcfce7",
  successText: "#14532d",
  warningBg: "#fef3c7",
  warningText: "#78350f",
  errorBg: "#fee2e2",
  errorText: "#7f1d1d",
  neutralBg: "#e4e7eb",
  neutralText: "#1f2933",
  focus: "#1d4ed8",
} as const;

export type ColorToken = keyof typeof colors;

/** 글자색 위에 글자를 얹는 쌍. 모두 4.5:1 이상이어야 한다. */
export const textPairs: ReadonlyArray<readonly [foreground: ColorToken, background: ColorToken]> = [
  ["ink", "paper"],
  ["ink", "paperSubtle"],
  ["inkMuted", "paper"],
  ["inkMuted", "paperSubtle"],
  ["primaryText", "primary"],
  ["dangerText", "danger"],
  ["secondaryText", "secondary"],
  ["infoText", "infoBg"],
  ["successText", "successBg"],
  ["warningText", "warningBg"],
  ["errorText", "errorBg"],
  ["neutralText", "neutralBg"],
  ["primary", "paper"],
  ["danger", "paper"],
];

/** 글자가 아닌 경계·초점 표시 쌍(WCAG 비텍스트 대비 3:1). */
export const nonTextPairs: ReadonlyArray<readonly [foreground: ColorToken, background: ColorToken]> = [
  ["line", "paper"],
  ["focus", "paper"],
];

/** 최소 터치 목표(OQ-033 D). */
export const TOUCH_TARGET_PX = 44;
