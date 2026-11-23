import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { ONBOARDING_SEEN_KEYS } from "@/lib/identity";
import { expectNoA11yViolations } from "@/test/a11y";
import { type FakeStorage, installFakeStorage } from "@/test/fake-storage";
import { renderApp } from "@/test/render";
import { seedRoom } from "@/test/room-seed";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { RoomOnboarding, RoomOnboardingButton } from "./room-onboarding";
import { setConnectionAtom } from "./state";

let storage: FakeStorage;
beforeEach(() => {
  storage = installFakeStorage();
});

function renderRoom(store = createStore()) {
  return renderApp(
    <main>
      <RoomOnboardingButton />
      <RoomOnboarding />
    </main>,
    store,
  );
}

describe("방 온보딩 (U-30, DV-26)", () => {
  it("처음 기록할 수 있는 방을 보면 탭 네 개를 한 장씩 설명하고, 시작하기로 닫으며 본 것으로 남긴다", async () => {
    const user = userEvent.setup();
    const store = createStore();
    seedRoom(store);
    renderRoom(store);
    const dialog = screen.getByRole("dialog", { name: "현황에서 손익을 봐요" });
    expect(within(dialog).getByText("4장 중 1번째")).toBeInTheDocument();
    const titles = ["현황에서 손익을 봐요"];
    for (let i = 0; i < 3; i += 1) {
      await user.click(within(dialog).getByRole("button", { name: "다음" }));
      titles.push(within(dialog).getByRole("heading", { level: 2 }).textContent ?? "");
    }
    expect(titles).toEqual(["현황에서 손익을 봐요", "기록에서 거래를 남겨요", "정산에서 보낼 금액을 봐요", "방에서 친구를 불러요"]);
    expect(storage.getItem(ONBOARDING_SEEN_KEYS.room)).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "시작하기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storage.getItem(ONBOARDING_SEEN_KEYS.room)).toBe("1");
  });

  it("홈 온보딩과 따로 남긴다: 홈 소개를 봤어도 방 온보딩은 열리고, 닫으면 방 표시만 더한다", async () => {
    const user = userEvent.setup();
    storage.setItem(ONBOARDING_SEEN_KEYS.home, "1");
    const store = createStore();
    seedRoom(store);
    renderRoom(store);
    await user.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(storage.keys().sort()).toEqual([ONBOARDING_SEEN_KEYS.home, ONBOARDING_SEEN_KEYS.room].sort());
  });

  it("연결 전·끝난 방·조회 전용 본인에게는 저절로 열지 않고, 끝난 방에는 다시 보기 버튼도 없다", () => {
    const store = createStore();
    seedRoom(store);
    store.set(setConnectionAtom, "disconnected");
    const view = renderRoom(store);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.unmount();

    const ended = createStore();
    seedRoom(ended, { status: "ENDED" });
    const endedView = renderRoom(ended);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "방 사용법 다시 보기" })).not.toBeInTheDocument();
    endedView.unmount();
    expect(storage.getItem(ONBOARDING_SEEN_KEYS.room)).toBeNull();
  });

  it("연결되어 데이터가 보이는 순간 열린다", () => {
    const store = createStore();
    seedRoom(store);
    store.set(setConnectionAtom, "disconnected");
    renderRoom(store);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => {
      seedRoom(store);
    });
    expect(screen.getByRole("dialog", { name: "현황에서 손익을 봐요" })).toBeInTheDocument();
  });

  it("본 브라우저에서는 열리지 않고, 다시 보기로 첫 장부터 열며 닫으면 포커스가 버튼으로 돌아온다", async () => {
    const user = userEvent.setup();
    storage.setItem(ONBOARDING_SEEN_KEYS.room, "1");
    const store = createStore();
    seedRoom(store);
    const { container } = renderRoom(store);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await expectNoA11yViolations(container);

    const again = screen.getByRole("button", { name: "방 사용법 다시 보기" });
    await user.click(again);
    expect(screen.getByRole("dialog", { name: "현황에서 손익을 봐요" })).toBeInTheDocument();
    await expectNoA11yViolations(document.body);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(again).toHaveFocus();
  });

  it("온보딩이 열린 채 확인 대화상자가 뜨면 포커스와 Esc를 그쪽에 양보한다(서로 포커스를 뺏지 않는다)", async () => {
    const user = userEvent.setup();
    const store = createStore();
    seedRoom(store);
    let openConfirm: () => void = () => undefined;
    function Confirm() {
      const [open, setOpen] = useState(false);
      openConfirm = () => setOpen(true);
      return (
        <ConfirmDialog
          open={open}
          title="확인"
          description="저절로 뜬 확인 대화상자"
          confirmLabel="확인"
          onConfirm={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      );
    }
    renderApp(
      <main>
        <Button>밖</Button>
        <RoomOnboarding />
        <Confirm />
      </main>,
      store,
    );
    expect(screen.getByRole("button", { name: "다음" })).toHaveFocus();
    act(() => openConfirm());
    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByText("저절로 뜬 확인 대화상자")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "현황에서 손익을 봐요" })).toBeInTheDocument();
    expect(storage.getItem(ONBOARDING_SEEN_KEYS.room)).toBeNull();
  });
});
