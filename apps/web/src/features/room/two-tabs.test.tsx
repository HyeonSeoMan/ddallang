import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeLockManager, installFakeLocks } from "@/test/fake-locks";
import { installFakeStorage, type FakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { createFakeBackend } from "@/test/stateful-server";
import { InviteScreen } from "./invite-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const CODE = fixtures.INVITE_CODE;
let storage: FakeStorage;
let manager: FakeLockManager;

beforeEach(() => {
  storage = installFakeStorage();
  manager = new FakeLockManager();
  installFakeLocks(manager);
});

describe("같은 브라우저 두 탭의 첫 입장 (FE-S1-6)", () => {
  it("[AC-ROOM-006-11] 두 탭이 같은 초대 링크로 동시에 첫 입장해도 키는 하나만 만들어지고 같은 키로 요청한다", async () => {
    const authorizations: string[] = [];
    const seenKeys = new Set<string>();
    server.use(
      ...createFakeBackend().handlers,
      http.get(apiUrl(`/invites/${CODE}`), () =>
        HttpResponse.json({ room: { name: "방", unit: "원", status: "IN_PROGRESS" }, isMember: false }),
      ),
      // 서버: 같은 키의 첫 요청은 201, 같은 키의 나머지는 같은 RoomMember를 200으로 복원한다(S1 §4.3).
      http.post(apiUrl(`/invites/${CODE}/members`), ({ request }) => {
        const authorization = request.headers.get("Authorization")!;
        authorizations.push(authorization);
        const status = seenKeys.has(authorization) ? 200 : 201;
        seenKeys.add(authorization);
        return HttpResponse.json(
          { room: { id: "room-1", name: "방", unit: "원", status: "IN_PROGRESS" }, me: fixtures.guestMember },
          { status },
        );
      }),
    );
    const randomSpy = vi.spyOn(crypto, "getRandomValues");

    // 탭 A·B: 같은 localStorage·같은 Web Locks를 공유하고 각자 별도 앱 상태(store)를 가진다.
    const tabA = renderApp(<InviteScreen inviteCode={CODE} />);
    const tabB = renderApp(<InviteScreen inviteCode={CODE} />);
    await waitFor(() => expect(screen.getAllByLabelText("닉네임")).toHaveLength(2));
    const nicknameInputs = screen.getAllByLabelText("닉네임");

    const user = userEvent.setup();
    await user.type(nicknameInputs[0]!, "손님");
    await user.type(nicknameInputs[1]!, "손님");
    const buttons = screen.getAllByRole("button", { name: "입장" });
    // 두 탭의 입장 버튼을 같은 tick에 누른다.
    await Promise.all(buttons.map((button) => user.click(button)));

    await waitFor(() => expect(authorizations).toHaveLength(2));
    // 키는 하나만 만들어지고 두 탭이 같은 키로 요청한다.
    expect(new Set(authorizations).size).toBe(1);
    expect(storage.keys()).toEqual([`ddallang:identity:${CODE}`]);
    expect(storage.getItem(`ddallang:identity:${CODE}`)).toBe(authorizations[0]!.replace("Bearer ", ""));
    // 난수 생성은 한 번뿐이었고(두 번째 탭은 잠금 안에서 재읽기), 배타 구간은 한 번에 하나만 실행됐다.
    const keyGenerations = randomSpy.mock.calls.filter(([array]) => (array as Uint8Array).length === 32);
    expect(keyGenerations).toHaveLength(1);
    expect(manager.maxConcurrent.get(`ddallang-identity:${CODE}`)).toBe(1);
    // 한 명으로 복원된다: 첫 요청 201, 나머지 200이며 두 탭 모두 방 화면에 들어간다.
    await waitFor(() => expect(screen.getAllByRole("heading", { name: "누적 손익" })).toHaveLength(2));
    tabA.unmount();
    tabB.unmount();
  });

  it("두 탭이 다른 키를 만들 수 없다: 잠금 없이는(미지원) 입장하지 못한다", async () => {
    installFakeLocks(null);
    server.use(
      ...createFakeBackend().handlers,
      http.get(apiUrl(`/invites/${CODE}`), () =>
        HttpResponse.json({ room: { name: "방", unit: "원", status: "IN_PROGRESS" }, isMember: false }),
      ),
    );
    renderApp(<InviteScreen inviteCode={CODE} />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("닉네임"), "손님");
    await user.click(screen.getByRole("button", { name: "입장" }));
    expect(await screen.findByText(/이 브라우저에서는 입장할 수 없습니다/)).toBeInTheDocument();
    expect(storage.keys()).toEqual([]);
  });
});
