// 디자인 토큰(FE-V1, FD-18 1.3.0, U-12). 값은 최종 UI 확정본 `docs/design/direction-v2-banksalad.md` §3을 따른다.
// 모든 글자 쌍은 대비 4.5:1, 기능 경계·초점은 3:1 이상이며 `tokens.test.ts`가 계산해 확인한다.

export const colors = {
  /** 화면 바탕. 흰 카드(`paper`)가 그림자 없이 색 차이로 구분된다. */
  canvas: "#f6f7f9",
  paper: "#ffffff",
  /** 카드 안 타일, 보조 버튼, 배지, 아이콘 원. 입력·선택 상자 바탕으로 쓰지 않는다(`line`과 3:1 미만). */
  paperSubtle: "#f2f4f6",
  /** 본문·금액·손실 금액. */
  ink: "#1b1d1f",
  inkMuted: "#5f6670",
  /** 입력·선택 상자·타일 경계(흰 바탕 위에서만, 비텍스트 대비 3:1). 장식 구분선은 `divider`. */
  line: "#8a9099",
  /** 장식용 구분선. 정보를 전하지 않으므로 대비 기준 대상이 아니다. */
  divider: "#eef0f2",
  /** 주 버튼 바탕·포커스 링·선택 표시. 글자색으로는 쓰지 않는다(초록 글자는 `brandText`). */
  primary: "#00875a",
  primaryPressed: "#00704b",
  primaryText: "#ffffff",
  brandText: "#007a51",
  /** 흰 바탕 위 장식(아이콘 면)에만 쓴다. 뜻을 전하는 표시에는 쓰지 않는다. */
  brandBright: "#0da46d",
  primarySoft: "#e8f6ef",
  /** 오류 글자, 삭제·게임 종료 버튼. */
  danger: "#c62f2f",
  dangerText: "#ffffff",
  /** 동전 노랑. 아이콘·그림 전용이며 글자 바탕으로 쓰지 않는다. */
  coin: "#ffc93c",
  /** 이익·손실 글자색. 손실은 검정이고 항상 `+`·`−` 부호를 함께 쓴다(FD-10, 색에만 의존하지 않음). */
  gain: "#007a51",
  loss: "#1b1d1f",
  infoBg: "#eaf3ff",
  infoText: "#1b5fc9",
  successBg: "#e8f6ef",
  successText: "#007a51",
  warningBg: "#fff4e5",
  warningText: "#8a4b00",
  errorBg: "#fdecec",
  errorText: "#b42318",
  neutralBg: "#f2f4f6",
  neutralText: "#5f6670",
  /** 비활성 버튼(종류와 상관없이). */
  disabledBg: "#f2f4f6",
  disabledText: "#5f6670",
  focus: "#00875a",
} as const;

export type ColorToken = keyof typeof colors;

/** 아바타 바탕 6색(장식). 글자는 `ink`이며 이름이 항상 함께 나온다. */
export const avatarColors = ["#ddf3e8", "#e1ecff", "#ffe8d6", "#f1e4ff", "#ffe1e6", "#e5e8eb"] as const;

/** 모서리: 카드 20, 컨트롤 12, 타일·띠 14, 알약은 완전히 둥글게. */
export const radii = {
  card: "20px",
  control: "12px",
  tile: "14px",
  chip: "999px",
} as const;

/** 깊이: 카드·헤더·버튼에는 그림자가 없다. 확인 대화상자만 떠 있다. */
export const shadows = {
  float: "0 2px 4px rgba(20, 30, 25, 0.06), 0 14px 34px rgba(20, 30, 25, 0.16)",
} as const;

/** 글꼴: Pretendard 가변 글꼴을 자체 호스팅한다(`app/layout.tsx`). 외부 글꼴 서버는 쓰지 않는다(FD-18). */
export const FONT_STACK =
  'var(--font-pretendard), Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif';

/** 글자 크기 규칙(FD-18): 제목 20/700, 본문 16/400, 메타 14/500, 캡션 12, 목록 금액 18/700, 금액 입력 24/700. */
export const fontSizes = {
  caption: "12px",
  meta: "14px",
  body: "16px",
  title: "20px",
  amountList: "18px",
  amountInput: "24px",
} as const;

/** 글자 위에 글자를 얹는 쌍. 모두 4.5:1 이상이어야 한다. */
export const textPairs: ReadonlyArray<readonly [foreground: ColorToken, background: ColorToken]> = [
  ["ink", "paper"],
  ["ink", "canvas"],
  ["ink", "paperSubtle"],
  ["inkMuted", "paper"],
  ["inkMuted", "canvas"],
  ["inkMuted", "paperSubtle"],
  ["inkMuted", "primarySoft"],
  ["primaryText", "primary"],
  ["primaryText", "primaryPressed"],
  ["dangerText", "danger"],
  ["infoText", "infoBg"],
  ["successText", "successBg"],
  ["warningText", "warningBg"],
  ["errorText", "errorBg"],
  ["neutralText", "neutralBg"],
  ["disabledText", "disabledBg"],
  ["brandText", "paper"],
  ["brandText", "canvas"],
  ["brandText", "primarySoft"],
  ["danger", "paper"],
  ["danger", "canvas"],
  ["danger", "paperSubtle"],
  ["gain", "paper"],
  ["gain", "canvas"],
  ["gain", "successBg"],
  ["loss", "paper"],
  ["loss", "canvas"],
  ["errorText", "paper"],
];

/** 글자가 아닌 경계·초점·선택 표시 쌍(WCAG 비텍스트 대비 3:1). `line`은 흰 바탕 위에서만 쓴다. */
export const nonTextPairs: ReadonlyArray<readonly [foreground: ColorToken, background: ColorToken]> = [
  ["line", "paper"],
  ["focus", "paper"],
  ["focus", "canvas"],
  ["primary", "primarySoft"],
  ["danger", "primarySoft"],
];

/** 최소 터치 목표(OQ-033 D). */
export const TOUCH_TARGET_PX = 44;
