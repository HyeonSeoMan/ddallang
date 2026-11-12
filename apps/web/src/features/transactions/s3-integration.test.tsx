import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { BalancesSection } from "@/features/balances/balances-section";
import { participantFilterAtom } from "@/features/realtime/state";
import { useRoomConnection } from "@/features/realtime/use-room-connection";
import { ServerDataGate } from "@/features/room/server-data-gate";
import { connectionAtom, sessionAtom, snapshotAtom } from "@/features/room/state";
import type { Transaction } from "@/lib/api";
import { installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { INVITE_CODE } from "@/test/room-seed";
import { createFakeBackend, type FakeBackend } from "@/test/stateful-server";
import { TransactionsSection } from "./transactions-section";

const KEY = "s".repeat(43);

/** 25건. 5의 배수는 p-2·p-3 사이의 거래라 p-1 필터에서는 빠진다. */
function makeTransactions(count = 25): Transaction[] {
  return Array.from({ length: count }, (_, i) => {
    const n = count - i; // 서버 순서: 최신(큰 번호)부터
    const between23 = n % 5 === 0;
    return {
      ...fixtures.transactions[1]!,
      id: `t-${n}`,
      amount: n * 10,
      payerId: between23 ? "p-2" : "p-1",
      payeeId: between23 ? "p-3" : "p-2",
    };
  });
}

function Harness() {
  useRoomConnection(INVITE_CODE, fixtures.room.id);
  return (
    <main>
      <ServerDataGate>
        <BalancesSection />
        <TransactionsSection />
      </ServerDataGate>
    </main>
  );
}

let backend: FakeBackend;
let store: ReturnType<typeof createStore>;
const rows = () => screen.queryAllByRole("listitem").filter((li) => /→/.test(li.textContent ?? ""));
const amounts = () => rows().map((r) => r.textContent?.match(/([\d,]+) 원/)?.[1]);
const visible = () => store.get(connectionAtom) === "connected" && store.get(snapshotAtom) !== null;

beforeEach(() => {
  installFakeStorage().setItem(`ddallang:identity:${INVITE_CODE}`, KEY);
  backend = createFakeBackend();
  backend.transactions = makeTransactions();
  server.use(...backend.handlers);
  store = createStore();
});

async function mountAndWait() {
  // 입장(복원)을 마친 뒤의 방 화면 상태: 세션이 있고 연결 훅이 스트림·갱신을 시작한다.
  store.set(sessionAtom, { inviteCode: INVITE_CODE, roomId: fixtures.room.id, me: fixtures.hostMember });
  renderApp(<Harness />, store);
  await waitFor(() => expect(visible()).toBe(true));
}

describe("S3 화면 × 갱신 주기 (FE-S3-3)", () => {
  it("첫 화면은 첫 페이지 20건이고 더 보기로 다음 5건을 붙인다", async () => {
    await mountAndWait();
    expect(rows()).toHaveLength(20);
    expect(amounts()[0]).toBe("250"); // 서버 순서(최신 먼저)
    await userEvent.click(screen.getByRole("button", { name: "더 보기" }));
    await waitFor(() => expect(rows()).toHaveLength(25));
    expect(screen.queryByRole("button", { name: "더 보기" })).not.toBeInTheDocument();
  });

  it("[AC-VIEW-005-7] 필터를 고르면 필터를 유지한 채 새 순회를 하고, 이후 변경 알림에도 같은 필터로 다시 불러온다", async () => {
    await mountAndWait();
    await userEvent.selectOptions(screen.getByLabelText("참여자 필터"), "가온");
    await waitFor(() => expect(store.get(snapshotAtom)?.transactionFilter).toBe("p-1"));
    expect(backend.transactionQueries.at(-1)).toEqual({ participantId: "p-1", cursor: null });
    // p-1이 당사자가 아닌 거래(5의 배수)는 빠졌다: 25건 → 20건(전부 첫 페이지에 들어간다)
    await waitFor(() => expect(rows()).toHaveLength(20));
    expect(amounts()).not.toContain("250");

    backend.transactions = [{ ...backend.transactions[1]!, id: "t-new", amount: 7777 }, ...backend.transactions];
    backend.commit("transaction.created", { transactionId: "t-new" });
    await waitFor(() => expect(amounts()[0]).toBe("7,777"));
    expect(backend.transactionQueries.at(-1)).toEqual({ participantId: "p-1", cursor: null }); // 필터 유지
    expect(store.get(participantFilterAtom)).toBe("p-1");
    expect((screen.getByLabelText("참여자 필터") as HTMLSelectElement).value).toBe("p-1");
  });

  it("[AC-VIEW-003-4] 갱신 응답이 오기 전에는 기존 목록을 유지하다가 한 번에 교체한다(부분 반영 없음)", async () => {
    await mountAndWait();
    const before = amounts();
    backend.latency.transactions = 150;
    backend.transactions = [{ ...backend.transactions[1]!, id: "t-new", amount: 9999 }, ...backend.transactions.slice(1)];
    backend.commit("transaction.updated", { transactionId: "t-25" });
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(amounts()).toEqual(before); // 아직 이전 목록
    await waitFor(() => expect(amounts()[0]).toBe("9,999"));
    expect(rows()).toHaveLength(20);
  });

  it("[AC-VIEW-004-8] 더 불러온 뒤 필터를 바꾸면 이전 페이지를 모두 버리고 새 첫 페이지로 교체한다(병합 금지)", async () => {
    await mountAndWait();
    await userEvent.click(screen.getByRole("button", { name: "더 보기" }));
    await waitFor(() => expect(rows()).toHaveLength(25));
    await userEvent.selectOptions(screen.getByLabelText("참여자 필터"), "다온 (비활성)");
    // 다온(p-3)이 당사자인 거래는 5의 배수 5건뿐이다. 이전 25건과 섞이지 않는다.
    await waitFor(() => expect(rows()).toHaveLength(5));
    expect(amounts().sort()).toEqual(["100", "150", "200", "250", "50"].sort());
    await userEvent.selectOptions(screen.getByLabelText("참여자 필터"), "전체");
    await waitFor(() => expect(rows()).toHaveLength(20)); // 해제도 새 순회(첫 페이지)
  });

  it("순회 중 변경이 알려지면 더 불러온 페이지는 자동 복원하지 않고 첫 페이지로 교체한다(U-4)", async () => {
    await mountAndWait();
    await userEvent.click(screen.getByRole("button", { name: "더 보기" }));
    await waitFor(() => expect(rows()).toHaveLength(25));
    backend.transactions = [{ ...backend.transactions[0]!, id: "t-new", amount: 4242 }, ...backend.transactions];
    backend.commit("transaction.created", { transactionId: "t-new" });
    await waitFor(() => expect(amounts()[0]).toBe("4,242"));
    expect(rows()).toHaveLength(20); // 26건 중 첫 페이지만(이전에 더 불러온 범위는 복원하지 않는다)
    expect(screen.getByRole("button", { name: "더 보기" })).toBeInTheDocument();
  });

  it("더 보기 응답이 오는 사이 새 순회로 교체되면 늦은 응답을 반영하지 않는다", async () => {
    await mountAndWait();
    backend.latency.transactions = 200;
    await userEvent.click(screen.getByRole("button", { name: "더 보기" })); // 200ms 걸린다
    backend.transactions = [{ ...backend.transactions[0]!, id: "t-new", amount: 5151 }, ...backend.transactions];
    backend.commit("transaction.created", { transactionId: "t-new" }); // 그 사이 변경 알림
    await waitFor(() => expect(amounts()[0]).toBe("5,151"), { timeout: 3000 });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(rows()).toHaveLength(20); // 늦게 온 2번째 페이지가 이어 붙지 않았다
  });

  it("더 보기 응답이 새 순회가 반영된 **뒤에** 도착해도(도착 순서를 강제) 이어 붙이지 않는다", async () => {
    await mountAndWait();
    // `cursor`가 있는 요청(더 보기)만 시험이 풀어 줄 때까지 붙잡아 둔다. 그 밖의 요청은 기존 가짜 서버로 넘어간다.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get(apiUrl(`/rooms/${fixtures.room.id}/transactions`), async ({ request }) => {
        if (new URL(request.url).searchParams.get("cursor") === null) return undefined;
        await gate;
        return HttpResponse.json({ transactions: [{ ...backend.transactions[0]!, id: "late", amount: 31337 }], nextCursor: null });
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "더 보기" })); // 붙잡힌 요청
    backend.transactions = [{ ...backend.transactions[0]!, id: "t-new", amount: 4321 }, ...backend.transactions];
    backend.commit("transaction.created", { transactionId: "t-new" });
    await waitFor(() => expect(amounts()[0]).toBe("4,321")); // 새 순회가 먼저 반영됐다
    release(); // 이제서야 이전 순회의 더 보기 응답이 도착한다
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(rows()).toHaveLength(20);
    expect(amounts()).not.toContain("31,337");
  });

  it("누적 손익은 거래 필터의 영향을 받지 않는다(필터 변경 뒤에도 같은 값)", async () => {
    await mountAndWait();
    const balanceRows = () => screen.getAllByRole("listitem").filter((li) => /\+|−|0 원/.test(li.textContent ?? "") && !/→/.test(li.textContent ?? ""));
    const before = balanceRows().map((r) => r.textContent);
    await userEvent.selectOptions(screen.getByLabelText("참여자 필터"), "나래");
    await waitFor(() => expect(store.get(snapshotAtom)?.transactionFilter).toBe("p-2"));
    expect(balanceRows().map((r) => r.textContent)).toEqual(before);
  });
});
