// 실제 화면을 jsdom에 렌더링하는 FE 클라이언트(FE-S5-6): 실제 세션·스트림·코디네이터·화면 컴포넌트를 쓴다.
// 접속자마다 신원 키가 다르지만 신원 키 모듈은 초대 코드별 저장소 한 칸만 읽으므로, 접속자마다 별칭 초대 코드를 쓴다
// (입장은 실서버 API로 끝났고 별칭은 저장소 조회에만 쓰인다).
import { waitFor } from "@testing-library/react";
import { createStore } from "jotai";
import { connectionAtom, sessionAtom, snapshotAtom } from "@/features/room/state";
import { InviteScreen } from "@/features/room/invite-screen";
import { renderApp } from "@/test/render";
import type { LiveRoom } from "./server";

export interface LiveClient {
  index: number;
  container: HTMLElement;
  unmount: () => void;
  /** 화면(`container`)이 조건을 만족하는 순간의 `Date.now()`. 이미 만족하면 즉시. 시간 안에 못 하면 `null`. */
  observe: (condition: (container: HTMLElement) => boolean, timeoutMs: number) => Promise<number | null>;
}

export async function mountClient(
  live: LiveRoom,
  index: number,
  saveKey: (inviteCode: string, key: string) => void,
  run: number,
): Promise<LiveClient> {
  const member = live.members[index]!;
  const alias = `latency-${run}-${index}`;
  saveKey(alias, member.key);
  const store = createStore();
  store.set(sessionAtom, { inviteCode: alias, roomId: live.room.id, me: member.me });
  const view = renderApp(<InviteScreen inviteCode={alias} />, store);
  await waitFor(() => {
    if (store.get(connectionAtom) !== "connected" || store.get(snapshotAtom) === null) {
      throw new Error("연결 대기");
    }
  }, { timeout: 30_000, interval: 50 });
  const container = view.container;
  return {
    index,
    container,
    unmount: () => view.unmount(),
    observe: (condition, timeoutMs) =>
      new Promise((resolve) => {
        if (condition(container)) return resolve(Date.now());
        const done = (value: number | null) => {
          observer.disconnect();
          clearTimeout(timer);
          resolve(value);
        };
        const observer = new MutationObserver(() => {
          if (condition(container)) done(Date.now());
        });
        observer.observe(container, { subtree: true, childList: true, characterData: true, attributes: true });
        const timer = setTimeout(() => done(null), timeoutMs);
      }),
  };
}

/** 구역 제목(`h2`)으로 구역을 찾는다. */
export function section(container: HTMLElement, heading: string): HTMLElement | null {
  const h = Array.from(container.querySelectorAll("h2")).find((el) => el.textContent === heading);
  return (h?.parentElement as HTMLElement | null) ?? null;
}
