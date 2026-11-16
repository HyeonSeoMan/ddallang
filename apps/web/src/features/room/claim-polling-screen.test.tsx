// 요청자 화면의 결과 수신(FE-M4): 대기 화면이 주기 조회로 결과를 받아 방 화면·결과 안내로 바뀐다(모의 서버).
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { AllPages } from "@/test/all-pages";
import { installFakeLocks } from "@/test/fake-locks";
import { installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { createFakeBackend, type FakeBackend } from "@/test/stateful-server";
import { InviteScreen } from "./invite-screen";
import { claimConfirmTitle, WAITING_TITLE } from "./messages";

const CODE = fixtures.INVITE_CODE;
const HOST = "h".repeat(43);
let backend: FakeBackend;
let polls: string[];

beforeEach(() => {
  installFakeStorage();
  installFakeLocks();
  backend = createFakeBackend();
  backend.identities.set(HOST, fixtures.hostParticipant.id);
  server.use(...backend.handlers);
  polls = [];
  server.events.removeAllListeners("request:start");
  server.events.on("request:start", ({ request }) => {
    if (request.method === "GET" && new URL(request.url).pathname.startsWith(`/invites/${CODE}/claims/`)) {
      polls.push(request.headers.get("Authorization") ?? "");
    }
  });
});

async function waitForApproval() {
  renderApp(
    <InviteScreen inviteCode={CODE}>
      <AllPages />
    </InviteScreen>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "기존 참여자 이어받기" }));
  await user.click(screen.getByRole("button", { name: "나래" }));
  await user.click(within(screen.getByRole("dialog", { name: claimConfirmTitle("나래") })).getByRole("button", { name: "요청" }));
  await screen.findByRole("heading", { name: WAITING_TITLE });
  return backend.claims[0]!.id;
}

const asHost = (path: string) => fetch(apiUrl(path), { method: "POST", headers: { Authorization: `Bearer ${HOST}` } });

describe("요청자 화면의 결과 수신 (FE-M4, S5 §6.8)", () => {
  it("[AC-VIEW-005-9] 방장이 승인하면 새로고침 없이 주기 조회로 알아채고 입장 요청으로 방 화면에 들어간다", async () => {
    const claimId = await waitForApproval();
    const eventsBefore = backend.eventRequests;
    expect((await asHost(`/rooms/${fixtures.room.id}/claims/${claimId}/approve`)).status).toBe(200);

    expect(await screen.findByRole("heading", { name: "누적 손익" }, { timeout: 4000 })).toBeInTheDocument();
    // 대기 중에는 스트림을 열지 않았고(방 비참여자), 주기 조회는 요청을 만든 키로 보냈다.
    expect(eventsBefore).toBe(0);
    expect(polls.length).toBeGreaterThan(0);
    expect(new Set(polls).size).toBe(1);
    expect(polls[0]).toBe(`Bearer ${[...backend.claimKeys.values()][0]}`);
    // 방 화면에 들어간 뒤에는 주기 조회를 멈춘다.
    const after = polls.length;
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(polls.length).toBe(after);
  });

  it("[AC-ROOM-009-7] 방장이 거절하면 결과를 안내하고 선택 화면으로 돌아간다", async () => {
    const claimId = await waitForApproval();
    expect((await asHost(`/rooms/${fixtures.room.id}/claims/${claimId}/reject`)).status).toBe(200);
    expect(await screen.findByText("방장이 이어받기 요청을 거절했습니다.", undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "새로 입장하기" })).toBeInTheDocument();
  });
});
