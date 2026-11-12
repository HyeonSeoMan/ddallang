// 방 화면의 전역 상태(FD-3). 서버 유래 데이터는 스냅샷 원자 하나로만 반영하며 연결 세대(epoch)로 보호한다.
import { atom } from "jotai";
import type {
  Balance,
  Participant,
  Room,
  RoomMember,
  Settlement,
  Transaction,
} from "@/lib/api";

/** 신원 키 자체는 들고 있지 않는다. 필요할 때 초대 코드로 신원 키 모듈에서 읽는다. */
export interface Session {
  inviteCode: string;
  roomId: string;
  me: RoomMember;
}

export type ConnectionState = "connected" | "disconnected";

/** 5개 조회를 하나로 묶은 스냅샷. 만들어진 연결 세대를 기록한다. */
export interface RoomSnapshot {
  epoch: number;
  room: Room;
  me: RoomMember;
  participants: Participant[];
  balances: Balance[];
  transactions: Transaction[];
  nextCursor: string | null;
  settlement: Settlement;
}

export const sessionAtom = atom<Session | null>(null);

/** 초기 `disconnected`. 연결이 확인되기 전에는 서버 유래 영역을 보이지 않는다. */
export const connectionAtom = atom<ConnectionState>("disconnected");

/** 연결 세대. 새 `ready`마다 올라가며, 다른 세대의 갱신 응답은 반영하지 않는다. */
export const epochAtom = atom(0);

export const snapshotAtom = atom<RoomSnapshot | null>(null);

/** 연결 상태를 바꾼다. `disconnected`가 되면 스냅샷을 즉시 비운다(S5 §6.5). */
export const setConnectionAtom = atom(null, (_get, set, state: ConnectionState) => {
  set(connectionAtom, state);
  if (state === "disconnected") set(snapshotAtom, null);
});

/** 새 연결 세대를 시작한다. 이전 스냅샷은 비워지고 새 세대 번호를 돌려준다. */
export const startEpochAtom = atom(null, (get, set) => {
  const next = get(epochAtom) + 1;
  set(epochAtom, next);
  set(snapshotAtom, null);
  return next;
});

/**
 * 스냅샷을 반영한다. 연결됨이고 스냅샷의 세대가 **현재 세대**일 때만 반영하고 `true`를 돌려준다.
 * 재접속 뒤 늦게 도착한 이전 세대의 응답은 버린다(`false`).
 */
export const applySnapshotAtom = atom(null, (get, set, snapshot: RoomSnapshot) => {
  if (get(connectionAtom) !== "connected" || snapshot.epoch !== get(epochAtom)) return false;
  set(snapshotAtom, snapshot);
  return true;
});

/** 서버 유래 영역을 보여도 되는지: 연결됨이고 현재 세대의 스냅샷이 있을 때만. */
export const dataVisibleAtom = atom((get) => {
  const snapshot = get(snapshotAtom);
  return get(connectionAtom) === "connected" && snapshot !== null && snapshot.epoch === get(epochAtom);
});

/** 변경 컨트롤을 쓸 수 있는지: 데이터가 보이고 방이 진행 중일 때(`canMutate`). */
export const canMutateAtom = atom((get) => {
  const snapshot = get(snapshotAtom);
  return get(dataVisibleAtom) && snapshot?.room.status === "IN_PROGRESS";
});
