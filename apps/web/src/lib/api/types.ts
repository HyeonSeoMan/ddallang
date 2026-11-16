// Spec의 응답 타입(S1 v0.3.0 §2.1·§4, S2 §2.1, S3 §4, S4 §4.2). 서버가 모르는 필드를 더해도 무시한다.

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

/** 방의 유일한 사람 단위(S1 §2.1, OQ-041). 요청자(`me`)도 참여자다. `isHost`는 방을 만든 참여자만 `true`. */
export interface Participant {
  id: string;
  roomId: string;
  nickname: string;
  status: ParticipantStatus;
  order: number;
  isHost: boolean;
  createdAt: string;
}

/** 요청에 실린 신원 키의 이 방 상태(S1 §2.2, §4.2). 연결됨은 `PARTICIPANT`로 온다. */
export type IdentityState = "NONE" | "PARTICIPANT" | "PENDING" | "REVOKED";

export type ClaimStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
/** `REJECTED`일 때만 값이 있다(S1 §2.1). */
export type ClaimRejectReason = "HOST_REJECTED" | "TARGET_CLAIMED" | "REQUESTER_LINKED";

/** 요청자용 이어받기 요청(S1 §4, S1-C13): 참여자 ID와 처리한 방장 ID는 담지 않는다. */
export interface MyClaim {
  id: string;
  nickname: string;
  status: ClaimStatus;
  rejectReason: ClaimRejectReason | null;
  createdAt: string;
  resolvedAt: string | null;
}

/** 방장용 이어받기 요청(S1 §4.12~§4.15). `resolvedById`는 처리한 방장의 참여자 ID. */
export interface Claim extends MyClaim {
  participantId: string;
  resolvedById: string | null;
}

/** `GET /invites/{inviteCode}` 응답(S1 §4.2). 후보는 `NONE`·`REVOKED`일 때만 채워진다. */
export interface InviteLookup {
  room: InviteRoom;
  identity: IdentityState;
  claim: MyClaim | null;
  claimableNicknames: string[];
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

/**
 * S1 §3.4, S2 §3.6, S5 §3.3 표의 오류 코드 합집합(v0.3.0). S3·S4는 새 코드를 정하지 않는다.
 * v0.2.3의 `MEMBER_LIMIT_EXCEEDED`는 없어졌다(S1 §3.4).
 */
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "IDENTITY_REVOKED",
  "HOST_ONLY",
  "REQUESTER_INACTIVE",
  "ROOM_NOT_FOUND",
  "INVITE_NOT_FOUND",
  "PARTICIPANT_NOT_FOUND",
  "CLAIM_NOT_FOUND",
  "ROUTE_NOT_FOUND",
  "NOT_SUPPORTED",
  "GAME_ENDED",
  "NICKNAME_TAKEN",
  "PARTICIPANT_LIMIT_EXCEEDED",
  "HOST_CANNOT_BE_DEACTIVATED",
  "ALREADY_PARTICIPANT",
  "CLAIM_PENDING",
  "CLAIM_ALREADY_RESOLVED",
  "CLAIM_REQUESTER_LINKED",
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

/**
 * 스트림 이벤트 이름(S5 §4.2 v0.3.0). `ready`·`heartbeat`·`access.revoked`는 변경 이벤트가 아니다.
 * 이 목록에 없는 이름도 변경 이벤트로 취급한다(E-11).
 */
export const STREAM_EVENTS = [
  "ready",
  "heartbeat",
  "transaction.created",
  "transaction.updated",
  "transaction.deleted",
  "participant.created",
  "participant.status_changed",
  "claim.created",
  "claim.canceled",
  "claim.resolved",
  "access.revoked",
  "room.ended",
] as const;
export type StreamEventName = (typeof STREAM_EVENTS)[number];
