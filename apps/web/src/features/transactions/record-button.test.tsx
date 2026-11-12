// FE-D2 완료 기준(FD-18 (4), U-6·U-7): 고정 `거래 기록하기` 버튼과 구역 모양. AC 태그는 없다(새 AC가 없다).
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROOM_SECTION_TITLES, RoomLayout } from "@/features/room/room-layout";
import { setConnectionAtom } from "@/features/room/state";
import { expectNoA11yViolations } from "@/test/a11y";
import { renderApp } from "@/test/render";
import { seedRoom } from "@/test/room-seed";
import { RECORD_BUTTON_CLEARANCE_PX, RecordTransactionButton } from "./record-button";
import { TransactionForm } from "./transaction-form";

let store: ReturnType<typeof createStore>;
const scrollIntoView = vi.fn();

beforeEach(() => {
  store = createStore();
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

function mount(options: Parameters<typeof seedRoom>[1] = {}) {
  seedRoom(store, options);
  return renderApp(
    <main>
      <RoomLayout slots={{ entry: <TransactionForm /> }} floating={<RecordTransactionButton />} />
    </main>,
    store,
  );
}

const recordButton = () => screen.queryByRole("button", { name: "거래 기록하기" });

describe("고정 거래 기록하기 버튼 (FE-D2, U-6)", () => {
  it("진행 중이고 연결된 방에서 보이고, 누르면 거래 입력 구역으로 이동해 첫 입력에 포커스를 둔다", async () => {
    mount();
    const button = recordButton();
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");

    await userEvent.click(button!);

    const entry = document.querySelector<HTMLElement>('[data-section="entry"]')!;
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView.mock.contexts[0]).toBe(entry);
    expect(within(entry).getByLabelText("지급자")).toHaveFocus();
  });

  it("모션 줄이기 설정이면 부드러운 스크롤을 쓰지 않는다", async () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", matchMedia);
    try {
      mount();
      await userEvent.click(recordButton()!);
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("게임이 종료된 방에서는 버튼도 여백도 없다(거래 입력 폼이 없는 상태와 같다)", () => {
    mount({ status: "ENDED" });
    expect(recordButton()).not.toBeInTheDocument();
    expect(screen.queryByTestId("record-button-clearance")).not.toBeInTheDocument();
  });

  it("종료된 방에서는 본문이 없는 빈 거래 입력 카드를 그리지 않는다", () => {
    mount({ status: "ENDED" });
    expect(screen.queryByRole("heading", { level: 2, name: "거래 입력" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "거래 내역" })).toBeInTheDocument();
  });

  it("연결이 끊기면 거래 입력 구역은 다른 구역처럼 제목만 남는다(가려진 이유는 연결 배너가 알린다)", () => {
    mount();
    act(() => store.set(setConnectionAtom, "disconnected"));
    const heading = screen.getByRole("heading", { level: 2, name: "거래 입력" });
    expect(heading).toBeInTheDocument();
    expect(screen.queryByLabelText("지급자")).not.toBeInTheDocument();
  });

  it("연결이 끊기면 버튼과 여백이 사라진다(복구 뒤 표시는 스냅샷 세대가 정한다, 이 시험 범위 밖)", () => {
    mount();
    expect(recordButton()).toBeInTheDocument();
    act(() => store.set(setConnectionAtom, "disconnected"));
    expect(recordButton()).not.toBeInTheDocument();
    expect(screen.queryByTestId("record-button-clearance")).not.toBeInTheDocument();
  });

  it("마지막 구역이 가려지지 않도록 버튼 높이보다 큰 여백이 구역 뒤에 있다", () => {
    mount();
    const clearance = screen.getByTestId("record-button-clearance");
    expect(clearance).toHaveAttribute("aria-hidden", "true");
    expect(Number.parseInt(clearance.style.height, 10)).toBe(RECORD_BUTTON_CLEARANCE_PX);
    // 56px(버튼) + 위아래 여유보다 커야 한다.
    expect(RECORD_BUTTON_CLEARANCE_PX).toBeGreaterThanOrEqual(56 + 16 + 16);
    const sections = document.querySelectorAll("section[data-section]");
    const last = sections[sections.length - 1]!;
    expect(last.compareDocumentPosition(clearance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("버튼은 접근성 위반이 없고 키보드로 누를 수 있다", async () => {
    const { container } = mount();
    await expectNoA11yViolations(container);
    const button = recordButton()!;
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(scrollIntoView).toHaveBeenCalledOnce();
  });
});

describe("방 화면 구역 모양 (FE-D2, FD-12·FD-18)", () => {
  it("구역 순서는 방 정보 → 누적 손익 → 정산 → 거래 입력 → 거래 내역 → 참여자로 바뀌지 않는다", () => {
    mount();
    const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(Object.values(ROOM_SECTION_TITLES));
  });

  it("구역 제목의 접근 가능한 이름에 장식 아이콘이 섞이지 않는다", () => {
    mount();
    for (const title of Object.values(ROOM_SECTION_TITLES)) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
    expect(document.querySelectorAll("section[data-section] h2 svg[aria-hidden='true']")).toHaveLength(
      Object.keys(ROOM_SECTION_TITLES).length,
    );
  });
});
