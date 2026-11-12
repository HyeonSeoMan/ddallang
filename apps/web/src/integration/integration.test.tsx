// 실서버 연동 점검(FE-I1, plan §4.2·§4.3): 실제 백엔드·PostgreSQL에 실제 FE 화면 클라이언트를 연결해
// 모의 서버로는 끝낼 수 없는 R 항목을 확인한다. 기본 `pnpm test`에는 포함되지 않는다.
// 실행: `INTEGRATION_API_BASE_URL=http://localhost:3101 pnpm test:integration`.
// 접속자 화면은 실제 `InviteScreen`을 jsdom에 렌더링한다(지연 측정과 같은 방식). 같은 브라우저 두 탭 첫 입장은
// 실브라우저 수동 점검이며 이 파일의 대상이 아니다.
import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { connectionAtom } from "@/features/room/state";
import { isKnownErrorCode } from "@/lib/api";
import { mockClipboard } from "@/test/clipboard";
import { installFakeLocks } from "@/test/fake-locks";
import { installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { restoreNavigatorStubs } from "@/test/navigator-stub";
import { type LiveClient, mountClient, section } from "@/latency/client";
import {
  baseUrl,
  call,
  createLiveRoom,
  createTransaction,
  deleteTransaction,
  endGame,
  type LiveRoom,
  newKey,
  registerParticipant,
  setParticipantStatus,
  updateTransaction,
} from "@/latency/server";
import { type ServerItem, settlementMatches } from "./settlement-match";
import { installNetworkControl, keyPaths, type NetworkControl } from "./stream-control";

let storage: ReturnType<typeof installFakeStorage>;
let control: NetworkControl;
let run = 0;
const clients: LiveClient[] = [];
const report: string[] = [];

beforeAll(() => {
  storage = installFakeStorage();
  installFakeLocks();
});
afterEach(() => {
  clients.splice(0).forEach((c) => c.unmount());
  control?.restore();
  restoreNavigatorStubs();
});
afterAll(() => {
  process.stdout.write(`\n[연동 점검 보고]\n${report.join("\n")}\n\n`);
});

async function open(live: LiveRoom, ...indexes: number[]): Promise<LiveClient[]> {
  run += 1;
  const opened: LiveClient[] = [];
  for (const i of indexes) {
    const c = await mountClient(live, i, (code, key) => storage.setItem(`ddallang:identity:${code}`, key), run);
    clients.push(c);
    opened.push(c);
  }
  return opened;
}

const text = (c: LiveClient) => c.container.textContent ?? "";
const showsReason = (reason: string) => (el: HTMLElement) =>
  Array.from(el.querySelectorAll("span")).some((s) => s.textContent === `사유: ${reason}`);
const participantListed = (nickname: string) => (el: HTMLElement) =>
  Array.from(section(el, "참여자")?.querySelectorAll("li") ?? []).some((li) => li.textContent?.includes(nickname));
/** 거래 입력 구역의 선택지(지급자·수취자)에 있는 참여자 이름. */
const selectableNames = (el: HTMLElement) =>
  Array.from(section(el, "거래 입력")?.querySelectorAll("option") ?? []).map((o) => o.textContent);
const isInactiveBadge = (nickname: string) => (el: HTMLElement) =>
  Array.from(section(el, "참여자")?.querySelectorAll("li") ?? []).some(
    (li) => li.textContent?.includes(nickname) && Array.from(li.querySelectorAll("span")).some((x) => x.textContent === "비활성"),
  );
/** 구역 제목 틀은 남아도 안에 서버 데이터(목록 항목·폼·입력·선택지)가 있으면 그 구역 이름을 돌려준다. */
const serverDataIn = (el: HTMLElement, headings: string[]) =>
  headings.filter((h) => (section(el, h)?.querySelectorAll("li, form, input, select, option").length ?? 0) > 0);
const settlementShows = (items: ServerItem[]) => (el: HTMLElement) => settlementMatches(section(el, "예상 정산"), items);
const serverSettlement = async (live: LiveRoom) =>
  (await call<{ settlement: { items: ServerItem[] } }>("GET", `/rooms/${live.room.id}/settlement`, live.host.key)).body.settlement.items;
const buttonNames = (c: LiveClient) =>
  Array.from(c.container.querySelectorAll("button")).map((b) => b.getAttribute("aria-label") ?? b.textContent ?? "");
const UNKNOWN_NOTICE = /결과를 확인하지 못했습니다|저장 여부를 확인할 수 없습니다/;
const hasFinalSettlement = (el: HTMLElement) => section(el, "최종 정산") !== null;
const SEEN = 20_000;

async function mustSee(c: LiveClient, what: string, condition: (el: HTMLElement) => boolean, timeoutMs = SEEN) {
  const at = await c.observe(condition, timeoutMs);
  expect(at, `${what}: ${timeoutMs}ms 안에 화면에 반영되지 않음`).not.toBeNull();
}

describe("실서버 연동 점검 (FE-I1)", () => {
  it("[AC-VIEW-005-1][AC-VIEW-005-2][AC-VIEW-005-3][AC-VIEW-005-5][AC-SET-008-2][AC-ROOM-003-3][AC-SET-007-1][AC-ROOM-001-14] 두 접속자: 방장의 참여자 등록·거래 저장·게임 종료가 다른 접속자 화면에 새로고침 없이 반영되고 방 단위·복사가 일치한다", async () => {
    const live = await createLiveRoom(2, "달러");
    const [a, b] = await open(live, 0, 1);
    const user = userEvent.setup();
    const ui = within(a!.container);

    // 참여자 등록(방장 화면의 실제 폼)
    await user.type(ui.getByLabelText("참여자 닉네임"), "참2");
    await user.click(ui.getByRole("button", { name: "참여자 등록" }));
    await mustSee(b!, "참여자 등록", participantListed("참2"));
    await mustSee(b!, "참여자 등록이 거래 입력 선택지에 반영", (el) => selectableNames(el).includes("참2"));

    // 거래 저장 → 다른 접속자의 목록·예상 정산(방 단위 표시)이 바뀐다
    await user.selectOptions(ui.getByLabelText("지급자"), "참0");
    await user.selectOptions(ui.getByLabelText("수취자"), "참1");
    await user.type(ui.getByLabelText("금액"), "1234");
    await user.type(ui.getByLabelText("사유 (선택)"), "통합점검");
    await user.click(ui.getByRole("button", { name: "저장" }));
    await mustSee(b!, "거래 저장", showsReason("통합점검"));
    await mustSee(b!, "예상 정산(방 단위)", (el) => section(el, "예상 정산")?.textContent?.includes("1,234 달러") ?? false);
    expect(section(b!.container, "누적 손익")?.textContent).toContain("1,234 달러");

    // 참여자 비활성화 → 다른 접속자의 참여자 표시(비활성 배지)와 거래 입력 선택지(활성만)에 반영
    await user.click(ui.getByRole("button", { name: "참2 비활성화" }));
    await mustSee(b!, "참여자 상태 변경", isInactiveBadge("참2"));
    await mustSee(b!, "상태 변경이 거래 입력 선택지에 반영", (el) => !selectableNames(el).includes("참2"));

    // 게임 종료(확인 창 → 확정) → 두 화면이 최종 정산으로 바뀌고 변경 컨트롤이 사라진다
    await user.click(ui.getByRole("button", { name: "게임 종료" }));
    const dialog = within(document.body).getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "게임 종료" }));
    await mustSee(a!, "종료 직후 최종 정산(방장)", hasFinalSettlement);
    await mustSee(b!, "종료 변경 수신(다른 접속자)", hasFinalSettlement);
    expect(within(b!.container).queryByLabelText("금액")).toBeNull();

    // 정산 복사: 방 단위가 복사 텍스트에도 쓰인다
    const clipboard = mockClipboard();
    await user.click(within(b!.container).getByRole("button", { name: "정산 복사" }));
    await waitFor(() => expect(clipboard.written).toHaveLength(1));
    expect(clipboard.written[0]).toMatch(/→ .* 1,234 달러/);
    expect(clipboard.written[0]).toContain("게임 종료");
    report.push(`복사 텍스트 예: ${JSON.stringify(clipboard.written[0])}`);
  });

  it("[AC-SYS-002-1][AC-SYS-002-3] 끊김 중 일어난 거래·종료가 복구 뒤 화면에 반영된다(끊김 중에는 서버 값을 숨긴다)", async () => {
    control = installNetworkControl();
    const live = await createLiveRoom(2);
    await createTransaction(live, "끊김전");
    const [, b] = await open(live, 0, 1);
    const key = live.members[1]!.key;
    // 끊기기 전에는 서버 데이터가 보인다(이래야 "사라졌다"가 의미가 있다).
    expect(showsReason("끊김전")(b!.container)).toBe(true);
    expect(section(b!.container, "누적 손익")?.textContent).toContain("100 원");
    expect(section(b!.container, "누적 손익")?.textContent).not.toContain("200 원");
    expect(serverDataIn(b!.container, ["거래 내역", "참여자"])).toEqual(["거래 내역", "참여자"]);

    control.block(key);
    control.cut(key);
    await waitFor(() => expect(b!.store.get(connectionAtom)).toBe("disconnected"), { timeout: 10_000 });
    // 끊김 즉시 이전에 보이던 서버 값이 모두 숨겨지고 안내가 나온다(이전 값을 최신처럼 보이지 않는다).
    await waitFor(() => expect(showsReason("끊김전")(b!.container)).toBe(false), { timeout: 3_000 });
    expect(serverDataIn(b!.container, ["누적 손익", "거래 내역", "참여자", "예상 정산", "거래 입력"])).toEqual([]);
    expect(text(b!)).toContain("연결이 끊겨 최신 정보를 표시할 수 없습니다");

    await createTransaction(live, "끊김중");
    await endGame(live);
    await new Promise((r) => setTimeout(r, 1_500));
    // 끊김이 이어지는 동안(재동기화 전)에도 계속 숨겨져 있다.
    expect(showsReason("끊김전")(b!.container)).toBe(false);
    expect(showsReason("끊김중")(b!.container)).toBe(false);
    expect(serverDataIn(b!.container, ["누적 손익", "거래 내역", "참여자", "예상 정산", "거래 입력"])).toEqual([]);

    const t0 = Date.now();
    control.unblock(key);
    await mustSee(b!, "복구 뒤 종료 반영", hasFinalSettlement, 60_000);
    await mustSee(b!, "복구 뒤 거래 반영", showsReason("끊김중"), 5_000);
    // 복구 뒤 손익·참여자·상태·정산도 재조회되어 표시된다(끊김 중 생긴 거래가 손익에 반영되어야 한다).
    await mustSee(b!, "복구 뒤 누적 손익", (el) => section(el, "누적 손익")?.textContent?.includes("200 원") ?? false, 5_000);
    for (const nickname of ["참0", "참1"]) await mustSee(b!, `복구 뒤 참여자 ${nickname}`, participantListed(nickname), 5_000);
    expect(section(b!.container, "최종 정산")?.textContent).toContain("200 원");
    report.push(`끊김 복구: 차단 해제 후 최종 정산 표시까지 ${Date.now() - t0}ms`);
  });

  it("[AC-TXN-008-5][AC-SYS-002-5] 저장 응답 유실: 서버에는 저장됐고 화면은 성공을 단정하지 않으며, 같은 키로 수동 재시도하면 중복 없이 재생된다", async () => {
    control = installNetworkControl();
    const live = await createLiveRoom(2);
    const [a, b] = await open(live, 0, 1);
    const user = userEvent.setup();
    const ui = within(a!.container);

    control.dropNextTransactionResponse(live.members[0]!.key);
    await user.selectOptions(ui.getByLabelText("지급자"), "참0");
    await user.selectOptions(ui.getByLabelText("수취자"), "참1");
    await user.type(ui.getByLabelText("금액"), "500");
    await user.type(ui.getByLabelText("사유 (선택)"), "응답유실");
    await user.click(ui.getByRole("button", { name: "저장" }));

    await mustSee(b!, "응답을 잃은 저장이 서버에는 반영됨", showsReason("응답유실"));
    // 응답을 잃은 화면: 성공으로 단정하지 않고(결과 불명 안내·입력 유지) 자동 재전송도 없다.
    await waitFor(() => expect(text(a!)).toMatch(UNKNOWN_NOTICE), { timeout: 10_000 });
    expect((ui.getByLabelText("금액") as HTMLInputElement).value).toBe("500");

    // 이 화면이 끊겼다 복구된 뒤: 재조회로 목록에서 확인할 수 있어도 저장 여부를 확정해 보이지 않고, 자동 재전송은 없다.
    const aKey = live.members[0]!.key;
    control.block(aKey);
    control.cut(aKey);
    await waitFor(() => expect(a!.store.get(connectionAtom)).toBe("disconnected"), { timeout: 10_000 });
    control.unblock(aKey);
    await mustSee(a!, "복구 뒤 재조회로 목록에서 확인 가능", showsReason("응답유실"), 60_000);
    expect(text(a!)).toMatch(UNKNOWN_NOTICE);
    expect((ui.getByLabelText("금액") as HTMLInputElement).value).toBe("500");
    expect(control.log.filter((l) => l.method === "POST" && l.path.endsWith("/transactions"))).toHaveLength(1); // 자동 재전송 없음
    const retry = await waitFor(() => ui.getByRole("button", { name: /다시 시도/ }), { timeout: 10_000 });
    await user.click(retry);
    // 두 번째 요청의 응답이 도착해 `replayed`가 기록될 때까지 기다린다(요청 시작만으로는 아직 모른다).
    await waitFor(() => {
      const sent = control.log.filter((l) => l.method === "POST" && l.path.endsWith("/transactions"));
      expect(sent).toHaveLength(2);
      expect(sent[1]!.status).not.toBeNull();
    });

    const posts = control.log.filter((l) => l.method === "POST" && l.path.endsWith("/transactions"));
    expect(posts[1]!.idempotencyKey).toBe(posts[0]!.idempotencyKey); // 같은 키
    expect(posts[1]!.replayed).toBe(true); // 서버가 저장된 응답을 재생(Idempotent-Replayed)
    const list = await call<{ transactions: Array<{ reason: string | null }> }>("GET", `/rooms/${live.room.id}/transactions`, live.host.key);
    expect(list.body.transactions.filter((t) => t.reason === "응답유실")).toHaveLength(1); // 중복 없음
    report.push(`응답 유실 재시도: 같은 키 ${posts[0]!.idempotencyKey}, 재생 ${posts[1]!.replayed}, 서버 거래 1건`);
  });

  it("[AC-VIEW-005-5][AC-SET-008-2] 다른 접속자의 거래 생성·수정·삭제와 참여자 변경 뒤 예상 정산이 새로고침 없이 서버 값으로 갱신된다", async () => {
    control = installNetworkControl();
    const live = await createLiveRoom(3);
    const [b] = await open(live, 1);
    const area = () => section(b!.container, "예상 정산")?.textContent ?? "";
    const seeServer = async (what: string) => {
      const items = await serverSettlement(live);
      await mustSee(b!, what, settlementShows(items));
      return items;
    };

    const first = await createTransaction(live, "정산-생성", { payer: 0, payee: 1, amount: 300 });
    let items = await seeServer("거래 생성 뒤 예상 정산");
    expect(items.map((i) => i.amount)).toEqual([300]);
    const afterCreate = area();

    await updateTransaction(live, first.transaction.id, "정산-수정", 500);
    items = await seeServer("거래 수정 뒤 예상 정산");
    expect(items.map((i) => i.amount)).toEqual([500]);
    expect(area()).not.toBe(afterCreate); // 실제로 바뀌었다
    const afterUpdate = area();

    await createTransaction(live, "정산-둘째", { payer: 2, payee: 0, amount: 200 });
    items = await seeServer("둘째 거래 뒤 예상 정산");
    const afterSecond = area();
    expect(afterSecond).not.toBe(afterUpdate);

    await deleteTransaction(live, first.transaction.id);
    items = await seeServer("거래 삭제 뒤 예상 정산");
    expect(items.map((i) => i.amount)).toEqual([200]);
    expect(area()).not.toBe(afterSecond);

    // 참여자 변경(등록·상태 변경): 정산 값은 같아도 이 접속자가 그 이벤트 뒤에 정산을 **성공적으로 다시 조회**하고 서버와 일치한다
    // (비활성 참여자도 정산에 포함되어 값이 바뀌지 않는다). 이전 이벤트의 추가 갱신과 섞이지 않도록 조용해진 뒤 기준을 잡는다.
    const bKey = live.members[1]!.key;
    const calls = () => control.log.filter((l) => l.method === "GET" && l.path.endsWith("/settlement") && l.key === bKey);
    const okCalls = () => calls().filter((l) => l.status === 200).length;
    const quiet = async () => {
      let last = -1;
      let since = Date.now();
      for (;;) {
        const n = calls().length;
        if (n !== last || calls().some((l) => l.status === null)) {
          last = n;
          since = Date.now();
        } else if (Date.now() - since >= 800) return;
        await new Promise((r) => setTimeout(r, 100));
      }
    };
    const refetchAfter = async (change: () => Promise<unknown>, reflected: (el: HTMLElement) => boolean, what: string) => {
      await quiet();
      const before = okCalls();
      await change();
      await mustSee(b!, what, reflected);
      await waitFor(() => expect(okCalls()).toBeGreaterThan(before), { timeout: SEEN }); // 이 변경 뒤의 성공한(200) 정산 조회
      await quiet();
      expect(calls().filter((l) => l.status !== null && l.status !== 200)).toEqual([]); // 실패한 정산 조회 없음
    };
    await refetchAfter(() => registerParticipant(live.host, live.room.id, "참3"), participantListed("참3"), "참여자 등록");
    await seeServer("참여자 등록 뒤 예상 정산(서버와 일치)");
    await refetchAfter(
      () => setParticipantStatus(live.host, live.room.id, live.participants[2]!.id, "INACTIVE"),
      isInactiveBadge("참2"),
      "참여자 비활성화",
    );
    await seeServer("참여자 비활성화 뒤 예상 정산(서버와 일치)");
    report.push("예상 정산 갱신: 생성·수정·둘째 생성·삭제마다 서버 정산과 일치하고 화면이 바뀜, 참여자 등록·상태 변경마다 정산 재조회");
  });

  it("[AC-VIEW-005-4][AC-TXN-009-3][AC-PART-004-3] 종료되면 방장과 작성자 화면의 거래 입력·수정·삭제·참여자 등록·상태 변경·종료 컨트롤이 모두 잠긴다", async () => {
    const live = await createLiveRoom(2);
    await createTransaction(live, "잠금시험", { as: live.members[1] }); // 작성자는 접속자 1(비방장)
    const [a, b] = await open(live, 0, 1);
    const editButtons = (c: LiveClient) => buttonNames(c).filter((n) => /수정$/.test(n));
    const deleteButtons = (c: LiveClient) => buttonNames(c).filter((n) => /삭제$/.test(n));

    // 종료 전에는 컨트롤이 실제로 있다(이래야 "없어졌다"가 의미가 있다).
    for (const c of [a!, b!]) {
      expect(editButtons(c), `접속자 ${c.index} 수정`).not.toEqual([]);
      expect(deleteButtons(c), `접속자 ${c.index} 삭제`).not.toEqual([]);
      expect(within(c.container).queryByLabelText("금액")).not.toBeNull();
    }
    expect(within(a!.container).queryByLabelText("참여자 닉네임")).not.toBeNull();
    expect(buttonNames(a!).some((n) => /비활성화$/.test(n))).toBe(true);
    expect(buttonNames(a!)).toContain("게임 종료");

    await endGame(live);
    await mustSee(a!, "방장 화면 종료 반영", hasFinalSettlement);
    await mustSee(b!, "작성자 화면 종료 반영", hasFinalSettlement);
    for (const c of [a!, b!]) {
      expect(editButtons(c), `접속자 ${c.index} 종료 뒤 수정`).toEqual([]);
      expect(deleteButtons(c), `접속자 ${c.index} 종료 뒤 삭제`).toEqual([]);
      expect(within(c.container).queryByLabelText("금액")).toBeNull();
      expect(within(c.container).queryByLabelText("참여자 닉네임")).toBeNull();
      expect(buttonNames(c).filter((n) => /저장|참여자 등록|비활성화|재활성화|게임 종료/.test(n))).toEqual([]);
    }
  });

  it("오류 코드·헤더 계약: 오류 형식·알려진 코드·`Date`·`Idempotent-Replayed`·`Retry-After`가 FE가 기대한 대로다", async () => {
    const live = await createLiveRoom(2);
    const rooms = `/rooms/${live.room.id}`;
    const problems: string[] = [];
    const expectError = async (label: string, pending: ReturnType<typeof call>, status: number, code: string) => {
      const res = await pending;
      const error = (res.body as { error?: { code?: string; message?: unknown; details?: unknown } }).error;
      if (res.status !== status) problems.push(`${label}: 상태 ${res.status} (기대 ${status})`);
      else if (error?.code !== code) problems.push(`${label}: 코드 ${error?.code} (기대 ${code})`);
      if (!error || typeof error.message !== "string" || !Array.isArray(error.details)) problems.push(`${label}: 오류 형식이 {error:{code,message,details[]}}가 아님`);
      if (error?.code && !isKnownErrorCode(error.code)) problems.push(`${label}: FE가 모르는 코드 ${error.code}`);
    };

    await expectError("없는 초대 코드", call("GET", "/invites/none-none-none-none-none", newKey()), 404, "INVITE_NOT_FOUND");
    await expectError("신원 키 없음", fetch(`${baseUrl()}${rooms}`).then(async (r) => ({ status: r.status, body: await r.json() })), 401, "UNAUTHENTICATED");
    await expectError("닉네임 중복", call("POST", `/invites/${live.room.inviteCode}/members`, newKey(), { nickname: "방장" }), 409, "NICKNAME_TAKEN");
    await expectError("방 생성 검증", call("POST", "/rooms", newKey(), { name: "", unit: "원", nickname: "x" }), 422, "VALIDATION_FAILED");
    await expectError("방장 전용", call("POST", `${rooms}/participants`, live.members[1]!.key, { nickname: "비방장등록" }), 403, "HOST_ONLY");
    const unknownRoute = await call("GET", "/no-such-route", live.host.key);
    if (unknownRoute.status !== 404) problems.push(`없는 경로: 상태 ${unknownRoute.status}`);

    // 헤더: Date·Idempotent-Replayed
    const room = await fetch(`${baseUrl()}${rooms}`, { headers: { Authorization: `Bearer ${live.host.key}` } });
    if (!room.headers.get("Date")) problems.push("GET 방 조회에 Date 헤더가 없음");
    const idem = { "Idempotency-Key": newKey().slice(0, 22), "Idempotency-First-Attempt-At": new Date().toISOString() };
    const send = () =>
      fetch(`${baseUrl()}${rooms}/transactions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${live.host.key}`, "Content-Type": "application/json", ...idem },
        body: JSON.stringify({ payerId: live.participants[0]!.id, payeeId: live.participants[1]!.id, amount: 100 }),
      });
    const first = await send();
    const second = await send();
    if (first.headers.get("Idempotent-Replayed") === "true") problems.push("첫 요청에 Idempotent-Replayed: true");
    if (second.headers.get("Idempotent-Replayed") !== "true") problems.push(`재생 응답에 Idempotent-Replayed: true가 없음(상태 ${second.status})`);

    // 같은 접속자 연결: 1~5번째는 열리고 6번째는 429 CONNECTION_LIMIT_EXCEEDED + Retry-After: 30
    const aborts: AbortController[] = [];
    const statuses: number[] = [];
    let limitedBody: { error?: { code?: string } } = {};
    let retryAfter: string | null = null;
    for (let n = 0; n < 6; n++) {
      const abort = new AbortController();
      aborts.push(abort);
      const res = await fetch(`${baseUrl()}${rooms}/events`, { headers: { Authorization: `Bearer ${live.host.key}` }, signal: abort.signal });
      statuses.push(res.status);
      if (res.status === 429) {
        retryAfter = res.headers.get("Retry-After");
        limitedBody = (await res.json().catch(() => ({}))) as typeof limitedBody;
      }
    }
    aborts.forEach((x) => x.abort());
    if (statuses.slice(0, 5).some((x) => x !== 200) || statuses[5] !== 429) problems.push(`스트림 연결 상태 ${statuses.join(",")} (기대 200×5, 429)`);
    if (limitedBody.error?.code !== "CONNECTION_LIMIT_EXCEEDED") problems.push(`429 코드 ${limitedBody.error?.code} (기대 CONNECTION_LIMIT_EXCEEDED)`);
    if (retryAfter !== "30") problems.push(`429 Retry-After=${retryAfter} (기대 30)`);

    // 종료 뒤 변경은 GAME_ENDED
    await endGame(live);
    await expectError("종료 뒤 거래", call("POST", `${rooms}/transactions`, live.host.key, { payerId: live.participants[0]!.id, payeeId: live.participants[1]!.id, amount: 1 }, true), 409, "GAME_ENDED");

    report.push(problems.length === 0 ? "오류 코드·헤더 계약: 차이 없음" : `오류 코드·헤더 계약 차이:\n- ${problems.join("\n- ")}`);
    expect(problems).toEqual([]);
  });

  it("모의 fixture와 실서버 응답의 모양 차이 목록(fixture에 있는 필드가 실서버에 없으면 불합격)", async () => {
    const live = await createLiveRoom(2);
    await createTransaction(live, "모양");
    const get = async (path: string, key = live.host.key) => (await call("GET", path, key)).body;
    const checks: Array<[string, unknown, unknown]> = [
      ["GET /rooms/{id}", await get(`/rooms/${live.room.id}`), { room: fixtures.room, me: fixtures.hostMember }],
      ["GET /rooms/{id}/participants", await get(`/rooms/${live.room.id}/participants`), { participants: fixtures.participants }],
      ["GET /rooms/{id}/balances", await get(`/rooms/${live.room.id}/balances`), { balances: fixtures.balances }],
      ["GET /rooms/{id}/transactions", await get(`/rooms/${live.room.id}/transactions`), { transactions: fixtures.transactions, nextCursor: null }],
      ["GET /rooms/{id}/settlement", await get(`/rooms/${live.room.id}/settlement`), { settlement: fixtures.expectedSettlement }],
    ];
    const missing: string[] = [];
    for (const [label, real, fixture] of checks) {
      const realPaths = new Set(keyPaths(real));
      const fixturePaths = new Set(keyPaths(fixture));
      const absent = [...fixturePaths].filter((p) => !realPaths.has(p));
      const extra = [...realPaths].filter((p) => !fixturePaths.has(p));
      if (absent.length > 0) missing.push(`${label}: 실서버에 없는 필드 ${absent.join(", ")}`);
      report.push(`${label}: fixture에만 있음 [${absent.join(", ")}], 실서버에만 있음 [${extra.join(", ")}]`);
    }
    expect(missing).toEqual([]);
  });
});
