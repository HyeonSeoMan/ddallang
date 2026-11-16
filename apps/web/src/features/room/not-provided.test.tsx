import { screen, waitFor } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createStore } from "jotai";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { ParticipantsSection } from "@/features/participants/participants-section";
import { installFakeLocks } from "@/test/fake-locks";
import { installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { apiUrl } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { seedRoom } from "@/test/room-seed";
import { createFakeBackend } from "@/test/stateful-server";
import { InviteScreen } from "./invite-screen";
import { AllPages } from "@/test/all-pages";
import { RoomInfo } from "./room-info";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => null }));

const SRC = join(process.cwd(), "src");

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/** 제공하지 않는 기능을 가리키는 컨트롤 문구(S1 §4.8, 2.0.0: 이어받기 밖의 신원 연결·해제·이동, 이어받기 요청 수정). */
const FORBIDDEN_CONTROL =
  /방 코드|코드 입력|최근 방|방 이름 (변경|수정)|정산 단위 (변경|수정)|닉네임 (변경|수정|바꾸)|이름 (변경|수정)|방장 (이전|넘기|변경)|강제 퇴장|내보내기|추방|링크 재발급|재발급|새 링크|연결 해제|참여자 연결|계정 연결|신원 (연결|해제|이동|옮기)|다른 기기로 (이동|옮기)|참여자 (전환|바꾸기)|요청 (수정|변경)|이어받기 (수정|변경)|다른 참여자로 (전환|이동)/;

beforeEach(() => {
  installFakeStorage();
  installFakeLocks();
});

describe("S1 비제공 UI 점검", () => {
  it("[AC-ROOM-002-2] 방 코드 입력 화면이 없다(첫 화면은 방 만들기뿐이다)", () => {
    renderApp(<HomePage />);
    expect(screen.queryByLabelText(/방 코드|초대 코드|코드 입력/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("textbox").map((t) => (t as HTMLInputElement).labels?.[0]?.textContent)).toEqual([
      "방 이름",
      "내 닉네임",
    ]);
    expect(document.body.textContent).not.toMatch(FORBIDDEN_CONTROL);
  });

  it("[AC-ROOM-002-3] 최근 방 목록 화면이 없다(저장소에서 방 목록을 읽지 않는다)", () => {
    const storage = installFakeStorage();
    storage.setItem("ddallang:identity:old-room", "x".repeat(43)); // 이전에 입장한 방이 있어도
    renderApp(<HomePage />);
    expect(screen.queryByText(/최근|이전 방|내 방/)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryAllByRole("list")).toHaveLength(0);
  });

  it("[AC-ROOM-003-1][AC-ROOM-006-8][AC-PART-003-1] 방 정보·닉네임·참여자 이름을 바꾸는 UI가 없다", () => {
    const store = createStore();
    seedRoom(store);
    renderApp(
      <main>
        <RoomInfo />
        <ParticipantsSection />
      </main>,
      store,
    );
    // 방장 화면에서도 버튼은 복사·상태 변경·등록뿐이다.
    const names = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent);
    expect(names).toEqual([
      "초대 링크 복사",
      "나래 비활성화",
      "다온 재활성화",
      "참여자 등록",
    ]);
    // 읽기 전용 초대 링크와 참여자 등록 입력 외에 입력이 없다.
    expect(screen.getAllByRole("textbox").map((t) => (t as HTMLInputElement).labels?.[0]?.textContent)).toEqual([
      "초대 링크",
      "참여자 닉네임",
    ]);
    expect(document.body.textContent).not.toMatch(FORBIDDEN_CONTROL);
  });

  it("[AC-ROOM-004-4] 이어받기 밖의 신원 연결·해제·이동 컨트롤이 방 화면에 없다(방장 화면 포함)", async () => {
    const backend = createFakeBackend();
    const KEY = "q".repeat(43);
    backend.identities.set(KEY, fixtures.hostParticipant.id);
    server.use(...backend.handlers);
    installFakeStorage().setItem(`ddallang:identity:${fixtures.INVITE_CODE}`, KEY);
    renderApp(<InviteScreen inviteCode={fixtures.INVITE_CODE}><AllPages /></InviteScreen>);
    await waitFor(() => expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0));
    // 대기 중인 이어받기 요청이 있어 방장 구역(승인·거절)이 보이는 상태에서도 그 밖의 신원 컨트롤은 없다.
    await fetch(apiUrl(`/invites/${fixtures.INVITE_CODE}/claims`), {
      method: "POST",
      headers: { Authorization: `Bearer ${"r".repeat(43)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "나래" }),
    });
    await screen.findByRole("region", { name: "이어받기 요청" });
    expect(document.body.textContent).not.toMatch(FORBIDDEN_CONTROL);
    expect(screen.queryByText(/연결|해제|내 참여자|나로 선택|전환/)).not.toBeInTheDocument();
    const buttons = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent ?? "");
    expect(buttons.filter((name) => /이어받기|신원/.test(name))).toEqual(["나래 이어받기 승인", "나래 이어받기 거절"]);
  });

  it("[AC-ROOM-006-8] [AC-ROOM-004-4] 초대 화면의 이어받기는 후보를 고를 뿐 닉네임 입력·요청 수정이 없다", async () => {
    server.use(...createFakeBackend().handlers);
    renderApp(<InviteScreen inviteCode={fixtures.INVITE_CODE}><AllPages /></InviteScreen>);
    const user = (await import("@testing-library/user-event")).default.setup();
    await user.click(await screen.findByRole("button", { name: "기존 참여자 이어받기" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument(); // 이어받기는 닉네임을 새로 정하지 않는다
    expect(document.body.textContent).not.toMatch(FORBIDDEN_CONTROL);
    await user.click(screen.getByRole("button", { name: "나래" }));
    await user.click(screen.getByRole("button", { name: "요청" }));
    await screen.findByRole("heading", { name: "방장의 승인을 기다리는 중" });
    // 대기 중에 할 수 있는 것은 요청 취소뿐이다(요청 수정 없음).
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["요청 취소"]);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("방장 이전·강제 퇴장·링크 재발급은 방 화면 전체에서 찾을 수 없다", async () => {
    server.use(...createFakeBackend().handlers);
    server.use(
      http.get(apiUrl(`/invites/${fixtures.INVITE_CODE}`), () =>
        HttpResponse.json({ room: { name: "방", unit: "원", status: "IN_PROGRESS" }, identity: "NONE", claim: null, claimableNicknames: [] }),
      ),
    );
    const store = createStore();
    seedRoom(store); // 방금 만든 방: 요청 없이 방 화면
    renderApp(<InviteScreen inviteCode={fixtures.INVITE_CODE}><AllPages /></InviteScreen>, store);
    await waitFor(() => expect(screen.getByRole("heading", { name: "참여자" })).toBeInTheDocument());
    expect(document.body.textContent).not.toMatch(FORBIDDEN_CONTROL);
  });

  it("정의된 화면 라우트는 `/`와 초대 링크 아래 4개 페이지(현황·기록·정산·방)뿐이다(`/rooms/…` 등 그 밖의 경로는 404)", () => {
    const pages = listFiles(join(SRC, "app"))
      .filter((file) => /(^|\/)(page|route)\.(ts|tsx)$/.test(file))
      .map((file) => relative(join(SRC, "app"), file))
      .sort();
    expect(pages).toEqual([
      "invite/[inviteCode]/page.tsx",
      "invite/[inviteCode]/record/page.tsx",
      "invite/[inviteCode]/room/page.tsx",
      "invite/[inviteCode]/settlement/page.tsx",
      "page.tsx",
    ]);
  });

  it("[AC-ROOM-004-4] 소스에 제공하지 않는 기능의 API 호출이 없다(허용 목록: 참여자 상태 PATCH, 거래 수정·삭제 PUT/DELETE. 이어받기는 POST·GET뿐)", () => {
    const sources = listFiles(SRC).filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.|\/test\//.test(file));
    const offenders: string[] = [];
    // 방·RoomMember·참여자를 수정·삭제하는 메서드 리터럴은 허용된 파일에만 있다.
    const allowed: Record<string, string[]> = {
      PATCH: ["participants-section.tsx"], // 참여자 상태 변경
      PUT: ["transaction-actions.tsx"], // 거래 수정(S2)
      DELETE: ["transaction-actions.tsx"], // 거래 삭제(S2)
    };
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      if (/regenerate|reissue|transfer[-_ ]?host|forceLeave|\bkick\b|links?\/new/i.test(text)) offenders.push(file);
      // 이어받기 밖의 신원 연결·해제·이동 경로(S1 §4.8 2.0.0): 그런 API 경로 리터럴이 없다.
      if (/\/(rooms|invites)\/[^"`\n]*\/(identity|identities|link|unlink|relink|move|transfer)\b/.test(text)) {
        offenders.push(`${relative(SRC, file)}: identity path`);
      }
      for (const match of text.matchAll(/method:\s*"(PATCH|PUT|DELETE)"/g)) {
        const verb = match[1]!;
        if (!allowed[verb]!.some((name) => file.endsWith(name))) offenders.push(`${relative(SRC, file)}: ${verb}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("스캔 규칙 자체 시험: 허용되지 않은 PATCH·DELETE 리터럴과 신원 이동 경로를 잡는다", () => {
    const sample = 'request({ method: "PATCH", path: `/rooms/${id}/members/${m}` })';
    expect(/method:\s*"(PATCH|PUT|DELETE)"/.test(sample)).toBe(true);
    const identityPath = /\/(rooms|invites)\/[^"`\n]*\/(identity|identities|link|unlink|relink|move|transfer)\b/;
    expect(identityPath.test("path: `/rooms/${roomId}/participants/${id}/unlink`")).toBe(true);
    expect(identityPath.test('import Link from "next/link";')).toBe(false);
    expect(identityPath.test("path: `/invites/${code}/claims/${id}/cancel`")).toBe(false);
  });
});
