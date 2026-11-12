import type { ValidationReasonCode } from "@/lib/api";

/** 검증 사유 코드별 안내 문구. 서버 규칙과 같은 코드를 쓰되 표시는 클라이언트 문구다(서버 `message`는 별도). */
export const REASON_MESSAGES: Partial<Record<ValidationReasonCode, string>> = {
  REQUIRED: "필수 항목입니다.",
  LENGTH_OUT_OF_RANGE: "12자 이하로 입력해 주세요.",
  INVALID_CHARACTER: "한글, 영문, 숫자, 공백만 쓸 수 있습니다.",
  LEADING_OR_TRAILING_SPACE: "앞뒤에 공백을 둘 수 없습니다.",
  CONSECUTIVE_SPACES: "공백을 연속으로 쓸 수 없습니다.",
  INVALID_TYPE: "올바른 값이 아닙니다.",
  INVALID_VALUE: "올바른 값이 아닙니다.",
};

export function reasonMessage(code: string | undefined): string {
  return REASON_MESSAGES[code as ValidationReasonCode] ?? "올바른 값이 아닙니다.";
}

/** 신원 키 안내(S1 §9, plan §7). 서버가 복구할 수 없다는 사실을 숨기지 않는다. */
export const IDENTITY_KEY_NOTICE =
  "이 방에는 이 브라우저에 저장된 정보로 다시 들어옵니다. 브라우저 저장소를 지우면 내 기록과 방장 권한을 되찾을 수 없습니다.";

/** 방 생성 결과 불명(S1 §6.5, plan §7). */
export const CREATE_UNKNOWN_NOTICE =
  "응답을 받지 못했습니다. 다시 시도하면 같은 이름의 방이 하나 더 만들어질 수 있습니다.";
