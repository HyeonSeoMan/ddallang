"use client";

// 거래 변경 요청의 실행과 화면 상태(FE-S2-1). 매니저(Idempotency Key 수명)와 결과 상태는 컴포넌트 밖에 둔다:
// 연결이 끊기면 서버 유래 영역이 가려져 컴포넌트가 사라지는데, 결과 불명 상태와 키는 그 뒤에도 남아야 한다.
import { atom, useAtomValue, useStore } from "jotai";
import { useCallback, useMemo } from "react";
import { bearerHeader, getApiClient } from "@/lib/api";
import { getStoredKey } from "@/lib/identity";
import {
  createMutationManager,
  type MutationManager,
  type MutationRequest,
  type SubmitOptions,
} from "@/lib/mutation/manager";
import { epochAtom, sessionAtom } from "@/features/room/state";
import { CLOCK_UNKNOWN_MESSAGE, describeApiError, type FieldErrors, NO_KEY_MESSAGE } from "./messages";

export type MutationUi =
  | { kind: "pending" }
  | { kind: "success" }
  /** 서버가 확정 거부했다. 성공으로 표시하지 않고 입력은 유지한다. */
  | { kind: "rejected"; code: string; message: string; fieldErrors: FieldErrors }
  /** 결과 불명. 성공으로 표시하지 않고 같은 키로 수동 재시도한다. `epoch`는 불명이 된 연결 세대. */
  | { kind: "unknown"; epoch: number }
  /** 첫 시도 후 24시간이 지났다. 거래 내역 확인 뒤 사용자가 직접 새로 저장해야 한다. */
  | { kind: "needs-confirmation" }
  /** 보내지 못했다(신원 키 없음, 서버 시각을 모름). */
  | { kind: "error"; message: string };

/** 작업 범위(`create:{roomId}`, `update:{txId}`, `delete:{txId}`)별 화면 상태. 새로고침하면 사라진다. */
export const mutationUiAtom = atom<Record<string, MutationUi>>({});

const managers = new Map<string, MutationManager>();

/**
 * 매니저는 (방, 신원 키)별로 둔다. 키의 효력 범위가 (방, 요청자 RoomMember)이므로(S2 §5.1, AC-TXN-007-7) 같은 방에서
 * 신원이 바뀌면 이전 신원의 불명 요청 키·최초 시각·진행 상태를 새 신원이 이어받지 않는다. 메모리에만 있다.
 */
function managerFor(inviteCode: string, roomId: string, identityKey: string): MutationManager {
  const id = `${inviteCode}:${roomId}:${identityKey}`;
  let manager = managers.get(id);
  if (!manager) {
    const api = getApiClient();
    manager = createMutationManager({
      api,
      // 서버 시계 차이를 아직 모르면 방 조회로 먼저 알아낸다(S2 §9).
      syncClock: async () => {
        const key = getStoredKey(inviteCode);
        if (!key) throw new Error("no identity key");
        return api.request({ method: "GET", path: `/rooms/${encodeURIComponent(roomId)}`, headers: bearerHeader(key) });
      },
    });
    managers.set(id, manager);
  }
  return manager;
}

/** 시험에서 매니저 상태를 초기화한다(앱에서는 새로고침이 이 역할을 한다). */
export function resetMutationManagers(): void {
  managers.clear();
}

export interface RoomMutation {
  state: MutationUi | null;
  /** 요청을 보낸다. 같은 작업이 진행 중이면 무시한다. 결과는 `state`로도 반영된다. */
  run(request: Omit<MutationRequest, "headers">, options?: SubmitOptions): Promise<MutationUi | null>;
  /** 화면 상태만 지운다(Idempotency Key 상태는 건드리지 않는다). */
  clear(): void;
}

/** 화면 상태의 작업 범위 이름. 요청자(RoomMember)별로 분리한다. */
export function mutationScope(kind: "create" | "update" | "delete" | "end", target: string, memberId: string): string {
  return `${kind}:${target}:${memberId}`;
}

export function useRoomMutation(scope: string, config: { expiredGuide?: string } = {}): RoomMutation {
  const store = useStore();
  const stateAtom = useMemo(() => atom((get) => get(mutationUiAtom)[scope] ?? null), [scope]);
  const state = useAtomValue(stateAtom);

  const setState = useCallback(
    (next: MutationUi | null) =>
      store.set(mutationUiAtom, (prev) => {
        const copy = { ...prev };
        if (next === null) delete copy[scope];
        else copy[scope] = next;
        return copy;
      }),
    [store, scope],
  );

  const run = useCallback<RoomMutation["run"]>(
    async (request, options) => {
      const session = store.get(sessionAtom);
      if (!session) return null;
      const key = getStoredKey(session.inviteCode);
      if (!key) {
        const failed: MutationUi = { kind: "error", message: NO_KEY_MESSAGE };
        setState(failed);
        return failed;
      }
      const manager = managerFor(session.inviteCode, session.roomId, key);
      const before = manager.getState(scope).status;
      if (before === "in-progress") return null; // 중복 제출
      const fresh = before === "idle";

      setState({ kind: "pending" });
      const outcome = await manager.submit(scope, { ...request, headers: bearerHeader(key) }, options);
      let next: MutationUi;
      switch (outcome.status) {
        case "success":
          next = { kind: "success" };
          break;
        case "rejected": {
          const { message, fieldErrors } = describeApiError(outcome.error, { fresh, expiredGuide: config.expiredGuide });
          next = { kind: "rejected", code: outcome.error.code, message, fieldErrors };
          break;
        }
        case "unknown":
          next = { kind: "unknown", epoch: store.get(epochAtom) };
          break;
        case "needs-confirmation":
          next = { kind: "needs-confirmation" };
          break;
        case "not-sent":
          next = { kind: "error", message: CLOCK_UNKNOWN_MESSAGE };
          break;
        case "in-progress":
          return null;
      }
      setState(next);
      return next;
    },
    [store, scope, setState, config.expiredGuide],
  );

  return { state, run, clear: useCallback(() => setState(null), [setState]) };
}
