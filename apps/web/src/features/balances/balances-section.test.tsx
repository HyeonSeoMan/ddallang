import { screen, within } from "@testing-library/react";
import { createStore } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/a11y";
import * as fixtures from "@/test/fixtures";
import { renderApp } from "@/test/render";
import { seedRoom } from "@/test/room-seed";
import { applySnapshotAtom, snapshotAtom } from "@/features/room/state";
import { BalancesSection } from "./balances-section";

function render(store = createStore()) {
  seedRoom(store);
  return renderApp(<main><BalancesSection /></main>, store);
}

describe("누적 손익 영역", () => {
  it("[AC-VIEW-001-2] 참여자별 순손익만 보이고 거래 항목은 없다", () => {
    render();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(fixtures.balances.length); // 거래 수(2)가 아니라 참여자 수(3)
    expect(screen.queryByText(/사유|라운드|→/)).not.toBeInTheDocument();
  });

  it("서버 순서를 그대로 쓴다(재정렬 없음): 손익 내림차순 +150, 0, −150", () => {
    render();
    const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows[0]).toContain("가온");
    expect(rows[0]).toContain("+150 원");
    expect(rows[1]).toContain("다온");
    expect(rows[1]).toContain("0 원");
    expect(rows[2]).toContain("나래");
    expect(rows[2]).toContain("−150 원");
  });

  it("서버가 준 순서가 정렬 규칙과 달라도(방어) 다시 정렬하지 않는다", () => {
    const store = createStore();
    seedRoom(store);
    const snapshot = store.get(snapshotAtom)!;
    const shuffled = [fixtures.balances[2]!, fixtures.balances[0]!, fixtures.balances[1]!];
    store.set(applySnapshotAtom, { ...snapshot, balances: shuffled });
    renderApp(<BalancesSection />, store);
    const names = screen.getAllByRole("listitem").map((li) => li.textContent?.split(" ")[0]);
    expect(names).toEqual(["나래", "가온", "다온"]);
  });

  it("비활성·거래 없는 참여자도 포함하고 비활성은 텍스트 배지로 표시한다", () => {
    render();
    const inactive = screen.getByText("다온").closest("li")!;
    expect(within(inactive).getByText("비활성")).toBeInTheDocument();
    expect(within(inactive).getByText("0 원")).toBeInTheDocument(); // 거래가 없어도 0으로 보인다
  });

  it("[AC-ROOM-001-14][AC-ROOM-003-3] 금액은 방의 정산 단위로만 표시하고 환산하지 않는다", () => {
    const store = createStore();
    seedRoom(store);
    const snapshot = store.get(snapshotAtom)!;
    store.set(applySnapshotAtom, { ...snapshot, room: { ...snapshot.room, unit: "점수" } });
    renderApp(<BalancesSection />, store);
    expect(screen.getByText("+150 점수")).toBeInTheDocument();
    expect(screen.getByText("−150 점수")).toBeInTheDocument();
    expect(screen.queryByText(/원|\$|달러/)).not.toBeInTheDocument();
  });

  it("약 10^12 금액도 정확한 서식으로 줄바꿈 없이 표시한다", () => {
    const store = createStore();
    seedRoom(store);
    const snapshot = store.get(snapshotAtom)!;
    store.set(applySnapshotAtom, {
      ...snapshot,
      balances: [
        { ...fixtures.balances[0]!, balance: 999_999_999_000 },
        { ...fixtures.balances[2]!, balance: -999_999_999_000 },
      ],
    });
    renderApp(<BalancesSection />, store);
    const big = screen.getByText("+999,999,999,000 원");
    expect(big.className).toContain("white-space_nowrap"); // 줄바꿈 금지 스타일(white-space: nowrap)이 적용된 요소
    expect(screen.getByText("−999,999,999,000 원")).toBeInTheDocument();
  });

  it("안전 정수가 아닌 손익은 표시하지 않고 예외를 낸다(잘못된 값을 보이지 않는다)", () => {
    const store = createStore();
    seedRoom(store);
    const snapshot = store.get(snapshotAtom)!;
    store.set(applySnapshotAtom, { ...snapshot, balances: [{ ...fixtures.balances[0]!, balance: 1.5 }] });
    vi.spyOn(console, "error").mockImplementation(() => undefined); // React가 렌더 예외를 로그로 남긴다
    expect(() => renderApp(<BalancesSection />, store)).toThrow(RangeError);
  });

  it("접근성 검사를 통과한다", async () => {
    const { container } = render();
    await expectNoA11yViolations(container);
  });
});
