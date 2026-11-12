import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { ServerDataGate } from "@/features/room/server-data-gate";
import { applySnapshotAtom, sessionAtom, setConnectionAtom, snapshotAtom } from "@/features/room/state";
import { expectNoA11yViolations } from "@/test/a11y";
import { installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl, errorResponse } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { INVITE_CODE, seedRoom } from "@/test/room-seed";
import { ParticipantsSection } from "./participants-section";

const KEY = "h".repeat(43);
const base = `/rooms/${fixtures.room.id}/participants`;

interface Seen {
  method: string;
  path: string;
  authorization: string | null;
  body: unknown;
}
let seen: Seen[];
let store: ReturnType<typeof createStore>;

function handler(
  method: "get" | "post" | "patch",
  path: string,
  respond: () => Response | Promise<Response>,
) {
  return http[method](apiUrl(path), async ({ request }) => {
    seen.push({
      method: request.method,
      path: new URL(request.url).pathname,
      authorization: request.headers.get("Authorization"),
      body: request.method === "GET" ? null : await request.json(),
    });
    return respond();
  });
}

const created = (nickname: string) =>
  HttpResponse.json(
    { participant: { id: "p-new", roomId: "room-1", nickname, status: "ACTIVE", order: 4, createdAt: "t" } },
    { status: 201 },
  );
const list = (...nicknames: string[]) =>
  HttpResponse.json({
    participants: nicknames.map((nickname, i) => ({
      id: `q-${i}`,
      roomId: "room-1",
      nickname,
      status: "ACTIVE",
      order: i + 1,
      createdAt: "t",
    })),
  });

beforeEach(() => {
  seen = [];
  store = createStore();
  installFakeStorage().setItem(`ddallang:identity:${INVITE_CODE}`, KEY);
});

function renderSection(options: Parameters<typeof seedRoom>[1] = {}) {
  seedRoom(store, options);
  return renderApp(<main><ParticipantsSection /></main>, store);
}

describe("참여자 영역", () => {
  it("목록을 order 순(서버 순서)으로 보이고 비활성 참여자를 표시한다", () => {
    renderSection();
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.querySelector("span")?.textContent)).toEqual(["가온", "나래", "다온"]);
    expect(within(items[2]!).getByText("비활성")).toBeInTheDocument(); // 배지(정확히 '비활성')
    expect(within(items[0]!).queryByText("비활성")).not.toBeInTheDocument();
    expect(within(items[1]!).queryByText("비활성")).not.toBeInTheDocument();
  });

  it("방장에게는 등록 폼과 상태 변경 버튼이 있고, 비방장에게는 없다", () => {
    const host = renderSection();
    expect(screen.getByLabelText("참여자 닉네임")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "가온 비활성화" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다온 재활성화" })).toBeInTheDocument();
    host.unmount();

    store = createStore();
    renderSection({ me: fixtures.guestMember });
    expect(screen.queryByLabelText("참여자 닉네임")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3); // 목록은 보인다
  });

  it("[AC-PART-004-3] 게임이 종료되면 방장에게도 등록·상태 변경 컨트롤이 없다", () => {
    renderSection({ status: "ENDED" });
    expect(screen.queryByLabelText("참여자 닉네임")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("등록: 정규화한 닉네임을 신원 키로 보내고 성공하면 입력을 비운다(등록은 서버 응답 뒤에만 알린다)", async () => {
    server.use(handler("post", base, () => created("마루")));
    const { container } = renderSection();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("참여자 닉네임"), "마루");
    await user.click(screen.getByRole("button", { name: "참여자 등록" }));
    await waitFor(() => expect(screen.getByLabelText("참여자 닉네임")).toHaveValue(""));
    expect(seen).toEqual([{ method: "POST", path: base, authorization: `Bearer ${KEY}`, body: { nickname: "마루" } }]);
    expect(await screen.findAllByText("참여자를 등록했습니다.")).not.toHaveLength(0);
    await expectNoA11yViolations(container);
  });

  it("닉네임 규칙 위반은 사유 전체를 보이고 요청하지 않는다", async () => {
    renderSection();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "참여자 등록" }));
    expect(screen.getByLabelText("참여자 닉네임")).toHaveAccessibleDescription("필수 항목입니다.");
    await user.type(screen.getByLabelText("참여자 닉네임"), " 안녕!!");
    await user.click(screen.getByRole("button", { name: "참여자 등록" }));
    expect(screen.getByLabelText("참여자 닉네임")).toHaveAccessibleDescription(/한글, 영문, 숫자.*앞뒤에 공백/);
    expect(seen).toHaveLength(0);
  });

  it("[AC-ROOM-008-2] 참여자 한도 초과는 서버 안내를 보이고 입력한 닉네임을 유지한다", async () => {
    server.use(
      handler("post", base, () =>
        errorResponse("PARTICIPANT_LIMIT_EXCEEDED", { message: "참여자는 10명까지 등록할 수 있습니다", details: [{ limit: 10 }] }),
      ),
    );
    renderSection();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("참여자 닉네임"), "열한번째");
    await user.click(screen.getByRole("button", { name: "참여자 등록" }));
    expect(await screen.findByText("참여자는 10명까지 등록할 수 있습니다")).toBeInTheDocument();
    expect(screen.getByLabelText("참여자 닉네임")).toHaveValue("열한번째");
  });

  it("[AC-PART-001-6] NICKNAME_TAKEN이면 목록을 다시 조회해 같은 닉네임(대소문자 무시)이 있으면 '이미 등록되어 있습니다'로만 안내한다", async () => {
    server.use(
      handler("post", base, () => errorResponse("NICKNAME_TAKEN", { message: "이미 사용 중인 닉네임입니다" })),
      handler("get", base, () => list("Gaon", "나래")),
    );
    renderSection();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("참여자 닉네임"), "gaon");
    await user.click(screen.getByRole("button", { name: "참여자 등록" }));
    expect(await screen.findByText("이미 등록되어 있습니다")).toBeInTheDocument();
    expect(seen.map((s) => s.method)).toEqual(["POST", "GET"]); // 재조회
    // 유실된 요청의 성공을 단정하는 문구를 쓰지 않는다.
    expect(screen.queryByText(/등록되었습니다|등록했습니다/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("참여자 닉네임")).toHaveValue("gaon");
  });

  it("재조회에도 같은 닉네임이 없으면 서버 message를 그대로 보인다", async () => {
    server.use(
      handler("post", base, () => errorResponse("NICKNAME_TAKEN", { message: "이미 사용 중인 닉네임입니다" })),
      handler("get", base, () => list("나래")),
    );
    renderSection();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("참여자 닉네임"), "마루");
    await user.click(screen.getByRole("button", { name: "참여자 등록" }));
    expect(await screen.findByText("이미 사용 중인 닉네임입니다")).toBeInTheDocument();
  });

  it("등록 응답을 받지 못하면 저장 여부를 단정하지 않고 입력을 유지한다", async () => {
    server.use(handler("post", base, () => HttpResponse.error()));
    renderSection();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("참여자 닉네임"), "마루");
    await user.click(screen.getByRole("button", { name: "참여자 등록" }));
    expect(await screen.findByText(/응답을 받지 못했습니다/)).toBeInTheDocument();
    expect(screen.getByLabelText("참여자 닉네임")).toHaveValue("마루");
    expect(screen.queryByText(/등록했습니다|등록되었습니다/)).not.toBeInTheDocument();
  });

  it("상태 변경: 비활성화는 PATCH {status}를 보내고 서버 오류(GAME_ENDED)는 그 행에 안내한다", async () => {
    server.use(handler("patch", `${base}/p-1`, () => errorResponse("GAME_ENDED", { message: "이미 종료된 게임입니다" })));
    renderSection();
    await userEvent.click(screen.getByRole("button", { name: "가온 비활성화" }));
    expect(await screen.findByText("이미 종료된 게임입니다")).toBeInTheDocument();
    expect(seen[0]).toMatchObject({ method: "PATCH", path: `${base}/p-1`, body: { status: "INACTIVE" } });
    expect(seen[0]!.authorization).toBe(`Bearer ${KEY}`);
  });

  it("재활성화는 ACTIVE를 보낸다", async () => {
    server.use(handler("patch", `${base}/p-3`, () => HttpResponse.json({ participant: fixtures.participants[2] })));
    renderSection();
    await userEvent.click(screen.getByRole("button", { name: "다온 재활성화" }));
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]!.body).toEqual({ status: "ACTIVE" });
  });

  it("결과 불명 뒤 재시도는 먼저 목록을 다시 조회하고, 이미 목표 상태면 다시 보내지 않는다", async () => {
    server.use(
      handler("patch", `${base}/p-1`, () => HttpResponse.error()),
      handler("get", base, () =>
        HttpResponse.json({ participants: [{ ...fixtures.participants[0], status: "INACTIVE" }] }),
      ),
    );
    renderSection();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "가온 비활성화" }));
    expect(await screen.findByText("결과를 확인하지 못했습니다.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "가온 상태 변경 다시 시도" }));
    expect(await screen.findByText("이미 해당 상태입니다.")).toBeInTheDocument();
    expect(seen.map((s) => s.method)).toEqual(["PATCH", "GET"]); // 두 번째 PATCH 없음
  });

  it("재조회 결과 아직 목표 상태가 아니면 다시 보낸다", async () => {
    let patches = 0;
    server.use(
      handler("patch", `${base}/p-1`, () => (++patches === 1 ? HttpResponse.error() : HttpResponse.json({ participant: fixtures.participants[0] }))),
      handler("get", base, () => HttpResponse.json({ participants: [fixtures.participants[0]] })),
    );
    renderSection();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "가온 비활성화" }));
    await screen.findByText("결과를 확인하지 못했습니다.");
    await user.click(screen.getByRole("button", { name: "가온 상태 변경 다시 시도" }));
    await waitFor(() => expect(seen.map((s) => s.method)).toEqual(["PATCH", "GET", "PATCH"]));
  });

  it("VALIDATION_FAILED에 닉네임 항목이 없으면 서버 message를 보인다", async () => {
    server.use(handler("post", base, () => errorResponse("VALIDATION_FAILED", { message: "입력값이 올바르지 않습니다", details: [] })));
    renderSection();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("참여자 닉네임"), "마루");
    await user.click(screen.getByRole("button", { name: "참여자 등록" }));
    expect(await screen.findByText("입력값이 올바르지 않습니다")).toBeInTheDocument();
  });

  it("재시도 버튼을 연달아 눌러도(목록 조회 구간 포함) 요청이 한 번만 나간다", async () => {
    let patches = 0;
    server.use(
      handler("patch", `${base}/p-1`, () => (++patches === 1 ? HttpResponse.error() : HttpResponse.json({ participant: fixtures.participants[0] }))),
      handler("get", base, async () => {
        await delay(80); // 두 번째 클릭이 목록 조회 구간 안에 들어오게 한다
        return HttpResponse.json({ participants: [fixtures.participants[0]] });
      }),
    );
    renderSection();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "가온 비활성화" }));
    await screen.findByText("결과를 확인하지 못했습니다.");
    const retry = screen.getByRole("button", { name: "가온 상태 변경 다시 시도" });
    await Promise.all([user.click(retry), user.click(retry)]);
    await waitFor(() => expect(seen.filter((s) => s.method === "PATCH")).toHaveLength(2)); // 최초 + 재시도 1회
    expect(seen.filter((s) => s.method === "GET")).toHaveLength(1);
  });

  it("상태 변경 버튼을 연달아 눌러도 요청이 한 번만 나간다", async () => {
    server.use(
      handler("patch", `${base}/p-1`, async () => {
        await delay(80); // 두 번째 클릭이 첫 요청이 진행 중일 때 들어오게 한다(응답이 즉시 오면 완료 뒤 클릭이 된다)
        return HttpResponse.json({ participant: fixtures.participants[0] });
      }),
    );
    renderSection();
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "가온 비활성화" });
    await Promise.all([user.click(button), user.click(button)]);
    await waitFor(() => expect(seen).toHaveLength(1));
    await delay(150);
    expect(seen).toHaveLength(1); // 늦게 오는 요청이 없다
  });

  it("결과 불명 안내는 알림(alert)이고, 갱신으로 이미 목표 상태가 되면 안내와 재시도가 사라진다", async () => {
    server.use(handler("patch", `${base}/p-1`, () => HttpResponse.error()));
    renderSection();
    await userEvent.click(screen.getByRole("button", { name: "가온 비활성화" }));
    const alert = await screen.findByText("결과를 확인하지 못했습니다.");
    expect(alert).toHaveAttribute("role", "alert");
    // 스트림 갱신으로 이 참여자가 INACTIVE가 되었다(다른 탭·재조회 등).
    act(() => {
      seedRoom(store, {
        participants: fixtures.participants.map((p) => (p.id === "p-1" ? { ...p, status: "INACTIVE" as const } : p)),
      });
    });
    await waitFor(() => expect(screen.queryByText("결과를 확인하지 못했습니다.")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "가온 상태 변경 다시 시도" })).not.toBeInTheDocument();
  });

  it("등록 입력 초안은 방별로 분리되어 다른 방으로 이동해도 새지 않는다", async () => {
    seedRoom(store);
    const view = renderApp(<ParticipantsSection />, store);
    await userEvent.type(screen.getByLabelText("참여자 닉네임"), "첫방초안");
    view.unmount();
    // 같은 앱 상태에서 다른 방 화면으로 들어간다.
    seedRoom(store);
    store.set(sessionAtom, { inviteCode: "other-code", roomId: "room-2", me: fixtures.hostMember });
    const snapshot = store.get(snapshotAtom)!;
    store.set(applySnapshotAtom, { ...snapshot, room: { ...snapshot.room, id: "room-2" } });
    renderApp(<ParticipantsSection />, store);
    expect(screen.getByLabelText("참여자 닉네임")).toHaveValue("");
  });

  it("[AC-SYS-001-5] 연결이 끊겨 영역이 가려져도 작성 중이던 닉네임 입력은 유지된다", async () => {
    seedRoom(store);
    renderApp(
      <main>
        <ServerDataGate>
          <ParticipantsSection />
        </ServerDataGate>
      </main>,
      store,
    );
    await userEvent.type(screen.getByLabelText("참여자 닉네임"), "작성중");
    act(() => store.set(setConnectionAtom, "disconnected"));
    expect(screen.queryByLabelText("참여자 닉네임")).not.toBeInTheDocument(); // 가려짐
    seedRoom(store); // 복구: 새 세대 스냅샷
    expect(await screen.findByLabelText("참여자 닉네임")).toHaveValue("작성중");
  });

  it("신원 키가 없으면 요청하지 않고 안내한다", async () => {
    installFakeStorage(); // 키 없음
    renderSection();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("참여자 닉네임"), "마루");
    await user.click(screen.getByRole("button", { name: "참여자 등록" }));
    expect(await screen.findByText(/신원 정보를 찾을 수 없습니다/)).toBeInTheDocument();
    expect(seen).toHaveLength(0);
  });
});
