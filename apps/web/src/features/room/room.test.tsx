import { act, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/a11y";
import * as fixtures from "@/test/fixtures";
import { initialInviteStage, inviteReducer, type InviteStage } from "./invite-stage";
import { RoomLayout, ROOM_SECTION_TITLES } from "./room-layout";
import { ServerDataGate, useCanMutate } from "./server-data-gate";
import {
  applySnapshotAtom,
  canMutateAtom,
  connectionAtom,
  epochAtom,
  type RoomSnapshot,
  setConnectionAtom,
  snapshotAtom,
  startEpochAtom,
} from "./state";

function makeSnapshot(epoch: number, status: "IN_PROGRESS" | "ENDED" = "IN_PROGRESS"): RoomSnapshot {
  return {
    epoch,
    room: { ...fixtures.room, status },
    me: fixtures.hostMember,
    participants: fixtures.participants,
    balances: fixtures.balances,
    transactions: fixtures.transactions,
    nextCursor: null,
    settlement: fixtures.expectedSettlement,
  };
}

function withStore(store = createStore()) {
  const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
  return { store, wrapper };
}

describe("연결·스냅샷 원자", () => {
  it("초기 상태는 disconnected이고 스냅샷이 없다", () => {
    const { store } = withStore();
    expect(store.get(connectionAtom)).toBe("disconnected");
    expect(store.get(snapshotAtom)).toBeNull();
    expect(store.get(epochAtom)).toBe(0);
  });

  it("연결됨이고 현재 세대일 때만 스냅샷을 반영한다", () => {
    const { store } = withStore();
    expect(store.set(applySnapshotAtom, makeSnapshot(0))).toBe(false); // 연결 전
    store.set(setConnectionAtom, "connected");
    const epoch = store.set(startEpochAtom);
    expect(store.set(applySnapshotAtom, makeSnapshot(epoch - 1))).toBe(false); // 이전 세대
    expect(store.set(applySnapshotAtom, makeSnapshot(epoch))).toBe(true);
    expect(store.get(snapshotAtom)?.epoch).toBe(epoch);
  });

  it("끊김이 되면 스냅샷을 즉시 비우고, 새 세대는 이전 스냅샷을 비운다", () => {
    const { store } = withStore();
    store.set(setConnectionAtom, "connected");
    const epoch = store.set(startEpochAtom);
    store.set(applySnapshotAtom, makeSnapshot(epoch));
    store.set(setConnectionAtom, "disconnected");
    expect(store.get(snapshotAtom)).toBeNull();

    store.set(setConnectionAtom, "connected");
    store.set(applySnapshotAtom, makeSnapshot(store.get(epochAtom)));
    store.set(startEpochAtom);
    expect(store.get(snapshotAtom)).toBeNull();
  });

  it("canMutate는 연결됨·현재 세대 스냅샷·진행 중일 때만 참이다", () => {
    const { store } = withStore();
    expect(store.get(canMutateAtom)).toBe(false);
    store.set(setConnectionAtom, "connected");
    const epoch = store.set(startEpochAtom);
    store.set(applySnapshotAtom, makeSnapshot(epoch));
    expect(store.get(canMutateAtom)).toBe(true);
    store.set(applySnapshotAtom, makeSnapshot(epoch, "ENDED"));
    expect(store.get(canMutateAtom)).toBe(false);
  });
});

describe("ServerDataGate", () => {
  function Probe() {
    return <p>서버 데이터 {useCanMutate() ? "변경 가능" : "변경 불가"}</p>;
  }
  function renderGate(store: ReturnType<typeof createStore>) {
    return render(
      <Provider store={store}>
        <ServerDataGate>
          <Probe />
        </ServerDataGate>
      </Provider>,
    );
  }

  it("끊김·스냅샷 없음에서는 자식을 렌더링하지 않는다", () => {
    const { store } = withStore();
    const view = renderGate(store);
    expect(screen.queryByText(/서버 데이터/)).not.toBeInTheDocument(); // 초기(끊김)
    view.unmount();

    store.set(setConnectionAtom, "connected"); // 연결됐지만 첫 스냅샷 전
    renderGate(store);
    expect(screen.queryByText(/서버 데이터/)).not.toBeInTheDocument();
  });

  it("이전 세대 스냅샷에서는 자식을 렌더링하지 않는다(연결·세대 원자를 직접 조작)", () => {
    const { store } = withStore();
    store.set(connectionAtom, "connected");
    store.set(epochAtom, 2);
    store.set(snapshotAtom, makeSnapshot(1));
    renderGate(store);
    expect(screen.queryByText(/서버 데이터/)).not.toBeInTheDocument();
  });

  it("연결됨이고 현재 세대 스냅샷이 있으면 렌더링한다", () => {
    const { store } = withStore();
    store.set(setConnectionAtom, "connected");
    store.set(applySnapshotAtom, makeSnapshot(store.set(startEpochAtom)));
    renderGate(store);
    expect(screen.getByText("서버 데이터 변경 가능")).toBeInTheDocument();
  });
});

describe("방 화면 구역", () => {
  it("[AC-VIEW-001-1] 누적 손익과 거래 내역이 서로 다른 제목의 구역이다", async () => {
    const { wrapper } = withStore();
    const { container } = render(
      <main>
        <RoomLayout />
      </main>,
      { wrapper },
    );
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(Object.values(ROOM_SECTION_TITLES));
    expect(headings).toContain("누적 손익");
    expect(headings).toContain("거래 내역");
    expect(new Set(headings).size).toBe(headings.length);
    await expectNoA11yViolations(container);
  });

  it("구역 순서는 방 정보 → 누적 손익 → 정산 → 거래 입력 → 거래 내역 → 참여자다", () => {
    expect(Object.values(ROOM_SECTION_TITLES)).toEqual([
      "방 정보",
      "누적 손익",
      "정산",
      "거래 입력",
      "거래 내역",
      "참여자",
    ]);
  });

  it("구역 제목은 끊김 중에도 보이고 본문은 게이트 뒤에만 보인다", () => {
    const { store, wrapper } = withStore();
    render(<RoomLayout slots={{ balances: <p>손익 본문</p> }} />, { wrapper });
    expect(screen.getByRole("heading", { name: "누적 손익" })).toBeInTheDocument();
    expect(screen.queryByText("손익 본문")).not.toBeInTheDocument();
    act(() => {
      store.set(setConnectionAtom, "connected");
      store.set(applySnapshotAtom, makeSnapshot(store.set(startEpochAtom)));
    });
    expect(screen.getByText("손익 본문")).toBeInTheDocument();
    act(() => store.set(setConnectionAtom, "disconnected"));
    expect(screen.queryByText("손익 본문")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "누적 손익" })).toBeInTheDocument();
  });

  it("구역 제목 덮어쓰기(예상·최종 정산)는 데이터가 보일 때만 적용된다", () => {
    const { store, wrapper } = withStore();
    render(<RoomLayout titles={{ settlement: "예상 정산" }} />, { wrapper });
    expect(screen.getByRole("heading", { name: "정산" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "예상 정산" })).not.toBeInTheDocument();
    act(() => {
      store.set(setConnectionAtom, "connected");
      store.set(applySnapshotAtom, makeSnapshot(store.set(startEpochAtom)));
    });
    expect(screen.getByRole("heading", { name: "예상 정산" })).toBeInTheDocument();
    act(() => store.set(setConnectionAtom, "disconnected"));
    expect(screen.queryByRole("heading", { name: "예상 정산" })).not.toBeInTheDocument();
  });
});

describe("초대 화면 단계 상태기계", () => {
  const run = (events: Parameters<typeof inviteReducer>[1][], from: InviteStage = initialInviteStage) =>
    events.reduce(inviteReducer, from);

  it("확인 중 → 닉네임 입력 → 입장 중 → 방 화면", () => {
    expect(run([{ type: "CHECKED", isMember: false }]).stage).toBe("nickname");
    expect(run([{ type: "CHECKED", isMember: false }, { type: "SUBMIT_NICKNAME" }]).stage).toBe("joining");
    expect(
      run([{ type: "CHECKED", isMember: false }, { type: "SUBMIT_NICKNAME" }, { type: "JOINED" }]).stage,
    ).toBe("room");
  });

  it("이미 멤버면 닉네임 없이 바로 입장 중이다", () => {
    expect(run([{ type: "CHECKED", isMember: true }]).stage).toBe("joining");
    expect(run([{ type: "CHECKED", isMember: true }, { type: "JOINED" }]).stage).toBe("room");
  });

  it("입장 거부는 닉네임 단계로 돌아가고, 복원 실패·초대 코드 오류는 오류 단계다", () => {
    expect(
      run([{ type: "CHECKED", isMember: false }, { type: "SUBMIT_NICKNAME" }, { type: "JOIN_REJECTED" }]).stage,
    ).toBe("nickname");
    expect(run([{ type: "CHECK_FAILED", code: "INVITE_NOT_FOUND" }])).toEqual({
      stage: "error",
      code: "INVITE_NOT_FOUND",
    });
    expect(
      run([{ type: "CHECKED", isMember: true }, { type: "RESTORE_FAILED", code: "ROOM_NOT_FOUND" }]).stage,
    ).toBe("error");
  });

  it("오류 단계에서 다시 시도하면 확인 중으로 돌아간다", () => {
    expect(run([{ type: "CHECK_FAILED", code: "NETWORK_ERROR" }, { type: "RETRY" }]).stage).toBe("checking");
    expect(run([{ type: "RETRY" }]).stage).toBe("checking"); // 오류가 아니면 무시(이미 확인 중)
    expect(run([{ type: "CHECKED", isMember: false }, { type: "RETRY" }]).stage).toBe("nickname");
  });

  it("단계에 맞지 않는 이벤트는 무시한다", () => {
    expect(run([{ type: "JOINED" }]).stage).toBe("checking");
    expect(run([{ type: "SUBMIT_NICKNAME" }]).stage).toBe("checking");
    expect(run([{ type: "CHECKED", isMember: false }, { type: "CHECKED", isMember: true }]).stage).toBe("nickname");
  });
});
