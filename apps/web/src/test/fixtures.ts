// Spec 예시에서 만든 고정 응답(FD-16). 서버의 계산 규칙을 다시 구현하지 않는다.
import type {
  Balance,
  Participant,
  Room,
  RoomMember,
  Settlement,
  Transaction,
} from "@/lib/api";

export const TEST_API_BASE_URL = "http://api.test";
export const INVITE_CODE = "invite-code-0000000000000000";
/** 43자 base64url(패딩 없음) 형식의 시험용 신원 키. 실제 키가 아니다. */
export const IDENTITY_KEY = "k".repeat(43);

export const room: Room = {
  id: "room-1",
  name: "금요일 포커",
  unit: "원",
  status: "IN_PROGRESS",
  inviteCode: INVITE_CODE,
  createdAt: "2026-11-08T03:00:00.000Z",
};

export const hostMember: RoomMember = {
  id: "member-host",
  roomId: room.id,
  nickname: "방장",
  isHost: true,
  createdAt: "2026-11-08T03:00:00.000Z",
};

export const guestMember: RoomMember = {
  id: "member-guest",
  roomId: room.id,
  nickname: "손님",
  isHost: false,
  createdAt: "2026-11-08T03:05:00.000Z",
};

export const participants: Participant[] = [
  { id: "p-1", roomId: room.id, nickname: "가온", status: "ACTIVE", order: 1, createdAt: "2026-11-08T03:01:00.000Z" },
  { id: "p-2", roomId: room.id, nickname: "나래", status: "ACTIVE", order: 2, createdAt: "2026-11-08T03:02:00.000Z" },
  { id: "p-3", roomId: room.id, nickname: "다온", status: "INACTIVE", order: 3, createdAt: "2026-11-08T03:03:00.000Z" },
];

export const transactions: Transaction[] = [
  {
    id: "t-2",
    payerId: "p-2",
    payeeId: "p-1",
    amount: 250,
    reason: "라운드 2",
    round: "2",
    authorId: hostMember.id,
    createdAt: "2026-11-08T03:21:45.123Z",
    updatedAt: "2026-11-08T03:21:45.123Z",
  },
  {
    id: "t-1",
    payerId: "p-1",
    payeeId: "p-2",
    amount: 100,
    reason: null,
    round: null,
    authorId: guestMember.id,
    createdAt: "2026-11-08T03:10:00.000Z",
    updatedAt: "2026-11-08T03:10:00.000Z",
  },
];

/** 서버 정렬(`balance` 내림차순, 같으면 `order` 오름차순)을 그대로 담은 고정 응답. */
export const balances: Balance[] = [
  { participantId: "p-1", nickname: "가온", status: "ACTIVE", order: 1, balance: 150 },
  { participantId: "p-3", nickname: "다온", status: "INACTIVE", order: 3, balance: 0 },
  { participantId: "p-2", nickname: "나래", status: "ACTIVE", order: 2, balance: -150 },
];

export const expectedSettlement: Settlement = {
  kind: "EXPECTED",
  items: [
    { payerId: "p-2", payerNickname: "나래", payeeId: "p-1", payeeNickname: "가온", amount: 150 },
  ],
};

export const finalSettlement: Settlement = { ...expectedSettlement, kind: "FINAL" };
