import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { beforeEach, describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/a11y";
import { mockClipboard } from "@/test/clipboard";
import * as fixtures from "@/test/fixtures";
import { renderApp } from "@/test/render";
import { seedRoom } from "@/test/room-seed";
import { RoomInfo } from "./room-info";

let store: ReturnType<typeof createStore>;
beforeEach(() => {
  store = createStore();
});

describe("방 정보 영역", () => {
  it("방 이름·정산 단위·진행 상태·내 닉네임과 방장 여부를 보여 준다", async () => {
    seedRoom(store);
    const { container } = renderApp(<main><RoomInfo /></main>, store);
    expect(screen.getByText(fixtures.room.name)).toBeInTheDocument();
    expect(screen.getByText("정산 단위: 원")).toBeInTheDocument();
    expect(screen.getByText("진행 중")).toBeInTheDocument();
    expect(screen.getByText(/내 닉네임: 방장/)).toBeInTheDocument();
    expect(screen.getByText("방장", { selector: "span" })).toBeInTheDocument(); // 방장 배지
    await expectNoA11yViolations(container);
  });

  it("방장이 아니면 방장 배지가 없고, 종료된 방은 게임 종료로 표시한다", () => {
    seedRoom(store, { me: fixtures.guestMember, status: "ENDED" });
    renderApp(<RoomInfo />, store);
    expect(screen.getByText(/내 닉네임: 손님/)).toBeInTheDocument();
    expect(screen.queryByText("방장", { selector: "span" })).not.toBeInTheDocument();
    expect(screen.getByText("게임 종료")).toBeInTheDocument();
  });

  it("방 정보를 바꾸는 입력·버튼이 없다(복사 버튼만 있다)", () => {
    seedRoom(store);
    renderApp(<RoomInfo />, store);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["초대 링크 복사"]);
    expect(screen.getAllByRole("textbox")).toHaveLength(1); // 읽기 전용 초대 링크
    expect(screen.getByLabelText("초대 링크")).toHaveAttribute("readonly");
  });

  it("초대 링크를 표시하고 복사가 끝난 뒤에만 성공을 알린다", async () => {
    seedRoom(store);
    const clipboard = mockClipboard({ manual: true });
    renderApp(<RoomInfo />, store);
    const link = `${window.location.origin}/invite/${fixtures.room.inviteCode}`;
    expect(screen.getByLabelText("초대 링크")).toHaveValue(link);

    await userEvent.click(screen.getByRole("button", { name: "초대 링크 복사" }));
    expect(screen.queryByText("초대 링크를 복사했습니다.")).not.toBeInTheDocument(); // 쓰기 완료 전
    act(() => clipboard.resolve());
    expect(await screen.findAllByText("초대 링크를 복사했습니다.")).not.toHaveLength(0);
    expect(clipboard.written).toEqual([link]);
  });

  it("복사에 실패하면 실패를 알리고 성공으로 표시하지 않는다", async () => {
    seedRoom(store);
    mockClipboard({ fail: true });
    renderApp(<RoomInfo />, store);
    await userEvent.click(screen.getByRole("button", { name: "초대 링크 복사" }));
    await waitFor(() =>
      expect(screen.getAllByText(/복사하지 못했습니다/).length).toBeGreaterThan(0),
    );
    expect(screen.queryByText("초대 링크를 복사했습니다.")).not.toBeInTheDocument();
  });
});
