import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { beforeEach, describe, expect, it } from "vitest";
import { applySnapshotAtom, snapshotAtom } from "@/features/room/state";
import type { Settlement } from "@/lib/api";
import { expectNoA11yViolations } from "@/test/a11y";
import { mockClipboard, removeClipboard } from "@/test/clipboard";
import * as fixtures from "@/test/fixtures";
import { renderApp } from "@/test/render";
import { seedRoom } from "@/test/room-seed";
import { EMPTY_SETTLEMENT, EXPECTED_NOTE, SettlementSection } from "./settlement-section";

let store: ReturnType<typeof createStore>;

const finalItems: Settlement = {
  kind: "FINAL",
  items: [
    { payerId: "p-2", payerNickname: "나래", payeeId: "p-1", payeeNickname: "가온", amount: 250 },
    { payerId: "p-3", payerNickname: "다온", payeeId: "p-1", payeeNickname: "가온", amount: 1_250_000 },
  ],
};

function seed(status: "IN_PROGRESS" | "ENDED", settlement?: Settlement, unit?: string) {
  seedRoom(store, { status });
  const snapshot = store.get(snapshotAtom)!;
  store.set(applySnapshotAtom, {
    ...snapshot,
    room: { ...snapshot.room, unit: unit ?? snapshot.room.unit },
    settlement: settlement ?? snapshot.settlement,
  });
}

const render = () => renderApp(<main><SettlementSection /></main>, store);
const rows = () => screen.getAllByRole("listitem");

beforeEach(() => {
  store = createStore();
});

describe("정산 영역 (FE-S4-2·S4-3)", () => {
  describe("예상 정산(진행 중)", () => {
    it("[AC-SET-008-1][AC-SET-008-5] 진행 중 배지와 안내를 보이고, 항목은 서버 순서 그대로 방의 단위로 보인다", () => {
      seed("IN_PROGRESS", { kind: "EXPECTED", items: finalItems.items });
      render();
      expect(screen.getByText("진행 중")).toBeInTheDocument();
      expect(screen.getByText(EXPECTED_NOTE)).toBeInTheDocument();
      expect(screen.queryByText("게임 종료")).not.toBeInTheDocument();
      expect(rows().map((r) => r.textContent)).toEqual(["나래 → 가온250 원", "다온 → 가온1,250,000 원"]);
    });

    it("[AC-SET-005-6][AC-SET-008-7] 복사 버튼이 없고 복사할 수 없다(`게임 종료` 텍스트를 만들지 않는다)", async () => {
      const clipboard = mockClipboard();
      seed("IN_PROGRESS", { kind: "EXPECTED", items: finalItems.items });
      render();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(clipboard.written).toEqual([]);
    });
  });

  describe("최종 정산(종료 후)", () => {
    it("`게임 종료` 배지를 보이고 진행 중 안내는 없다", () => {
      seed("ENDED", finalItems);
      render();
      expect(screen.getByText("게임 종료")).toBeInTheDocument();
      expect(screen.queryByText("진행 중")).not.toBeInTheDocument();
      expect(screen.queryByText(EXPECTED_NOTE)).not.toBeInTheDocument();
    });

    it("[AC-ROOM-001-14][AC-ROOM-003-3] 금액은 방의 단위로만 표시하고 환산하지 않는다", () => {
      seed("ENDED", finalItems, "칩");
      render();
      expect(screen.getByText("250 칩")).toBeInTheDocument();
      expect(screen.getByText("1,250,000 칩")).toBeInTheDocument();
      expect(screen.queryByText(/원|\$/)).not.toBeInTheDocument();
    });

    it("약 10^12 금액도 정확히 표시한다", () => {
      seed("ENDED", { kind: "FINAL", items: [{ ...finalItems.items[0]!, amount: 999_999_999_000 }] });
      render();
      expect(screen.getByText("999,999,999,000 원")).toBeInTheDocument();
    });

    it("[AC-SET-005-2][AC-SET-005-3] 복사하면 Spec 형식의 일반 텍스트가 클립보드에 쓰이고 완료 뒤에만 성공을 표시한다", async () => {
      const clipboard = mockClipboard({ manual: true });
      seed("ENDED", finalItems);
      render();
      await userEvent.click(screen.getByRole("button", { name: "정산 복사" }));
      expect(screen.queryByText("정산 내용을 복사했습니다.")).not.toBeInTheDocument(); // 쓰기 완료 전
      act(() => clipboard.resolve());
      expect(await screen.findByText("정산 내용을 복사했습니다.")).toBeInTheDocument();
      expect(clipboard.written).toEqual([
        `${fixtures.room.name}\n게임 종료\n\n나래 → 가온 250 원\n다온 → 가온 1,250,000 원`,
      ]);
    });

    it("[AC-SET-004-3] 화면 순서와 복사 텍스트의 순서가 같다", async () => {
      const clipboard = mockClipboard();
      seed("ENDED", finalItems);
      render();
      await userEvent.click(screen.getByRole("button", { name: "정산 복사" }));
      await waitFor(() => expect(clipboard.written).toHaveLength(1));
      const copiedNames = clipboard.written[0]!.split("\n").slice(3).map((l) => l.split(" ")[0]);
      expect(copiedNames).toEqual(rows().map((r) => r.textContent!.split(" ")[0]));
    });

    it("[AC-SET-005-5] 클립보드 실패·미지원이면 실패를 알리고 성공으로 표시하지 않는다", async () => {
      seed("ENDED", finalItems);
      mockClipboard({ fail: true });
      const first = render();
      await userEvent.click(screen.getByRole("button", { name: "정산 복사" }));
      expect(await screen.findByText(/복사하지 못했습니다/)).toBeInTheDocument();
      expect(screen.queryByText("정산 내용을 복사했습니다.")).not.toBeInTheDocument();
      first.unmount();

      removeClipboard();
      render();
      await userEvent.click(screen.getByRole("button", { name: "정산 복사" }));
      expect(await screen.findByText(/복사하지 못했습니다/)).toBeInTheDocument();
    });
  });

  describe("항목 없음", () => {
    it("[AC-SET-006-1] 예상 정산과 최종 정산 모두 정확히 `정산할 내역이 없습니다.`를 보인다", () => {
      seed("IN_PROGRESS", { kind: "EXPECTED", items: [] });
      const first = render();
      expect(screen.getByText("정산할 내역이 없습니다.")).toBeInTheDocument();
      expect(EMPTY_SETTLEMENT).toBe("정산할 내역이 없습니다.");
      first.unmount();

      store = createStore();
      seed("ENDED", { kind: "FINAL", items: [] });
      render();
      expect(screen.getByText("정산할 내역이 없습니다.")).toBeInTheDocument();
    });

    it("[AC-SET-006-3] 항목이 1건 이상이면 이 문구가 없다", () => {
      seed("ENDED", finalItems);
      render();
      expect(screen.queryByText("정산할 내역이 없습니다.")).not.toBeInTheDocument();
    });

    it("[AC-SET-006-2] 종료된 방의 빈 최종 정산은 복사 버튼이 비활성이고 눌러도 복사되지 않는다", async () => {
      const clipboard = mockClipboard();
      seed("ENDED", { kind: "FINAL", items: [] });
      render();
      const button = screen.getByRole("button", { name: "정산 복사" });
      expect(button).toBeDisabled();
      await userEvent.click(button);
      expect(clipboard.written).toEqual([]);
    });
  });

  it("[AC-SET-008-6] 정산은 참여자 필터와 무관하다(영역은 필터 상태를 읽지 않는다)", () => {
    seed("IN_PROGRESS", { kind: "EXPECTED", items: finalItems.items });
    render();
    expect(rows()).toHaveLength(2);
  });

  it("접근성 검사를 통과한다", async () => {
    seed("ENDED", finalItems);
    const { container } = render();
    await expectNoA11yViolations(container);
  });
});
