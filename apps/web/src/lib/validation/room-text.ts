// 방 이름·정산 단위·닉네임 공통 문자열 검증(S1 §3.2). 클라이언트 검증은 편의이며 서버 판정이 최종이다(FD-9).
import type { ValidationReasonCode } from "@/lib/api";

export const MAX_CODE_POINTS = 12;
/** 원본이 이보다 길면 정규화하지 않고 길이 위반으로 거부한다(S1 §3.2 0번). */
export const MAX_RAW_CODE_POINTS = 64;

export interface TextValidation {
  /** NFC로 정규화한 값(원본이 64 코드 포인트를 넘으면 원본 그대로). 서버에는 이 값을 보낸다. */
  value: string;
  /** 위반 사유 전체(독립 위반은 모아서 반환). 비어 있으면 유효하다. */
  reasons: ValidationReasonCode[];
}

function isAllowedCodePoint(cp: number): boolean {
  return (
    (cp >= 0xac00 && cp <= 0xd7a3) || // 한글 완성형 음절
    (cp >= 0x3131 && cp <= 0x3163) || // 한글 호환 자모
    (cp >= 0x41 && cp <= 0x5a) || // A-Z
    (cp >= 0x61 && cp <= 0x7a) || // a-z
    (cp >= 0x30 && cp <= 0x39) || // 0-9
    cp === 0x20 // 공백
  );
}

export function validateRoomText(raw: string): TextValidation {
  if (raw === "") return { value: "", reasons: ["REQUIRED"] };
  if ([...raw].length > MAX_RAW_CODE_POINTS) return { value: raw, reasons: ["LENGTH_OUT_OF_RANGE"] };

  const value = raw.normalize("NFC");
  const codePoints = [...value];
  const reasons: ValidationReasonCode[] = [];

  if (codePoints.length > MAX_CODE_POINTS) reasons.push("LENGTH_OUT_OF_RANGE");
  if (!codePoints.every((ch) => isAllowedCodePoint(ch.codePointAt(0) ?? -1))) {
    reasons.push("INVALID_CHARACTER");
  }
  if (value.startsWith(" ") || value.endsWith(" ")) reasons.push("LEADING_OR_TRAILING_SPACE");
  if (value.includes("  ")) reasons.push("CONSECUTIVE_SPACES");

  return { value, reasons };
}
