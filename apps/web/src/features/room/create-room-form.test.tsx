import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/a11y";
import { installFakeStorage, type FakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl, errorResponse } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { CreateRoomForm } from "./create-room-form";
import { CREATE_UNKNOWN_NOTICE, IDENTITY_KEY_NOTICE } from "./messages";
import { sessionAtom } from "./state";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

interface Captured {
  authorization: string | null;
  url: string;
  body: unknown;
}

let storage: FakeStorage;
let requests: Captured[];

function createdResponse() {
  return HttpResponse.json(
    { room: { ...fixtures.room, inviteCode: "created-code" }, me: fixtures.hostMember },
    { status: 201 },
  );
}

function useCreateHandler(respond: () => Response | Promise<Response> = createdResponse) {
  server.use(
    http.post(apiUrl("/rooms"), async ({ request }) => {
      requests.push({
        authorization: request.headers.get("Authorization"),
        url: request.url,
        body: await request.json(),
      });
      return respond();
    }),
  );
}

async function fillAndSubmit(options: { name?: string; nickname?: string } = {}) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("방 이름"), options.name ?? "금요일 포커");
  await user.type(screen.getByLabelText("내 닉네임"), options.nickname ?? "방장");
  await user.click(screen.getByRole("button", { name: "방 만들기" }));
  return user;
}

beforeEach(() => {
  push.mockClear();
  requests = [];
  storage = installFakeStorage();
});

describe("방 생성 화면", () => {
  it("[AC-ROOM-001-12] 정산 단위 목록(원·점수·칩)에서 선택할 수 있다", async () => {
    renderApp(<CreateRoomForm />);
    const select = screen.getByLabelText("정산 단위");
    const options = Array.from((select as HTMLSelectElement).options).map((o) => o.text);
    expect(options).toEqual(["원", "점수", "칩", "직접 입력"]);
    expect(select).toHaveValue("원");
    useCreateHandler();
    const user = userEvent.setup();
    await user.selectOptions(select, "칩");
    await user.type(screen.getByLabelText("방 이름"), "방");
    await user.type(screen.getByLabelText("내 닉네임"), "나");
    await user.click(screen.getByRole("button", { name: "방 만들기" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]!.body).toEqual({ name: "방", unit: "칩", nickname: "나" });
  });

  it("[AC-ROOM-001-13] 직접 입력 필드를 제공하고 규칙 위반은 사유 전체를 한 번에 보여 준다", async () => {
    renderApp(<CreateRoomForm />);
    const user = userEvent.setup();
    expect(screen.queryByLabelText("정산 단위 직접 입력")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("정산 단위"), "직접 입력");
    const custom = screen.getByLabelText("정산 단위 직접 입력");
    await user.type(custom, "  포인트!!가나다라마바사아");
    await user.type(screen.getByLabelText("방 이름"), "방");
    await user.type(screen.getByLabelText("내 닉네임"), "나");
    await user.click(screen.getByRole("button", { name: "방 만들기" }));

    expect(custom).toHaveAccessibleDescription(
      /12자 이하.*한글, 영문, 숫자, 공백만.*앞뒤에 공백.*공백을 연속으로/,
    );
    expect(requests).toHaveLength(0);
  });

  it("[AC-ROOM-001-13] 직접 입력한 단위(\"포인트\", \"Chip 10\")는 그대로 서버에 보낸다", async () => {
    useCreateHandler();
    renderApp(<CreateRoomForm />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("정산 단위"), "직접 입력");
    await user.type(screen.getByLabelText("정산 단위 직접 입력"), "Chip 10");
    await user.type(screen.getByLabelText("방 이름"), "방");
    await user.type(screen.getByLabelText("내 닉네임"), "나");
    await user.click(screen.getByRole("button", { name: "방 만들기" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]!.body).toMatchObject({ unit: "Chip 10" });
  });

  it("빈 입력은 세 필드 모두 REQUIRED를 한 번에 보이고 요청·저장을 하지 않는다", async () => {
    renderApp(<CreateRoomForm />);
    await userEvent.click(screen.getByRole("button", { name: "방 만들기" }));
    expect(screen.getByLabelText("방 이름")).toHaveAccessibleDescription("필수 항목입니다.");
    expect(screen.getByLabelText("내 닉네임")).toHaveAccessibleDescription("필수 항목입니다.");
    expect(requests).toHaveLength(0);
    expect(storage.keys()).toEqual([]);
  });

  it("[AC-ROOM-001-1] 생성 성공: 정규화한 값을 보내고 키를 초대 코드에 연결해 저장한 뒤 방 화면으로 간다", async () => {
    useCreateHandler();
    const { store } = renderApp(<CreateRoomForm />);
    await fillAndSubmit({ name: "한글".normalize("NFD") });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/invite/created-code"));

    const [request] = requests;
    expect(request!.body).toEqual({ name: "한글", unit: "원", nickname: "방장" });
    const key = request!.authorization?.replace("Bearer ", "");
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(request!.url).not.toContain(key);
    // 키가 초대 코드에 연결되어 저장되고 대기 항목은 지워진다.
    expect(storage.keys()).toEqual(["ddallang:identity:created-code"]);
    expect(storage.getItem("ddallang:identity:created-code")).toBe(key);
    expect(store.get(sessionAtom)).toMatchObject({ inviteCode: "created-code", roomId: "room-1" });
  });

  it("서버가 422로 거부하면 사유를 필드에 표시하고 입력을 유지하며 대기 항목을 지운다", async () => {
    useCreateHandler(() =>
      errorResponse("VALIDATION_FAILED", {
        details: [
          { field: "name", code: "CONSECUTIVE_SPACES" },
          { field: "nickname", code: "INVALID_CHARACTER" },
        ],
      }),
    );
    renderApp(<CreateRoomForm />);
    await fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByLabelText("방 이름")).toHaveAccessibleDescription("공백을 연속으로 쓸 수 없습니다."),
    );
    expect(screen.getByLabelText("내 닉네임")).toHaveAccessibleDescription(/한글, 영문, 숫자/);
    expect(screen.getByLabelText("방 이름")).toHaveValue("금요일 포커");
    expect(storage.keys()).toEqual([]);
    expect(push).not.toHaveBeenCalled();
  });

  it("필드에 매핑되지 않는 거부(401 등)는 서버 message를 보이고 입력을 유지한다", async () => {
    useCreateHandler(() => errorResponse("UNAUTHENTICATED", { message: "인증이 필요합니다" }));
    renderApp(<CreateRoomForm />);
    await fillAndSubmit();
    expect(await screen.findByText("인증이 필요합니다")).toBeInTheDocument();
    expect(screen.getByLabelText("내 닉네임")).toHaveValue("방장");
    expect(storage.keys()).toEqual([]);
  });

  describe("결과 불명", () => {
    it("자동 재전송 없이 안내하고, 다시 시도는 같은 신원 키를 쓰며, 성공하면 연결한다", async () => {
      let call = 0;
      useCreateHandler(() => (++call === 1 ? HttpResponse.error() : createdResponse()));
      renderApp(<CreateRoomForm />);
      const user = await fillAndSubmit();

      expect(await screen.findByText(CREATE_UNKNOWN_NOTICE)).toBeInTheDocument();
      expect(requests).toHaveLength(1); // 자동 재전송 없음
      expect(push).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: "방 만들기" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "다시 시도" }));
      await waitFor(() => expect(push).toHaveBeenCalledWith("/invite/created-code"));
      expect(requests).toHaveLength(2);
      expect(requests[1]!.authorization).toBe(requests[0]!.authorization);
      expect(requests[1]!.body).toEqual(requests[0]!.body);
      expect(storage.keys()).toEqual(["ddallang:identity:created-code"]);
    });

    it("5xx도 결과 불명으로 다룬다", async () => {
      useCreateHandler(() => new HttpResponse(null, { status: 503 }));
      renderApp(<CreateRoomForm />);
      await fillAndSubmit();
      expect(await screen.findByText(CREATE_UNKNOWN_NOTICE)).toBeInTheDocument();
    });

    it("취소하면 대기 항목을 지우고, 새 시도는 새 신원 키를 쓴다", async () => {
      let call = 0;
      useCreateHandler(() => (++call === 1 ? HttpResponse.error() : createdResponse()));
      renderApp(<CreateRoomForm />);
      const user = await fillAndSubmit();
      await screen.findByText(CREATE_UNKNOWN_NOTICE);
      expect(storage.keys()).toHaveLength(1); // 대기 항목

      await user.click(screen.getByRole("button", { name: "취소" }));
      expect(storage.keys()).toEqual([]);
      expect(screen.getByLabelText("방 이름")).toHaveValue("금요일 포커"); // 입력 유지

      await user.click(screen.getByRole("button", { name: "방 만들기" }));
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1]!.authorization).not.toBe(requests[0]!.authorization);
    });
  });

  it("저장소를 쓸 수 없으면 요청 전에 막고 안내한다", async () => {
    storage.options.failOnSet = true;
    useCreateHandler();
    renderApp(<CreateRoomForm />);
    await fillAndSubmit();
    expect(await screen.findByText(/브라우저 저장소를 사용할 수 없어/)).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it("방은 만들어졌지만 키를 연결하지 못하면 이동하지 않고 알린다", async () => {
    useCreateHandler(() => {
      storage.options.failOnSet = true; // 응답 뒤 연결 단계에서 저장 실패
      return createdResponse();
    });
    renderApp(<CreateRoomForm />);
    await fillAndSubmit();
    expect(await screen.findByText(/방은 만들어졌지만/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("요청이 진행 중이면 컨트롤이 비활성화되어 중복 제출되지 않는다", async () => {
    useCreateHandler(async () => {
      await delay(50);
      return createdResponse();
    });
    renderApp(<CreateRoomForm />);
    const user = await fillAndSubmit();
    const button = screen.getByRole("button", { name: "만드는 중…" });
    expect(button).toBeDisabled();
    await user.click(button);
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(requests).toHaveLength(1);
  });

  it("[AC-SYS-002-4] 입력 초안을 저장소에 쓰지 않고, 다시 열면 비어 있다", async () => {
    const first = renderApp(<CreateRoomForm />);
    await userEvent.type(screen.getByLabelText("방 이름"), "초안");
    expect(storage.keys()).toEqual([]);
    first.unmount();
    renderApp(<CreateRoomForm />);
    expect(screen.getByLabelText("방 이름")).toHaveValue("");
  });

  it("신원 키 안내를 숨기지 않고, 접근성 검사를 통과한다", async () => {
    const { container } = renderApp(<main><CreateRoomForm /></main>);
    expect(screen.getByText(IDENTITY_KEY_NOTICE)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
