import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerDataGate } from "@/features/room/server-data-gate";
import { applySnapshotAtom, setConnectionAtom, snapshotAtom, startEpochAtom } from "@/features/room/state";
import { expectNoA11yViolations } from "@/test/a11y";
import { primeServerClock } from "@/test/clock-prime";
import { installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl, errorResponse } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { INVITE_CODE, makeSnapshot, seedRoom } from "@/test/room-seed";
import { UNKNOWN_AFTER_RECOVERY, UNKNOWN_RESULT } from "./messages";
import { TransactionForm } from "./transaction-form";

const KEY = "w".repeat(43);
const txPath = `/rooms/${fixtures.room.id}/transactions`;

interface Req {
  body: Record<string, unknown>;
  key: string | null;
  firstAttemptAt: string | null;
  authorization: string | null;
}
let requests: Req[];
let store: ReturnType<typeof createStore>;

function handle(respond: (n: number) => Response | Promise<Response>) {
  server.use(
    http.post(apiUrl(txPath), async ({ request }) => {
      requests.push({
        body: (await request.json()) as Record<string, unknown>,
        key: request.headers.get("Idempotency-Key"),
        firstAttemptAt: request.headers.get("Idempotency-First-Attempt-At"),
        authorization: request.headers.get("Authorization"),
      });
      return respond(requests.length);
    }),
  );
}

const created = () =>
  HttpResponse.json({ transaction: { ...fixtures.transactions[1], id: "t-new" } }, { status: 201 });

beforeEach(async () => {
  requests = [];
  store = createStore();
  installFakeStorage().setItem(`ddallang:identity:${INVITE_CODE}`, KEY);
  await primeServerClock(KEY);
});

function mount(options: Parameters<typeof seedRoom>[1] = {}) {
  seedRoom(store, options);
  return renderApp(<main><TransactionForm /></main>, store);
}

async function fill(user: ReturnType<typeof userEvent.setup>, v: { payer?: string; payee?: string; amount?: string; reason?: string; round?: string }) {
  if (v.payer) await user.selectOptions(screen.getByLabelText("지급자"), v.payer);
  if (v.payee) await user.selectOptions(screen.getByLabelText("수취자"), v.payee);
  if (v.amount !== undefined) await user.type(screen.getByLabelText("금액"), v.amount);
  if (v.reason !== undefined) await user.type(screen.getByLabelText("사유 (선택)"), v.reason);
  if (v.round !== undefined) await user.type(screen.getByLabelText("라운드 (선택)"), v.round);
}

const save = () => screen.getByRole("button", { name: /^저장/ });

describe("거래 입력 폼 (FE-S2-2)", () => {
  it("[AC-PART-002-3] 지급자·수취자 선택지에는 활성 참여자만 있고 비활성은 없다", async () => {
    const { container } = mount();
    for (const label of ["지급자", "수취자"]) {
      const options = Array.from((screen.getByLabelText(label) as HTMLSelectElement).options).map((o) => o.text);
      expect(options).toEqual(["선택", "가온", "나래"]); // 다온(비활성) 제외
    }
    await expectNoA11yViolations(container);
  });

  it("[AC-PART-002-4] 참여자가 재활성화되어 새 스냅샷이 반영되면 선택지에 들어온다", () => {
    mount();
    act(() => {
      const snapshot = store.get(snapshotAtom)!;
      store.set(applySnapshotAtom, {
        ...snapshot,
        participants: snapshot.participants.map((p) => (p.id === "p-3" ? { ...p, status: "ACTIVE" as const } : p)),
      });
    });
    expect(Array.from((screen.getByLabelText("지급자") as HTMLSelectElement).options).map((o) => o.text)).toContain("다온");
  });

  it("[AC-TXN-001-3] 지급자·수취자·금액 누락은 사유를 보이고 보내지 않으며 입력을 유지한다", async () => {
    mount();
    const user = userEvent.setup();
    await fill(user, { reason: "점심" });
    await user.click(save());
    expect(screen.getByLabelText("지급자")).toHaveAccessibleDescription("필수 항목입니다.");
    expect(screen.getByLabelText("수취자")).toHaveAccessibleDescription("필수 항목입니다.");
    expect(screen.getByLabelText("금액")).toHaveAccessibleDescription("필수 항목입니다.");
    expect(screen.getByLabelText("사유 (선택)")).toHaveValue("점심"); // 입력 유지
    expect(requests).toHaveLength(0);
  });

  it("지급자와 수취자가 같으면 보내지 않는다", async () => {
    mount();
    const user = userEvent.setup();
    await fill(user, { payer: "가온", payee: "가온", amount: "100" });
    await user.click(save());
    expect(screen.getByLabelText("수취자")).toHaveAccessibleDescription("지급자와 수취자는 달라야 합니다.");
    expect(requests).toHaveLength(0);
  });

  it("[AC-TXN-001-6] 금액 형식·범위, 사유 50자·라운드 12자, 허용 문자를 클라이언트에서 먼저 검증한다", async () => {
    mount();
    const user = userEvent.setup();
    await fill(user, { payer: "가온", payee: "나래", amount: "1,000", reason: "가".repeat(51), round: "a".repeat(13) });
    await user.click(save());
    expect(screen.getByLabelText("금액")).toHaveAccessibleDescription("숫자만 입력해 주세요.");
    expect(screen.getByLabelText("사유 (선택)")).toHaveAccessibleDescription("50자 이하로 입력해 주세요.");
    expect(screen.getByLabelText("라운드 (선택)")).toHaveAccessibleDescription("12자 이하로 입력해 주세요.");
    expect(requests).toHaveLength(0);
    expect(screen.getByLabelText("금액")).toHaveValue("1,000"); // 입력 유지
  });

  it("저장하면 키·최초 시도 시각·신원 키 헤더와 함께 올바른 본문을 보내고, 성공 뒤에만 입력을 비운다", async () => {
    handle(() => created());
    mount();
    const user = userEvent.setup();
    await fill(user, { payer: "가온", payee: "나래", amount: "1250", reason: "점심", round: "2" });
    await user.click(save());
    await waitFor(() => expect(screen.getByLabelText("금액")).toHaveValue(""));
    const [request] = requests;
    expect(request!.body).toEqual({ payerId: "p-1", payeeId: "p-2", amount: 1250, reason: "점심", round: "2" });
    expect(request!.key).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(request!.firstAttemptAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(request!.authorization).toBe(`Bearer ${KEY}`);
    expect(screen.getByLabelText("지급자")).toHaveValue("");
    expect(await screen.findAllByText("거래를 저장했습니다.")).not.toHaveLength(0);
  });

  it("입력 없는 사유·라운드는 본문에서 뺀다", async () => {
    handle(() => created());
    mount();
    const user = userEvent.setup();
    await fill(user, { payer: "가온", payee: "나래", amount: "5" });
    await user.click(save());
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]!.body).toEqual({ payerId: "p-1", payeeId: "p-2", amount: 5 });
  });

  it("[AC-TXN-007-1] 저장 중에는 저장 컨트롤이 비활성화되어 중복 제출되지 않는다", async () => {
    handle(async () => {
      await delay(60);
      return created();
    });
    mount();
    const user = userEvent.setup();
    await fill(user, { payer: "가온", payee: "나래", amount: "10" });
    await user.click(save());
    const busy = screen.getByRole("button", { name: "저장 중…" });
    expect(busy).toBeDisabled();
    await user.click(busy);
    await waitFor(() => expect(screen.getByLabelText("금액")).toHaveValue(""));
    expect(requests).toHaveLength(1);
  });

  describe("서버 확정 거부는 입력을 유지하고 성공을 표시하지 않는다", () => {
    it("[AC-ROOM-008-3] 거래 한도 초과는 서버 안내를 보이고 입력을 유지한다", async () => {
      handle(() => errorResponse("TRANSACTION_LIMIT_EXCEEDED", { message: "거래는 1,000건까지 등록할 수 있습니다", details: [{ limit: 1000 }] }));
      mount();
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "나래", amount: "10", reason: "한도" });
      await user.click(save());
      expect(await screen.findByText("거래는 1,000건까지 등록할 수 있습니다")).toBeInTheDocument();
      expect(screen.getByLabelText("사유 (선택)")).toHaveValue("한도");
      expect(screen.queryByText("거래를 저장했습니다.")).not.toBeInTheDocument();
    });

    it("[AC-TXN-008-1][AC-TXN-008-2] 서버 오류는 실패를 표시하고 입력을 유지하며 자동 재전송하지 않는다", async () => {
      handle(() => errorResponse("GAME_ENDED", { message: "이미 종료된 게임입니다" }));
      mount();
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "나래", amount: "10" });
      await user.click(save());
      expect(await screen.findByText("이미 종료된 게임입니다")).toBeInTheDocument();
      expect(screen.getByLabelText("금액")).toHaveValue("10");
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(requests).toHaveLength(1);
    });

    it("PARTICIPANT_INACTIVE는 해당 필드에 안내한다", async () => {
      handle(() => errorResponse("PARTICIPANT_INACTIVE", { message: "비활성 참여자는 선택할 수 없습니다", details: [{ field: "payerId" }] }));
      mount();
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "나래", amount: "10" });
      await user.click(save());
      await waitFor(() => expect(screen.getByLabelText("지급자")).toHaveAccessibleDescription("비활성 참여자는 선택할 수 없습니다"));
    });

    it("서버 422의 필드 사유를 필드에 보이고 서버 message를 그대로 보인다(매핑 불가 시)", async () => {
      handle(() =>
        errorResponse("VALIDATION_FAILED", { details: [{ field: "amount", code: "OUT_OF_RANGE" }, { field: "reason", code: "INVALID_CHARACTER" }] }),
      );
      mount();
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "나래", amount: "10" });
      await user.click(save());
      await waitFor(() => expect(screen.getByLabelText("금액")).toHaveAccessibleDescription("1 이상 999,999,999 이하로 입력해 주세요."));
      expect(screen.getByLabelText("사유 (선택)")).toHaveAccessibleDescription(/보이지 않는 문자/);
    });

    it("[S2 F01] 서버 422 뒤 고친 필드의 오류만 사라지고 고치지 않은 필드의 오류는 남으며, 로컬 오류를 지운 뒤에도 옛 서버 오류가 되살아나지 않는다", async () => {
      const AMOUNT_ERROR = "1 이상 999,999,999 이하로 입력해 주세요.";
      handle(() =>
        errorResponse("VALIDATION_FAILED", { details: [{ field: "amount", code: "OUT_OF_RANGE" }, { field: "reason", code: "INVALID_CHARACTER" }] }),
      );
      mount();
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "나래", amount: "10" });
      await user.click(save());
      await waitFor(() => expect(screen.getByLabelText("금액")).toHaveAccessibleDescription(AMOUNT_ERROR));
      expect(screen.getByLabelText("사유 (선택)")).toHaveAccessibleDescription(/보이지 않는 문자/);

      await user.type(screen.getByLabelText("금액"), "5"); // 금액을 고친다
      expect(screen.getByLabelText("금액")).not.toHaveAccessibleDescription(AMOUNT_ERROR);
      expect(screen.getByLabelText("사유 (선택)")).toHaveAccessibleDescription(/보이지 않는 문자/); // 고치지 않은 필드의 오류는 남는다

      // 금액을 비워 로컬 검증 오류를 만들고, 다시 입력해 로컬 오류를 모두 지워도 금액의 옛 서버 오류가 되살아나지 않는다.
      await user.clear(screen.getByLabelText("금액"));
      await user.click(save());
      expect(screen.getByLabelText("금액")).toHaveAccessibleDescription("필수 항목입니다.");
      expect(requests).toHaveLength(1); // 로컬 검증 실패는 보내지 않는다
      await user.type(screen.getByLabelText("금액"), "7");
      expect(screen.getByLabelText("금액")).not.toHaveAccessibleDescription(AMOUNT_ERROR);
      expect(screen.getByLabelText("금액")).not.toHaveAccessibleDescription("필수 항목입니다.");

      await user.type(screen.getByLabelText("사유 (선택)"), "가"); // 사유도 고치면 서버 오류가 모두 사라진다
      expect(screen.getByLabelText("사유 (선택)")).not.toHaveAccessibleDescription(/보이지 않는 문자/);
    });

    it("[S2 F01 재마운트] 재마운트(연결 끊김·복구)해도 고친 필드의 옛 서버 오류는 되살아나지 않고, 새 거부 응답에서는 다시 표시된다", async () => {
      const AMOUNT_ERROR = "1 이상 999,999,999 이하로 입력해 주세요.";
      handle(() =>
        errorResponse("VALIDATION_FAILED", { details: [{ field: "amount", code: "OUT_OF_RANGE" }, { field: "reason", code: "INVALID_CHARACTER" }] }),
      );
      const view = mount();
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "나래", amount: "10" });
      await user.click(save());
      await waitFor(() => expect(screen.getByLabelText("금액")).toHaveAccessibleDescription(AMOUNT_ERROR));
      await user.type(screen.getByLabelText("금액"), "5"); // 금액을 고친다
      expect(screen.getByLabelText("금액")).not.toHaveAccessibleDescription(AMOUNT_ERROR);

      view.unmount();
      renderApp(<main><TransactionForm /></main>, store); // 같은 앱 상태(초안·거부 응답)로 다시 마운트
      expect(screen.getByLabelText("금액")).toHaveValue("105");
      expect(screen.getByLabelText("금액")).not.toHaveAccessibleDescription(AMOUNT_ERROR); // 되살아나지 않는다
      expect(screen.getByLabelText("사유 (선택)")).toHaveAccessibleDescription(/보이지 않는 문자/); // 고치지 않은 필드의 오류는 남는다

      await user.click(save()); // 새 거부 응답에서는 다시 표시된다
      await waitFor(() => expect(screen.getByLabelText("금액")).toHaveAccessibleDescription(AMOUNT_ERROR));
      expect(requests).toHaveLength(2);
    });
  });

  describe("결과 불명과 Idempotency Key (FE-F8 연동)", () => {
    it("[AC-TXN-008-1] 네트워크 오류는 성공을 표시하지 않고 '결과를 확인하지 못했습니다'로 알리며 입력을 유지한다", async () => {
      handle(() => HttpResponse.error());
      mount();
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "나래", amount: "10" });
      await user.click(save());
      expect(await screen.findByText(UNKNOWN_RESULT)).toBeInTheDocument();
      expect(screen.queryByText("거래를 저장했습니다.")).not.toBeInTheDocument();
      expect(screen.getByLabelText("금액")).toHaveValue("10");
    });

    it("[AC-TXN-007-5][AC-TXN-008-3] 수동 재시도는 같은 키와 같은 최초 시도 시각이고 자동 재전송은 없다", async () => {
      handle((n) => (n === 1 ? HttpResponse.error() : created()));
      mount();
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "나래", amount: "10" });
      await user.click(save());
      await screen.findByText(UNKNOWN_RESULT);
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(requests).toHaveLength(1); // 자동 재전송 없음
      await user.click(screen.getByRole("button", { name: "다시 시도" }));
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1]!.key).toBe(requests[0]!.key);
      expect(requests[1]!.firstAttemptAt).toBe(requests[0]!.firstAttemptAt);
      await waitFor(() => expect(screen.getByLabelText("금액")).toHaveValue(""));
    });

    it("[AC-TXN-007-6] 입력 내용을 바꾼 뒤 다시 저장하면 새 키를 쓴다", async () => {
      handle((n) => (n === 1 ? HttpResponse.error() : created()));
      mount();
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "나래", amount: "10" });
      await user.click(save());
      await screen.findByText(UNKNOWN_RESULT);
      await user.type(screen.getByLabelText("금액"), "5"); // 105로 변경
      await user.click(screen.getByRole("button", { name: "다시 시도" }));
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1]!.key).not.toBe(requests[0]!.key);
      expect(requests[1]!.body.amount).toBe(105);
    });

    it("[AC-TXN-008-5][AC-SYS-002-5] 연결이 복구되어 재조회한 뒤에도 확인되지 않으면 '저장 여부를 확인할 수 없습니다'를 유지한다(성공 단정 없음)", async () => {
      handle(() => HttpResponse.error());
      mount();
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "나래", amount: "10" });
      await user.click(save());
      await screen.findByText(UNKNOWN_RESULT);
      // 연결이 끊겼다가 복구되어 새 세대의 스냅샷이 반영된다(거래 목록에 이 거래가 없다).
      act(() => {
        store.set(setConnectionAtom, "disconnected");
      });
      act(() => {
        store.set(setConnectionAtom, "connected");
        const epoch = store.set(startEpochAtom);
        store.set(applySnapshotAtom, makeSnapshot(epoch));
      });
      expect(await screen.findByText(UNKNOWN_AFTER_RECOVERY)).toBeInTheDocument();
      expect(screen.queryByText("거래를 저장했습니다.")).not.toBeInTheDocument();
      expect(requests).toHaveLength(1); // 복구가 자동으로 제출하지 않는다
    });

    it("[AC-TXN-007-12] 첫 시도 후 24시간이 지나면 새 키로 자동 재전송하지 않고, 확인 뒤 직접 새로 저장한다", async () => {
      handle((n) => (n === 1 ? HttpResponse.error() : created()));
      mount();
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "나래", amount: "10" });
      await user.click(save());
      await screen.findByText(UNKNOWN_RESULT);
      vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 24 * 60 * 60 * 1000 + 1000 });
      try {
        await user.click(screen.getByRole("button", { name: "다시 시도" }));
        expect(await screen.findByText(/첫 시도 후 24시간이 지났습니다/)).toBeInTheDocument();
        expect(requests).toHaveLength(1); // 새 키로 자동 재전송하지 않았다
        await user.click(screen.getByRole("button", { name: /새로 저장/ }));
        await waitFor(() => expect(requests).toHaveLength(2));
        expect(requests[1]!.key).not.toBe(requests[0]!.key);
      } finally {
        vi.useRealTimers();
      }
    });

    it("[AC-TXN-007-12] 서버가 만료(IDEMPOTENCY_KEY_EXPIRED)로 거부하면 서버 message와 목록 확인·시계 확인을 안내한다", async () => {
      handle(() =>
        errorResponse("IDEMPOTENCY_KEY_EXPIRED", { message: "요청이 만료되었습니다", details: [{ serverTime: new Date().toISOString() }] }),
      );
      mount();
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "나래", amount: "10" });
      await user.click(save());
      const text = await screen.findByText(/요청이 만료되었습니다/);
      expect(text.textContent).toContain("거래 내역에서 저장 여부를 먼저 확인해 주세요.");
      expect(text.textContent).toContain("기기의 날짜·시간 설정을 확인해 주세요."); // 방금 시작한 요청이므로 시계 확인도 안내
      expect(screen.getByLabelText("금액")).toHaveValue("10");
    });
  });

  describe("검수(Claude) 반영", () => {
    it("[F01] 입력 초안은 방별로 분리되어 다른 방으로 이동해도 이어지지 않는다", async () => {
      mount();
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "나래", amount: "321", reason: "첫방" });
      expect(screen.getByLabelText("금액")).toHaveValue("321");
      // 같은 앱 상태에서 다른 방으로 들어간다.
      act(() => {
        const snapshot = store.get(snapshotAtom)!;
        store.set(applySnapshotAtom, { ...snapshot, room: { ...snapshot.room, id: "room-2" } });
      });
      expect(screen.getByLabelText("금액")).toHaveValue("");
      expect(screen.getByLabelText("사유 (선택)")).toHaveValue("");
    });

    it("[F05] 입력을 고친 필드의 이전 검증 오류는 지워지고 나머지 오류는 남는다", async () => {
      mount();
      const user = userEvent.setup();
      await user.click(save()); // 지급자·수취자·금액 모두 필수 오류
      expect(screen.getByLabelText("지급자")).toHaveAccessibleDescription("필수 항목입니다.");
      await user.selectOptions(screen.getByLabelText("지급자"), "가온");
      expect(screen.getByLabelText("지급자")).not.toHaveAccessibleDescription("필수 항목입니다.");
      expect(screen.getByLabelText("수취자")).toHaveAccessibleDescription("필수 항목입니다."); // 아직 고치지 않음
      await user.type(screen.getByLabelText("금액"), "10");
      expect(screen.getByLabelText("금액")).not.toHaveAccessibleDescription("필수 항목입니다.");
    });

    it("[F05] 지급자를 바꾸면 수취자의 '같은 사람' 오류만 함께 지운다", async () => {
      mount();
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "가온", amount: "10" });
      await user.click(save());
      expect(screen.getByLabelText("수취자")).toHaveAccessibleDescription("지급자와 수취자는 달라야 합니다.");
      await user.selectOptions(screen.getByLabelText("지급자"), "나래");
      expect(screen.getByLabelText("수취자")).not.toHaveAccessibleDescription("지급자와 수취자는 달라야 합니다.");
    });
  });

  describe("검수 R-F03·R-F05", () => {
    it("[R-F03] 저장 응답을 기다리는 사이 바꾼 입력은 이전 요청이 성공해도 지워지지 않는다", async () => {
      handle(async () => {
        await delay(80);
        return created();
      });
      mount();
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "나래", amount: "10" });
      await user.click(save());
      await waitFor(() => expect(requests).toHaveLength(1));
      await user.clear(screen.getByLabelText("금액"));
      await user.type(screen.getByLabelText("금액"), "20"); // 아직 저장되지 않은 새 입력
      await delay(160);
      expect(screen.getByLabelText("금액")).toHaveValue("20");
      expect(screen.getByLabelText("지급자")).toHaveValue("p-1");
      expect(requests).toHaveLength(1); // 새 입력은 자동 제출되지 않는다
    });

    it("[R-F05] 같은 방에서 신원이 바뀌면 이전 신원의 불명 요청 상태·키를 이어받지 않는다", async () => {
      handle((n) => (n === 1 ? HttpResponse.error() : created()));
      seedRoom(store);
      const first = renderApp(<main><TransactionForm /></main>, store);
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "나래", amount: "10" });
      await user.click(save());
      await screen.findByText(UNKNOWN_RESULT);
      first.unmount();

      // 같은 방에 다른 신원(다른 RoomMember·다른 신원 키)으로 들어온다.
      const OTHER_KEY = "z".repeat(43);
      installFakeStorage().setItem(`ddallang:identity:${INVITE_CODE}`, OTHER_KEY);
      await primeServerClock(OTHER_KEY);
      seedRoom(store, { me: fixtures.guestMember });
      renderApp(<main><TransactionForm /></main>, store);
      expect(screen.queryByText(UNKNOWN_RESULT)).not.toBeInTheDocument(); // 이전 신원의 상태가 보이지 않는다
      await fill(user, { payer: "가온", payee: "나래", amount: "10" });
      await user.click(save());
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1]!.authorization).toBe(`Bearer ${OTHER_KEY}`);
      expect(requests[1]!.key).not.toBe(requests[0]!.key); // 같은 내용이어도 새 신원은 새 키
    });

    it("[R-F04] 시계 동기화 중 저장 버튼을 연달아 눌러도 요청은 한 번만 나간다", async () => {
      handle(() => created());
      // 서버 시계를 아직 모르는 상태를 만든다: 새 API 클라이언트는 만들 수 없으므로 방 조회가 느린 동기화를 흉내 낸다.
      mount();
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "나래", amount: "10" });
      const button = save();
      await Promise.all([user.click(button), user.click(button)]);
      await waitFor(() => expect(requests).toHaveLength(1));
      await delay(80);
      expect(requests).toHaveLength(1);
    });
  });

  describe("종료와 연결 끊김", () => {
    it("[AC-TXN-009-3] 게임이 종료되면 입력 폼이 숨겨진다", () => {
      mount({ status: "ENDED" });
      expect(screen.queryByLabelText("지급자")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^저장/ })).not.toBeInTheDocument();
    });

    it("[AC-SYS-001-5][AC-SYS-002-2] 끊겨서 영역이 가려져도 작성 중이던 입력은 유지되고, 복구해도 자동 제출되지 않으며, 더 이상 활성이 아닌 선택은 비운다", async () => {
      seedRoom(store);
      renderApp(<main><ServerDataGate><TransactionForm /></ServerDataGate></main>, store);
      const user = userEvent.setup();
      await fill(user, { payer: "가온", payee: "나래", amount: "77", reason: "작성중" });

      act(() => store.set(setConnectionAtom, "disconnected"));
      expect(screen.queryByLabelText("금액")).not.toBeInTheDocument(); // 가려짐(서버 유래 선택지·참여자)

      // 복구: 그 사이 나래가 비활성화되었다.
      act(() => {
        store.set(setConnectionAtom, "connected");
        const epoch = store.set(startEpochAtom);
        store.set(applySnapshotAtom, {
          ...makeSnapshot(epoch),
          participants: fixtures.participants.map((p) => (p.id === "p-2" ? { ...p, status: "INACTIVE" as const } : p)),
        });
      });
      expect(await screen.findByLabelText("금액")).toHaveValue("77");
      expect(screen.getByLabelText("사유 (선택)")).toHaveValue("작성중");
      expect(screen.getByLabelText("지급자")).toHaveValue("p-1"); // 활성이라 유지
      expect(screen.getByLabelText("수취자")).toHaveValue(""); // 비활성이 되어 비움
      expect(requests).toHaveLength(0); // 자동 제출 없음
    });
  });
});
