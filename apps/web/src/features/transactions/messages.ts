import { ApiError } from "@/lib/api";
import type { ValidationReasonCode } from "@/lib/api";
import { REASON_MAX, ROUND_MAX } from "@/lib/validation/transaction";

export type TxField = "payerId" | "payeeId" | "amount" | "reason" | "round";
export type FieldErrors = Partial<Record<TxField, string[]>>;

export const UNKNOWN_RESULT = "결과를 확인하지 못했습니다.";
/** 연결이 복구되어 재조회한 뒤에도 거래 내역에서 확인되지 않을 때(저장되지 않았다고 단정하지 않는다). */
export const UNKNOWN_AFTER_RECOVERY = "저장 여부를 확인할 수 없습니다. 거래 내역을 확인해 주세요.";
export const EXPIRED_GUIDE = "거래 내역에서 저장 여부를 먼저 확인해 주세요.";
export const CLOCK_HINT = "기기의 날짜·시간 설정을 확인해 주세요.";
export const NO_KEY_MESSAGE = "이 브라우저에 저장된 신원 정보를 찾을 수 없습니다. 초대 링크로 다시 입장해 주세요.";
export const CLOCK_UNKNOWN_MESSAGE = "서버 시각을 확인하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.";
/** 허용하는 기기-서버 시각 차이(S2 §5.4, 5분). */
export const CLOCK_SKEW_LIMIT_MS = 5 * 60 * 1000;

const PLAIN: Partial<Record<ValidationReasonCode, string>> = {
  REQUIRED: "필수 항목입니다.",
  INVALID_TYPE: "올바른 값이 아닙니다.",
  INVALID_VALUE: "올바른 값이 아닙니다.",
  INVALID_CHARACTER: "줄바꿈·탭·보이지 않는 문자는 쓸 수 없습니다.",
  LEADING_OR_TRAILING_SPACE: "앞뒤에 공백을 둘 수 없습니다.",
  OUT_OF_RANGE: "올바른 범위의 값이 아닙니다.",
  SAME_AS_PAYER: "지급자와 수취자는 달라야 합니다.",
  PARTICIPANT_NOT_FOUND: "이 방의 참여자가 아닙니다.",
  NOT_ALLOWED_FIELD: "변경할 수 없는 항목입니다.",
};

/** 필드·사유 코드별 안내 문구. 분기는 서버 `code`로 하고 표시 문구만 필드에 맞춘다. */
export function fieldReasonMessage(field: TxField, code: string | undefined): string {
  if (code === "LENGTH_OUT_OF_RANGE") {
    if (field === "reason") return `${REASON_MAX}자 이하로 입력해 주세요.`;
    if (field === "round") return `${ROUND_MAX}자 이하로 입력해 주세요.`;
  }
  if (field === "amount") {
    if (code === "INVALID_TYPE") return "숫자만 입력해 주세요.";
    if (code === "INVALID_VALUE") return "정수만 입력할 수 있습니다.";
    if (code === "OUT_OF_RANGE") return "1 이상 999,999,999 이하로 입력해 주세요.";
  }
  return PLAIN[code as ValidationReasonCode] ?? "올바른 값이 아닙니다.";
}

const FIELDS: TxField[] = ["payerId", "payeeId", "amount", "reason", "round"];
const isTxField = (value: string | undefined): value is TxField => FIELDS.includes(value as TxField);

export interface ErrorDescription {
  message: string;
  fieldErrors: FieldErrors;
}

/**
 * 거래 변경 요청의 확정 거부를 화면 문구로 연결한다(S2 §3.6). 분기는 `code`로 하고 표시는 서버 `message`를 그대로 쓴다.
 * 필드에 매핑되는 사유는 `fieldErrors`로 돌려주고, 매핑되지 않으면 `message`를 그대로 보인다.
 * `fresh`는 사용자가 방금 시작한 요청인지(만료 안내에서 기기 시계 확인을 덧붙이는 기준).
 */
export function describeApiError(
  error: ApiError,
  context: { fresh: boolean; now?: number; /** 만료 안내의 확인 대상 문구(거래는 거래 내역, 게임 종료는 방 상태). */ expiredGuide?: string },
): ErrorDescription {
  const fieldErrors: FieldErrors = {};
  switch (error.code) {
    case "VALIDATION_FAILED": {
      let unmapped = false;
      for (const detail of error.details) {
        if (isTxField(detail.field)) (fieldErrors[detail.field] ??= []).push(fieldReasonMessage(detail.field, detail.code));
        else unmapped = true; // idempotencyKey·firstAttemptAt 등: 사용자가 고칠 입력이 아니다
      }
      const clockRelated = error.details.some((d) => d.field === "firstAttemptAt");
      if (clockRelated) return { message: `${error.message} ${CLOCK_HINT}`, fieldErrors };
      if (Object.keys(fieldErrors).length === 0 || unmapped) return { message: error.message, fieldErrors };
      return { message: "", fieldErrors };
    }
    case "PARTICIPANT_INACTIVE": {
      for (const detail of error.details) {
        if (detail.field === "payerId" || detail.field === "payeeId") {
          (fieldErrors[detail.field] ??= []).push(error.message);
        }
      }
      return { message: error.message, fieldErrors };
    }
    case "IDEMPOTENCY_KEY_EXPIRED": {
      const serverTime = error.details.find((d) => d.serverTime)?.serverTime;
      const skewed =
        serverTime !== undefined && Math.abs(Date.parse(serverTime) - (context.now ?? Date.now())) > CLOCK_SKEW_LIMIT_MS;
      // 서버 message를 그대로 보이고 목록 확인을 안내한다. 방금 시작한 요청이거나 시계 차이가 크면 시계 확인도 덧붙인다.
      const parts = [error.message, context.expiredGuide ?? EXPIRED_GUIDE];
      if (context.fresh || skewed) parts.push(CLOCK_HINT);
      return { message: parts.join(" "), fieldErrors };
    }
    case "IDEMPOTENCY_CONFLICT":
      return { message: `${error.message} 내용을 확인하고 다시 저장해 주세요.`, fieldErrors };
    default:
      // GAME_ENDED, TRANSACTION_LIMIT_EXCEEDED, NOT_AUTHOR_OR_HOST, TRANSACTION_DELETED, TRANSACTION_NOT_FOUND,
      // UNAUTHENTICATED, ROOM_NOT_FOUND 등: 서버 message를 그대로 보인다.
      return { message: error.message, fieldErrors };
  }
}
