// 고정 `거래 기록하기` 버튼(링크)과 구역 모양. 페이지 분리 뒤에는 기록 페이지로 이동하는 링크다. AC 태그는 없다(새 AC가 없다).
import { act, screen, within } from "@testing-library/react";
import { createStore } from "jotai";
import { beforeEach, describe, expect, it } from "vitest";
import { roomBasePath } from "@/features/room/room-header";
import { ROOM_SECTION_TITLES, RoomLayout } from "@/features/room/room-layout";
import { setConnectionAtom } from "@/features/room/state";
import { expectNoA11yViolations } from "@/test/a11y";
import { renderApp } from "@/test/render";
import { INVITE_CODE, seedRoom } from "@/test/room-seed";
import { RECORD_BUTTON_CLEARANCE_PX, RecordTransactionButton } from "./record-button";
import { TransactionForm } from "./transaction-form";

let store: ReturnType<typeof createStore>;

beforeEach(() => {
  store = createStore();
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

const recordLink = () => screen.queryByRole("link", { name: "거래 기록하기" });

describe("고정 거래 기록하기 링크 (U-6, 페이지 분리)", () => {
  it("진행 중이고 연결된 방에서 보이고, 기록 페이지로 가는 링크다", () => {
    mount();
    const link = recordLink();
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", `${roomBasePath(INVITE_CODE)}/record`);
    // 이동 동작이므로 버튼이 아니라 링크다(모양만 버튼).
    expect(screen.queryByRole("button", { name: "거래 기록하기" })).not.toBeInTheDocument();
  });

  it("게임이 종료된 방에서는 링크도 여백도 없다(거래 입력 폼이 없는 상태와 같다)", () => {
    mount({ status: "ENDED" });
    expect(recordLink()).not.toBeInTheDocument();
    expect(screen.queryByTestId("record-button-clearance")).not.toBeInTheDocument();
  });

  it("종료된 방에서도 거래 입력 구역은 유지되고(FD-12) 폼이 없는 제목만의 컴팩트 카드로 보인다", () => {
    mount({ status: "ENDED" });
    expect(screen.getByRole("heading", { level: 2, name: "거래 입력" })).toBeInTheDocument();
    const entry = document.querySelector<HTMLElement>('[data-section="entry"]')!;
    expect(entry).toHaveAttribute("data-compact", "true");
    expect(within(entry).queryByLabelText("지급자")).not.toBeInTheDocument();
    // 본문이 있는 구역은 컴팩트가 아니다.
    expect(document.querySelector('[data-section="balances"]')).not.toHaveAttribute("data-compact");
  });

  it("연결이 끊기면 거래 입력 구역은 다른 구역처럼 제목만 남는다(가려진 이유는 연결 배너가 알린다)", () => {
    mount();
    act(() => store.set(setConnectionAtom, "disconnected"));
    expect(screen.getByRole("heading", { level: 2, name: "거래 입력" })).toBeInTheDocument();
    expect(screen.queryByLabelText("지급자")).not.toBeInTheDocument();
  });

  it("연결이 끊기면 링크와 여백이 사라진다(복구 뒤 표시는 스냅샷 세대가 정한다, 이 시험 범위 밖)", () => {
    mount();
    expect(recordLink()).toBeInTheDocument();
    act(() => store.set(setConnectionAtom, "disconnected"));
    expect(recordLink()).not.toBeInTheDocument();
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

  it("접근성 위반이 없다", async () => {
    const { container } = mount();
    await expectNoA11yViolations(container);
  });
});

describe("구역 모양 (FD-12·FD-18)", () => {
  it("RoomLayout은 구역을 방 정보 → 누적 손익 → 정산 → 거래 입력 → 거래 내역 → 참여자 순으로 그린다", () => {
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
