// 방장의 이어받기 요청 구역·방 탭 배지(FE-M5, FD-24·FD-25).
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { InviteScreen } from "@/features/room/invite-screen";
import { dataVisibleAtom, setConnectionAtom } from "@/features/room/state";
import { expectNoA11yViolations } from "@/test/a11y";
import { AllPages } from "@/test/all-pages";
import { installFakeLocks } from "@/test/fake-locks";
import { installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl, errorResponse } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { createFakeBackend, type FakeBackend } from "@/test/stateful-server";
import { createStore } from "jotai";
import { APPROVE_BODY, approveTitle, CLAIM_REQUESTS_TITLE, claimRowTitle, duplicateNotice, pendingBadgeLabel } from "./messages";

const CODE = fixtures.INVITE_CODE;
const ME = "m".repeat(43);
let backend: FakeBackend;

beforeEach(() => {
  const storage = installFakeStorage();
  installFakeLocks();
  backend = createFakeBackend();
  server.use(...backend.handlers);
  storage.setItem(`ddallang:identity:${CODE}`, ME);
});

/** 이 브라우저(ME)가 `participantId`로 들어와 있는 방 화면을 연다. */
async function openRoomAs(participantId: string) {
  backend.identities.set(ME, participantId);
  const store = createStore();
  const view = renderApp(
    <InviteScreen inviteCode={CODE}>
      <AllPages />
    </InviteScreen>,
    store,
  );
  // 구역 제목은 연결 전에도 보이므로 첫 스냅샷이 반영될 때까지 기다린다.
  await waitFor(() => expect(store.get(dataVisibleAtom)).toBe(true));
  return { ...view, store };
}

/** 다른 브라우저가 이어받기를 요청한다(서버가 `claim.created`를 보낸다). */
async function requestFromAnotherBrowser(nickname: string, key: string) {
  const response = await fetch(apiUrl(`/invites/${CODE}/claims`), {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
  return ((await response.json()) as { claim: { id: string } }).claim.id;
}

const section = () => screen.queryByRole("region", { name: CLAIM_REQUESTS_TITLE });

describe("방장의 이어받기 요청 구역 (FE-M5)", () => {
  it("[AC-VIEW-005-9] [AC-ROOM-009-4] 새 요청은 claim.created 뒤 갱신으로 대상 닉네임과 승인·거절 컨트롤로 나타나고, 취소되면 사라진다", async () => {
    const { container } = await openRoomAs(fixtures.hostParticipant.id);
    expect(section()).not.toBeInTheDocument(); // 대기 요청이 없으면 구역을 숨긴다

    const claimId = await requestFromAnotherBrowser("나래", "a".repeat(43));
    const region = await screen.findByRole("region", { name: CLAIM_REQUESTS_TITLE });
    expect(within(region).getByText(claimRowTitle("나래"))).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "나래 이어받기 승인" })).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "나래 이어받기 거절" })).toBeInTheDocument();
    // 참여자 구역보다 위에 있다.
    const sections = [...container.querySelectorAll("section[data-section]")].map((s) => s.getAttribute("data-section"));
    expect(sections.indexOf("claims")).toBeLessThan(sections.indexOf("participants"));
    await expectNoA11yViolations(container);

    await fetch(apiUrl(`/invites/${CODE}/claims/${claimId}/cancel`), {
      method: "POST",
      headers: { Authorization: `Bearer ${"a".repeat(43)}` },
    });
    await waitFor(() => expect(section()).not.toBeInTheDocument());
  });

  it("[AC-ROOM-009-4] 같은 참여자에 요청이 둘 이상이면 하나만 승인할 수 있음을 알린다", async () => {
    await openRoomAs(fixtures.hostParticipant.id);
    await requestFromAnotherBrowser("다온", "a".repeat(43));
    await requestFromAnotherBrowser("다온", "b".repeat(43));
    const region = await screen.findByRole("region", { name: CLAIM_REQUESTS_TITLE });
    await waitFor(() => expect(within(region).getAllByText(claimRowTitle("다온"))).toHaveLength(2));
    expect(within(region).getByText(new RegExp(duplicateNotice(2)))).toBeInTheDocument();
  });

  it("승인은 확인 대화상자를 거쳐 보내고, 거절은 확인 없이 보낸다", async () => {
    await openRoomAs(fixtures.hostParticipant.id);
    await requestFromAnotherBrowser("나래", "a".repeat(43));
    await requestFromAnotherBrowser("다온", "b".repeat(43));
    const region = await screen.findByRole("region", { name: CLAIM_REQUESTS_TITLE });
    await waitFor(() => expect(within(region).getAllByRole("listitem")).toHaveLength(2));
    const user = userEvent.setup();

    await user.click(within(region).getByRole("button", { name: "다온 이어받기 거절" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(backend.claims.find((c) => c.nickname === "다온")!.status).toBe("REJECTED"));

    await user.click(within(region).getByRole("button", { name: "나래 이어받기 승인" }));
    const dialog = screen.getByRole("dialog", { name: approveTitle("나래") });
    expect(dialog).toHaveAccessibleDescription(APPROVE_BODY);
    expect(within(dialog).getByRole("button", { name: "취소" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(backend.claims.find((c) => c.nickname === "나래")!.status).toBe("PENDING");

    await user.click(within(region).getByRole("button", { name: "나래 이어받기 승인" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "승인" }));
    await waitFor(() => expect(backend.claims.find((c) => c.nickname === "나래")!.status).toBe("APPROVED"));
    await waitFor(() => expect(section()).not.toBeInTheDocument());
  });

  it("[AC-ROOM-004-5] 이미 처리된 요청(CLAIM_ALREADY_RESOLVED)은 단건 조회로 현재 상태와 처리한 방장 닉네임을 안내한다", async () => {
    await openRoomAs(fixtures.hostParticipant.id);
    const claimId = await requestFromAnotherBrowser("나래", "a".repeat(43));
    const region = await screen.findByRole("region", { name: CLAIM_REQUESTS_TITLE });
    // 다른 방장 탭이 먼저 거절했다(이 화면은 아직 갱신 전).
    server.use(
      http.post(apiUrl(`/rooms/${fixtures.room.id}/claims/${claimId}/reject`), () =>
        errorResponse("CLAIM_ALREADY_RESOLVED", { message: "이미 처리된 요청입니다" }),
      ),
    );
    Object.assign(backend.claims[0]!, { status: "REJECTED", rejectReason: "HOST_REJECTED", resolvedById: fixtures.hostParticipant.id });
    await userEvent.click(within(region).getByRole("button", { name: "나래 이어받기 거절" }));
    expect(await screen.findByText(`이미 처리된 요청입니다. 현재 상태: 거절됨 처리: ${fixtures.hostParticipant.nickname}`)).toBeInTheDocument();
    // 대기 요청이 없어져도 안내는 남고, 닫으면 구역이 사라진다(검수 R5).
    await waitFor(() => expect(within(region).queryAllByRole("listitem")).toHaveLength(0));
    await userEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    expect(section()).not.toBeInTheDocument();
  });

  it("승인 응답을 받지 못하면(결과 불명) 단건 조회로 현재 상태를 안내하고 승인됐다고 단정하지 않는다", async () => {
    await openRoomAs(fixtures.hostParticipant.id);
    await requestFromAnotherBrowser("나래", "a".repeat(43));
    const region = await screen.findByRole("region", { name: CLAIM_REQUESTS_TITLE });
    backend.dropResponseOnce.add("approveClaim");
    const user = userEvent.setup();
    await user.click(within(region).getByRole("button", { name: "나래 이어받기 승인" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "승인" }));
    expect(
      await screen.findByText(`이미 처리된 요청입니다. 현재 상태: 승인됨 처리: ${fixtures.hostParticipant.nickname}`),
    ).toBeInTheDocument();
    expect(screen.queryByText("이어받기를 승인했습니다.", { selector: "[role=status] *" })).not.toBeInTheDocument();
  });

  it("[AC-PART-004-3] 게임이 종료되어도 이어받기 요청 컨트롤은 남는다", async () => {
    backend.room = { ...backend.room, status: "ENDED" };
    backend.settlement = { ...backend.settlement, kind: "FINAL" };
    await openRoomAs(fixtures.hostParticipant.id);
    await requestFromAnotherBrowser("나래", "a".repeat(43));
    const region = await screen.findByRole("region", { name: CLAIM_REQUESTS_TITLE });
    expect(within(region).getByRole("button", { name: "나래 이어받기 승인" })).toBeEnabled();
    expect(within(region).getByRole("button", { name: "나래 이어받기 거절" })).toBeEnabled();
  });

  it("비방장은 대기 목록을 조회하지 않고 구역·배지가 없다", async () => {
    await openRoomAs(fixtures.guestParticipant.id);
    await requestFromAnotherBrowser("다온", "a".repeat(43));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(backend.requests.claims).toBe(0);
    expect(section()).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "방" })).toBeInTheDocument();
  });

  it("방 탭에 대기 건수 배지를 붙이고(접근 가능한 이름 포함) 끊김 중에는 숨긴다. 새 요청은 알림 영역으로 읽어 준다", async () => {
    const { store } = await openRoomAs(fixtures.hostParticipant.id);
    await requestFromAnotherBrowser("나래", "a".repeat(43));
    const tab = await screen.findByRole("link", { name: new RegExp(pendingBadgeLabel(1)) });
    expect(tab).toHaveAccessibleName(`방 ${pendingBadgeLabel(1)}`);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("이어받기 요청이 왔습니다."));
    await requestFromAnotherBrowser("다온", "b".repeat(43));
    expect(await screen.findByRole("link", { name: `방 ${pendingBadgeLabel(2)}` })).toBeInTheDocument();

    act(() => store.set(setConnectionAtom, "disconnected"));
    // 끊김 중에는 배지가 없다: 탭의 접근 가능한 이름이 그냥 `방`이고 숫자 배지 요소도 없다(검수 R1).
    const roomTab = screen.getByRole("link", { name: "방" });
    expect(roomTab).toHaveAccessibleName("방");
    expect(roomTab.querySelector("[aria-hidden=true]")).toBeNull();
    expect(section()).not.toBeInTheDocument();
  });

  it("6개 중 대기 목록 조회가 실패하면 그 갱신은 반영하지 않는다", async () => {
    await openRoomAs(fixtures.hostParticipant.id);
    server.use(http.get(apiUrl(`/rooms/${fixtures.room.id}/claims`), () => new HttpResponse(null, { status: 503 })));
    await requestFromAnotherBrowser("나래", "a".repeat(43));
    // 갱신 실패 → 끊김 처리(데이터 영역 숨김). 요청 행이 부분 반영되지 않는다.
    await waitFor(() => expect(screen.queryByRole("heading", { name: "누적 손익" })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/연결 끊김/)).toBeInTheDocument());
    expect(section()).not.toBeInTheDocument();
  });
});
