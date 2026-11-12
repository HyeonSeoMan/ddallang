import { act, waitFor } from "@testing-library/react";
import { createStore } from "jotai";
import { http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import {
  connectionAtom,
  epochAtom,
  snapshotAtom,
} from "@/features/room/state";
import { installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl, errorResponse } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { createFakeBackend, type FakeBackend } from "@/test/stateful-server";
import { connectionPhaseAtom } from "./state";
import { useRoomConnection } from "./use-room-connection";

const CODE = "invite-code-0000000000000000";
const KEY = "k".repeat(43);

function Probe() {
  useRoomConnection(CODE, fixtures.room.id);
  return null;
}

let backend: FakeBackend;
let store: ReturnType<typeof createStore>;

function mount() {
  return renderApp(<Probe />, store);
}

const visible = () => store.get(connectionAtom) === "connected" && store.get(snapshotAtom) !== null;

beforeEach(() => {
  installFakeStorage().setItem(`ddallang:identity:${CODE}`, KEY);
  backend = createFakeBackend();
  server.use(...backend.handlers);
  store = createStore();
});

describe("useRoomConnection (가짜 서버 통합)", () => {
  it("연결하면 ready 뒤 5개 조회로 스냅샷이 채워진다(처음에는 데이터가 보이지 않는다)", async () => {
    mount();
    expect(store.get(snapshotAtom)).toBeNull();
    await waitFor(() => expect(visible()).toBe(true));
    const snapshot = store.get(snapshotAtom)!;
    expect(snapshot.epoch).toBe(store.get(epochAtom));
    expect(snapshot.room.id).toBe("room-1");
    expect(snapshot.transactions).toHaveLength(2);
    expect(Object.values(backend.requests)).toEqual([1, 1, 1, 1, 1]); // 5개 전체를 한 번씩
    await waitFor(() => expect(store.get(connectionPhaseAtom)).toBe("connected"));
  });

  it("[AC-VIEW-005-1] 다른 접속자의 변경 알림이 오면 새로고침 없이 스냅샷이 갱신된다", async () => {
    mount();
    await waitFor(() => expect(visible()).toBe(true));
    backend.transactions = [
      { ...fixtures.transactions[0]!, id: "t-new", amount: 999 },
      ...backend.transactions,
    ];
    backend.commit("transaction.created", { transactionId: "t-new" });
    await waitFor(() => expect(store.get(snapshotAtom)?.transactions[0]?.id).toBe("t-new"));
    expect(backend.requests.transactions).toBe(2);
  });

  it("[AC-VIEW-005-2] 종료 알림 뒤 방 상태와 최종 정산이 함께(한 스냅샷으로) 바뀐다", async () => {
    mount();
    await waitFor(() => expect(visible()).toBe(true));
    backend.room = { ...backend.room, status: "ENDED" };
    backend.settlement = { ...backend.settlement, kind: "FINAL" };
    backend.commit("room.ended");
    await waitFor(() => expect(store.get(snapshotAtom)?.room.status).toBe("ENDED"));
    expect(store.get(snapshotAtom)?.settlement.kind).toBe("FINAL");
  });

  it("[AC-SYS-001-2] 스트림이 끊기면 즉시 데이터가 사라지고, [AC-SYS-002-1] 재연결 뒤 전체 재동기화로 다시 보인다", async () => {
    mount();
    await waitFor(() => expect(visible()).toBe(true));
    const firstEpoch = store.get(epochAtom);

    act(() => backend.stream!.error());
    await waitFor(() => expect(store.get(connectionAtom)).toBe("disconnected"));
    expect(store.get(snapshotAtom)).toBeNull(); // 이전 값을 "최신 아님"으로도 보이지 않는다
    expect(store.get(connectionPhaseAtom)).toBe("reconnecting");

    backend.transactions = [{ ...fixtures.transactions[0]!, id: "t-while-down" }, ...backend.transactions];
    await waitFor(() => expect(visible()).toBe(true), { timeout: 4000 }); // 약 1초 뒤 재연결
    expect(store.get(epochAtom)).toBe(firstEpoch + 1);
    expect(store.get(snapshotAtom)?.transactions[0]?.id).toBe("t-while-down"); // 끊긴 동안의 변경 반영
    await waitFor(() => expect(store.get(connectionPhaseAtom)).toBe("recovered"));
  }, 10_000);

  it("갱신 주기가 실패하면 일부도 반영하지 않고 끊김으로 전환하며, 복구되면 다시 보인다", async () => {
    mount();
    await waitFor(() => expect(visible()).toBe(true));
    backend.failing.add("balances");
    backend.commit("transaction.created");
    await waitFor(() => expect(store.get(connectionAtom)).toBe("disconnected"));
    expect(store.get(snapshotAtom)).toBeNull();
    backend.failing.delete("balances");
    await waitFor(() => expect(visible()).toBe(true), { timeout: 4000 });
  }, 10_000);

  it("스트림 열기가 401이면 재시도 없이 접근 불가 상태다", async () => {
    server.use(http.get(apiUrl(`/rooms/${fixtures.room.id}/events`), () => errorResponse("UNAUTHENTICATED")));
    mount();
    await waitFor(() => expect(store.get(connectionPhaseAtom)).toBe("inaccessible"));
    expect(store.get(connectionAtom)).toBe("disconnected");
    expect(store.get(snapshotAtom)).toBeNull();
  });

  it("저장된 신원 키가 없으면 연결하지 않고 접근 불가다", async () => {
    installFakeStorage(); // 키 없는 새 저장소
    mount();
    await waitFor(() => expect(store.get(connectionPhaseAtom)).toBe("inaccessible"));
    expect(backend.requests.room).toBe(0);
  });

  it("언마운트하면 스트림이 중단되고 데이터가 숨겨진다", async () => {
    const view = mount();
    await waitFor(() => expect(visible()).toBe(true));
    view.unmount();
    expect(store.get(connectionAtom)).toBe("disconnected");
    expect(store.get(snapshotAtom)).toBeNull();
    const before = backend.requests.room;
    backend.commit("transaction.created"); // 구독이 끊겼으므로 조회가 늘지 않는다
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(backend.requests.room).toBe(before);
  });
});
