"use client";

import { useStore } from "jotai";
import { type RefObject, useEffect, useRef } from "react";
import { ApiError, getApiClient } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/env";
import { getStoredKey } from "@/lib/identity";
import {
  applySnapshotAtom,
  sessionAtom,
  setConnectionAtom,
  startEpochAtom,
} from "@/features/room/state";
import { type ConnectionEnv, createRoomConnection, type RoomConnection } from "./connection";
import { createCoordinator } from "./coordinator";
import { runEventStream } from "./event-stream";
import { fetchRoomSnapshot } from "./snapshot";
import { connectionPhaseAtom, participantFilterAtom, refreshRequestAtom } from "./state";

/** 실제 브라우저의 온라인·보임 상태와 이벤트. 요청자 주기 조회(FD-23)도 같은 환경을 쓴다. */
export function browserEnv(): ConnectionEnv {
  return {
    on(type, listener) {
      const target: Window | Document = type === "visibilitychange" ? document : window;
      target.addEventListener(type, listener);
      return () => target.removeEventListener(type, listener);
    },
    isOnline: () => navigator.onLine,
    isVisible: () => document.visibilityState === "visible",
  };
}

const noKey = () =>
  new ApiError({
    status: 401,
    code: "UNAUTHENTICATED",
    message: "이 브라우저에 저장된 신원 정보를 찾을 수 없습니다.",
  });

/**
 * 방 화면에 들어온 뒤 스트림을 연결하고 갱신·재연결을 맡는다(S5 §6.5의 적용 범위). 언마운트하면 중단한다.
 * 신원 키는 요청 때마다 신원 키 모듈에서 읽으며 이 훅이 들고 있지 않는다. 접근 상실(`access.revoked`, 스트림·갱신의
 * `401 IDENTITY_REVOKED`)이면 재연결하지 않고 `onAccessRevoked`에 그 스트림을 연 키를 넘긴다(FD-21).
 */
export function useRoomConnection(
  inviteCode: string,
  roomId: string,
  onAccessRevoked?: (usedKey: string) => void,
  /** 접근 상실 처리기가 세션을 비우기 전에 스트림·갱신을 직접 멈출 수 있게 현재 연결을 담는다(FD-21). */
  connectionRef?: RefObject<RoomConnection | null>,
): void {
  const store = useStore();
  const revokedRef = useRef(onAccessRevoked);
  useEffect(() => {
    revokedRef.current = onAccessRevoked;
  });

  useEffect(() => {
    const api = getApiClient();
    const eventsUrl = `${getApiBaseUrl()}/rooms/${encodeURIComponent(roomId)}/events`;
    /** 현재 스트림을 연 키. 접근 상실 처리의 조건부 삭제에 쓴다(S1 §3.1). */
    let streamKey: string | null = null;

    const connection = createRoomConnection({
      async openStream(handlers) {
        const identityKey = getStoredKey(inviteCode);
        if (!identityKey) return { kind: "rejected", error: noKey() };
        streamKey = identityKey;
        return runEventStream({ url: eventsUrl, identityKey, ...handlers });
      },
      onAccessRevoked() {
        if (streamKey) revokedRef.current?.(streamKey);
      },
      createCoordinator: (epoch, hooks) =>
        createCoordinator({
          async fetchSnapshot(signal) {
            const identityKey = getStoredKey(inviteCode);
            if (!identityKey) throw noKey();
            return fetchRoomSnapshot(api, {
              roomId,
              identityKey,
              participantId: store.get(participantFilterAtom),
              epoch,
              isHost: store.get(sessionAtom)?.me.isHost ?? false,
            }, signal);
          },
          applySnapshot: (snapshot) => store.set(applySnapshotAtom, snapshot),
          ...hooks,
        }),
      setConnected: (connected) => store.set(setConnectionAtom, connected ? "connected" : "disconnected"),
      startEpoch: () => store.set(startEpochAtom),
      setPhase: (phase) => store.set(connectionPhaseAtom, phase),
      now: () => Date.now(),
      random: () => Math.random(),
      env: browserEnv(),
    });

    connection.start();
    if (connectionRef) connectionRef.current = connection;
    const unsubscribe = store.sub(refreshRequestAtom, () => connection.requestRefresh());
    return () => {
      unsubscribe();
      connection.stop();
      if (connectionRef?.current === connection) connectionRef.current = null;
    };
  }, [inviteCode, roomId, store, connectionRef]);
}
