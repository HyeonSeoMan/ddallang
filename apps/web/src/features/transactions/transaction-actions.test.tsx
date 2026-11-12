import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomMember, Transaction } from "@/lib/api";
import { expectNoA11yViolations } from "@/test/a11y";
import { primeServerClock } from "@/test/clock-prime";
import { installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl, errorResponse } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { INVITE_CODE, seedRoom } from "@/test/room-seed";
import { editDraftsAtom } from "./edit-state";
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

  describe("연결 끊김과 재마운트 (Codex R-F01·R-F02)", () => {
    function renderRow(me = fixtures.guestMember) {
      return renderApp(
        <main>
          <TransactionActions transaction={own} me={me} room={fixtures.room} />
        </main>,
        store,
      );
    }

    it("[AC-SYS-001-5][R-F01] 수정 중이던 입력은 행이 언마운트됐다가 다시 마운트돼도 유지된다(자동 제출 없음)", async () => {
      handle("put", `${base}/t-own`, () => HttpResponse.json({ transaction: own }));
      seedRoom(store, { me: fixtures.guestMember });
      const first = renderRow();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /수정/ }));
      await user.clear(screen.getByLabelText("금액"));
      await user.type(screen.getByLabelText("금액"), "250");
      await user.type(screen.getByLabelText("사유 (선택)"), "추가");
      first.unmount(); // 연결 끊김으로 서버 유래 영역이 가려진다
      renderRow();
      expect(screen.getByLabelText("금액")).toHaveValue("250");
      expect(screen.getByLabelText("사유 (선택)")).toHaveValue("점심추가");
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(seen).toHaveLength(0); // 복구가 자동으로 제출하지 않는다
    });

    it("[R-F02] 결과 불명인 수정은 재마운트 뒤에도 안내와 수동 재시도가 남고, 다시 열어도 지워지지 않으며, 같은 키로 보낸다", async () => {
      let calls = 0;
      handle("put", `${base}/t-own`, () => (++calls === 1 ? HttpResponse.error() : HttpResponse.json({ transaction: own })));
      seedRoom(store, { me: fixtures.guestMember });
      const first = renderRow();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /수정/ }));
      await user.clear(screen.getByLabelText("금액"));
      await user.type(screen.getByLabelText("금액"), "300");
      await user.click(screen.getByRole("button", { name: "저장" }));
      await screen.findByText("결과를 확인하지 못했습니다.");
      first.unmount();

      renderRow();
      expect(screen.getByText("결과를 확인하지 못했습니다.")).toBeInTheDocument(); // 폼이 다시 열려 있다
      expect(screen.getByLabelText("금액")).toHaveValue("300");
      // 폼을 닫아도(취소) 불명 안내와 재시도는 남는다.
      await user.click(screen.getByRole("button", { name: "취소" }));
      expect(screen.getByText("결과를 확인하지 못했습니다.")).toBeInTheDocument();
      // 다시 열어도 불명 상태와 입력이 지워지지 않는다.
      await user.click(screen.getByRole("button", { name: /수정/ }));
      expect(screen.getByText("결과를 확인하지 못했습니다.")).toBeInTheDocument();
      expect(screen.getByLabelText("금액")).toHaveValue("300");
      await user.click(screen.getByRole("button", { name: "다시 시도" }));
      await waitFor(() => expect(seen).toHaveLength(2));
      expect(seen[1]!.key).toBe(seen[0]!.key); // 같은 키
      expect(seen[1]!.body).toEqual(seen[0]!.body);
    });

    /** 결과 불명 → 취소(폼 닫힘) 상태를 만든다. */
    async function closedUnknown(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole("button", { name: /수정/ }));
      await user.clear(screen.getByLabelText("금액"));
      await user.type(screen.getByLabelText("금액"), "300");
      await user.click(screen.getByRole("button", { name: "저장" }));
      await screen.findByText("결과를 확인하지 못했습니다.");
      await user.click(screen.getByRole("button", { name: "취소" }));
    }

    it("[R2-F01] 닫힌 상태의 재시도가 진행 중일 때 수정을 열 수 없고, 응답이 또 유실돼도 안내와 같은 키 재시도·입력이 남는다", async () => {
      let calls = 0;
      handle("put", `${base}/t-own`, async () => {
        calls += 1;
        if (calls === 2) {
          await delay(60); // 닫힌 상태의 재시도 응답이 늦게 온다
          return HttpResponse.error(); // 그리고 또 유실된다
        }
        return calls === 1 ? HttpResponse.error() : HttpResponse.json({ transaction: own });
      });
      seedRoom(store, { me: fixtures.guestMember });
      renderRow();
      const user = userEvent.setup();
      await closedUnknown(user);
      await user.click(screen.getByRole("button", { name: "다시 시도" })); // 닫힌 상태에서 재시도
      expect(screen.getByRole("button", { name: /수정/ })).toBeDisabled(); // 진행 중에는 열 수 없다
      await screen.findByText("결과를 확인하지 못했습니다.", undefined, { timeout: 2000 });
      await waitFor(() => expect(screen.getByRole("button", { name: "다시 시도" })).toBeEnabled());
      expect(seen).toHaveLength(2);
      expect(seen[1]!.key).toBe(seen[0]!.key); // 같은 키
      // 다시 열면 보냈던 입력이 그대로다(서버 값으로 덮어쓰지 않는다).
      await user.click(screen.getByRole("button", { name: /수정/ }));
      expect(screen.getByLabelText("금액")).toHaveValue("300");
      expect(screen.getByText("결과를 확인하지 못했습니다.")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "다시 시도" })); // 세 번째 시도는 성공
      await waitFor(() => expect(seen).toHaveLength(3));
      expect(seen[2]!.key).toBe(seen[0]!.key);
    });

    it("[R2-F02] 닫힌 상태의 재시도가 확정 거부되면 거부 사유를 보이고, 다시 열어도 입력을 덮어쓰지 않는다", async () => {
      let calls = 0;
      handle("put", `${base}/t-own`, () =>
        ++calls === 1 ? HttpResponse.error() : errorResponse("GAME_ENDED", { message: "이미 종료된 게임입니다" }),
      );
      seedRoom(store, { me: fixtures.guestMember });
      renderRow();
      const user = userEvent.setup();
      await closedUnknown(user);
      await user.click(screen.getByRole("button", { name: "다시 시도" }));
      expect(await screen.findByText("이미 종료된 게임입니다")).toBeInTheDocument(); // 닫힌 상태에서도 보인다
      await user.click(screen.getByRole("button", { name: /수정/ }));
      expect(screen.getByLabelText("금액")).toHaveValue("300"); // 덮어쓰지 않았다
      expect(screen.getByText("이미 종료된 게임입니다")).toBeInTheDocument(); // 거부 사유도 유지
      // 거부된 수정은 취소하면 초안과 결과를 함께 버린다.
      await user.click(screen.getByRole("button", { name: "취소" }));
      expect(screen.queryByText("이미 종료된 게임입니다")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /수정/ }));
      expect(screen.getByLabelText("금액")).toHaveValue("100"); // 서버 값에서 새로 시작
    });

    it("[상태 조합] 닫힌 상태에서 24시간이 지난 불명 수정은 확인 버튼으로만 새 키로 보내고 자동 재전송하지 않는다", async () => {
      let calls = 0;
      handle("put", `${base}/t-own`, () => (++calls === 1 ? HttpResponse.error() : HttpResponse.json({ transaction: own })));
      seedRoom(store, { me: fixtures.guestMember });
      renderRow();
      const user = userEvent.setup();
      await closedUnknown(user);
      vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 24 * 60 * 60 * 1000 + 1000 });
      try {
        await user.click(screen.getByRole("button", { name: "다시 시도" }));
        expect(await screen.findByText(/첫 시도 후 24시간이 지났습니다/)).toBeInTheDocument();
        expect(seen).toHaveLength(1); // 자동으로 새 키를 만들어 보내지 않았다
        await user.click(screen.getByRole("button", { name: /새로 저장/ }));
        await waitFor(() => expect(seen).toHaveLength(2));
        expect(seen[1]!.key).not.toBe(seen[0]!.key);
        expect(seen[1]!.body).toEqual(seen[0]!.body); // 보냈던 입력 그대로
      } finally {
        vi.useRealTimers();
      }
    });

    it("[상태 조합] 저장 중에는 취소할 수 없고(초안 유지), 거부된 수정은 재마운트 뒤에도 사유와 입력이 남는다", async () => {
      handle("put", `${base}/t-own`, async () => {
        await delay(60);
        return errorResponse("NOT_AUTHOR_OR_HOST", { message: "작성자 또는 방장만 수정할 수 있습니다" });
      });
      seedRoom(store, { me: fixtures.guestMember });
      const first = renderRow();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /수정/ }));
      await user.clear(screen.getByLabelText("금액"));
      await user.type(screen.getByLabelText("금액"), "350");
      await user.click(screen.getByRole("button", { name: "저장" }));
      expect(screen.getByRole("button", { name: "취소" })).toBeDisabled(); // 전송 중 취소 불가
      await screen.findByText("작성자 또는 방장만 수정할 수 있습니다");
      first.unmount();
      renderRow();
      expect(screen.getByLabelText("금액")).toHaveValue("350");
      expect(screen.getByText("작성자 또는 방장만 수정할 수 있습니다")).toBeInTheDocument();
    });

    it("[F02] 불명 뒤 입력을 바꾸고 취소하면 보냈던 입력으로 되돌아가, 닫힌 상태의 다시 시도는 같은 요청의 같은 키 재시도다", async () => {
      let calls = 0;
      handle("put", `${base}/t-own`, () => (++calls === 1 ? HttpResponse.error() : HttpResponse.json({ transaction: own })));
      seedRoom(store, { me: fixtures.guestMember });
      renderRow();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /수정/ }));
      await user.clear(screen.getByLabelText("금액"));
      await user.type(screen.getByLabelText("금액"), "300");
      await user.click(screen.getByRole("button", { name: "저장" }));
      await screen.findByText("결과를 확인하지 못했습니다.");
      await user.clear(screen.getByLabelText("금액")); // 불명 뒤 입력을 바꾸고(비우고)
      await user.type(screen.getByLabelText("금액"), "999");
      await user.click(screen.getByRole("button", { name: "취소" })); // 닫는다
      await user.click(screen.getByRole("button", { name: "다시 시도" }));
      await waitFor(() => expect(seen).toHaveLength(2));
      expect(seen[1]!.body).toEqual(seen[0]!.body); // 보냈던 내용(300) 그대로
      expect(seen[1]!.key).toBe(seen[0]!.key); // 같은 키: 안내 문구와 일치
    });

    it("[R3-F01] 닫힌 상태의 재시도에 서버가 필드별 검증 거부(422)를 주면 폼을 다시 열어 필드 사유를 보여 주고 입력을 유지한다", async () => {
      let calls = 0;
      handle("put", `${base}/t-own`, () =>
        ++calls === 1
          ? HttpResponse.error()
          : errorResponse("VALIDATION_FAILED", { details: [{ field: "amount", code: "OUT_OF_RANGE" }] }),
      );
      seedRoom(store, { me: fixtures.guestMember });
      renderRow();
      const user = userEvent.setup();
      await closedUnknown(user);
      await user.click(screen.getByRole("button", { name: "다시 시도" }));
      expect(await screen.findByLabelText("금액")).toHaveAccessibleDescription("1 이상 999,999,999 이하로 입력해 주세요.");
      expect(screen.getByLabelText("금액")).toHaveValue("300"); // 입력 유지
      // 재마운트 뒤에도 사유와 입력을 확인하고 고칠 수 있다.
      expect(seen).toHaveLength(2);
    });

    it("수정에 성공하면 초안이 사라지고, 응답을 기다리는 사이 바꾼 입력은 보존한다", async () => {
      handle("put", `${base}/t-own`, async () => {
        await delay(60);
        return HttpResponse.json({ transaction: own });
      });
      seedRoom(store, { me: fixtures.guestMember });
      renderRow();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /수정/ }));
      await user.clear(screen.getByLabelText("금액"));
      await user.type(screen.getByLabelText("금액"), "400");
      await user.click(screen.getByRole("button", { name: "저장" }));
      await user.type(screen.getByLabelText("금액"), "5"); // 저장 응답 전에 4005로 변경
      await waitFor(() => expect(seen).toHaveLength(1));
      await delay(120);
      expect(screen.getByLabelText("금액")).toHaveValue("4005"); // 새 입력이 저장된 것으로 오인돼 지워지지 않았다
    });
  });

  describe("검수(Claude) 반영", () => {
    it("[F03] 삭제가 성공하면 그 거래의 컨트롤이 사라지고 수정 초안·상태가 남지 않는다", async () => {
      handle("delete", `${base}/t-own`, () => HttpResponse.json({ transactionId: "t-own", deletedAt: "x" }));
      seedRoom(store, { me: fixtures.guestMember });
      const view = renderApp(
        <main>
          <TransactionActions transaction={own} me={fixtures.guestMember} room={fixtures.room} />
        </main>,
        store,
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /수정/ })); // 수정 초안을 만들어 둔다
      await user.click(screen.getByRole("button", { name: "취소" }));
      await user.click(screen.getByRole("button", { name: /삭제/ }));
      await user.click(screen.getByRole("button", { name: "삭제" }));
      await waitFor(() => expect(screen.queryByRole("button", { name: /수정/ })).not.toBeInTheDocument());
      expect(screen.queryByRole("button")).not.toBeInTheDocument(); // 삭제된 거래를 다시 수정·삭제할 수 없다
      expect(Object.keys(store.get(editDraftsAtom))).toEqual([]);
      view.unmount();
    });

    it("[F04] summary가 있으면 같은 금액의 행도 접근 가능한 이름으로 구분된다", () => {
      seedRoom(store, { me: fixtures.hostMember });
      renderApp(
        <main>
          <TransactionActions transaction={own} me={fixtures.hostMember} room={fixtures.room} summary="가온 → 나래 100 원" />
          <TransactionActions transaction={others} me={fixtures.hostMember} room={fixtures.room} summary="나래 → 다온 100 원" />
        </main>,
        store,
      );
      expect(screen.getByRole("button", { name: "거래 가온 → 나래 100 원 수정" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "거래 나래 → 다온 100 원 수정" })).toBeInTheDocument();
    });

    it("[F05] 고친 필드의 이전 검증 오류는 지워지고 다른 필드의 오류는 남는다", async () => {
      seedRoom(store, { me: fixtures.guestMember });
      renderApp(
        <main>
          <TransactionActions transaction={own} me={fixtures.guestMember} room={fixtures.room} />
        </main>,
        store,
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /수정/ }));
      await user.clear(screen.getByLabelText("금액"));
      await user.type(screen.getByLabelText("사유 (선택)"), "가".repeat(51)); // 50자 초과: 사유 오류도 만든다
      await user.click(screen.getByRole("button", { name: "저장" }));
      // 두 오류가 모두 실제로 생겼다.
      expect(screen.getByLabelText("금액")).toHaveAccessibleDescription("필수 항목입니다.");
      expect(screen.getByLabelText("사유 (선택)")).toHaveAccessibleDescription(/50/);
      await user.type(screen.getByLabelText("금액"), "50"); // 금액만 고친다
      expect(screen.getByLabelText("금액")).not.toHaveAccessibleDescription("필수 항목입니다.");
      expect(screen.getByLabelText("사유 (선택)")).toHaveAccessibleDescription(/50/); // 사유 오류는 남는다
      expect(seen).toHaveLength(0);
    });

    it("[S2 F01·F02] 서버 422 뒤 고친 필드의 오류만 사라지고 다른 필드의 오류는 남으며, 로컬 오류를 지운 뒤에도 옛 서버 오류가 되살아나지 않는다", async () => {
      const AMOUNT_ERROR = "1 이상 999,999,999 이하로 입력해 주세요.";
      handle("put", `${base}/t-own`, () =>
        errorResponse("VALIDATION_FAILED", { details: [{ field: "amount", code: "OUT_OF_RANGE" }, { field: "reason", code: "INVALID_CHARACTER" }] }),
      );
      seedRoom(store, { me: fixtures.guestMember });
      renderApp(
        <main>
          <TransactionActions transaction={own} me={fixtures.guestMember} room={fixtures.room} />
        </main>,
        store,
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /수정/ }));
      await user.click(screen.getByRole("button", { name: "저장" }));
      await waitFor(() => expect(screen.getByLabelText("금액")).toHaveAccessibleDescription(AMOUNT_ERROR));
      expect(screen.getByLabelText("사유 (선택)")).toHaveAccessibleDescription(/보이지 않는 문자/);
      expect(seen).toHaveLength(1);

      await user.type(screen.getByLabelText("금액"), "1"); // 금액을 고친다
      expect(screen.getByLabelText("금액")).not.toHaveAccessibleDescription(AMOUNT_ERROR);
      expect(screen.getByLabelText("사유 (선택)")).toHaveAccessibleDescription(/보이지 않는 문자/); // 고치지 않은 필드의 오류는 남는다

      await user.clear(screen.getByLabelText("금액")); // 로컬 오류를 만들었다가 모두 지워도
      await user.click(screen.getByRole("button", { name: "저장" }));
      expect(screen.getByLabelText("금액")).toHaveAccessibleDescription("필수 항목입니다.");
      expect(seen).toHaveLength(1);
      await user.type(screen.getByLabelText("금액"), "7");
      expect(screen.getByLabelText("금액")).not.toHaveAccessibleDescription(AMOUNT_ERROR); // 옛 서버 오류가 되살아나지 않는다
      expect(screen.getByLabelText("금액")).not.toHaveAccessibleDescription("필수 항목입니다.");
    });

    it("[S2 F01 재마운트] 재마운트해도 고친 필드의 옛 서버 오류는 되살아나지 않고, 새 거부 응답에서는 다시 표시된다", async () => {
      const AMOUNT_ERROR = "1 이상 999,999,999 이하로 입력해 주세요.";
      handle("put", `${base}/t-own`, () =>
        errorResponse("VALIDATION_FAILED", { details: [{ field: "amount", code: "OUT_OF_RANGE" }, { field: "reason", code: "INVALID_CHARACTER" }] }),
      );
      seedRoom(store, { me: fixtures.guestMember });
      const view = renderApp(
        <main>
          <TransactionActions transaction={own} me={fixtures.guestMember} room={fixtures.room} />
        </main>,
        store,
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /수정/ }));
      await user.click(screen.getByRole("button", { name: "저장" }));
      await waitFor(() => expect(screen.getByLabelText("금액")).toHaveAccessibleDescription(AMOUNT_ERROR));
      await user.type(screen.getByLabelText("금액"), "1"); // 금액을 고친다(3001)
      expect(screen.getByLabelText("금액")).not.toHaveAccessibleDescription(AMOUNT_ERROR);

      view.unmount();
      renderApp(
        <main>
          <TransactionActions transaction={own} me={fixtures.guestMember} room={fixtures.room} />
        </main>,
        store,
      );
      expect(screen.getByLabelText("금액")).toHaveValue(`${own.amount}1`);
      expect(screen.getByLabelText("금액")).not.toHaveAccessibleDescription(AMOUNT_ERROR); // 되살아나지 않는다
      expect(screen.getByLabelText("사유 (선택)")).toHaveAccessibleDescription(/보이지 않는 문자/);

      await user.click(screen.getByRole("button", { name: "저장" })); // 새 거부 응답에서는 다시 표시된다
      await waitFor(() => expect(screen.getByLabelText("금액")).toHaveAccessibleDescription(AMOUNT_ERROR));
      expect(seen).toHaveLength(2);
    });

    it("[F01] 수정 초안은 요청자별로 분리되어 같은 방에서 신원이 바뀌어도 이전 신원의 초안이 보이지 않는다", async () => {
      seedRoom(store, { me: fixtures.hostMember });
      const first = renderApp(
        <main>
          <TransactionActions transaction={own} me={fixtures.hostMember} room={fixtures.room} />
        </main>,
        store,
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /수정/ }));
      await user.clear(screen.getByLabelText("금액"));
      await user.type(screen.getByLabelText("금액"), "777");
      first.unmount();
      seedRoom(store, { me: fixtures.guestMember }); // 같은 방, 다른 신원
      renderApp(
        <main>
          <TransactionActions transaction={own} me={fixtures.guestMember} room={fixtures.room} />
        </main>,
        store,
      );
      expect(screen.queryByLabelText("금액")).not.toBeInTheDocument(); // 이전 신원의 열린 초안이 보이지 않는다
      expect(screen.getByRole("button", { name: /수정/ })).toBeInTheDocument();
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
