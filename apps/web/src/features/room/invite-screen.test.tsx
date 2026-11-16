import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/a11y";
import { installFakeLocks } from "@/test/fake-locks";
import { installFakeStorage, type FakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl, errorResponse } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { createFakeBackend } from "@/test/stateful-server";
import { renderApp } from "@/test/render";
import { InviteScreen } from "./invite-screen";
import { AllPages } from "@/test/all-pages";
import { CLAIMABLE_HINT, ENDED_NO_JOIN } from "./messages";
import { sessionAtom } from "./state";

const CODE = "invite-code-0000000000000000";
const STORED_KEY = "s".repeat(43);

interface Seen {
  method: string;
  path: string;
  authorization: string | null;
  body: unknown;
}

let storage: FakeStorage;
let seen: Seen[];

function record(request: Request, body: unknown = null) {
  seen.push({
    method: request.method,
    path: new URL(request.url).pathname,
    authorization: request.headers.get("Authorization"),
    body,
  });
}

function inviteHandler(options: { isMember?: boolean; status?: "IN_PROGRESS" | "ENDED"; candidates?: string[] } = {}) {
  return http.get(apiUrl(`/invites/${CODE}`), ({ request }) => {
    record(request);
    return HttpResponse.json(
      fixtures.inviteLookup({
        room: { name: fixtures.room.name, unit: fixtures.room.unit, status: options.status ?? "IN_PROGRESS" },
        identity: options.isMember ? "PARTICIPANT" : "NONE",
        ...(options.candidates ? { claimableNicknames: options.candidates } : {}),
      }),
    );
  });
}

/** 신원 없음 화면에서 `새로 입장하기`를 눌러 닉네임 입력을 연다(2.0.0 선택 단계, FD-22). */
async function openNewJoin(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "새로 입장하기" }));
  return screen.getByLabelText("닉네임");
}

function joinHandler(respond: () => Response = () => joined(201)) {
  return http.post(apiUrl(`/invites/${CODE}/members`), async ({ request }) => {
    record(request, await request.json());
    return respond();
  });
}

function joined(status: number) {
  return HttpResponse.json(
    {
      room: { id: fixtures.room.id, name: fixtures.room.name, unit: fixtures.room.unit, status: "IN_PROGRESS" },
      me: fixtures.guestParticipant,
    },
    { status },
  );
}

beforeEach(() => {
  seen = [];
  storage = installFakeStorage();
  installFakeLocks();
  // 방 화면에 들어가면 스트림과 5개 조회가 시작되므로 기본 가짜 서버를 둔다(시험이 필요하면 덮어쓴다).
  server.use(...createFakeBackend().handlers);
});

describe("초대 링크 화면", () => {
  it("[AC-ROOM-002-4] 없는·잘못된 초대 코드는 서버 message로 오류를 보이고 입장 입력을 보이지 않는다", async () => {
    server.use(
      http.get(apiUrl(`/invites/${CODE}`), () =>
        errorResponse("INVITE_NOT_FOUND", { message: "초대 링크를 찾을 수 없습니다" }),
      ),
    );
    renderApp(<InviteScreen inviteCode={CODE}><AllPages /></InviteScreen>);
    expect(await screen.findByText("초대 링크를 찾을 수 없습니다")).toBeInTheDocument();
    expect(screen.queryByLabelText("닉네임")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();
    expect(storage.keys()).toEqual([]); // 키를 만들지 않는다
  });

  it("[AC-ROOM-004-1] 확인 중 → 선택 → 닉네임 입력 → 입장 중 → 방 화면 순으로 바뀌고, 입장 전에는 방 이름·단위·진행 상태만 보인다", async () => {
    server.use(
      inviteHandler(),
      http.post(apiUrl(`/invites/${CODE}/members`), async ({ request }) => {
        record(request, await request.json());
        await delay(30);
        return joined(201);
      }),
    );
    const store = createStore();
    const { container } = renderApp(<InviteScreen inviteCode={CODE}><AllPages /></InviteScreen>, store);
    expect(screen.getByText("확인 중…")).toBeInTheDocument();

    expect(await screen.findByRole("button", { name: "새로 입장하기" })).toBeInTheDocument();
    // 입장 전에는 이 세 가지만 공개된다(후보 닉네임은 이어받기를 고를 때만 보인다).
    expect(screen.getByText(fixtures.room.name)).toBeInTheDocument();
    expect(screen.getByText(`정산 단위: ${fixtures.room.unit}`)).toBeInTheDocument();
    expect(screen.getByText("진행 중")).toBeInTheDocument();
    expect(container.textContent).not.toContain(CODE);
    expect(container.textContent).not.toContain("나래");
    expect(container.textContent).not.toMatch(/명|인원/);
    expect(screen.queryByRole("heading", { name: "참여자" })).not.toBeInTheDocument();
    await expectNoA11yViolations(container);

    const user = userEvent.setup();
    const nicknameInput = await openNewJoin(user);
    expect(screen.getByText(/브라우저 저장소를 지우면/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
    await user.type(nicknameInput, "손님");
    await user.click(screen.getByRole("button", { name: "입장" }));
    expect(screen.getByText("입장 중…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "누적 손익" })).toBeInTheDocument();

    // 첫 입장: 새 키를 만들어 저장하고, 그 키와 닉네임으로 입장한다.
    const post = seen.find((s) => s.method === "POST")!;
    expect(post.body).toEqual({ nickname: "손님" });
    expect(storage.getItem(`ddallang:identity:${CODE}`)).toBe(post.authorization?.replace("Bearer ", ""));
    expect(store.get(sessionAtom)).toMatchObject({ inviteCode: CODE, roomId: "room-1" });
  });

  it("[AC-ROOM-005-1] 이미 입장한 브라우저는 닉네임을 다시 묻지 않고 같은 키로 복원한다", async () => {
    storage.setItem(`ddallang:identity:${CODE}`, STORED_KEY);
    server.use(inviteHandler({ isMember: true }), joinHandler(() => joined(200)));
    renderApp(<InviteScreen inviteCode={CODE}><AllPages /></InviteScreen>);

    expect(await screen.findByRole("heading", { name: "누적 손익" })).toBeInTheDocument();
    expect(screen.queryByLabelText("닉네임")).not.toBeInTheDocument();
    const [get, post] = seen;
    expect(get!.authorization).toBe(`Bearer ${STORED_KEY}`); // 조회에 저장된 키를 싣는다
    expect(post!.authorization).toBe(`Bearer ${STORED_KEY}`);
    expect(post!.body).toEqual({}); // 닉네임을 보내지 않는다
  });

  it("[AC-ROOM-005-1] 복원 응답이 늦게 와도(실서버 지연) 입장 중에서 멈추지 않고 방 화면으로 간다", async () => {
    storage.setItem(`ddallang:identity:${CODE}`, STORED_KEY);
    server.use(
      inviteHandler({ isMember: true }),
      http.post(apiUrl(`/invites/${CODE}/members`), async ({ request }) => {
        record(request, await request.json());
        await delay(150);
        return joined(200);
      }),
    );
    renderApp(<InviteScreen inviteCode={CODE}><AllPages /></InviteScreen>);
    expect(await screen.findByText("입장 중…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "누적 손익" }, { timeout: 2000 })).toBeInTheDocument();
  });

  it("[AC-ROOM-008-1] [AC-ROOM-008-8] 인원 한도를 넘으면 서버 안내와 이어받기 안내를 보이고 입력한 닉네임을 유지한다", async () => {
    server.use(
      inviteHandler(),
      joinHandler(() =>
        errorResponse("PARTICIPANT_LIMIT_EXCEEDED", {
          message: "참여 인원이 가득 찼습니다",
          details: [{ limit: 10 }],
        }),
      ),
    );
    renderApp(<InviteScreen inviteCode={CODE}><AllPages /></InviteScreen>);
    const user = userEvent.setup();
    await user.type(await openNewJoin(user), "열한번째");
    await user.click(screen.getByRole("button", { name: "입장" }));
    expect(await screen.findByText("참여 인원이 가득 찼습니다")).toBeInTheDocument();
    expect(screen.getByLabelText("닉네임")).toHaveValue("열한번째");
    expect(screen.getByText(CLAIMABLE_HINT)).toBeInTheDocument();
    // 기존 참여자라면 이어받기로 이동할 수 있다.
    await user.click(screen.getByRole("button", { name: "이어받기로 가기" }));
    expect(screen.getByRole("heading", { name: "이어받을 참여자 선택" })).toBeInTheDocument();
  });

  it("[AC-ROOM-002-6] 닉네임이 중복이면 목록을 조회하지 않고 서버 안내와 이어받기 안내를 보인다", async () => {
    server.use(
      inviteHandler(),
      joinHandler(() => errorResponse("NICKNAME_TAKEN", { message: "이미 사용 중인 닉네임입니다" })),
    );
    renderApp(<InviteScreen inviteCode={CODE}><AllPages /></InviteScreen>);
    const user = userEvent.setup();
    await user.type(await openNewJoin(user), "손님");
    await user.click(screen.getByRole("button", { name: "입장" }));
    expect(await screen.findByText("이미 사용 중인 닉네임입니다")).toBeInTheDocument();
    expect(screen.getByLabelText("닉네임")).toHaveValue("손님");
    expect(screen.getByText(CLAIMABLE_HINT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이어받기로 가기" })).toBeInTheDocument();
    expect(seen.map((s) => `${s.method} ${s.path}`)).toEqual([
      `GET /invites/${CODE}`,
      `POST /invites/${CODE}/members`,
    ]); // 참여자 목록 조회 없음
  });

  it("닉네임 규칙 위반은 사유 전체를 보이고 요청하지 않으며, 서버 422는 필드에 표시한다", async () => {
    server.use(
      inviteHandler(),
      joinHandler(() =>
        errorResponse("VALIDATION_FAILED", { details: [{ field: "nickname", code: "INVALID_CHARACTER" }] }),
      ),
    );
    renderApp(<InviteScreen inviteCode={CODE}><AllPages /></InviteScreen>);
    const user = userEvent.setup();
    const input = await openNewJoin(user);
    await user.click(screen.getByRole("button", { name: "입장" }));
    expect(input).toHaveAccessibleDescription("필수 항목입니다.");
    expect(seen.filter((s) => s.method === "POST")).toHaveLength(0);

    await user.type(input, "손님!");
    await user.click(screen.getByRole("button", { name: "입장" }));
    expect(input).toHaveAccessibleDescription(/한글, 영문, 숫자/); // 클라이언트 검증
    expect(seen.filter((s) => s.method === "POST")).toHaveLength(0);

    // 클라이언트 검증을 통과해도 서버가 거부하면(서버 판정이 최종) 사유를 필드에 보인다.
    await user.clear(input);
    await user.type(input, "손님");
    await user.click(screen.getByRole("button", { name: "입장" }));
    await waitFor(() => expect(seen.filter((s) => s.method === "POST")).toHaveLength(1));
    expect(await screen.findByLabelText("닉네임")).toHaveAccessibleDescription(/한글, 영문, 숫자/);
    expect(screen.queryByText(CLAIMABLE_HINT)).not.toBeInTheDocument(); // 검증 거부에는 이어받기 안내가 없다
  });

  it("[AC-ROOM-002-5] 종료된 방은 새로 입장할 수 없고 이어받기만 보인다(후보가 없으면 이어받기도 숨긴다)", async () => {
    server.use(inviteHandler({ status: "ENDED" }), joinHandler());
    const { unmount } = renderApp(<InviteScreen inviteCode={CODE}><AllPages /></InviteScreen>);
    expect(await screen.findByText(ENDED_NO_JOIN)).toBeInTheDocument();
    expect(screen.getByText("게임 종료")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "새로 입장하기" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("닉네임")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "기존 참여자 이어받기" })).toBeInTheDocument();
    unmount();

    server.use(inviteHandler({ status: "ENDED", candidates: [] }));
    renderApp(<InviteScreen inviteCode={CODE}><AllPages /></InviteScreen>);
    expect(await screen.findByText(ENDED_NO_JOIN)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "기존 참여자 이어받기" })).not.toBeInTheDocument();
    expect(seen.filter((r) => r.method === "POST")).toHaveLength(0);
  });

  it("진행 중인 방의 입장 요청이 GAME_ENDED면 다시 조회해 종료 화면으로 바꾼다", async () => {
    let status: "IN_PROGRESS" | "ENDED" = "IN_PROGRESS";
    server.use(
      http.get(apiUrl(`/invites/${CODE}`), () =>
        HttpResponse.json(fixtures.inviteLookup({ room: { name: fixtures.room.name, unit: fixtures.room.unit, status } })),
      ),
      joinHandler(() => {
        status = "ENDED";
        return errorResponse("GAME_ENDED", { message: "게임이 종료되었습니다" });
      }),
    );
    renderApp(<InviteScreen inviteCode={CODE}><AllPages /></InviteScreen>);
    const user = userEvent.setup();
    await user.type(await openNewJoin(user), "늦손님");
    await user.click(screen.getByRole("button", { name: "입장" }));
    expect(await screen.findByText(ENDED_NO_JOIN)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "새로 입장하기" })).not.toBeInTheDocument();
  });

  it("조회가 네트워크 오류로 실패하면 안내하고 다시 시도할 수 있다", async () => {
    let calls = 0;
    server.use(
      http.get(apiUrl(`/invites/${CODE}`), () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.error()
          : HttpResponse.json({ room: { name: "방", unit: "원", status: "IN_PROGRESS" }, identity: "NONE", claim: null, claimableNicknames: [] });
      }),
    );
    renderApp(<InviteScreen inviteCode={CODE}><AllPages /></InviteScreen>);
    expect(await screen.findByText(/응답을 받지 못했습니다/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("button", { name: "새로 입장하기" })).toBeInTheDocument();
  });

  it("복원 입장이 실패하면 닉네임 입력이 아니라 오류를 보인다", async () => {
    storage.setItem(`ddallang:identity:${CODE}`, STORED_KEY);
    server.use(
      inviteHandler({ isMember: true }),
      joinHandler(() => errorResponse("INVITE_NOT_FOUND", { message: "초대 링크를 찾을 수 없습니다" })),
    );
    renderApp(<InviteScreen inviteCode={CODE}><AllPages /></InviteScreen>);
    expect(await screen.findByText("초대 링크를 찾을 수 없습니다")).toBeInTheDocument();
    expect(screen.queryByLabelText("닉네임")).not.toBeInTheDocument();
  });

  it("저장소·잠금을 쓸 수 없으면 입장 요청 없이 안내한다", async () => {
    server.use(inviteHandler(), joinHandler());
    renderApp(<InviteScreen inviteCode={CODE}><AllPages /></InviteScreen>);
    const user = userEvent.setup();
    await user.type(await openNewJoin(user), "손님");
    storage.options.failOnSet = true;
    await user.click(screen.getByRole("button", { name: "입장" }));
    expect(await screen.findByText(/브라우저 저장소를 사용할 수 없어/)).toBeInTheDocument();
    expect(seen.filter((s) => s.method === "POST")).toHaveLength(0);
    expect(screen.getByLabelText("닉네임")).toHaveValue("손님");
  });

  it("방을 방금 만들어 세션이 있으면 요청 없이 바로 방 화면이다", () => {
    const store = createStore();
    store.set(sessionAtom, { inviteCode: CODE, roomId: "room-1", me: fixtures.hostParticipant });
    renderApp(<InviteScreen inviteCode={CODE}><AllPages /></InviteScreen>, store);
    expect(screen.getByRole("heading", { name: "누적 손익" })).toBeInTheDocument();
    expect(seen).toHaveLength(0);
  });
});
