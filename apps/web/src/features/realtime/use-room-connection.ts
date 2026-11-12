"use client";

import { useStore } from "jotai";
import { useEffect } from "react";
import { ApiError, getApiClient } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/env";
import { getStoredKey } from "@/lib/identity";
import {
  applySnapshotAtom,
  setConnectionAtom,
  startEpochAtom,
} from "@/features/room/state";
import { type ConnectionEnv, createRoomConnection } from "./connection";
import { createCoordinator } from "./coordinator";
import { runEventStream } from "./event-stream";
import { fetchRoomSnapshot } from "./snapshot";
import { connectionPhaseAtom, participantFilterAtom } from "./state";

function browserEnv(): ConnectionEnv {
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
 * 신원 키는 요청 때마다 신원 키 모듈에서 읽으며 이 훅이 들고 있지 않는다.
 */
export function useRoomConnection(inviteCode: string, roomId: string): void {
  const store = useStore();

  useEffect(() => {
    const api = getApiClient();
    const eventsUrl = `${getApiBaseUrl()}/rooms/${encodeURIComponent(roomId)}/events`;

    const connection = createRoomConnection({
      async openStream(handlers) {
        const identityKey = getStoredKey(inviteCode);
        if (!identityKey) return { kind: "rejected", error: noKey() };
        return runEventStream({ url: eventsUrl, identityKey, ...handlers });
      },
      createCoordinator: (epoch, hooks) =>
        createCoordinator({
          async fetchSnapshot() {
            const identityKey = getStoredKey(inviteCode);
            if (!identityKey) throw noKey();
            return fetchRoomSnapshot(api, {
              roomId,
              identityKey,
              participantId: store.get(participantFilterAtom),
              epoch,
            });
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
    return () => connection.stop();
  }, [inviteCode, roomId, store]);
}
