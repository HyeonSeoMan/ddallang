import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { participantFilterAtom, refreshRequestAtom } from "@/features/realtime/state";
import { applySnapshotAtom, snapshotAtom } from "@/features/room/state";
import type { Transaction } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { expectNoA11yViolations } from "@/test/a11y";
import { installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl, errorResponse } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { INVITE_CODE, seedRoom } from "@/test/room-seed";
import { TransactionsSection } from "./transactions-section";

const KEY = "t".repeat(43);
const txPath = `/rooms/${fixtures.room.id}/transactions`;

const tx = (n: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t-${n}`,
  payerId: "p-1",
  payeeId: "p-2",
  amount: n * 10,
  reason: null,
  round: null,
  authorId: fixtures.hostMember.id,
  createdAt: "2026-11-08T03:21:45.123Z",
  updatedAt: "2026-11-08T03:21:45.123Z",
  ...extra,
});

let store: ReturnType<typeof createStore>;
let queries: Array<{ cursor: string | null; participantId: string | null; authorization: string | null }>;

function useMoreHandler(respond: (cursor: string | null) => Response | Promise<Response>) {
  server.use(
    http.get(apiUrl(txPath), ({ request }) => {
      const url = new URL(request.url);
      const cursor = url.searchParams.get("cursor");
      queries.push({ cursor, participantId: url.searchParams.get("participantId"), authorization: request.headers.get("Authorization") });
      return respond(cursor);
    }),
  );
}

function seed(transactions: Transaction[], options: { nextCursor?: string | null; filter?: string | null } = {}) {
  seedRoom(store);
  const snapshot = store.get(snapshotAtom)!;
  store.set(applySnapshotAtom, {
    ...snapshot,
    transactions,
    nextCursor: options.nextCursor ?? null,
    transactionFilter: options.filter ?? null,
  });
  if (options.filter !== undefined) store.set(participantFilterAtom, options.filter);
}

function renderSection(props: Parameters<typeof TransactionsSection>[0] = {}) {
  return renderApp(<main><TransactionsSection {...props} /></main>, store);
}

const rows = () => screen.getAllByRole("listitem");

beforeEach(() => {
  store = createStore();
  queries = [];
  installFakeStorage().setItem(`ddallang:identity:${INVITE_CODE}`, KEY);
});

describe("거래 내역 영역", () => {
  it("서버 순서 그대로, 닉네임·금액(방의 단위)·사유·라운드·시각을 보인다", () => {
    seed([
      tx(2, { id: "t-b", payerId: "p-2", payeeId: "p-1", amount: 250, reason: "라운드 2", round: "2" }),
      tx(1, { id: "t-a", amount: 100, createdAt: "2026-11-08T03:10:00.000Z" }),
    ]);
    renderSection();
    const [first, second] = rows();
    expect(first!.textContent).toContain("나래 → 가온");
    expect(first!.textContent).toContain("250 원");
    expect(first!.textContent).toContain("사유: 라운드 2");
    expect(first!.textContent).toContain("라운드: 2");
    expect(first!.textContent).toContain(formatDateTime("2026-11-08T03:21:45.123Z"));
    expect(second!.textContent).toContain("가온 → 나래");
    expect(second!.textContent).not.toContain("사유"); // null은 표시하지 않는다
    // 시각으로 다시 정렬하지 않는다: 첫 행이 더 늦은 시각이어도 순서는 서버 순서다.
  });

  it("[AC-ROOM-001-14][AC-ROOM-003-3] 거래 금액은 방의 정산 단위로만 표시하고 환산하지 않는다", () => {
    seed([tx(5, { amount: 1_250_000 })]);
    const snapshot = store.get(snapshotAtom)!;
    store.set(applySnapshotAtom, { ...snapshot, room: { ...snapshot.room, unit: "칩" } });
    renderSection();
    expect(screen.getByText("1,250,000 칩")).toBeInTheDocument();
  });

  it("사유·라운드는 HTML로 해석하지 않고 텍스트로 이스케이프한다", () => {
    seed([tx(1, { reason: "<img src=x onerror=alert(1)><b>굵게</b>", round: "<script>1</script>" })]);
    const { container } = renderSection();
    expect(container.querySelector("img, b, script")).toBeNull();
    expect(screen.getByText(/<img src=x onerror=alert\(1\)><b>굵게<\/b>/)).toBeInTheDocument();
  });

  it("알 수 없는 참여자 ID는 이름 대신 안내 문구로 보인다", () => {
    seed([tx(1, { payerId: "ghost" })]);
    renderSection();
    expect(rows()[0]!.textContent).toContain("알 수 없음");
  });

  it("거래가 없으면 안내하고, 필터가 있으면 그 참여자의 거래가 없다고 안내한다", () => {
    seed([]);
    const first = renderSection();
    expect(screen.getByText("거래가 없습니다.")).toBeInTheDocument();
    first.unmount();
    store = createStore();
    seed([], { filter: "p-1" });
    renderSection();
    expect(screen.getByText("이 참여자의 거래가 없습니다.")).toBeInTheDocument();
  });

  it("수정·삭제 컨트롤 자리(renderActions)에 거래와 me·room을 넘긴다", () => {
    seed([tx(1)]);
    renderSection({
      renderActions: (t, { me, room }) => <span>{`${t.id}/${me.nickname}/${room.name}`}</span>,
    });
    expect(screen.getByText(`t-1/방장/${fixtures.room.name}`)).toBeInTheDocument();
  });

  it("접근성 검사를 통과한다", async () => {
    seed([tx(1)], { nextCursor: "c20" });
    const { container } = renderSection();
    await expectNoA11yViolations(container);
  });

  describe("더 보기(20건 단위)", () => {
    it("nextCursor가 null이면 버튼이 없다", () => {
      seed([tx(1)], { nextCursor: null });
      renderSection();
      expect(screen.queryByRole("button", { name: "더 보기" })).not.toBeInTheDocument();
    });

    it("커서와 순회 시작 때의 필터로 이어 불러와 서버 순서대로 붙이고 마지막이면 버튼이 사라진다", async () => {
      seed([tx(1), tx(2)], { nextCursor: "c20", filter: "p-1" });
      useMoreHandler(() => HttpResponse.json({ transactions: [tx(3), tx(4)], nextCursor: null }));
      renderSection();
      await userEvent.click(screen.getByRole("button", { name: "더 보기" }));
      await waitFor(() => expect(rows()).toHaveLength(4));
      expect(queries).toEqual([{ cursor: "c20", participantId: "p-1", authorization: `Bearer ${KEY}` }]);
      expect(rows().map((r) => r.textContent?.match(/\d+ 원/)?.[0])).toEqual(["10 원", "20 원", "30 원", "40 원"]);
      expect(screen.queryByRole("button", { name: "더 보기" })).not.toBeInTheDocument();
    });

    it("필터를 바꿨지만 새 순회가 아직 반영되기 전이면 더 보기는 현재 순회의 필터(커서가 묶인 필터)로 이어 간다", async () => {
      seed([tx(1)], { nextCursor: "c20", filter: null });
      store.set(participantFilterAtom, "p-2"); // 사용자가 필터를 바꿨지만 스냅샷은 아직 전체 목록이다
      useMoreHandler(() => HttpResponse.json({ transactions: [tx(2)], nextCursor: null }));
      renderSection();
      await userEvent.click(screen.getByRole("button", { name: "더 보기" }));
      await waitFor(() => expect(queries).toHaveLength(1));
      expect(queries[0]).toMatchObject({ cursor: "c20", participantId: null });
    });

    it("같은 순회에서 같은 id가 두 번 오면 하나만 둔다", async () => {
      seed([tx(1), tx(2)], { nextCursor: "c20" });
      useMoreHandler(() => HttpResponse.json({ transactions: [tx(2), tx(3)], nextCursor: null }));
      renderSection();
      await userEvent.click(screen.getByRole("button", { name: "더 보기" }));
      await waitFor(() => expect(rows()).toHaveLength(3));
    });

    it("[AC-VIEW-003-4] 스냅샷이 새로 반영되면 더 불러온 페이지를 버리고 첫 페이지로 교체한다(병합 금지)", async () => {
      seed([tx(1), tx(2)], { nextCursor: "c20" });
      useMoreHandler(() => HttpResponse.json({ transactions: [tx(3)], nextCursor: "c40" }));
      renderSection();
      await userEvent.click(screen.getByRole("button", { name: "더 보기" }));
      await waitFor(() => expect(rows()).toHaveLength(3));

      // 변경 알림 뒤 갱신: 새 스냅샷(새 첫 페이지)이 반영된다.
      act(() => {
        const snapshot = store.get(snapshotAtom)!;
        store.set(applySnapshotAtom, { ...snapshot, transactions: [tx(9), tx(1), tx(2)], nextCursor: "c20" });
      });
      expect(rows().map((r) => r.textContent?.match(/\d+ 원/)?.[0])).toEqual(["90 원", "10 원", "20 원"]);
      expect(screen.getByRole("button", { name: "더 보기" })).toBeInTheDocument(); // 처음 커서부터 다시
    });

    it("응답이 오는 사이 새 순회로 교체되었다면 늦게 온 응답은 버린다", async () => {
      seed([tx(1)], { nextCursor: "c20" });
      useMoreHandler(async () => {
        await delay(60);
        return HttpResponse.json({ transactions: [tx(99)], nextCursor: null });
      });
      renderSection();
      await userEvent.click(screen.getByRole("button", { name: "더 보기" }));
      act(() => {
        const snapshot = store.get(snapshotAtom)!;
        store.set(applySnapshotAtom, { ...snapshot, transactions: [tx(7)], nextCursor: null });
      });
      await delay(150);
      expect(rows()).toHaveLength(1);
      expect(rows()[0]!.textContent).toContain("70 원");
    });

    it("cursor 오류(details.field = cursor)이면 새 순회를 요청하고 안내한다", async () => {
      seed([tx(1)], { nextCursor: "c20" });
      useMoreHandler(() =>
        errorResponse("VALIDATION_FAILED", { details: [{ field: "cursor", code: "INVALID_VALUE" }] }),
      );
      renderSection();
      const before = store.get(refreshRequestAtom);
      await userEvent.click(screen.getByRole("button", { name: "더 보기" }));
      expect(await screen.findByText("목록이 바뀌어 처음부터 다시 불러옵니다.")).toBeInTheDocument();
      expect(store.get(refreshRequestAtom)).toBe(before + 1);
    });

    it("네트워크·5xx 오류는 안내하고 다시 시도할 수 있다", async () => {
      seed([tx(1)], { nextCursor: "c20" });
      let calls = 0;
      useMoreHandler(() => (++calls === 1 ? HttpResponse.error() : HttpResponse.json({ transactions: [tx(2)], nextCursor: null })));
      renderSection();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "더 보기" }));
      expect(await screen.findByText(/더 불러오지 못했습니다/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "더 보기" }));
      await waitFor(() => expect(rows()).toHaveLength(2));
      expect(screen.queryByText(/더 불러오지 못했습니다/)).not.toBeInTheDocument();
    });

    it("불러오는 동안 버튼이 비활성화되어 중복 요청하지 않는다", async () => {
      seed([tx(1)], { nextCursor: "c20" });
      useMoreHandler(async () => {
        await delay(40);
        return HttpResponse.json({ transactions: [tx(2)], nextCursor: null });
      });
      renderSection();
      const user = userEvent.setup();
      const button = screen.getByRole("button", { name: "더 보기" });
      await Promise.all([user.click(button), user.click(button)]);
      await waitFor(() => expect(rows()).toHaveLength(2));
      expect(queries).toHaveLength(1);
    });
  });

  describe("참여자 필터", () => {
    it("전체와 모든 참여자(비활성 포함)를 고를 수 있다(1명만)", () => {
      seed([tx(1)]);
      renderSection();
      const select = screen.getByLabelText("참여자 필터") as HTMLSelectElement;
      expect(Array.from(select.options).map((o) => o.text)).toEqual(["전체", "가온", "나래", "다온 (비활성)"]);
      expect(select.multiple).toBe(false);
    });

    it("[AC-VIEW-004-3][AC-VIEW-004-5] 선택·변경·해제는 새 순회(전체 갱신)를 요청한다", async () => {
      seed([tx(1)]);
      renderSection();
      const select = screen.getByLabelText("참여자 필터");
      const user = userEvent.setup();
      const start = store.get(refreshRequestAtom);
      await user.selectOptions(select, "나래");
      expect(store.get(participantFilterAtom)).toBe("p-2");
      await user.selectOptions(select, "다온 (비활성)");
      expect(store.get(participantFilterAtom)).toBe("p-3");
      await user.selectOptions(select, "전체");
      expect(store.get(participantFilterAtom)).toBeNull();
      expect(store.get(refreshRequestAtom)).toBe(start + 3);
    });

    it("[AC-VIEW-004-8] 새 순회가 반영되기 전에는 기존 목록을 유지하다가 한 번에 교체한다", async () => {
      seed([tx(1), tx(2)]);
      renderSection();
      await userEvent.selectOptions(screen.getByLabelText("참여자 필터"), "나래");
      // 새 스냅샷이 오기 전: 이전 목록 유지 + 적용 중 표시
      expect(rows()).toHaveLength(2);
      expect(screen.getByText("필터를 적용하는 중…")).toBeInTheDocument();
      // 새 순회의 첫 페이지가 반영되면 한 번에 교체된다(이어 붙이지 않는다).
      act(() => {
        const snapshot = store.get(snapshotAtom)!;
        store.set(applySnapshotAtom, { ...snapshot, transactions: [tx(5)], nextCursor: null, transactionFilter: "p-2" });
      });
      expect(rows()).toHaveLength(1);
      expect(rows()[0]!.textContent).toContain("50 원");
      expect(screen.queryByText("필터를 적용하는 중…")).not.toBeInTheDocument();
    });
  });
});
