// 고정 `거래 기록하기` 버튼(링크)과 구역 모양. 페이지 분리 뒤에는 기록 페이지로 이동하는 링크다. AC 태그는 없다(새 AC가 없다).
import { act, screen, within } from "@testing-library/react";
import { createStore } from "jotai";
import { beforeEach, describe, expect, it } from "vitest";
import { connectionPhaseAtom } from "@/features/realtime/state";
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
    expect(within(entry).queryByRole("group", { name: "지급자" })).not.toBeInTheDocument();
    // 본문이 있는 구역은 컴팩트가 아니다.
    expect(document.querySelector('[data-section="balances"]')).not.toHaveAttribute("data-compact");
  });

  it("연결이 끊기면 거래 입력 구역은 폼 없이 제목과 스켈레톤만 남는다(가려진 이유는 연결 배너가 알린다)", () => {
    mount();
    act(() => store.set(setConnectionAtom, "disconnected"));
    expect(screen.getByRole("heading", { level: 2, name: "거래 입력" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "지급자" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-section="entry"] [data-skeleton="form"]')).toBeInTheDocument();
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

  it("구역 제목은 카드 밖에 있고 본문만 흰 카드에 든다(DV-13)", () => {
    mount();
    const balances = document.querySelector<HTMLElement>('[data-section="balances"]')!;
    const [heading, card] = Array.from(balances.children);
    expect(heading!.tagName).toBe("H2");
    expect(card!.className).toMatch(/bg-c_paper/);
    expect(heading!.className).not.toMatch(/bg-c_paper/);
    expect(balances.className).not.toMatch(/bg-c_paper/);
  });

  // 2.1.0(U-21, FD-29): 방향 문서 1.1.0 §5.1(Plan 2.0.0까지)의 "제목만 남고 카드 없음"을 "카드 안 스켈레톤만"으로 바꿨다. 서버 값이 없다는 단언은 유지한다.
  it("끊김 중에는 모든 구역이 제목과 값 없는 스켈레톤 카드만 남는다(방향 문서 1.2.0 §5.1, S5 §6.5)", () => {
    mount();
    act(() => store.set(setConnectionAtom, "disconnected"));
    const sections = Array.from(document.querySelectorAll<HTMLElement>("section[data-section]"));
    expect(sections).toHaveLength(Object.keys(ROOM_SECTION_TITLES).length);
    for (const section of sections) {
      expect(Array.from(section.children).map((el) => el.tagName)).toEqual(["H2", "DIV"]);
      const card = section.children[1]!;
      expect(card.children).toHaveLength(1);
      expect(card.firstElementChild).toHaveAttribute("data-skeleton");
      expect(card.firstElementChild).toHaveAttribute("aria-hidden", "true");
      expect(card.textContent).toBe("");
      expect(section).toHaveAttribute("aria-busy", "true");
    }
  });

  it("첫 로딩(스냅샷 없음, 스트림 연결 전)에도 구역마다 스켈레톤 카드를 보인다(FD-29, U-21)", async () => {
    const { container } = renderApp(
      <main>
        <RoomLayout slots={{ entry: <TransactionForm /> }} floating={<RecordTransactionButton />} />
      </main>,
      store,
    );
    const shapes = Array.from(document.querySelectorAll("section[data-section]")).map((section) => [
      section.getAttribute("data-section"),
      section.querySelector("[data-skeleton]")?.getAttribute("data-skeleton"),
    ]);
    expect(shapes).toEqual([
      ["info", "lines"],
      ["balances", "rows"],
      ["settlement", "rows"],
      ["entry", "form"],
      ["transactions", "rows"],
      ["participants", "rows"],
    ]);
    // 목록 모양은 행 수가 고정이다(이전 값의 정보가 없다, RK-F29).
    for (const rows of document.querySelectorAll('[data-skeleton="rows"]')) {
      expect(rows.firstElementChild!.children).toHaveLength(3);
    }
    expect(recordLink()).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("스켈레톤 막대는 동작 줄이기 설정에서 깜빡이지 않는다(FD-29)", () => {
    renderApp(<RoomLayout />, store);
    const bar = document.querySelector('[data-skeleton="lines"] > div > div')!;
    expect(bar.className.split(" ")).toContain("anim_pulse");
    expect(bar.className.split(" ").some((name) => /^mo.*reduce.*:anim_none$/i.test(name))).toBe(true);
  });

  it("접근 불가(401·404, 재시도 없음)이면 스켈레톤과 `aria-busy` 없이 제목만 남는다(Q-C7)", () => {
    mount();
    act(() => {
      store.set(setConnectionAtom, "disconnected");
      store.set(connectionPhaseAtom, "inaccessible");
    });
    expect(document.querySelector("[data-skeleton]")).toBeNull();
    expect(document.querySelector("section[aria-busy]")).toBeNull();
    for (const section of document.querySelectorAll<HTMLElement>("section[data-section]")) {
      expect(Array.from(section.children).map((el) => el.tagName)).toEqual(["H2"]);
    }
  });

  it("연결되어 데이터가 보이면 스켈레톤과 `aria-busy`가 없다(FD-29)", () => {
    mount();
    expect(document.querySelector("[data-skeleton]")).toBeNull();
    expect(document.querySelector("section[aria-busy]")).toBeNull();
  });

  it("구역 제목 아이콘은 집·코인·주머니·연필·장부·얼굴 둘이다(FD-18 (3))", () => {
    mount();
    const shapes = Array.from(document.querySelectorAll("section[data-section] h2 svg")).map(
      (svg) => svg.querySelector("[fill]")?.getAttribute("fill") ?? "",
    );
    // 각 아이콘의 첫 면 색: 집 #FBAFC1, 코인 #FDB927, 주머니 #FDB927, 연필 #FFC93C, 장부 #00C176, 얼굴 둘(마스크 뒤 첫 면) #fff
    expect(shapes).toEqual(["#FBAFC1", "#FDB927", "#FDB927", "#FFC93C", "#00C176", "#fff"]);
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
