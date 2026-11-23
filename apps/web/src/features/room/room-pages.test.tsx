// 페이지 분리(FD-12 개정): 헤더 탭, 페이지별 구성, 종료 방 이동. 새 AC는 없고 기존 AC·동작은 AllPages 시험이 지킨다.
import { act, screen, within } from "@testing-library/react";
import { createStore } from "jotai";
import { type ReactNode, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { choiceGroup } from "@/test/choice";
import { expectNoA11yViolations } from "@/test/a11y";
import { installFakeStorage, skipRoomOnboarding } from "@/test/fake-storage";
import { renderApp } from "@/test/render";
import { INVITE_CODE, seedRoom } from "@/test/room-seed";
import { pageOfPath, RoomHeader, roomBasePath } from "./room-header";
import { RecordPage, RoomPage, SettlementPage, StatusPage } from "./room-pages";
import { RoomShell } from "./room-shell";
import { setConnectionAtom } from "./state";

const nav = vi.hoisted(() => ({ pathname: null as string | null, replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
}));

const BASE = roomBasePath(INVITE_CODE);
let store: ReturnType<typeof createStore>;

beforeEach(() => {
  store = createStore();
  nav.pathname = BASE;
  nav.replace.mockClear();
  // 방 온보딩을 본 브라우저로 둔다. 온보딩의 페이지 이동은 아래 "방 온보딩과 페이지"가 따로 본다.
  skipRoomOnboarding(installFakeStorage());
});

function mount(ui: ReactNode, options: Parameters<typeof seedRoom>[1] = {}) {
  seedRoom(store, options);
  return renderApp(<main>{ui}</main>, store);
}

const headings = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

describe("경로 → 페이지", () => {
  it("초대 링크 아래 경로를 페이지로 바꾼다. 모르는 경로·경로 없음은 현황이다", () => {
    expect(pageOfPath(BASE, INVITE_CODE)).toBe("status");
    expect(pageOfPath(`${BASE}/record`, INVITE_CODE)).toBe("record");
    expect(pageOfPath(`${BASE}/settlement`, INVITE_CODE)).toBe("settlement");
    expect(pageOfPath(`${BASE}/room`, INVITE_CODE)).toBe("room");
    expect(pageOfPath(`${BASE}/elsewhere`, INVITE_CODE)).toBe("status");
    expect(pageOfPath(null, INVITE_CODE)).toBe("status");
  });
});

describe("헤더 탭", () => {
  it("방 이름·진행 상태와 탭 4개를 보이고 현재 페이지에 aria-current를 둔다", () => {
    nav.pathname = `${BASE}/settlement`;
    mount(<RoomHeader inviteCode={INVITE_CODE} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("금요일 포커");
    expect(screen.getByText("진행 중")).toBeInTheDocument();
    const nav4 = screen.getByRole("navigation", { name: "방 페이지" });
    const links = within(nav4).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["현황", "기록", "정산", "방"]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([BASE, `${BASE}/record`, `${BASE}/settlement`, `${BASE}/room`]);
    expect(links.filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.textContent)).toEqual(["정산"]);
  });

  it("게임이 종료되면 기록 탭이 사라지고 `게임 종료`를 표시한다(S2 §9)", () => {
    mount(<RoomHeader inviteCode={INVITE_CODE} />, { status: "ENDED" });
    const links = within(screen.getByRole("navigation", { name: "방 페이지" })).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["현황", "정산", "방"]);
    expect(screen.getByText("게임 종료")).toBeInTheDocument();
  });

  it("연결이 끊기면 서버 유래 값(방 이름·진행 상태)을 가리고 DDALLANG만 남긴다", () => {
    mount(<RoomHeader inviteCode={INVITE_CODE} />);
    act(() => store.set(setConnectionAtom, "disconnected"));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("DDALLANG");
    expect(screen.queryByText("금요일 포커")).not.toBeInTheDocument();
    expect(screen.queryByText("진행 중")).not.toBeInTheDocument();
    // 탭은 서버 값이 아니므로 그대로 쓸 수 있다.
    expect(within(screen.getByRole("navigation", { name: "방 페이지" })).getAllByRole("link")).toHaveLength(4);
  });

  it("헤더는 위쪽 틈까지 덮는 고정 래퍼 안에 있다(스크롤되는 카드가 틈으로 비치지 않게)", () => {
    mount(<RoomHeader inviteCode={INVITE_CODE} />);
    const wrapper = screen.getByTestId("room-header-sticky");
    expect(wrapper).toContainElement(screen.getByRole("banner"));
    // 헤더(banner) 자체가 아니라 래퍼가 고정과 배경을 맡는다. 디자인 v2: 래퍼가 화면 폭 전체를 흰 단색으로 칠하고
    // (그라데이션 없음, 방향 문서 §5.1) 아래에 장식 구분선을 둔다(RK-F20).
    expect(wrapper.className).toMatch(/pos_sticky/);
    expect(wrapper.className).toMatch(/top_0/);
    expect(wrapper.className).toMatch(/bg-c_paper/);
    expect(wrapper.className).toMatch(/bd-b-c_divider/);
  });

  it("헤더 탭은 글자만 있고(아이콘 없음) 로고도 없다(DV-9·DV-16)", () => {
    mount(<RoomHeader inviteCode={INVITE_CODE} />);
    expect(screen.getByTestId("room-header-sticky").querySelector("svg")).toBeNull();
  });

  it("접근성 위반이 없다", async () => {
    const { container } = mount(<RoomHeader inviteCode={INVITE_CODE} />);
    await expectNoA11yViolations(container);
  });
});

describe("페이지별 구성(손익과 거래 내역은 한 화면, AC-VIEW-001-1)", () => {
  it("현황: 누적 손익과 거래 내역, 거래 기록하기 링크. 입력·정산·방 정보·참여자는 없다", () => {
    mount(<StatusPage />);
    expect(headings()).toEqual(["누적 손익", "거래 내역"]);
    expect(screen.getByRole("link", { name: "거래 기록하기" })).toBeInTheDocument();
  });

  it("기록: 거래 입력만", () => {
    mount(<RecordPage />);
    expect(headings()).toEqual(["거래 입력"]);
    expect(choiceGroup(screen, "지급자")).toBeInTheDocument();
  });

  it("정산: 예상 정산과 게임 종료(방장). 진행 중에만 종료 컨트롤이 있다", () => {
    mount(<SettlementPage />);
    expect(headings()).toEqual(["예상 정산"]);
    expect(screen.getByRole("button", { name: "게임 종료" })).toBeInTheDocument();
    // 게임 종료는 정산 카드 밖(구역 안, 카드 아래)에 있다(방향 문서 §5.4).
    const section = document.querySelector<HTMLElement>('[data-section="settlement"]')!;
    const button = screen.getByRole("button", { name: "게임 종료" });
    expect(section).toContainElement(button);
    expect(button.closest("[class*='bg-c_paper']")).toBeNull();
  });

  it("정산: 종료된 방은 최종 정산이고 종료 컨트롤이 없다", () => {
    mount(<SettlementPage />, { status: "ENDED" });
    expect(headings()).toEqual(["최종 정산"]);
    expect(screen.queryByRole("button", { name: "게임 종료" })).not.toBeInTheDocument();
  });

  it("방: 방 정보(초대 링크)와 참여자", () => {
    mount(<RoomPage />);
    expect(headings()).toEqual(["방 정보", "참여자"]);
    expect(screen.getByLabelText("초대 링크")).toBeInTheDocument();
  });

  it("모든 페이지가 접근성 위반이 없다", async () => {
    for (const page of [<StatusPage key="s" />, <RecordPage key="r" />, <SettlementPage key="t" />, <RoomPage key="o" />]) {
      const { container, unmount } = mount(page);
      await expectNoA11yViolations(container);
      unmount();
      store = createStore();
    }
  });
});

describe("종료된 방 이동 (S2 §9, FD-12 개정)", () => {
  const shell = <RoomShell inviteCode={INVITE_CODE}>본문</RoomShell>;

  it("종료된 방에서 기록 페이지에 있으면 정산으로 보낸다", () => {
    nav.pathname = `${BASE}/record`;
    mount(shell, { status: "ENDED" });
    expect(nav.replace).toHaveBeenCalledWith(`${BASE}/settlement`);
  });

  it("종료된 방에 처음 들어온 곳이 현황이면 정산에서 시작한다", () => {
    nav.pathname = BASE;
    mount(shell, { status: "ENDED" });
    expect(nav.replace).toHaveBeenCalledWith(`${BASE}/settlement`);
  });

  it("종료된 방에서 사용자가 방 페이지에 있으면 건드리지 않는다", () => {
    nav.pathname = `${BASE}/room`;
    mount(shell, { status: "ENDED" });
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("진행 중인 방은 어느 페이지에서도 이동시키지 않는다", () => {
    for (const path of [BASE, `${BASE}/record`, `${BASE}/settlement`, `${BASE}/room`]) {
      nav.pathname = path;
      const { unmount } = mount(shell);
      expect(nav.replace).not.toHaveBeenCalled();
      unmount();
      store = createStore();
    }
  });

  it("경로를 알 수 없으면(시험·초기 렌더) 라우터를 쓰지 않는다", () => {
    nav.pathname = null;
    mount(shell, { status: "ENDED" });
    expect(nav.replace).not.toHaveBeenCalled();
  });
});

describe("방 온보딩과 페이지 (U-31)", () => {
  it("장을 넘기면 뒤 페이지가 현황 → 기록 → 정산 → 방 순으로 바뀌고, 닫으면 그 페이지에 머문다", async () => {
    const user = userEvent.setup();
    installFakeStorage();
    nav.pathname = `${BASE}/settlement`; // 정산 페이지에서 처음 들어와도 첫 장은 현황이다
    // 라우터가 옮긴 경로로 다시 그린다(실제 앱에서는 레이아웃이 그대로 남고 경로만 바뀐다).
    let redraw = () => undefined as void;
    function Routed() {
      const [, setTick] = useState(0);
      redraw = () => setTick((tick) => tick + 1);
      return <RoomShell inviteCode={INVITE_CODE}>본문</RoomShell>;
    }
    mount(<Routed />);
    const dialog = screen.getByRole("dialog", { name: "현황에서 손익을 봐요" });
    expect(nav.replace.mock.calls).toEqual([[BASE]]);

    const pages = [`${BASE}/record`, `${BASE}/settlement`, `${BASE}/room`];
    for (const page of pages) {
      nav.pathname = nav.replace.mock.calls.at(-1)![0];
      act(() => redraw());
      await user.click(within(dialog).getByRole("button", { name: "다음" }));
      expect(nav.replace.mock.calls.at(-1)).toEqual([page]);
    }
    const calls = nav.replace.mock.calls.length;
    await user.click(within(dialog).getByRole("button", { name: "시작하기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(nav.replace.mock.calls).toHaveLength(calls);
  });

  it("이미 그 페이지에 있으면 옮기지 않는다", () => {
    installFakeStorage();
    nav.pathname = BASE;
    mount(<RoomShell inviteCode={INVITE_CODE}>본문</RoomShell>);
    expect(screen.getByRole("dialog", { name: "현황에서 손익을 봐요" })).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("이동이 반영되기 전에 장을 빠르게 넘겨도 장마다 옮긴다(경로가 늦게 바뀌는 경우, 검수 T1-01)", async () => {
    const user = userEvent.setup();
    installFakeStorage();
    nav.pathname = `${BASE}/room`; // 라우터가 아직 아무 이동도 반영하지 않은 채로 둔다
    mount(<RoomShell inviteCode={INVITE_CODE}>본문</RoomShell>);
    for (let i = 0; i < 3; i += 1) await user.click(screen.getByRole("button", { name: "다음" }));
    expect(nav.replace.mock.calls).toEqual([[BASE], [`${BASE}/record`], [`${BASE}/settlement`], [`${BASE}/room`]]);
  });

  it("다시 열면 첫 장에서 다시 현황으로 옮긴다(이전에 요청한 주소가 남아 있어도)", async () => {
    const user = userEvent.setup();
    installFakeStorage();
    nav.pathname = BASE;
    let redraw = () => undefined as void;
    function Routed() {
      const [, setTick] = useState(0);
      redraw = () => setTick((tick) => tick + 1);
      return <RoomShell inviteCode={INVITE_CODE}>본문</RoomShell>;
    }
    mount(
      <>
        <Routed />
        <RoomPage />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "건너뛰기" })); // 현황에서 닫았다
    expect(nav.replace).not.toHaveBeenCalled();
    nav.pathname = `${BASE}/room`; // 사용자가 방 페이지로 옮겼다
    act(() => redraw());
    await user.click(screen.getByRole("button", { name: "방 사용법 다시 보기" }));
    expect(nav.replace.mock.calls).toEqual([[BASE]]);
  });
});
