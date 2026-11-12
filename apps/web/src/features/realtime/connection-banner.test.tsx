import { act, screen } from "@testing-library/react";
import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/a11y";
import { renderApp } from "@/test/render";
import { AnnouncerProvider, useAnnounce } from "@/ui/announcer";
import type { ConnectionPhase } from "./connection";
import {
  bannerFor,
  ConnectionBanner,
  HIDDEN_GUIDANCE,
  INACCESSIBLE_MESSAGE,
  LIMIT_MESSAGE,
} from "./connection-banner";
import { connectionPhaseAtom } from "./state";

const PHASES: ConnectionPhase[] = ["connecting", "connected", "recovered", "reconnecting", "offline", "limit", "inaccessible"];

function render(phase: ConnectionPhase) {
  const store = createStore();
  store.set(connectionPhaseAtom, phase);
  return renderApp(<ConnectionBanner />, store);
}

describe("연결 배너 (FE-S5-4)", () => {
  it("모든 연결 단계에 문구가 정해져 있다(connected만 배너 없음)", () => {
    for (const phase of PHASES) {
      const content = bannerFor(phase);
      if (phase === "connected") expect(content).toBeNull();
      else expect(content?.title.length, phase).toBeGreaterThan(0);
    }
  });

  it("[AC-SYS-001-1] 끊김·재연결 중에는 연결 끊김 상태와 오류 안내(가림 이유·복구 방법)를 보인다", () => {
    const { container } = render("reconnecting");
    const banner = screen.getByText(/연결 끊김 · 다시 연결 중/);
    expect(banner.closest('[role="alert"]')).not.toBeNull(); // 경고는 alert로 안내
    expect(container.textContent).toContain(HIDDEN_GUIDANCE);
  });

  it("오프라인이면 네트워크 문제임을 알린다", () => {
    render("offline");
    expect(screen.getByText(/네트워크에 연결되어 있지 않습니다/)).toBeInTheDocument();
  });

  it("[AC-SYS-001-4] 이전 값·'최신 아님' 표시·캐시 대체 표시를 보이지 않는다", () => {
    for (const phase of ["reconnecting", "offline", "limit"] as const) {
      const view = render(phase);
      expect(view.container.textContent).not.toMatch(/최신 아님|이전 값|오래된|캐시|마지막으로/);
      view.unmount();
    }
  });

  it("복구 직후에는 `최신 상태로 갱신됨`을 보이고(status), 연결되어 있으면 배너가 없다", () => {
    const recovered = render("recovered");
    expect(screen.getByText("최신 상태로 갱신됨").closest('[role="status"]')).not.toBeNull();
    recovered.unmount();
    const connected = render("connected");
    expect(connected.container.textContent).toBe("");
  });

  it("처음 연결 중이면 연결 중임을 알린다", () => {
    render("connecting");
    expect(screen.getByText("연결 중")).toBeInTheDocument();
  });

  it("연결 수 한도(429)와 접근 불가(401·404) 문구를 보인다", () => {
    const limit = render("limit");
    expect(limit.container.textContent).toContain(LIMIT_MESSAGE);
    limit.unmount();
    const inaccessible = render("inaccessible");
    expect(inaccessible.container.textContent).toContain(INACCESSIBLE_MESSAGE);
  });

  it("끊김 중에는 알림 영역에 남아 있던 지난 문구를 비운다", async () => {
    function Announcer() {
      const announce = useAnnounce();
      return <button onClick={() => announce("거래를 저장했습니다.")}>알림</button>;
    }
    const store = createStore();
    store.set(connectionPhaseAtom, "connected");
    renderApp(
      <AnnouncerProvider>
        <Announcer />
        <ConnectionBanner />
      </AnnouncerProvider>,
      store,
    );
    // renderApp이 이미 AnnouncerProvider를 두르므로 안쪽 제공자가 이 컴포넌트들의 알림을 맡는다.
    act(() => screen.getByRole("button", { name: "알림" }).click());
    expect(screen.getAllByRole("status").some((el) => el.textContent === "거래를 저장했습니다.")).toBe(true);
    act(() => store.set(connectionPhaseAtom, "reconnecting"));
    expect(screen.getAllByRole("status").some((el) => el.textContent === "거래를 저장했습니다.")).toBe(false);
  });

  it("접근성 검사를 통과한다", async () => {
    const { container } = render("reconnecting");
    await expectNoA11yViolations(container);
  });
});
