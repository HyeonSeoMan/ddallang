// 참여자·거래 화면 개정(FE-M6, FD-26·FD-27): 방장 행, 조회 전용 본인, REQUESTER_INACTIVE, 작성자 닉네임.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { ParticipantsSection } from "@/features/participants/participants-section";
import { InviteScreen } from "@/features/room/invite-screen";
import { RecordPage, SettlementPage, StatusPage } from "@/features/room/room-pages";
import { canMutateAtom, dataVisibleAtom, readOnlySelfAtom, setConnectionAtom } from "@/features/room/state";
import { expectNoA11yViolations } from "@/test/a11y";
import { AllPages } from "@/test/all-pages";
import { choiceNames, choose } from "@/test/choice";
import { primeServerClock } from "@/test/clock-prime";
import { installFakeLocks } from "@/test/fake-locks";
import { installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl, errorResponse } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { INVITE_CODE, seedRoom } from "@/test/room-seed";
import { createFakeBackend } from "@/test/stateful-server";
import { READ_ONLY_SELF_NOTICE } from "./messages";

const KEY = "s".repeat(43);
const inactiveMe = { ...fixtures.guestParticipant, status: "INACTIVE" as const };
const withMeInactive = fixtures.participants.map((p) => (p.id === inactiveMe.id ? inactiveMe : p));
let store: ReturnType<typeof createStore>;

beforeEach(() => {
  store = createStore();
  installFakeStorage().setItem(`ddallang:identity:${INVITE_CODE}`, KEY);
});

describe("방장 참여자 행 (FD-26, P-4)", () => {
  it("[AC-PART-002-10] 방장 자기 행에는 비활성화 컨트롤이 없고 방장 표시만 있다", async () => {
    seedRoom(store);
    const { container } = renderApp(<main><ParticipantsSection /></main>, store);
    const hostRow = screen.getByText(fixtures.hostParticipant.nickname).closest("li")!;
    expect(within(hostRow).getByText("방장")).toBeInTheDocument();
    expect(within(hostRow).queryByRole("button")).not.toBeInTheDocument();
    // 다른 참여자 행에는 그대로 있다.
    expect(screen.getByRole("button", { name: "나래 비활성화" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("[AC-PART-002-10] 서버가 HOST_CANNOT_BE_DEACTIVATED로 거부하면 서버 message를 그 행에 보인다", async () => {
    await primeServerClock(KEY);
    server.use(
      http.patch(apiUrl(`/rooms/${fixtures.room.id}/participants/:id`), () =>
        errorResponse("HOST_CANNOT_BE_DEACTIVATED", { message: "방장은 비활성화할 수 없습니다" }),
      ),
    );
    seedRoom(store);
    renderApp(<main><ParticipantsSection /></main>, store);
    await userEvent.click(screen.getByRole("button", { name: "나래 비활성화" }));
    expect(await screen.findByText("방장은 비활성화할 수 없습니다")).toBeInTheDocument();
  });
});

describe("조회 전용 본인 (FD-26, FE-C6)", () => {
  it("[AC-PART-002-11] 비활성 본인은 거래 입력 폼이 비활성화되고(입력값 유지) 안내 배너를 보며 수정·삭제 컨트롤이 없다", async () => {
    seedRoom(store, { me: fixtures.guestParticipant });
    const { container } = renderApp(<main><StatusPage /><RecordPage /></main>, store);
    const user = userEvent.setup();
    // 활성일 때 입력해 둔 값.
    await choose(user, screen, "지급자", "가온");
    await user.type(screen.getByLabelText("금액"), "300");
    expect(screen.getAllByRole("button", { name: /수정$/ }).length).toBeGreaterThan(0); // 자기 작성 거래(t-1)

    // 비활성화되어 다음 갱신이 반영되었다.
    act(() => {
      seedRoom(store, { me: inactiveMe, participants: withMeInactive });
    });
    expect(store.get(canMutateAtom)).toBe(false);
    expect(store.get(readOnlySelfAtom)).toBe(true);
    expect(screen.getByText(READ_ONLY_SELF_NOTICE)).toBeInTheDocument();
    expect(screen.getByLabelText("금액")).toBeDisabled();
    expect(screen.getByLabelText("금액")).toHaveValue("300"); // 입력값은 남는다
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    expect(within(screen.getByRole("group", { name: "지급자" })).getByRole("radio", { name: "가온" })).toBeChecked();
    expect(screen.queryByRole("button", { name: /수정$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /삭제$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "거래 기록하기" })).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("[AC-PART-002-12] 재활성화되면 다음 갱신에서 컨트롤이 돌아오고 남겨 둔 입력으로 저장할 수 있다", async () => {
    await primeServerClock(KEY);
    const bodies: unknown[] = [];
    server.use(
      http.post(apiUrl(`/rooms/${fixtures.room.id}/transactions`), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ transaction: { ...fixtures.transactions[1], id: "t-new" } }, { status: 201 });
      }),
    );
    seedRoom(store, { me: fixtures.guestParticipant });
    renderApp(<main><StatusPage /><RecordPage /></main>, store);
    const user = userEvent.setup();
    await choose(user, screen, "지급자", "가온");
    await choose(user, screen, "수취자", "나래");
    await user.type(screen.getByLabelText("금액"), "300");
    act(() => {
      seedRoom(store, { me: inactiveMe, participants: withMeInactive });
    });
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    // 비활성 상태에서는 나래가 선택지에서 빠진다(AC-PART-002-3). 다시 활성이 되면 돌아온다.
    expect(choiceNames(screen, "수취자")).not.toContain("나래");

    act(() => {
      seedRoom(store, { me: fixtures.guestParticipant });
    });
    expect(screen.queryByText(READ_ONLY_SELF_NOTICE)).not.toBeInTheDocument();
    expect(screen.getByLabelText("금액")).toBeEnabled();
    expect(screen.getAllByRole("button", { name: /수정$/ }).length).toBeGreaterThan(0);
    await choose(user, screen, "수취자", "나래");
    await user.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(bodies).toEqual([{ payerId: "p-1", payeeId: "p-2", amount: 300 }]));
  });

  it("[AC-SET-008-1] 비활성 본인도 예상 정산을 본다", () => {
    seedRoom(store, { me: inactiveMe, participants: withMeInactive });
    renderApp(<main><SettlementPage /></main>, store);
    expect(screen.getByRole("heading", { name: "예상 정산" })).toBeInTheDocument();
    expect(screen.getByText(/나래/)).toBeInTheDocument();
  });

  it("[AC-PART-002-11] REQUESTER_INACTIVE를 받으면 서버 message를 보이고 입력을 유지한 채 갱신을 요청해 조회 전용이 된다", async () => {
    installFakeLocks();
    const backend = createFakeBackend();
    backend.identities.set(KEY, fixtures.guestParticipant.id);
    server.use(...backend.handlers);
    // 서버에서는 이미 비활성이지만 이 화면은 아직 갱신 전이다(비활성화 이벤트를 놓쳤다).
    server.use(
      http.post(apiUrl(`/rooms/${fixtures.room.id}/transactions`), () => {
        backend.participants = backend.participants.map((p) => (p.id === inactiveMe.id ? inactiveMe : p));
        return errorResponse("REQUESTER_INACTIVE", { message: "비활성 참여자는 거래를 기록할 수 없습니다" });
      }),
    );
    const view = renderApp(
      <InviteScreen inviteCode={INVITE_CODE}>
        <AllPages />
      </InviteScreen>,
      store,
    );
    await waitFor(() => expect(store.get(dataVisibleAtom)).toBe(true));
    await primeServerClock(KEY);
    const user = userEvent.setup();
    await choose(user, screen, "지급자", "가온");
    await choose(user, screen, "수취자", "나래");
    await user.type(screen.getByLabelText("금액"), "500");
    // 거부 뒤의 갱신(방 조회)을 붙잡아 두어, 갱신이 오기 전에도 서버 message가 보이는지 확정적으로 본다(검수 N1·N2).
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let held = 0;
    server.use(
      http.get(apiUrl(`/rooms/${fixtures.room.id}`), async () => {
        held += 1;
        await gate;
        return HttpResponse.json({ room: backend.room, me: inactiveMe });
      }),
    );
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("비활성 참여자는 거래를 기록할 수 없습니다")).toBeInTheDocument();
    await waitFor(() => expect(held).toBeGreaterThan(0)); // 갱신을 요청했다
    await new Promise((resolve) => setTimeout(resolve, 100)); // 렌더·effect가 끝날 시간을 준다
    expect(screen.getByText("비활성 참여자는 거래를 기록할 수 없습니다")).toBeInTheDocument();
    expect(screen.getByLabelText("금액")).toBeEnabled(); // 아직 갱신 전
    server.resetHandlers(...backend.handlers);
    release();
    await waitFor(() => expect(screen.getByLabelText("금액")).toBeDisabled());
    expect(screen.getByLabelText("금액")).toHaveValue("500");
    expect(screen.getByText(READ_ONLY_SELF_NOTICE)).toBeInTheDocument();
    // 조회 전용으로 바뀐 뒤에도 서버 message는 남는다(검수 R4).
    expect(screen.getByText("비활성 참여자는 거래를 기록할 수 없습니다")).toBeInTheDocument();
    // 재활성화되면 그 안내는 지워지고 입력값은 남는다.
    backend.participants = backend.participants.map((p) => (p.id === inactiveMe.id ? fixtures.guestParticipant : p));
    backend.commit("participant.status_changed", { participantId: inactiveMe.id });
    await waitFor(() => expect(screen.getByLabelText("금액")).toBeEnabled());
    // 안내는 재활성화가 반영된 다음 렌더의 effect에서 지워진다.
    await waitFor(() => expect(screen.queryByText("비활성 참여자는 거래를 기록할 수 없습니다")).not.toBeInTheDocument());
    expect(screen.getByLabelText("금액")).toHaveValue("500");
    view.unmount();
  });

  it("끊긴 사이 재활성화돼도 재연결 뒤 비활성 거부 안내를 지운다(검수 P1)", async () => {
    await primeServerClock(KEY);
    server.use(
      http.post(apiUrl(`/rooms/${fixtures.room.id}/transactions`), () =>
        errorResponse("REQUESTER_INACTIVE", { message: "비활성 참여자는 거래를 기록할 수 없습니다" }),
      ),
    );
    seedRoom(store, { me: fixtures.guestParticipant });
    renderApp(<main><RecordPage /></main>, store);
    const user = userEvent.setup();
    await choose(user, screen, "지급자", "가온");
    await choose(user, screen, "수취자", "나래");
    await user.type(screen.getByLabelText("금액"), "500");
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText("비활성 참여자는 거래를 기록할 수 없습니다")).toBeInTheDocument();
    act(() => {
      seedRoom(store, { me: inactiveMe, participants: withMeInactive }); // 갱신: 조회 전용
    });
    act(() => {
      store.set(setConnectionAtom, "disconnected"); // 끊김
    });
    act(() => {
      seedRoom(store, { me: fixtures.guestParticipant }); // 재연결: 그 사이 재활성화됨
    });
    await waitFor(() => expect(screen.queryByText("비활성 참여자는 거래를 기록할 수 없습니다")).not.toBeInTheDocument());
    expect(screen.getByLabelText("금액")).toHaveValue("500");
  });

  it("[AC-VIEW-005-3] 방장이 나를 비활성화하면 변경 알림 뒤 갱신으로 내 거래 컨트롤이 잠기고, 재활성화하면 돌아온다(모의)", async () => {
    installFakeLocks();
    const backend = createFakeBackend();
    backend.identities.set(KEY, fixtures.guestParticipant.id);
    server.use(...backend.handlers);
    renderApp(
      <InviteScreen inviteCode={INVITE_CODE}>
        <AllPages />
      </InviteScreen>,
      store,
    );
    await waitFor(() => expect(store.get(canMutateAtom)).toBe(true));
    const setStatus = async (status: "ACTIVE" | "INACTIVE") => {
      backend.participants = backend.participants.map((p) => (p.id === inactiveMe.id ? { ...p, status } : p));
      backend.commit("participant.status_changed", { participantId: inactiveMe.id });
    };
    await setStatus("INACTIVE");
    await waitFor(() => expect(store.get(readOnlySelfAtom)).toBe(true));
    expect(screen.getByLabelText("금액")).toBeDisabled();
    await setStatus("ACTIVE");
    await waitFor(() => expect(store.get(canMutateAtom)).toBe(true));
    expect(screen.getByLabelText("금액")).toBeEnabled();
  });
});

describe("거래 행의 작성자 닉네임 (FD-27, S3 §9)", () => {
  it("작성자 닉네임을 같은 갱신 주기의 참여자에서 찾아 보이고, 목록에 없는 작성자 ID는 비운다", () => {
    seedRoom(store, {
      participants: fixtures.participants.filter((p) => p.id !== fixtures.guestParticipant.id),
    });
    renderApp(<main><StatusPage /></main>, store);
    const rows = screen.getAllByRole("listitem").filter((li) => li.textContent?.includes("→"));
    // t-2는 방장(가온)이 작성, t-1은 목록에서 빠진 나래가 작성.
    expect(rows[0]).toHaveTextContent(`작성자 ${fixtures.hostParticipant.nickname}`);
    expect(rows[1]).not.toHaveTextContent("작성자");
  });
});
