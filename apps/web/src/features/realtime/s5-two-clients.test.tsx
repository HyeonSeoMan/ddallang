import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InviteScreen } from "@/features/room/invite-screen";
import { connectionAtom, sessionAtom, snapshotAtom } from "@/features/room/state";
import { UNKNOWN_AFTER_RECOVERY, UNKNOWN_RESULT } from "@/features/transactions/messages";
import { primeServerClock } from "@/test/clock-prime";
import { installFakeLocks } from "@/test/fake-locks";
import { installFakeStorage, type FakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { INVITE_CODE } from "@/test/room-seed";
import { createFakeBackend, type FakeBackend } from "@/test/stateful-server";
import { connectionPhaseAtom } from "./state";

const KEY = "w".repeat(43);

/** 시험용 파생 값: 시나리오가 필요한 만큼만 손익·예상 정산을 만든다(서버 규칙의 재구현이 아니다). */
function derive(backend: FakeBackend) {
  const totals = new Map<string, number>(backend.participants.map((p) => [p.id, 0]));
  for (const t of backend.transactions) {
    totals.set(t.payeeId, (totals.get(t.payeeId) ?? 0) + t.amount);
    totals.set(t.payerId, (totals.get(t.payerId) ?? 0) - t.amount);
  }
  backend.balances = backend.participants
    .map((p) => ({ participantId: p.id, nickname: p.nickname, status: p.status, order: p.order, balance: totals.get(p.id) ?? 0 }))
    .sort((a, b) => b.balance - a.balance || a.order - b.order);
  const top = backend.balances[0];
  backend.settlement = {
    kind: backend.room.status === "ENDED" ? "FINAL" : "EXPECTED",
    items:
      top && top.balance > 0
        ? backend.balances
            .filter((b) => b.balance < 0)
            .map((b) => ({ payerId: b.participantId, payerNickname: b.nickname, payeeId: top.participantId, payeeNickname: top.nickname, amount: -b.balance }))
        : [],
  };
}

interface Client {
  store: ReturnType<typeof createStore>;
  root: HTMLElement;
  ui: ReturnType<typeof within>;
  unmount: () => void;
}

let backend: FakeBackend;
let storage: FakeStorage;

function mountClient(): Client {
  const store = createStore();
  store.set(sessionAtom, { inviteCode: INVITE_CODE, roomId: fixtures.room.id, me: fixtures.hostMember });
  const view = renderApp(<InviteScreen inviteCode={INVITE_CODE} />, store);
  return { store, root: view.container, ui: within(view.container), unmount: view.unmount };
}

const ready = (c: Client) =>
  waitFor(() => expect(c.store.get(connectionAtom) === "connected" && c.store.get(snapshotAtom) !== null).toBe(true), { timeout: 4000 });

async function mountBoth(): Promise<{ a: Client; b: Client }> {
  const a = mountClient();
  const b = mountClient();
  await ready(a);
  await ready(b);
  await waitFor(() => expect(backend.streams.length).toBeGreaterThanOrEqual(2));
  return { a, b };
}

async function saveTransaction(c: Client, user: ReturnType<typeof userEvent.setup>, payer: string, payee: string, amount: string, reason?: string) {
  await user.selectOptions(c.ui.getByLabelText("지급자"), payer);
  await user.selectOptions(c.ui.getByLabelText("수취자"), payee);
  await user.type(c.ui.getByLabelText("금액"), amount);
  if (reason) await user.type(c.ui.getByLabelText("사유 (선택)"), reason);
  await user.click(c.ui.getByRole("button", { name: /^저장/ }));
}

const listRows = (c: Client) =>
  within(c.ui.getByRole("heading", { name: "거래 내역" }).closest("section")!).queryAllByRole("listitem");
const balanceOf = (c: Client, nickname: string) =>
  within(c.ui.getByRole("heading", { name: "누적 손익" }).closest("section")!).getByText(nickname).closest("li")!.textContent;

beforeEach(async () => {
  storage = installFakeStorage();
  storage.setItem(`ddallang:identity:${INVITE_CODE}`, KEY);
  installFakeLocks();
  backend = createFakeBackend();
  derive(backend);
  backend.afterChange = () => derive(backend);
  server.use(...backend.handlers);
  await primeServerClock(KEY);
});

describe("두 접속자 통합 (FE-S5-5, 가짜 서버·스트림)", () => {
  it("[AC-VIEW-005-1][AC-VIEW-005-5] A가 거래를 등록하면 B의 거래 내역·누적 손익·예상 정산이 새로고침 없이 갱신된다", async () => {
    const { a, b } = await mountBoth();
    const rowsBefore = listRows(b).length;
    await saveTransaction(a, userEvent.setup(), "나래", "가온", "7777", "신규 정산");
    // B 화면: 거래 내역에 새 거래, 손익 변동, 예상 정산 갱신.
    await waitFor(() => expect(b.ui.getByText("사유: 신규 정산")).toBeInTheDocument(), { timeout: 4000 });
    expect(listRows(b)).toHaveLength(rowsBefore + 1);
    expect(b.ui.getAllByText("7,777 원").length).toBeGreaterThan(0);
    expect(balanceOf(b, "나래")).toContain("7,927"); // 지급자 나래의 순손익이 −150에서 −7,927로 줄었다
    expect(balanceOf(b, "가온")).toContain("+7,927");
    const settlement = within(b.ui.getByRole("heading", { name: "예상 정산" }).closest("section")!);
    expect(settlement.getByText("나래 → 가온")).toBeInTheDocument(); // 예상 정산이 새 손익으로 갱신됐다
    expect(settlement.getByText("7,927 원")).toBeInTheDocument();
  });

  it("[AC-VIEW-005-2] A가 거래를 수정·삭제하면 B에도 반영된다", async () => {
    const { a, b } = await mountBoth();
    const user = userEvent.setup();
    const firstRow = listRows(a)[0]!;
    // 수정: 금액 250 → 9000
    await user.click(within(firstRow).getByRole("button", { name: /수정/ }));
    const editForm = within(a.ui.getByRole("form", { name: /수정/ }));
    const amount = editForm.getByLabelText("금액");
    await user.clear(amount);
    await user.type(amount, "9000");
    await user.click(editForm.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(b.ui.getAllByText("9,000 원").length).toBeGreaterThan(0), { timeout: 4000 });
    // 삭제
    const rows = listRows(a).length;
    await user.click(within(listRows(a)[0]!).getByRole("button", { name: /삭제/ }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(listRows(b)).toHaveLength(rows - 1), { timeout: 4000 });
    expect(b.ui.queryByText("9,000 원")).not.toBeInTheDocument();
  });

  it("[AC-VIEW-005-3][AC-PART-002-4] A가 참여자를 등록·비활성화하면 B의 참여자 표시와 거래 입력 선택지에 반영된다", async () => {
    const { a, b } = await mountBoth();
    const user = userEvent.setup();
    await user.type(a.ui.getByLabelText("참여자 닉네임"), "마루");
    await user.click(a.ui.getByRole("button", { name: "참여자 등록" }));
    await waitFor(() => expect(b.ui.getAllByText("마루").length).toBeGreaterThan(0), { timeout: 4000 });
    const payeeOptions = () => Array.from((b.ui.getByLabelText("수취자") as HTMLSelectElement).options).map((o) => o.text);
    expect(payeeOptions()).toContain("마루"); // 새 참여자는 선택지에 들어온다

    await user.click(a.ui.getByRole("button", { name: "나래 비활성화" }));
    await waitFor(() => expect(payeeOptions()).not.toContain("나래"), { timeout: 4000 }); // 비활성은 선택지에서 빠진다
    const participants = within(b.ui.getByRole("heading", { name: "참여자" }).closest("section")!);
    expect(participants.getByText("나래").closest("li")!.textContent).toContain("비활성"); // 나래 행에 비활성 배지

    await user.click(a.ui.getByRole("button", { name: "나래 재활성화" }));
    await waitFor(() => expect(payeeOptions()).toContain("나래"), { timeout: 4000 }); // 재활성화 뒤 다시 선택 가능
  });

  it("[AC-VIEW-005-4][AC-SET-007-1][AC-SET-008-3] A가 종료하면 B의 입력·수정·삭제·참여자 컨트롤이 잠기고 최종 정산이 표시된다", async () => {
    const { a, b } = await mountBoth();
    expect(b.ui.getByLabelText("금액")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(a.ui.getByRole("button", { name: "게임 종료" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "게임 종료" }));
    await waitFor(() => expect(b.ui.getByRole("heading", { name: "최종 정산" })).toBeInTheDocument(), { timeout: 4000 });
    for (const c of [a, b]) {
      expect(c.ui.queryByLabelText("금액")).not.toBeInTheDocument(); // 거래 입력
      expect(c.ui.queryAllByRole("button", { name: /수정|삭제/ })).toHaveLength(0); // 거래 수정·삭제
      expect(c.ui.queryByLabelText("참여자 닉네임")).not.toBeInTheDocument(); // 참여자 등록
      expect(c.ui.queryAllByRole("button", { name: /비활성화|재활성화/ })).toHaveLength(0); // 참여자 상태 변경
      expect(c.ui.queryByRole("button", { name: "게임 종료" })).not.toBeInTheDocument(); // 종료 컨트롤
      expect(c.ui.getAllByText("게임 종료", { selector: "span" }).length).toBeGreaterThan(0); // 진행 상태 배지(방 정보·정산)
    }
  });

  it("[AC-SYS-002-3] 끊긴 동안 게임이 종료되면 복구 뒤 종료 상태가 반영된다", async () => {
    const { a, b } = await mountBoth();
    // B만 끊는다: 서버가 B의 스트림을 끊고 재연결을 막는다.
    backend.blockEvents = true;
    act(() => backend.streams[1]!.error());
    await waitFor(() => expect(b.store.get(connectionAtom)).toBe("disconnected"), { timeout: 4000 });
    expect(b.ui.queryByLabelText("금액")).not.toBeInTheDocument(); // 끊김 중 데이터 숨김

    const user = userEvent.setup();
    await user.click(a.ui.getByRole("button", { name: "게임 종료" })); // 그 사이 A가 종료한다
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "게임 종료" }));
    await waitFor(() => expect(a.ui.getByRole("heading", { name: "최종 정산" })).toBeInTheDocument(), { timeout: 4000 });
    expect(b.ui.queryByRole("heading", { name: "최종 정산" })).not.toBeInTheDocument(); // B는 아직 모른다(이전 값도 안 보인다)

    backend.blockEvents = false; // 복구
    await waitFor(() => expect(b.ui.getByRole("heading", { name: "최종 정산" })).toBeInTheDocument(), { timeout: 6000 });
    expect(b.ui.queryByLabelText("금액")).not.toBeInTheDocument();
    await waitFor(() => expect(b.store.get(connectionPhaseAtom)).toBe("recovered"));
  }, 15_000);

  it("[AC-SYS-002-2] 끊김 중에 작성하던 거래는 복구 때 자동 제출되지 않는다", async () => {
    const { b } = await mountBoth();
    const user = userEvent.setup();
    await user.selectOptions(b.ui.getByLabelText("지급자"), "가온");
    await user.selectOptions(b.ui.getByLabelText("수취자"), "나래");
    await user.type(b.ui.getByLabelText("금액"), "4444");
    act(() => backend.streams[1]!.error());
    await waitFor(() => expect(b.store.get(connectionAtom)).toBe("disconnected"), { timeout: 4000 });
    await ready(b); // 재연결·재동기화
    expect(b.ui.getByLabelText("금액")).toHaveValue("4444"); // 입력은 유지된다
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(backend.writes.filter((w) => w.operation === "createTransaction")).toHaveLength(0); // 자동 제출 없음
  }, 10_000);

  it("[AC-SYS-002-5][AC-TXN-008-5] 저장 응답이 유실된 뒤 복구해도 성공으로 단정하지 않고 재조회한 목록으로 확인하게 하며 자동 재전송하지 않는다", async () => {
    const { a } = await mountBoth();
    backend.dropResponseOnce.add("createTransaction");
    await saveTransaction(a, userEvent.setup(), "가온", "나래", "31337", "응답 유실");
    expect(await a.ui.findByText(UNKNOWN_RESULT)).toBeInTheDocument(); // 서버는 저장했지만 응답을 못 받았다
    expect(a.ui.queryByText("거래를 저장했습니다.")).not.toBeInTheDocument();

    act(() => backend.streams[0]!.error()); // 연결이 끊겼다가 복구된다(재연결 간격 약 1초)
    // 복구되어 재조회한 뒤에도 시스템은 저장 성공을 단정하지 않고 "확인할 수 없음"을 유지한다.
    expect(await a.ui.findByText(UNKNOWN_AFTER_RECOVERY, undefined, { timeout: 6000 })).toBeInTheDocument();
    // 사용자는 재조회한 거래 내역에서 직접 확인할 수 있다.
    expect(a.ui.getByText("사유: 응답 유실")).toBeInTheDocument();
    expect(a.ui.queryByText("거래를 저장했습니다.")).not.toBeInTheDocument();
    expect(backend.writes.filter((w) => w.operation === "createTransaction")).toHaveLength(1); // 자동 재전송 없음
  }, 15_000);

  it("[AC-SYS-002-4] 새로고침(재방문)하면 입력 초안이 복원되지 않고, 초안을 저장소에 쓰지도 않는다", async () => {
    const setItem = vi.spyOn(storage, "setItem");
    const first = mountClient();
    await ready(first);
    const user = userEvent.setup();
    await user.type(first.ui.getByLabelText("금액"), "1234");
    await user.type(first.ui.getByLabelText("사유 (선택)"), "초안");
    await user.type(first.ui.getByLabelText("참여자 닉네임"), "초안닉");
    expect(setItem).not.toHaveBeenCalled(); // 입력 초안은 메모리에만 있다
    expect(storage.keys()).toEqual([`ddallang:identity:${INVITE_CODE}`]); // 신원 키 외에 저장된 것이 없다
    first.unmount();

    const second = mountClient(); // 새로고침에 해당: 새 앱 상태
    await ready(second);
    expect(second.ui.getByLabelText("금액")).toHaveValue("");
    expect(second.ui.getByLabelText("사유 (선택)")).toHaveValue("");
    expect(second.ui.getByLabelText("참여자 닉네임")).toHaveValue("");
  });
});
