// Spec의 응답 타입(S1 §2.1, S2 §2.1, S3 §4, S4 §4.2). 서버가 모르는 필드를 더해도 무시한다.

export type RoomStatus = "IN_PROGRESS" | "ENDED";
export type ParticipantStatus = "ACTIVE" | "INACTIVE";

export interface Room {
  id: string;
  name: string;
  unit: string;
  status: RoomStatus;
  inviteCode: string;
  createdAt: string;
}

/** 입장 응답의 방(S1 §4.3): 초대 코드·생성 시각은 없다. */
export type RoomSummary = Pick<Room, "id" | "name" | "unit" | "status">;

/** 초대 링크 조회의 방(S1 §4.2): 입장 전에는 이 세 필드만 공개된다. */
export type InviteRoom = Pick<Room, "name" | "unit" | "status">;

export interface RoomMember {
  id: string;
  roomId: string;
  nickname: string;
  isHost: boolean;
  createdAt: string;
}

export interface Participant {
  id: string;
  roomId: string;
  nickname: string;
  status: ParticipantStatus;
  order: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  payerId: string;
  payeeId: string;
  amount: number;
  reason: string | null;
  round: string | null;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Balance {
  participantId: string;
  nickname: string;
  status: ParticipantStatus;
  order: number;
  balance: number;
}

export type SettlementKind = "EXPECTED" | "FINAL";

export interface SettlementItem {
  payerId: string;
  payerNickname: string;
  payeeId: string;
  payeeNickname: string;
  amount: number;
}

export interface Settlement {
  kind: SettlementKind;
  items: SettlementItem[];
}

/** S1 §3.4, S2 §3.6, S5 §3.3 표의 오류 코드 합집합. S3·S4는 새 코드를 정하지 않는다. */
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "HOST_ONLY",
  "ROOM_NOT_FOUND",
  "INVITE_NOT_FOUND",
  "PARTICIPANT_NOT_FOUND",
  "ROUTE_NOT_FOUND",
  "NOT_SUPPORTED",
  "GAME_ENDED",
  "NICKNAME_TAKEN",
  "MEMBER_LIMIT_EXCEEDED",
  "PARTICIPANT_LIMIT_EXCEEDED",
  "VALIDATION_FAILED",
  "NOT_AUTHOR_OR_HOST",
  "TRANSACTION_NOT_FOUND",
  "TRANSACTION_DELETED",
  "PARTICIPANT_INACTIVE",
  "TRANSACTION_LIMIT_EXCEEDED",
  "IDEMPOTENCY_CONFLICT",
  "IDEMPOTENCY_KEY_EXPIRED",
  "CONNECTION_LIMIT_EXCEEDED",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** 검증 사유 코드(`details[].code`): S1 §3.4 + S2 §3.6. */
export const VALIDATION_REASON_CODES = [
  "REQUIRED",
  "LENGTH_OUT_OF_RANGE",
  "LEADING_OR_TRAILING_SPACE",
  "CONSECUTIVE_SPACES",
  "INVALID_CHARACTER",
  "INVALID_TYPE",
  "INVALID_VALUE",
  "NOT_ALLOWED_FIELD",
  "OUT_OF_RANGE",
  "SAME_AS_PAYER",
  "PARTICIPANT_NOT_FOUND",
] as const;
export type ValidationReasonCode = (typeof VALIDATION_REASON_CODES)[number];

export function isKnownErrorCode(code: string): code is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(code);
}
