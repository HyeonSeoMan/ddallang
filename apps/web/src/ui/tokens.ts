// 디자인 토큰(FE-D1, FD-18, U-5). 시안 v1(`docs/design/mockup-v1.html`)의 값을 출발점으로 하되 모든 글자 쌍을
// 대비 4.5:1 이상으로 조정했다(RK-F15). 시안의 보조 글자색은 회색 바탕에서 4.5:1에 못 미쳐 더 어둡게 했다.
// 대비는 `tokens.test.ts`가 계산해 확인한다. 최종 UI 승인이 아니다.

export const colors = {
  /** 화면 바탕. 흰 카드(`paper`)가 이 위에 떠 보인다. */
  canvas: "#f3f5f4",
  paper: "#ffffff",
  paperSubtle: "#eef1ef",
  ink: "#111614",
  inkMuted: "#55615a",
  /** 입력 테두리 같은 기능 경계(비텍스트 대비 3:1). 장식 구분선은 `divider`. */
  line: "#7f8c85",
  /** 장식용 구분선. 정보를 전하지 않으므로 대비 기준 대상이 아니다. */
  divider: "#e4e9e6",
  primary: "#12804f",
  primaryText: "#ffffff",
  danger: "#b8322a",
  dangerText: "#ffffff",
  secondary: "#e8ece9",
  secondaryText: "#111614",
  /** 딸랑 노랑: 보조 강조(코인·정산 요약·거래 입력 버튼). */
  accent: "#ffc93c",
  accentText: "#3a2a00",
  accentSoft: "#fff3c9",
  /** 이익·손실 글자색. 색에만 의존하지 않고 항상 `+`·`−` 부호를 함께 쓴다(FD-10). */
  gain: "#0b6b45",
  loss: "#b8322a",
  infoBg: "#e6f1fb",
  infoText: "#14406b",
  successBg: "#e2f4ea",
  successText: "#0b5a3a",
  warningBg: "#fff3c9",
  warningText: "#6b4a00",
  errorBg: "#fde8e5",
  errorText: "#8f2118",
  neutralBg: "#e8ece9",
  neutralText: "#111614",
  focus: "#12804f",
} as const;

export type ColorToken = keyof typeof colors;

/** 모서리: 카드는 크게, 컨트롤은 중간, 알약은 완전히 둥글게. */
export const radii = {
  card: "24px",
  control: "16px",
  chip: "999px",
} as const;

/** 깊이: 카드는 얕게, 떠 있는 요소(대화상자 등)는 깊게, 버튼은 하단 가장자리를 둔다. */
export const shadows = {
  card: "0 1px 2px rgba(20, 30, 25, 0.04), 0 10px 28px rgba(20, 30, 25, 0.07)",
  float: "0 2px 4px rgba(20, 30, 25, 0.06), 0 14px 34px rgba(20, 30, 25, 0.16)",
  button: "0 3px 0 rgba(0, 0, 0, 0.22), 0 12px 22px rgba(18, 128, 79, 0.28)",
  buttonAccent: "0 3px 0 rgba(150, 100, 0, 0.35), 0 12px 22px rgba(255, 190, 30, 0.34)",
  buttonPressed: "0 1px 0 rgba(0, 0, 0, 0.2), 0 6px 12px rgba(0, 0, 0, 0.15)",
  chip: "0 2px 0 rgba(0, 0, 0, 0.07), 0 4px 8px rgba(0, 0, 0, 0.06)",
} as const;

/** 글꼴: Pretendard 가변 글꼴을 자체 호스팅한다(`app/layout.tsx`). 외부 글꼴 서버는 쓰지 않는다(FD-18). */
export const FONT_STACK =
  'var(--font-pretendard), Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif';

/** 글자 크기 규칙(FD-18): 제목 20/700, 본문 16/400, 메타 14/500, 캡션 12. */
export const fontSizes = {
  caption: "12px",
  meta: "14px",
  body: "16px",
  title: "20px",
  amount: "28px",
} as const;

/** 글자 위에 글자를 얹는 쌍. 모두 4.5:1 이상이어야 한다. */
export const textPairs: ReadonlyArray<readonly [foreground: ColorToken, background: ColorToken]> = [
  ["ink", "paper"],
  ["ink", "canvas"],
  ["ink", "paperSubtle"],
  ["ink", "accentSoft"],
  ["inkMuted", "paper"],
  ["inkMuted", "canvas"],
  ["inkMuted", "paperSubtle"],
  ["primaryText", "primary"],
  ["dangerText", "danger"],
  ["secondaryText", "secondary"],
  ["accentText", "accent"],
  ["infoText", "infoBg"],
  ["successText", "successBg"],
  ["warningText", "warningBg"],
  ["errorText", "errorBg"],
  ["neutralText", "neutralBg"],
  ["primary", "paper"],
  ["primary", "canvas"],
  ["danger", "paper"],
  ["danger", "canvas"],
  ["gain", "paper"],
  ["gain", "canvas"],
  ["gain", "successBg"],
  ["loss", "paper"],
  ["loss", "canvas"],
  ["errorText", "paper"],
];

/** 글자가 아닌 경계·초점 표시 쌍(WCAG 비텍스트 대비 3:1). */
export const nonTextPairs: ReadonlyArray<readonly [foreground: ColorToken, background: ColorToken]> = [
  ["line", "paper"],
  ["line", "canvas"],
  ["focus", "paper"],
  ["focus", "canvas"],
];

/** 최소 터치 목표(OQ-033 D). */
export const TOUCH_TARGET_PX = 44;
