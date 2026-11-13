import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { InviteScreen } from "@/features/room/invite-screen";
import { AllPages } from "@/test/all-pages";
import { connectionAtom, sessionAtom, snapshotAtom } from "@/features/room/state";
import { transactionDraftsAtom } from "@/features/transactions/transaction-form";
import { installFakeLocks } from "@/test/fake-locks";
import { installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl, errorResponse } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { INVITE_CODE } from "@/test/room-seed";
import { createFakeBackend, type FakeBackend } from "@/test/stateful-server";
import { HIDDEN_GUIDANCE, INACCESSIBLE_MESSAGE, LIMIT_MESSAGE } from "./connection-banner";
import { connectionPhaseAtom } from "./state";

const KEY = "u".repeat(43);
let backend: FakeBackend;
let store: ReturnType<typeof createStore>;

const visible = () => store.get(connectionAtom) === "connected" && store.get(snapshotAtom) !== null;

beforeEach(() => {
  installFakeStorage().setItem(`ddallang:identity:${INVITE_CODE}`, KEY);
  installFakeLocks();
  backend = createFakeBackend();
  server.use(...backend.handlers);
  store = createStore();
});

function mount() {
  store.set(sessionAtom, { inviteCode: INVITE_CODE, roomId: fixtures.room.id, me: fixtures.hostMember });
  return renderApp(<InviteScreen inviteCode={INVITE_CODE}><AllPages /></InviteScreen>, store);
}

/** 서버 변경 컨트롤(거래 등록·수정·삭제·참여자 변경·종료)을 가리키는 버튼 이름. */
const MUTATION_CONTROLS = /^저장|수정|삭제|참여자 등록|비활성화|재활성화|게임 종료/;

describe("방 화면 연결 UI (FE-S5-4, 실제 연결 훅 통합)", () => {
  it("연결되어 데이터가 보이면 배너가 없고, 변경 컨트롤이 있다", async () => {
    mount();
    await waitFor(() => expect(visible()).toBe(true));
    await waitFor(() => expect(store.get(connectionPhaseAtom)).toBe("connected"));
    expect(document.querySelector("[data-connection-phase]")).toBeNull();
    expect(screen.getByRole("button", { name: "참여자 등록" })).toBeInTheDocument();
  });

  it("[AC-SYS-001-1][AC-SYS-001-2][AC-SYS-001-3][AC-SYS-001-4] 스트림이 끊기면 연결 끊김을 알리고 서버 유래 영역·변경 컨트롤이 모두 사라진다(이전 값·큐잉 없음)", async () => {
    mount();
    await waitFor(() => expect(visible()).toBe(true));
    expect(screen.getAllByText("가온").length).toBeGreaterThan(0);

    act(() => backend.stream!.error());
    await waitFor(() => expect(store.get(connectionAtom)).toBe("disconnected"));

    const banner = document.querySelector("[data-connection-phase]")!;
    expect(banner.textContent).toContain("연결 끊김");
    expect(banner.textContent).toContain(HIDDEN_GUIDANCE);
    // 손익·거래·정산·참여자·방 정보·게임 상태가 모두 가려진다(이전 값을 대신 보이지 않는다).
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByText(fixtures.room.name)).not.toBeInTheDocument();
    expect(screen.queryByText(/진행 중|게임 종료/)).not.toBeInTheDocument();
    // 변경 조작이 불가능하다.
    expect(screen.queryAllByRole("button", { name: MUTATION_CONTROLS })).toHaveLength(0);
    expect(document.querySelectorAll("form")).toHaveLength(0);
    // 구역 제목은 남지만 본문은 비어 있다.
    expect(screen.getByRole("heading", { name: "누적 손익" })).toBeInTheDocument();
  });

  it("[AC-SYS-001-5][AC-SYS-002-2] 끊김 중에도 작성 중이던 입력은 유지되고 복구해도 자동 제출되지 않는다", async () => {
    mount();
    await waitFor(() => expect(visible()).toBe(true));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("금액"), "4321");
    await user.type(screen.getByLabelText("사유 (선택)"), "작성중");

    act(() => backend.stream!.error());
    await waitFor(() => expect(store.get(connectionAtom)).toBe("disconnected"));
    expect(screen.queryByLabelText("금액")).not.toBeInTheDocument();
    const drafts = Object.values(store.get(transactionDraftsAtom));
    expect(drafts[0]).toMatchObject({ amount: "4321", reason: "작성중" }); // 메모리에 유지

    await waitFor(() => expect(visible()).toBe(true), { timeout: 4000 }); // 재연결
    expect(await screen.findByLabelText("금액")).toHaveValue("4321");
    expect(screen.getByLabelText("사유 (선택)")).toHaveValue("작성중");
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(backend.requests.room).toBeGreaterThan(0); // 재동기화는 했지만
    // 거래 생성 요청은 없다(이 시험의 서버에는 POST 처리기가 없어 요청이 나가면 기록 없이 실패하므로 입력이 그대로인지 본다).
    expect(screen.getByLabelText("금액")).toHaveValue("4321");
  }, 10_000);

  it("[AC-SYS-002-1] 복구하면 `최신 상태로 갱신됨`이 보이고 데이터가 다시 표시된다", async () => {
    mount();
    await waitFor(() => expect(visible()).toBe(true));
    act(() => backend.stream!.error());
    await waitFor(() => expect(store.get(connectionAtom)).toBe("disconnected"));
    await waitFor(() => expect(visible()).toBe(true), { timeout: 4000 });
    await waitFor(() => expect(store.get(connectionPhaseAtom)).toBe("recovered"));
    expect(screen.getByText("최신 상태로 갱신됨")).toBeInTheDocument();
    expect(screen.getAllByText("가온").length).toBeGreaterThan(0);
  }, 10_000);

  it("[AC-VIEW-005-6] 변경 알림에 토스트 같은 별도 알림을 만들지 않는다", async () => {
    mount();
    await waitFor(() => expect(visible()).toBe(true));
    await waitFor(() => expect(store.get(connectionPhaseAtom)).toBe("connected"));
    const before = document.body.textContent;
    backend.transactions = [{ ...backend.transactions[0]!, id: "t-new", amount: 4242 }, ...backend.transactions];
    backend.commit("transaction.created", { transactionId: "t-new" });
    await waitFor(() => expect(screen.getByText("4,242 원")).toBeInTheDocument());
    expect(screen.queryAllByRole("alert").map((a) => a.textContent).filter(Boolean)).toEqual([]);
    expect(document.body.textContent).not.toMatch(/새 거래|추가되었습니다|업데이트/);
    expect(document.body.textContent).not.toBe(before); // 값은 새로고침 없이 바뀌었다
  });

  it("연결 수 한도(429)이면 한도 안내를 보이고 데이터는 보이지 않는다", async () => {
    server.use(
      http.get(apiUrl(`/rooms/${fixtures.room.id}/events`), () =>
        errorResponse("CONNECTION_LIMIT_EXCEEDED", { headers: { "Retry-After": "30" } }),
      ),
    );
    mount();
    await waitFor(() => expect(store.get(connectionPhaseAtom)).toBe("limit"));
    expect(document.querySelector("[data-connection-phase]")!.textContent).toContain(LIMIT_MESSAGE);
    expect(store.get(snapshotAtom)).toBeNull();
  });

  it("401·404이면 접근 불가를 안내하고 재시도하지 않는다", async () => {
    let attempts = 0;
    server.use(
      http.get(apiUrl(`/rooms/${fixtures.room.id}/events`), () => {
        attempts += 1;
        return HttpResponse.json({ error: { code: "ROOM_NOT_FOUND", message: "방을 찾을 수 없습니다", details: [] } }, { status: 404 });
      }),
    );
    mount();
    await waitFor(() => expect(store.get(connectionPhaseAtom)).toBe("inaccessible"));
    expect(document.querySelector("[data-connection-phase]")!.textContent).toContain(INACCESSIBLE_MESSAGE);
    await new Promise((resolve) => setTimeout(resolve, 1300));
    expect(attempts).toBe(1);
  });
});
