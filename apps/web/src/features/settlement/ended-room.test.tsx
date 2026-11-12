import { waitFor, within } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createStore } from "jotai";
import { beforeEach, describe, expect, it } from "vitest";
import { InviteScreen } from "@/features/room/invite-screen";
import { connectionAtom, sessionAtom, snapshotAtom } from "@/features/room/state";
import { expectNoA11yViolations } from "@/test/a11y";
import { installFakeLocks } from "@/test/fake-locks";
import { installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderApp } from "@/test/render";
import { INVITE_CODE } from "@/test/room-seed";
import { createFakeBackend, type FakeBackend } from "@/test/stateful-server";

const SRC = join(process.cwd(), "src");
/** 방 API 경로(`/rooms/.../<세그먼트>`)에 확정·재개·버전·송금 상태 세그먼트가 있는지(컴포넌트 import 경로는 대상이 아니다). */
const FORBIDDEN_API = /rooms\/[^"'`\s]*\/(confirm|confirmation|reopen|resume|versions?|paid|payment|restore)\b/;
let backend: FakeBackend;
let store: ReturnType<typeof createStore>;

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/** 종료된 방의 상태: 서버가 `ENDED`와 `FINAL`을 일관되게 돌려준다. */
beforeEach(() => {
  installFakeStorage().setItem(`ddallang:identity:${INVITE_CODE}`, "k".repeat(43));
  installFakeLocks();
  backend = createFakeBackend();
  backend.room = { ...backend.room, status: "ENDED" };
  backend.settlement = { kind: "FINAL", items: fixtures.finalSettlement.items };
  server.use(...backend.handlers);
  store = createStore();
});

async function mountEnded(me = fixtures.hostMember) {
  backend.me = me; // 화면은 재조회한 방 응답의 me를 쓰므로 서버 응답도 같은 접속자로 맞춘다
  store.set(sessionAtom, { inviteCode: INVITE_CODE, roomId: fixtures.room.id, me });
  const view = renderApp(<InviteScreen inviteCode={INVITE_CODE} />, store);
  await waitFor(() => expect(store.get(connectionAtom) === "connected" && store.get(snapshotAtom) !== null).toBe(true), { timeout: 4000 });
  return view;
}

/** 종료 후에 남아 있으면 안 되는 변경·확정 컨트롤의 이름. */
const FORBIDDEN_BUTTONS = /^저장|수정|삭제|참여자 등록|비활성화|재활성화|게임 종료$|확정|재개|다시 열기|정정|송금 완료|버전/;

describe("종료 후 잠금·비제공 통합 (FE-S4-4)", () => {
  it("[AC-VIEW-005-4][AC-TXN-009-3][AC-PART-004-3] 종료된 방에서는 방장에게도 입력·수정·삭제·참여자·종료 컨트롤이 모두 없다", async () => {
    const { container } = await mountEnded();
    const ui = within(container);
    expect(ui.queryByLabelText("금액")).not.toBeInTheDocument(); // 거래 입력
    expect(ui.queryByLabelText("참여자 닉네임")).not.toBeInTheDocument(); // 참여자 등록
    // 남은 버튼은 복사류뿐이다(초대 링크 복사, 정산 복사). 변경 컨트롤은 하나도 없다.
    const names = ui.getAllByRole("button").map((b) => b.textContent);
    expect(names.sort()).toEqual(["정산 복사", "초대 링크 복사"].sort());
    expect(ui.queryAllByRole("button", { name: FORBIDDEN_BUTTONS })).toHaveLength(0);
  });

  it("정산 영역은 `최종 정산`이고 `게임 종료` 배지가 있다(종료 때 같은 영역이 바뀜)", async () => {
    const { container } = await mountEnded();
    const ui = within(container);
    expect(ui.getByRole("heading", { name: "최종 정산" })).toBeInTheDocument();
    expect(ui.queryByRole("heading", { name: "예상 정산" })).not.toBeInTheDocument();
    expect(ui.getAllByText("게임 종료", { selector: "span" }).length).toBeGreaterThan(0);
  });

  it("[AC-TXN-009-3] 종료 후 입장한 접속자(비방장)에게도 변경 컨트롤이 없고 목록·손익·정산은 보인다", async () => {
    const { container } = await mountEnded(fixtures.guestMember);
    expect(store.get(snapshotAtom)?.me.isHost).toBe(false); // 실제로 비방장 스냅샷을 검사하는지 확인
    const ui = within(container);
    expect(ui.queryAllByRole("button", { name: FORBIDDEN_BUTTONS })).toHaveLength(0);
    expect(ui.queryByLabelText("금액")).not.toBeInTheDocument();
    expect(ui.getByRole("heading", { name: "최종 정산" })).toBeInTheDocument();
    expect(ui.getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("[AC-SET-007-2] 확정·확정 취소·버전·송금 완료·재개·정정 UI가 없다", async () => {
    const { container } = await mountEnded();
    expect(container.textContent).not.toMatch(/확정|버전|송금 완료|송금했|재개|다시 열|정정|되돌리기/);
    expect(within(container).queryAllByRole("checkbox")).toHaveLength(0); // 송금 완료 체크 같은 것이 없다
  });

  it("접근성 검사를 통과한다", async () => {
    const { container } = await mountEnded();
    await expectNoA11yViolations(container);
  });

  it("스캔 규칙 자체 시험: 확정·재개 API 경로는 잡고 컴포넌트 import 경로는 잡지 않는다", () => {
    expect(FORBIDDEN_API.test('path: `/rooms/${id}/settlement/confirm`')).toBe(true);
    expect(FORBIDDEN_API.test('request({ path: `/rooms/${id}/reopen` })')).toBe(true);
    expect(FORBIDDEN_API.test('import { ConfirmDialog } from "@/ui/confirm-dialog";')).toBe(false);
    expect(FORBIDDEN_API.test('path: `/rooms/${id}/end`')).toBe(false);
  });

  it("[AC-SET-007-2] 소스에 확정·재개·버전·송금 상태 API 호출이 없고 종료 요청은 종료 컨트롤 하나에만 있다(자동 종료·재개 경로 없음)", () => {
    const sources = listFiles(SRC).filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.|\/test\//.test(file));
    const offenders: string[] = [];
    const endCallers: string[] = [];
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      if (FORBIDDEN_API.test(text)) offenders.push(relative(SRC, file));
      if (/\/end`|\/end"/.test(text)) endCallers.push(relative(SRC, file));
    }
    expect(offenders).toEqual([]);
    expect(endCallers).toEqual(["features/settlement/end-game.tsx"]); // 종료 요청은 한 곳(방장이 확인한 뒤)뿐이다
  });
});
