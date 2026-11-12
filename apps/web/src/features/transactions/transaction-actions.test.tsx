import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { RoomMember, Transaction } from "@/lib/api";
import { expectNoA11yViolations } from "@/test/a11y";
import { primeServerClock } from "@/test/clock-prime";
import { installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl, errorResponse } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { INVITE_CODE, seedRoom } from "@/test/room-seed";
import { TransactionActions } from "./transaction-actions";

const KEY = "a".repeat(43);
const base = `/rooms/${fixtures.room.id}/transactions`;

const own: Transaction = { ...fixtures.transactions[1]!, id: "t-own", authorId: fixtures.guestMember.id, amount: 100, reason: "점심", round: null };
const others: Transaction = { ...own, id: "t-other", authorId: "someone-else" };

interface Seen {
  method: string;
  path: string;
  body: unknown;
  key: string | null;
  authorization: string | null;
}
let seen: Seen[];
let store: ReturnType<typeof createStore>;

function handle(method: "put" | "delete", path: string, respond: () => Response | Promise<Response>) {
  server.use(
    http[method](apiUrl(path), async ({ request }) => {
      let body: unknown = null;
      if (request.method === "PUT") body = await request.json();
      seen.push({ method: request.method, path: new URL(request.url).pathname, body, key: request.headers.get("Idempotency-Key"), authorization: request.headers.get("Authorization") });
      return respond();
    }),
  );
}

beforeEach(async () => {
  seen = [];
  store = createStore();
  installFakeStorage().setItem(`ddallang:identity:${INVITE_CODE}`, KEY);
  await primeServerClock(KEY);
});

function mount(tx: Transaction, options: { me?: RoomMember; status?: "IN_PROGRESS" | "ENDED" } = {}) {
  seedRoom(store, { me: options.me ?? fixtures.guestMember, status: options.status });
  return renderApp(
    <main>
      <TransactionActions transaction={tx} me={options.me ?? fixtures.guestMember} room={{ ...fixtures.room, status: options.status ?? "IN_PROGRESS" }} />
    </main>,
    store,
  );
}

describe("거래 수정·삭제 컨트롤 (FE-S2-3)", () => {
  describe("노출", () => {
    it("작성자에게는 수정·삭제가 보이고 접근성 검사를 통과한다", async () => {
      const { container } = mount(own);
      expect(screen.getByRole("button", { name: "거래 100 원 수정" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "거래 100 원 삭제" })).toBeInTheDocument();
      await expectNoA11yViolations(container);
    });

    it("방장에게는 타인의 거래에도 보인다", () => {
      mount(others, { me: fixtures.hostMember });
      expect(screen.getByRole("button", { name: /수정/ })).toBeInTheDocument();
    });

    it("작성자도 방장도 아니면 컨트롤이 없다(서버가 최종 판정)", () => {
      mount(others, { me: fixtures.guestMember });
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("[AC-TXN-009-3] 게임이 종료되면 작성자·방장에게도 숨긴다", () => {
      mount(own, { status: "ENDED" });
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("수정", () => {
    it("[AC-TXN-005-6] 수정 폼에는 금액·사유·라운드만 있고 당사자 입력은 없다", async () => {
      mount(own);
      await userEvent.click(screen.getByRole("button", { name: /수정/ }));
      expect(screen.getByLabelText("금액")).toHaveValue("100");
      expect(screen.getByLabelText("사유 (선택)")).toHaveValue("점심");
      expect(screen.getByLabelText("라운드 (선택)")).toHaveValue("");
      expect(screen.queryByLabelText(/지급자|수취자/)).not.toBeInTheDocument();
      expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    });

    it("[AC-TXN-005-1] 확인 대화상자 없이 저장하고, 본문은 금액·사유·라운드(입력 없음은 null)뿐이다", async () => {
      handle("put", `${base}/t-own`, () => HttpResponse.json({ transaction: { ...own, amount: 250 } }));
      mount(own);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /수정/ }));
      await user.clear(screen.getByLabelText("금액"));
      await user.type(screen.getByLabelText("금액"), "250");
      await user.clear(screen.getByLabelText("사유 (선택)")); // 사유를 지운다
      await user.click(screen.getByRole("button", { name: "저장" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); // 확인 절차 없음
      await waitFor(() => expect(seen).toHaveLength(1));
      expect(seen[0]).toMatchObject({ method: "PUT", path: `${base}/t-own`, body: { amount: 250, reason: null, round: null }, authorization: `Bearer ${KEY}` });
      expect(seen[0]!.key).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(Object.keys(seen[0]!.body as object).sort()).toEqual(["amount", "reason", "round"]);
      await waitFor(() => expect(screen.queryByLabelText("금액")).not.toBeInTheDocument()); // 성공하면 닫힌다
    });

    it("클라이언트 검증 오류는 보내지 않고 입력을 유지한다", async () => {
      mount(own);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /수정/ }));
      await user.clear(screen.getByLabelText("금액"));
      await user.type(screen.getByLabelText("금액"), "0");
      await user.click(screen.getByRole("button", { name: "저장" }));
      expect(screen.getByLabelText("금액")).toHaveAccessibleDescription("1 이상 999,999,999 이하로 입력해 주세요.");
      expect(seen).toHaveLength(0);
    });

    it.each([
      ["NOT_AUTHOR_OR_HOST", "작성자 또는 방장만 수정할 수 있습니다"],
      ["TRANSACTION_DELETED", "이미 삭제된 거래입니다"],
      ["GAME_ENDED", "이미 종료된 게임입니다"],
    ] as const)("%s는 서버 message를 보이고 입력을 유지한다", async (code, message) => {
      handle("put", `${base}/t-own`, () => errorResponse(code, { message }));
      mount(own);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /수정/ }));
      await user.click(screen.getByRole("button", { name: "저장" }));
      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(screen.getByLabelText("금액")).toHaveValue("100");
    });

    it("저장 중에는 컨트롤이 비활성화된다", async () => {
      handle("put", `${base}/t-own`, async () => {
        await delay(50);
        return HttpResponse.json({ transaction: own });
      });
      mount(own);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /수정/ }));
      await user.click(screen.getByRole("button", { name: "저장" }));
      expect(screen.getByRole("button", { name: "저장 중…" })).toBeDisabled();
      await waitFor(() => expect(screen.queryByLabelText("금액")).not.toBeInTheDocument());
      expect(seen).toHaveLength(1);
    });
  });

  describe("삭제", () => {
    it("[AC-TXN-005-2] 확인 전에는 요청하지 않고 기본 포커스는 취소이며, 취소하면 요청이 0회다", async () => {
      // 요청이 나가면 기록되도록 삭제 처리기를 등록해 둔다(없으면 요청이 나가도 `seen`에 남지 않는다).
      handle("delete", `${base}/t-own`, () => HttpResponse.json({ transactionId: "t-own", deletedAt: "x" }));
      mount(own);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /삭제/ }));
      const dialog = screen.getByRole("dialog", { name: "거래를 삭제할까요?" });
      expect(dialog).toHaveAccessibleDescription("삭제한 거래는 누적 손익과 정산에서 빠지며 되돌릴 수 없습니다.");
      expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
      expect(seen).toHaveLength(0);
      await user.click(screen.getByRole("button", { name: "취소" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(seen).toHaveLength(0);
    });

    it("Esc로 닫아도 요청하지 않는다", async () => {
      handle("delete", `${base}/t-own`, () => HttpResponse.json({ transactionId: "t-own", deletedAt: "x" }));
      mount(own);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /삭제/ }));
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(seen).toHaveLength(0);
    });

    it("확인하면 DELETE를 키 헤더와 함께 보내고 성공하면 대화상자가 닫힌다", async () => {
      handle("delete", `${base}/t-own`, () => HttpResponse.json({ transactionId: "t-own", deletedAt: "2026-11-12T00:00:00.000Z" }));
      mount(own);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /삭제/ }));
      await user.click(screen.getByRole("button", { name: "삭제" }));
      await waitFor(() => expect(seen).toHaveLength(1));
      expect(seen[0]).toMatchObject({ method: "DELETE", path: `${base}/t-own`, authorization: `Bearer ${KEY}` });
      expect(seen[0]!.key).toMatch(/^[A-Za-z0-9_-]{22}$/);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("이미 삭제된 거래(TRANSACTION_DELETED)는 서버 message를 보이고 대화상자를 닫는다", async () => {
      handle("delete", `${base}/t-own`, () => errorResponse("TRANSACTION_DELETED", { message: "이미 삭제된 거래입니다" }));
      mount(own);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /삭제/ }));
      await user.click(screen.getByRole("button", { name: "삭제" }));
      expect(await screen.findByText("이미 삭제된 거래입니다")).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("응답을 받지 못하면 삭제됐다고 단정하지 않고 같은 키로 다시 시도할 수 있다", async () => {
      let calls = 0;
      handle("delete", `${base}/t-own`, () => (++calls === 1 ? HttpResponse.error() : HttpResponse.json({ transactionId: "t-own", deletedAt: "x" })));
      mount(own);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /삭제/ }));
      await user.click(screen.getByRole("button", { name: "삭제" }));
      expect(await screen.findByText("결과를 확인하지 못했습니다.")).toBeInTheDocument();
      expect(screen.queryByText(/삭제했습니다/)).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "다시 시도" }));
      await waitFor(() => expect(seen).toHaveLength(2));
      expect(seen[1]!.key).toBe(seen[0]!.key); // 같은 키
    });
  });
});
