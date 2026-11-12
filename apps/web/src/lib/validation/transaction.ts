// 거래 입력 검증(S2 §3.2 사유·라운드, §3.3 금액). 클라이언트 검증은 편의이며 서버 판정이 최종이다(FD-9).
import type { ValidationReasonCode } from "@/lib/api";

export const REASON_MAX = 50;
export const ROUND_MAX = 12;
/** 원본이 이보다 길면 정규화하지 않고 길이 위반으로 거부한다(S2 §3.2 0번). */
export const REASON_RAW_MAX = 200;
export const ROUND_RAW_MAX = 48;
export const AMOUNT_MAX = 999_999_999;

export interface OptionalTextValidation {
  /** NFC로 정규화한 값. "입력 없음"(빈 문자열)이면 `null`. */
  value: string | null;
  reasons: ValidationReasonCode[];
}

// 거부 문자(S2 §3.2 3번): 제어(Cc)·서식(Cf)·서로게이트·사용자 정의·미할당(Cs·Co·Cn)·줄/문단 구분자(Zl·Zp),
// U+0020을 제외한 공백 구분자(Zs), 한글 채움 문자.
const FORBIDDEN = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}ᅟᅠㅤﾠ]|(?! )\p{Zs}/u;

/** 사유·라운드: 선택 입력. 빈 문자열은 입력 없음(`null`)이고 자동 공백 제거는 하지 않는다. */
export function validateOptionalText(raw: string, max: number, rawMax: number): OptionalTextValidation {
  if (raw === "") return { value: null, reasons: [] };
  if ([...raw].length > rawMax) return { value: raw, reasons: ["LENGTH_OUT_OF_RANGE"] };

  const value = raw.normalize("NFC");
  const reasons: ValidationReasonCode[] = [];
  if ([...value].length > max) reasons.push("LENGTH_OUT_OF_RANGE");
  if (FORBIDDEN.test(value)) reasons.push("INVALID_CHARACTER");
  // 공백만으로 된 값도 포함한다. 값 안의 연속 공백은 자유 서술이라 허용한다.
  if (value.startsWith(" ") || value.endsWith(" ")) reasons.push("LEADING_OR_TRAILING_SPACE");
  return { value, reasons };
}

export const validateReason = (raw: string) => validateOptionalText(raw, REASON_MAX, REASON_RAW_MAX);
export const validateRound = (raw: string) => validateOptionalText(raw, ROUND_MAX, ROUND_RAW_MAX);

export type AmountValidation =
  | { ok: true; value: number }
  | { ok: false; reason: ValidationReasonCode };

/**
 * 금액 입력(문자열) 검증: 정수이고 1 이상 999,999,999 이하. 누락은 `REQUIRED`, 숫자가 아니면 `INVALID_TYPE`,
 * 소수는 `INVALID_VALUE`, 0·음수·상한 초과는 `OUT_OF_RANGE`(S2 §3.3). 쉼표 등을 알아서 지우지 않는다.
 */
export function validateAmount(raw: string): AmountValidation {
  if (raw === "") return { ok: false, reason: "REQUIRED" };
  if (/^\d+$/.test(raw)) {
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > AMOUNT_MAX) return { ok: false, reason: "OUT_OF_RANGE" };
    return { ok: true, value };
  }
  if (/^-\d+$/.test(raw)) return { ok: false, reason: "OUT_OF_RANGE" };
  if (/^-?(\d+\.\d*|\.\d+)$/.test(raw)) return { ok: false, reason: "INVALID_VALUE" };
  return { ok: false, reason: "INVALID_TYPE" };
}
