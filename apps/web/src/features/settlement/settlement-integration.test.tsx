import { screen, waitFor, within } from "@testing-library/react";
import { createStore } from "jotai";
import { beforeEach, describe, expect, it } from "vitest";
import { InviteScreen } from "@/features/room/invite-screen";
import { AllPages } from "@/test/all-pages";
import { connectionAtom, sessionAtom, snapshotAtom } from "@/features/room/state";
import { mockClipboard } from "@/test/clipboard";
import { installFakeLocks } from "@/test/fake-locks";
import { installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { INVITE_CODE } from "@/test/room-seed";
import { createFakeBackend, type FakeBackend } from "@/test/stateful-server";
import userEvent from "@testing-library/user-event";
import { EXPECTED_NOTE } from "./settlement-section";

let backend: FakeBackend;
let store: ReturnType<typeof createStore>;
const visible = () => store.get(connectionAtom) === "connected" && store.get(snapshotAtom) !== null;

beforeEach(() => {
  installFakeStorage().setItem(`ddallang:identity:${INVITE_CODE}`, "v".repeat(43));
  installFakeLocks();
  backend = createFakeBackend();
  server.use(...backend.handlers);
  store = createStore();
});

function mount() {
  store.set(sessionAtom, { inviteCode: INVITE_CODE, roomId: fixtures.room.id, me: fixtures.hostMember });
  return renderApp(<InviteScreen inviteCode={INVITE_CODE}><AllPages /></InviteScreen>, store);
}

describe("정산 영역 × 갱신·종료 (FE-S4-2 통합)", () => {
  it("[AC-SET-008-1] 진행 중에는 `예상 정산`이라는 이름과 진행 중 표시가 있고 복사 컨트롤이 없다", async () => {
    mount();
    await waitFor(() => expect(visible()).toBe(true));
    expect(screen.getByRole("heading", { name: "예상 정산" })).toBeInTheDocument();
    expect(screen.getByText(EXPECTED_NOTE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "정산 복사" })).not.toBeInTheDocument();
  });

  it("[AC-SET-008-2][AC-VIEW-005-5] 거래·참여자 변경 뒤 새로고침 없이 예상 정산이 갱신된다(가짜 서버, 실서버 확인은 FE-I1)", async () => {
    mount();
    await waitFor(() => expect(visible()).toBe(true));
    backend.settlement = {
      kind: "EXPECTED",
      items: [{ payerId: "p-2", payerNickname: "나래", payeeId: "p-3", payeeNickname: "다온", amount: 8_000 }],
    };
    backend.commit("transaction.created", { transactionId: "t-x" });
    const section = () => within(screen.getByRole("heading", { name: "예상 정산" }).closest("section")!);
    await waitFor(() => expect(section().getByText("나래 → 다온")).toBeInTheDocument());
    expect(section().getByText("8,000 원")).toBeInTheDocument();
    expect(section().queryByText("나래 → 가온")).not.toBeInTheDocument(); // 이전 정산 항목과 섞이지 않는다
  });

  it("[AC-SET-008-3][AC-SET-007-1] 종료되면 같은 영역이 `최종 정산`으로 바뀌고 복사 버튼이 생긴다(별도 조작 없음)", async () => {
    const clipboard = mockClipboard();
    mount();
    await waitFor(() => expect(visible()).toBe(true));
    backend.room = { ...backend.room, status: "ENDED" };
    backend.settlement = { kind: "FINAL", items: fixtures.finalSettlement.items };
    backend.commit("room.ended");
    await waitFor(() => expect(screen.getByRole("heading", { name: "최종 정산" })).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "예상 정산" })).not.toBeInTheDocument();
    expect(screen.queryByText(EXPECTED_NOTE)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "정산 복사" }));
    await waitFor(() => expect(clipboard.written).toHaveLength(1));
    expect(clipboard.written[0]).toBe(`${fixtures.room.name}\n게임 종료\n\n나래 → 가온 150 원`);
  });

  it("[AC-SET-008-6][Codex F02] 참여자 필터를 선택·변경·해제해도 정산은 그대로이고 정산·손익 요청에 쿼리가 없다", async () => {
    mount();
    await waitFor(() => expect(visible()).toBe(true));
    const settlementText = () =>
      within(screen.getByRole("heading", { name: "예상 정산" }).closest("section")!).getByRole("list").textContent;
    const before = settlementText();
    const filter = () => screen.getByLabelText("참여자 필터");
    const user = userEvent.setup();

    // 각 선택이 새 스냅샷에 실제로 반영된 뒤(선택한 참여자 ID, 해제는 null)에 정산을 비교한다.
    const expectedFilter: Array<[string, string | null]> = [
      ["가온", "p-1"],
      ["나래", "p-2"],
      ["다온 (비활성)", "p-3"],
      ["전체", null],
    ];
    for (const [choice, filterId] of expectedFilter) {
      await user.selectOptions(filter(), choice);
      await waitFor(() => expect(store.get(snapshotAtom)?.transactionFilter).toBe(filterId));
      expect(settlementText()).toBe(before); // 정산은 필터와 무관하다
    }
    // 정산·손익·방 조회에는 어떤 쿼리도 붙지 않았다. 거래 목록만 필터를 쓴다.
    expect(backend.searches.settlement.every((q) => q === "")).toBe(true);
    expect(backend.searches.balances.every((q) => q === "")).toBe(true);
    expect(backend.searches.room.every((q) => q === "")).toBe(true);
    expect(backend.searches.transactions.some((q) => q.includes("participantId="))).toBe(true);
  });

  it("방 상태와 정산 종류가 어긋난 응답은 반영하지 않는다(종료됐는데 정산이 아직 예상이면 최종이 될 때까지 기다린다)", async () => {
    mount();
    await waitFor(() => expect(visible()).toBe(true));
    backend.room = { ...backend.room, status: "ENDED" }; // 정산은 EXPECTED 그대로(어긋남)
    backend.commit("room.ended");
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(store.get(snapshotAtom)?.room.status).toBe("IN_PROGRESS"); // 어긋난 스냅샷은 반영되지 않았다
    expect(screen.getByRole("heading", { name: "예상 정산" })).toBeInTheDocument();
    backend.settlement = { kind: "FINAL", items: [] };
    await waitFor(() => expect(screen.getByRole("heading", { name: "최종 정산" })).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText("정산할 내역이 없습니다.")).toBeInTheDocument();
  });
});
