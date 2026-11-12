import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshRequestAtom } from "@/features/realtime/state";
import { applySnapshotAtom, setConnectionAtom, snapshotAtom, startEpochAtom } from "@/features/room/state";
import type { RoomMember } from "@/lib/api";
import { expectNoA11yViolations } from "@/test/a11y";
import { primeServerClock } from "@/test/clock-prime";
import { installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl, errorResponse } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { INVITE_CODE, makeSnapshot, seedRoom } from "@/test/room-seed";
import { END_BODY, END_TITLE, EndGame } from "./end-game";

const KEY = "e".repeat(43);
const endPath = `/rooms/${fixtures.room.id}/end`;

interface Seen {
  key: string | null;
  firstAttemptAt: string | null;
  authorization: string | null;
  body: string;
}
let seen: Seen[];
let store: ReturnType<typeof createStore>;

function handle(respond: (n: number) => Response | Promise<Response>) {
  server.use(
    http.post(apiUrl(endPath), async ({ request }) => {
      seen.push({
        key: request.headers.get("Idempotency-Key"),
        firstAttemptAt: request.headers.get("Idempotency-First-Attempt-At"),
        authorization: request.headers.get("Authorization"),
        body: await request.text(),
      });
      return respond(seen.length);
    }),
  );
}
const ended = () => HttpResponse.json({ roomId: fixtures.room.id, status: "ENDED" });

beforeEach(async () => {
  seen = [];
  store = createStore();
  installFakeStorage().setItem(`ddallang:identity:${INVITE_CODE}`, KEY);
  await primeServerClock(KEY);
});

function mount(options: { me?: RoomMember; status?: "IN_PROGRESS" | "ENDED" } = {}) {
  seedRoom(store, { me: options.me ?? fixtures.hostMember, status: options.status });
  return renderApp(<main><EndGame /></main>, store);
}
const openDialog = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "게임 종료" }));
const confirm = () => screen.getByRole("dialog").querySelector("button:last-of-type") as HTMLButtonElement;

describe("게임 종료 흐름 (FE-S4-1)", () => {
  describe("노출", () => {
    it("방장에게만, 진행 중일 때만 종료 컨트롤이 보인다", () => {
      const host = mount();
      expect(screen.getByRole("button", { name: "게임 종료" })).toBeInTheDocument();
      host.unmount();

      store = createStore();
      const guest = mount({ me: fixtures.guestMember });
      expect(screen.queryByRole("button", { name: "게임 종료" })).not.toBeInTheDocument(); // 비방장
      guest.unmount();

      store = createStore();
      mount({ status: "ENDED" });
      expect(screen.queryByRole("button", { name: "게임 종료" })).not.toBeInTheDocument(); // 이미 종료
    });

    it("접근성 검사를 통과한다", async () => {
      const { container } = mount();
      await expectNoA11yViolations(container);
    });
  });

  describe("확인 절차", () => {
    it("[AC-SET-001-1] 누르면 확인 창이 뜨고(되돌릴 수 없음·잠김 안내, 기본 포커스 취소) 확인 전에는 요청이 없다", async () => {
      handle(() => ended());
      mount();
      const user = userEvent.setup();
      await openDialog(user);
      const dialog = screen.getByRole("dialog", { name: END_TITLE });
      expect(dialog).toHaveAccessibleDescription(END_BODY);
      expect(END_BODY).toContain("되돌릴 수 없습니다");
      expect(END_BODY).toContain("거래와 참여자를 바꿀 수 없고");
      expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(seen).toHaveLength(0);
    });

    it("[AC-SET-001-1] 취소·Esc는 요청 0회이고 상태가 바뀌지 않는다", async () => {
      handle(() => ended());
      mount();
      const user = userEvent.setup();
      await openDialog(user);
      await user.click(screen.getByRole("button", { name: "취소" }));
      await openDialog(user);
      await user.keyboard("{Escape}");
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(seen).toHaveLength(0);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(store.get(snapshotAtom)?.room.status).toBe("IN_PROGRESS");
    });
  });

  describe("요청과 결과", () => {
    it("확인하면 본문 없이 POST /end를 신원 키·Idempotency 헤더와 함께 보내고, 200이면 재동기화를 요청한다(상태는 응답이 아니라 재조회가 기준)", async () => {
      handle(() => ended());
      mount();
      const user = userEvent.setup();
      await openDialog(user);
      const before = store.get(refreshRequestAtom);
      await user.click(confirm());
      await waitFor(() => expect(seen).toHaveLength(1));
      expect(seen[0]!.body).toBe("");
      expect(seen[0]!.authorization).toBe(`Bearer ${KEY}`);
      expect(seen[0]!.key).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(seen[0]!.firstAttemptAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      await waitFor(() => expect(store.get(refreshRequestAtom)).toBe(before + 1));
      expect(store.get(snapshotAtom)?.room.status).toBe("IN_PROGRESS"); // 200만으로 로컬 상태를 바꾸지 않는다
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("진행 중에는 컨트롤이 비활성화되어 중복 요청하지 않는다", async () => {
      handle(async () => {
        await delay(80);
        return ended();
      });
      mount();
      const user = userEvent.setup();
      await openDialog(user);
      await Promise.all([user.click(confirm()), user.click(confirm())]);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await delay(120);
      expect(seen).toHaveLength(1);
    });

    it("GAME_ENDED는 서버 message를 보이고 재동기화를 요청하며, 방이 ENDED가 되어 컨트롤이 사라져도 메시지가 남는다", async () => {
      handle(() => errorResponse("GAME_ENDED", { message: "이미 종료된 게임입니다" }));
      mount();
      const user = userEvent.setup();
      await openDialog(user);
      const before = store.get(refreshRequestAtom);
      await user.click(confirm());
      expect(await screen.findByText("이미 종료된 게임입니다")).toBeInTheDocument();
      expect(store.get(refreshRequestAtom)).toBe(before + 1);
      // 재동기화로 방이 ENDED가 되었다.
      act(() => {
        const epoch = store.get(snapshotAtom)!.epoch;
        store.set(applySnapshotAtom, { ...makeSnapshot(epoch, { status: "ENDED" }) });
      });
      expect(screen.queryByRole("button", { name: "게임 종료" })).not.toBeInTheDocument();
      expect(screen.getByText("이미 종료된 게임입니다")).toBeInTheDocument();
    });
  });

  describe("결과 불명 (S2 §9와 같은 원칙)", () => {
    it("응답이 없으면 종료됐다고 단정하지 않고 같은 키·같은 최초 시도 시각으로 수동 재시도한다(자동 재전송 없음)", async () => {
      handle((n) => (n === 1 ? HttpResponse.error() : ended()));
      mount();
      const user = userEvent.setup();
      await openDialog(user);
      await user.click(confirm());
      expect(await screen.findByText(/게임이 종료되었는지 단정할 수 없습니다/)).toBeInTheDocument();
      expect(screen.queryByText("게임을 종료했습니다.")).not.toBeInTheDocument();
      expect(store.get(snapshotAtom)?.room.status).toBe("IN_PROGRESS");
      await delay(80);
      expect(seen).toHaveLength(1); // 자동 재전송 없음
      await user.click(screen.getByRole("button", { name: "다시 시도" }));
      await waitFor(() => expect(seen).toHaveLength(2));
      expect(seen[1]!.key).toBe(seen[0]!.key);
      expect(seen[1]!.firstAttemptAt).toBe(seen[0]!.firstAttemptAt);
    });

    it("연결이 복구된 뒤에도 확인되지 않으면 '종료 여부를 확인할 수 없습니다'를 유지한다", async () => {
      handle(() => HttpResponse.error());
      mount();
      const user = userEvent.setup();
      await openDialog(user);
      await user.click(confirm());
      await screen.findByText(/게임이 종료되었는지 단정할 수 없습니다/);
      act(() => store.set(setConnectionAtom, "disconnected"));
      act(() => {
        store.set(setConnectionAtom, "connected");
        const epoch = store.set(startEpochAtom);
        store.set(applySnapshotAtom, makeSnapshot(epoch)); // 재조회했지만 여전히 진행 중
      });
      expect(await screen.findByText("종료 여부를 확인할 수 없습니다. 방 상태를 확인해 주세요.")).toBeInTheDocument();
      expect(seen).toHaveLength(1); // 복구가 자동으로 종료를 다시 보내지 않는다
    });

    it("IDEMPOTENCY_KEY_EXPIRED는 서버 message를 그대로 보이고 방의 현재 상태를 확인하게 한다", async () => {
      handle(() =>
        errorResponse("IDEMPOTENCY_KEY_EXPIRED", { message: "요청이 만료되었습니다", details: [{ serverTime: new Date().toISOString() }] }),
      );
      mount();
      const user = userEvent.setup();
      await openDialog(user);
      await user.click(confirm());
      const text = await screen.findByText(/요청이 만료되었습니다/);
      expect(text.textContent).toContain("방의 현재 상태를 먼저 확인해 주세요.");
      expect(text.textContent).not.toContain("거래 내역"); // 거래가 아니라 방 상태를 확인하게 한다
    });

    it("첫 시도 후 24시간이 지나면 자동 재전송하지 않고, 확인 절차를 새로 거칠 때만 새 키로 보낸다", async () => {
      handle((n) => (n === 1 ? HttpResponse.error() : ended()));
      mount();
      const user = userEvent.setup();
      await openDialog(user);
      await user.click(confirm());
      await screen.findByText(/단정할 수 없습니다/);
      vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 24 * 60 * 60 * 1000 + 1000 });
      try {
        await user.click(screen.getByRole("button", { name: "다시 시도" }));
        expect(await screen.findByText(/첫 시도 후 24시간이 지났습니다/)).toBeInTheDocument();
        expect(seen).toHaveLength(1); // 새 키로 자동 재전송하지 않았다
        // 새 시도도 확인 대화상자를 거친다: 열기만 해서는, 취소·Esc로는 요청이 가지 않는다.
        await user.click(screen.getByRole("button", { name: /다시 종료/ }));
        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).getByRole("button", { name: "취소" })).toHaveFocus();
        expect(seen).toHaveLength(1);
        await user.keyboard("{Escape}");
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(seen).toHaveLength(1);
        await user.click(screen.getByRole("button", { name: /다시 종료/ }));
        await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "게임 종료" }));
        await waitFor(() => expect(seen).toHaveLength(2));
        expect(seen[1]!.key).not.toBe(seen[0]!.key);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
