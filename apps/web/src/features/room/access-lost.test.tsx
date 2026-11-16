// 접근 상실 처리(FE-M2, FD-20·FD-21): REST·스트림·초대 조회 세 입구가 같은 처리기로 간다.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { snapshotAtom } from "@/features/room/state";
import { AllPages } from "@/test/all-pages";
import { installFakeLocks } from "@/test/fake-locks";
import { type FakeStorage, installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl, errorResponse } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { primeServerClock } from "@/test/clock-prime";
import { renderApp } from "@/test/render";
import { createFakeBackend, type FakeBackend } from "@/test/stateful-server";
import { InviteScreen } from "./invite-screen";
import { ACCESS_LOST_NEXT_ENDED, ACCESS_LOST_NEXT_IN_PROGRESS, ACCESS_LOST_NOTICE } from "./messages";
import { sessionAtom } from "./state";

const CODE = fixtures.INVITE_CODE;
const STORAGE_NAME = `ddallang:identity:${CODE}`;
const OLD = "o".repeat(43);
const NEW = "n".repeat(43);
const HOST = "h".repeat(43);

let storage: FakeStorage;
let backend: FakeBackend;

beforeEach(() => {
  storage = installFakeStorage();
  installFakeLocks();
  backend = createFakeBackend();
  server.use(...backend.handlers);
});

const post = (path: string, key: string, body?: unknown) =>
  fetch(apiUrl(path), {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/** 다른 브라우저(NEW)가 `대상`을 이어받기 요청하고 방장(HOST)이 승인한다. */
async function approveClaimFromAnotherBrowser(nickname: string) {
  const created = (await (await post(`/invites/${CODE}/claims`, NEW, { nickname })).json()) as { claim: { id: string } };
  const approved = await post(`/rooms/${fixtures.room.id}/claims/${created.claim.id}/approve`, HOST);
  expect(approved.status).toBe(200);
}

/** 이 브라우저(OLD)가 `participantId`로 이미 들어와 있는 방 화면을 연다. */
async function openRoomAs(participantId: string) {
  backend.identities.set(OLD, participantId);
  backend.identities.set(HOST, fixtures.hostParticipant.id);
  storage.setItem(STORAGE_NAME, OLD);
  const store = createStore();
  const view = renderApp(
    <InviteScreen inviteCode={CODE}>
      <AllPages />
    </InviteScreen>,
    store,
  );
  expect(await screen.findByRole("heading", { name: "누적 손익" })).toBeInTheDocument();
  return { ...view, store };
}

async function expectAccessLostScreen(next: string) {
  const banner = await screen.findByText(new RegExp(ACCESS_LOST_NOTICE));
  expect(banner).toHaveTextContent(next);
  // 신원 없음 상태의 초대 화면(새로 입장 입력)으로 돌아왔고 방 화면은 닫혔다.
  expect(await screen.findByLabelText("닉네임")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "누적 손익" })).not.toBeInTheDocument();
}

describe("접근 상실 처리 (FE-M2)", () => {
  it("[AC-VIEW-005-9] 스트림의 access.revoked: 방 화면을 닫고 키를 지우고 안내하며 다시 연결하지 않는다", async () => {
    const { store } = await openRoomAs(fixtures.guestParticipant.id);
    const eventsBefore = backend.eventRequests;

    await approveClaimFromAnotherBrowser(fixtures.guestParticipant.nickname);

    await expectAccessLostScreen(ACCESS_LOST_NEXT_IN_PROGRESS);
    expect(storage.getItem(STORAGE_NAME)).toBeNull();
    expect(store.get(sessionAtom)).toBeNull();
    expect(store.get(snapshotAtom)).toBeNull();
    // 재연결하지 않는다(S5 §6.3 5): 이전 키로 스트림을 다시 열지 않는다.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(backend.eventRequests).toBe(eventsBefore);
    // 다시 조회한 초대 화면은 키 없이 신원 없음이다.
    expect(screen.getAllByText(ACCESS_LOST_NOTICE, { exact: false })).toHaveLength(1);
  });

  it("[AC-ROOM-009-5] REST 변경 요청의 401 IDENTITY_REVOKED도 같은 처리기로 간다(이벤트를 놓친 경우)", async () => {
    await openRoomAs(fixtures.hostParticipant.id);
    await primeServerClock(OLD); // 변경 요청 매니저가 요청을 보내려면 서버 시계 차이를 알아야 한다
    // 승인 이벤트가 유실된 상황: 서버에서만 이 키가 접근을 잃었다.
    backend.identities.delete(OLD);
    backend.revokedKeys.add(OLD);
    const ends: number[] = [];
    server.events.on("response:mocked", ({ request, response }) => {
      if (request.method === "POST" && request.url.endsWith("/end")) ends.push(response.status);
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "게임 종료" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "게임 종료" }));

    await expectAccessLostScreen(ACCESS_LOST_NEXT_IN_PROGRESS);
    expect(ends).toEqual([401]); // 종료 요청 자체가 401 IDENTITY_REVOKED를 받았다
    expect(storage.getItem(STORAGE_NAME)).toBeNull();
    expect(backend.room.status).toBe("IN_PROGRESS"); // 거부된 요청은 아무것도 바꾸지 않았다
  });

  it("[AC-ROOM-005-8] 초대 조회의 identity=REVOKED: 키를 지우고 안내한 뒤 신원 없음 화면을 보인다", async () => {
    backend.revokedKeys.add(OLD);
    storage.setItem(STORAGE_NAME, OLD);
    renderApp(
      <InviteScreen inviteCode={CODE}>
        <AllPages />
      </InviteScreen>,
    );
    await expectAccessLostScreen(ACCESS_LOST_NEXT_IN_PROGRESS);
    await waitFor(() => expect(storage.getItem(STORAGE_NAME)).toBeNull());
  });

  it("종료된 방의 접근 상실 안내는 이어받기만 권한다", async () => {
    backend.revokedKeys.add(OLD);
    backend.room = { ...backend.room, status: "ENDED" };
    storage.setItem(STORAGE_NAME, OLD);
    renderApp(<InviteScreen inviteCode={CODE} />);
    const banner = await screen.findByText(new RegExp(ACCESS_LOST_NOTICE));
    expect(banner).toHaveTextContent(ACCESS_LOST_NEXT_ENDED);
    expect(banner).not.toHaveTextContent(ACCESS_LOST_NEXT_IN_PROGRESS);
  });

  it("[AC-ROOM-005-8] 두 탭: 다른 탭이 새 키를 만든 뒤 도착한 이전 키의 401은 새 키를 지우지 않는다", async () => {
    await openRoomAs(fixtures.hostParticipant.id);
    await primeServerClock(OLD);
    // 이전 키(OLD)로 보낸 종료 요청의 응답을 붙잡아 두었다가, 다른 탭이 새 키를 만든 뒤 401을 돌려준다.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const used: Array<string | null> = [];
    server.use(
      http.post(apiUrl(`/rooms/${fixtures.room.id}/end`), async ({ request }) => {
        used.push(request.headers.get("Authorization"));
        await gate;
        return errorResponse("IDENTITY_REVOKED");
      }),
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "게임 종료" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "게임 종료" }));
    await waitFor(() => expect(used).toEqual([`Bearer ${OLD}`]));
    storage.setItem(STORAGE_NAME, NEW); // 다른 탭: 이전 키를 지우고 새 키를 만들었다
    release();

    await expectAccessLostScreen(ACCESS_LOST_NEXT_IN_PROGRESS);
    expect(storage.getItem(STORAGE_NAME)).toBe(NEW);
  });

  it("다른 401·404는 접근 상실이 아니라 기존 접근 불가 안내다", async () => {
    await openRoomAs(fixtures.hostParticipant.id);
    // 키가 이 방에서 연결되지 않은 것처럼 서버가 방 조회를 404 ROOM_NOT_FOUND로 거부한다.
    server.use(http.get(apiUrl(`/rooms/${fixtures.room.id}`), () => errorResponse("ROOM_NOT_FOUND")));
    backend.commit("participant.created", { participantId: "p-x" });
    expect(await screen.findByText("연결할 수 없음")).toBeInTheDocument();
    expect(screen.queryByText(ACCESS_LOST_NOTICE, { exact: false })).not.toBeInTheDocument();
    expect(storage.getItem(STORAGE_NAME)).toBe(OLD);
  });
});
