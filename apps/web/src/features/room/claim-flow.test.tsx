// 초대 화면의 이어받기 흐름(FE-M3, FD-22, S1 §4.9~§4.11·§6.5·§9).
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { InviteLookup, MyClaim } from "@/lib/api";
import { expectNoA11yViolations } from "@/test/a11y";
import { AllPages } from "@/test/all-pages";
import { installFakeLocks } from "@/test/fake-locks";
import { type FakeStorage, installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl, errorResponse } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { createFakeBackend, type FakeBackend } from "@/test/stateful-server";
import { InviteScreen } from "./invite-screen";
import {
  CLAIM_CONFIRM_BODY,
  claimConfirmTitle,
  IDENTITY_KEY_NOTICE,
  RESULT_UNCONFIRMED,
  WAITING_TITLE,
  waitingBody,
  withRo,
} from "./messages";

const CODE = fixtures.INVITE_CODE;
const INVITE = `/invites/${CODE}`;
const STORAGE_NAME = `ddallang:identity:${CODE}`;
const HOST = "h".repeat(43);

let storage: FakeStorage;
let backend: FakeBackend;

beforeEach(() => {
  storage = installFakeStorage();
  installFakeLocks();
  backend = createFakeBackend();
  backend.identities.set(HOST, fixtures.hostParticipant.id);
  server.use(...backend.handlers);
});

const claim = (overrides: Partial<MyClaim> = {}): MyClaim => ({ ...fixtures.pendingMyClaim, ...overrides });

function mount() {
  return renderApp(
    <InviteScreen inviteCode={CODE}>
      <AllPages />
    </InviteScreen>,
  );
}

/** 선택 → 이어받기 → 후보 → 확인까지 간다. */
async function openConfirm(user: ReturnType<typeof userEvent.setup>, nickname = "나래") {
  await user.click(await screen.findByRole("button", { name: "기존 참여자 이어받기" }));
  await user.click(screen.getByRole("button", { name: nickname }));
  return screen.getByRole("dialog", { name: claimConfirmTitle(nickname) });
}

async function requestClaim(user: ReturnType<typeof userEvent.setup>, nickname = "나래") {
  const dialog = await openConfirm(user, nickname);
  await user.click(within(dialog).getByRole("button", { name: "요청" }));
}

const postToHost = (path: string) =>
  fetch(apiUrl(path), { method: "POST", headers: { Authorization: `Bearer ${HOST}` } });

describe("이어받기 요청과 대기 (FE-M3)", () => {
  it("[AC-ROOM-009-1] [AC-ROOM-009-3] 후보(방장 제외)를 골라 확인하면 요청하고, 대기 화면은 대상 닉네임만 보이고 방 정보는 없다", async () => {
    const { container } = mount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "기존 참여자 이어받기" }));
    const list = screen.getByRole("list", { name: "이어받기 후보" });
    expect(within(list).getAllByRole("button").map((b) => b.textContent)).toEqual(["나래", "다온"]);
    expect(within(list).queryByRole("button", { name: "가온" })).not.toBeInTheDocument(); // 방장은 후보가 아니다
    expect(screen.getByText(IDENTITY_KEY_NOTICE)).toBeInTheDocument();
    await expectNoA11yViolations(container);

    await user.click(within(list).getByRole("button", { name: "나래" }));
    const dialog = screen.getByRole("dialog", { name: claimConfirmTitle("나래") });
    expect(dialog).toHaveAccessibleDescription(CLAIM_CONFIRM_BODY);
    expect(within(dialog).getByRole("button", { name: "취소" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "요청" }));

    expect(await screen.findByRole("heading", { name: WAITING_TITLE })).toBeInTheDocument();
    expect(screen.getByText(waitingBody("나래"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "요청 취소" })).toBeEnabled();
    // 대기 중에는 방 정보를 보이지 않는다(AC-ROOM-009-1). 참여자 목록·거래도 없다.
    expect(screen.queryByRole("region", { name: "방 정보" })).not.toBeInTheDocument();
    expect(screen.queryByText(fixtures.room.name)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "누적 손익" })).not.toBeInTheDocument();
    // 키는 입장과 같은 배타 구간으로 만들어 저장했고 그 키로 요청했다.
    const key = storage.getItem(STORAGE_NAME);
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(backend.claimKeys.get(backend.claims[0]!.id)).toBe(key);
    expect(backend.claims[0]).toMatchObject({ nickname: "나래", status: "PENDING" });
    await expectNoA11yViolations(container);
  });

  it("[AC-ROOM-009-1] 대기 중인 키로 다시 들어오면(PENDING) 바로 대기 화면이다", async () => {
    storage.setItem(STORAGE_NAME, "p".repeat(43));
    server.use(
      http.get(apiUrl(INVITE), () => HttpResponse.json(fixtures.inviteLookup({ identity: "PENDING", claim: claim() }))),
    );
    mount();
    expect(await screen.findByRole("heading", { name: WAITING_TITLE })).toBeInTheDocument();
    expect(screen.getByText(waitingBody("나래"))).toBeInTheDocument();
  });

  it("확인 대화상자에서 취소하면 요청하지 않고 후보 선택으로 돌아간다", async () => {
    mount();
    const user = userEvent.setup();
    const dialog = await openConfirm(user);
    await user.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "이어받을 참여자 선택" })).toBeInTheDocument();
    expect(backend.claims).toHaveLength(0);
  });

  it("[AC-ROOM-009-9] 요청 취소에 성공하면 취소를 안내하고 선택으로 돌아간다", async () => {
    mount();
    const user = userEvent.setup();
    await requestClaim(user);
    await user.click(await screen.findByRole("button", { name: "요청 취소" }));
    expect(await screen.findByText("이어받기 요청을 취소했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "새로 입장하기" })).toBeInTheDocument();
    expect(backend.claims[0]!.status).toBe("CANCELED");
  });

  it("[AC-ROOM-009-7] 최근 요청이 거절됐으면 진입할 때 사유를 한 번 안내한다(같은 페이지에서 다시 안내하지 않음)", async () => {
    mount();
    const user = userEvent.setup();
    await requestClaim(user);
    await screen.findByRole("heading", { name: WAITING_TITLE });
    expect((await postToHost(`/rooms/${fixtures.room.id}/claims/${backend.claims[0]!.id}/reject`)).status).toBe(200);

    // 새로고침에 해당: 새 화면이 초대 조회의 claim으로 결과를 안내한다.
    const second = mount();
    expect(await within(second.container).findByText("방장이 이어받기 요청을 거절했습니다.")).toBeInTheDocument();
    // 같은 페이지에서 다시 조회해도(새로 입장 → 뒤로는 조회하지 않음) 안내를 반복하지 않는다.
    await user.click(within(second.container).getByRole("button", { name: "새로 입장하기" }));
    expect(within(second.container).queryByText("방장이 이어받기 요청을 거절했습니다.")).not.toBeInTheDocument();
  });

  it("후보가 그 사이 사라졌으면(PARTICIPANT_NOT_FOUND) 서버 안내와 함께 후보를 다시 불러온다", async () => {
    let lookups = 0;
    server.use(
      http.get(apiUrl(INVITE), () => {
        lookups += 1;
        return HttpResponse.json(fixtures.inviteLookup(lookups > 1 ? { claimableNicknames: ["다온"] } : {}));
      }),
      http.post(apiUrl(`${INVITE}/claims`), () => errorResponse("PARTICIPANT_NOT_FOUND", { message: "참여자를 찾을 수 없습니다" })),
    );
    mount();
    const user = userEvent.setup();
    await requestClaim(user);
    expect(await screen.findByText("참여자를 찾을 수 없습니다")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "이어받기 후보" });
    expect(within(list).getAllByRole("button").map((b) => b.textContent)).toEqual(["다온"]);
  });
});

describe("이어받기 요청의 결과 불명(응답 유실) 뒤 복구 (S1 §6.5)", () => {
  /** 첫 조회는 신원 없음(이전 요청 `old`가 거절된 상태로 남아 있을 수 있음), 요청은 응답 유실, 재조회는 `second`. */
  function lostRequest(second: InviteLookup | "fail", first: Partial<InviteLookup> = {}) {
    let lookups = 0;
    let posts = 0;
    server.use(
      http.get(apiUrl(INVITE), () => {
        lookups += 1;
        if (lookups === 1) return HttpResponse.json(fixtures.inviteLookup(first));
        return second === "fail" ? HttpResponse.error() : HttpResponse.json(second);
      }),
      http.post(apiUrl(`${INVITE}/claims`), () => {
        posts += 1;
        return HttpResponse.error();
      }),
    );
    return { lookups: () => lookups, posts: () => posts };
  }

  it("재조회가 PENDING이면 그 요청으로 대기한다(같은 키로 자동 재전송하지 않음)", async () => {
    const counts = lostRequest(fixtures.inviteLookup({ identity: "PENDING", claim: claim({ id: "new" }) }));
    mount();
    await requestClaim(userEvent.setup());
    expect(await screen.findByRole("heading", { name: WAITING_TITLE })).toBeInTheDocument();
    expect(counts.posts()).toBe(1);
    expect(counts.lookups()).toBe(2);
  });

  it("그 사이 승인됐으면(PARTICIPANT) 입장 요청으로 복원해 방 화면에 들어간다", async () => {
    lostRequest(fixtures.inviteLookup({ identity: "PARTICIPANT" }));
    server.use(
      http.post(apiUrl(`${INVITE}/members`), () =>
        HttpResponse.json({
          room: { id: fixtures.room.id, name: fixtures.room.name, unit: fixtures.room.unit, status: "IN_PROGRESS" },
          me: fixtures.guestParticipant,
        }),
      ),
    );
    mount();
    await requestClaim(userEvent.setup());
    expect(await screen.findByRole("heading", { name: "누적 손익" })).toBeInTheDocument();
  });

  it("그 사이 거절된 새 요청이면 그 결과를 안내하고 선택으로 간다", async () => {
    lostRequest(
      fixtures.inviteLookup({ claim: claim({ id: "new", status: "REJECTED", rejectReason: "TARGET_CLAIMED" }) }),
    );
    mount();
    await requestClaim(userEvent.setup());
    expect(await screen.findByText("다른 요청이 승인되어 이 요청은 거절되었습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "새로 입장하기" })).toBeInTheDocument();
  });

  it("요청이 저장되지 않았으면 결과를 확인하지 못했다고 안내한다", async () => {
    lostRequest(fixtures.inviteLookup({ claim: null }));
    mount();
    await requestClaim(userEvent.setup());
    expect(await screen.findByText(new RegExp(RESULT_UNCONFIRMED))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "새로 입장하기" })).toBeInTheDocument();
  });

  it("이전 요청의 결과만 남아 있으면 이번 결과로 단정하지 않고 확인 불가를 안내한다", async () => {
    const old = claim({ id: "old", status: "REJECTED", rejectReason: "HOST_REJECTED" });
    lostRequest(fixtures.inviteLookup({ claim: old }), { claim: old });
    mount();
    // 진입 때 이전 요청의 결과를 한 번 안내한다.
    expect(await screen.findByText("방장이 이어받기 요청을 거절했습니다.")).toBeInTheDocument();
    await requestClaim(userEvent.setup());
    expect(await screen.findByText(new RegExp(RESULT_UNCONFIRMED))).toBeInTheDocument();
    expect(screen.queryByText("방장이 이어받기 요청을 거절했습니다.")).not.toBeInTheDocument();
  });

  it("재조회도 실패하면 결과를 확인하지 못했다며 `다시 확인`을 보이고, 누를 때만 다시 조회한다", async () => {
    const counts = lostRequest("fail");
    mount();
    await requestClaim(userEvent.setup());
    expect(await screen.findByRole("button", { name: "다시 확인" })).toBeInTheDocument();
    expect(screen.getByText(RESULT_UNCONFIRMED)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(counts.lookups()).toBe(2);
    await userEvent.click(screen.getByRole("button", { name: "다시 확인" }));
    await waitFor(() => expect(counts.lookups()).toBe(3));
  });
});

describe("요청 취소의 결과 불명·이미 처리됨 (S1 §6.5)", () => {
  /** 대기 화면에서 취소가 `cancel`로 끝나고 내 요청 조회가 `status`를 돌려준다. */
  async function cancelWith(cancel: "lost" | "resolved", status: MyClaim | "fail") {
    storage.setItem(STORAGE_NAME, "p".repeat(43));
    const checks: string[] = [];
    server.use(
      http.get(apiUrl(INVITE), () => HttpResponse.json(fixtures.inviteLookup({ identity: "PENDING", claim: claim() }))),
      http.post(apiUrl(`${INVITE}/claims/:id/cancel`), () =>
        cancel === "lost" ? HttpResponse.error() : errorResponse("CLAIM_ALREADY_RESOLVED", { message: "이미 처리된 요청입니다" }),
      ),
      http.get(apiUrl(`${INVITE}/claims/:id`), ({ params }) => {
        checks.push(String(params.id));
        return status === "fail" ? HttpResponse.error() : HttpResponse.json({ claim: status });
      }),
      http.post(apiUrl(`${INVITE}/members`), () =>
        HttpResponse.json({
          room: { id: fixtures.room.id, name: fixtures.room.name, unit: fixtures.room.unit, status: "IN_PROGRESS" },
          me: fixtures.guestParticipant,
        }),
      ),
    );
    mount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "요청 취소" }));
    await waitFor(() => expect(checks).toEqual(["claim-1"]));
  }

  it("결과 불명 뒤 PENDING이면 대기를 유지하고 취소되지 않았다고 안내한다", async () => {
    await cancelWith("lost", claim());
    expect(await screen.findByText(/요청이 취소되지 않았습니다/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: WAITING_TITLE })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "요청 취소" })).toBeEnabled();
  });

  it("이미 처리됨 뒤 APPROVED면 입장 요청으로 복원한다", async () => {
    await cancelWith("resolved", claim({ status: "APPROVED" }));
    expect(await screen.findByRole("heading", { name: "누적 손익" })).toBeInTheDocument();
  });

  it("이미 처리됨 뒤 REJECTED면 사유를 안내하고 선택으로 간다", async () => {
    await cancelWith("resolved", claim({ status: "REJECTED", rejectReason: "HOST_REJECTED" }));
    expect(await screen.findByText("방장이 이어받기 요청을 거절했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "새로 입장하기" })).toBeInTheDocument();
  });

  it("결과 불명 뒤 CANCELED면 이번 취소의 결과라고 단정하지 않는 문구로 선택에 간다", async () => {
    await cancelWith("lost", claim({ status: "CANCELED" }));
    expect(await screen.findByText("이어받기 요청이 취소된 상태입니다.")).toBeInTheDocument();
    expect(screen.queryByText("이어받기 요청을 취소했습니다.")).not.toBeInTheDocument();
  });

  it("확인 조회까지 실패하면 대기를 유지하고 확인하지 못했다고 안내한다", async () => {
    await cancelWith("lost", "fail");
    expect(await screen.findByText(/요청 상태를 계속 확인합니다/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: WAITING_TITLE })).toBeInTheDocument();
  });
});

describe("문구", () => {
  it("신원 키 안내는 이어받기로 되찾을 수 있고 방장 권한은 되찾을 수 없다고 알린다(S1 §3.1·§9)", () => {
    expect(IDENTITY_KEY_NOTICE).toContain("서버도 복구할 수 없으며");
    expect(IDENTITY_KEY_NOTICE).toContain("방장의 승인을 받아 이어받기로만 되찾을 수 있습니다");
    expect(IDENTITY_KEY_NOTICE).toContain("방장 권한은 되찾을 수 없습니다");
    expect(IDENTITY_KEY_NOTICE).not.toContain("내 기록과 방장 권한을 되찾을 수 없습니다");
  });

  it("닉네임 뒤 조사 (으)로를 받침에 맞춘다", () => {
    expect(withRo("나래")).toBe("나래로");
    expect(withRo("다온")).toBe("다온으로");
    expect(withRo("하늘")).toBe("하늘로"); // ㄹ 받침
    expect(withRo("Chip")).toBe("Chip(으)로");
    expect(claimConfirmTitle("다온")).toBe("다온으로 이어받을까요?");
  });
});
