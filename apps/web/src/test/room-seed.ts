import type { createStore } from "jotai";
import {
  applySnapshotAtom,
  type RoomSnapshot,
  sessionAtom,
  setConnectionAtom,
  startEpochAtom,
} from "@/features/room/state";
import type { Participant, RoomMember } from "@/lib/api";
import * as fixtures from "./fixtures";

export const INVITE_CODE = fixtures.INVITE_CODE;

export interface SeedOptions {
  me?: RoomMember;
  status?: "IN_PROGRESS" | "ENDED";
  participants?: Participant[];
}

export function makeSnapshot(epoch: number, options: SeedOptions = {}): RoomSnapshot {
  return {
    epoch,
    room: { ...fixtures.room, status: options.status ?? "IN_PROGRESS" },
    me: options.me ?? fixtures.hostMember,
    participants: options.participants ?? fixtures.participants,
    balances: fixtures.balances,
    transactions: fixtures.transactions,
    nextCursor: null,
    transactionFilter: null,
    settlement: options.status === "ENDED" ? fixtures.finalSettlement : fixtures.expectedSettlement,
  };
}

/** 방 화면이 연결되어 스냅샷이 반영된 상태를 만든다(스트림 없이 상태만 심는다). */
export function seedRoom(store: ReturnType<typeof createStore>, options: SeedOptions = {}) {
  const me = options.me ?? fixtures.hostMember;
  store.set(sessionAtom, { inviteCode: INVITE_CODE, roomId: fixtures.room.id, me });
  store.set(setConnectionAtom, "connected");
  const epoch = store.set(startEpochAtom);
  store.set(applySnapshotAtom, makeSnapshot(epoch, options));
  return epoch;
}
