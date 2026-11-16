// 화면 반영 지연 측정(FE-S5-6 → 2.0.0 FE-M8, S5 §6.7 v0.3.0, AC-VIEW-005-8·005-9): 실서버에 방마다 실제 FE 클라이언트를 연결하고
// 변경 종류별로 T0(요청 송신 시각, 보수 기준)부터 각 접속자 화면에 새 값이 보이기까지를 잰다.
// 기본 `pnpm test`에는 포함되지 않는다. 실행: `LATENCY_API_BASE_URL=http://localhost:3001 pnpm test:latency`.
// 한계: jsdom의 DOM 변경 시각까지이며 브라우저 페인트 시간은 포함하지 않는다.
import { writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { installFakeLocks } from "@/test/fake-locks";
import { installFakeStorage } from "@/test/fake-storage";
import { ACCESS_LOST_NOTICE } from "@/features/room/messages";
import { type LiveClient, mountClient, mountRequester, section } from "./client";
import {
  approveClaim,
  cancelClaim,
  createLiveRoom,
  createTransaction,
  deleteTransaction,
  endGame,
  joinRoom,
  type LiveRoom,
  newKey,
  recentTransactions,
  registerParticipant,
  rejectClaim,
  requestClaim,
  seedTransactions,
  setParticipantStatus,
  updateTransaction,
} from "./server";
import { judge, summarize } from "./stats";

const SCREEN_LIMITS = { p95Ms: 3_000, maxMs: 5_000 };
const CONVERGE_LIMIT_MS = 20_000;
/** 이 시간 안에 화면에 반영되지 않으면 그 표본은 실패(시간 초과)로 센다. */
const WAIT_MS = 15_000;
const COUNT = Number(process.env.LATENCY_COUNT ?? 100);
const ROOMS = Number(process.env.LATENCY_ROOMS ?? 10);
const CONVERGE_SAMPLES = Number(process.env.LATENCY_CONVERGE ?? 10);

const samples: Record<string, number[]> = {};
const timeouts: Record<string, number> = {};
const failures: string[] = [];
let runId = 0;
let storage: ReturnType<typeof installFakeStorage>;

beforeAll(() => {
  storage = installFakeStorage();
  installFakeLocks();
});

const KINDS = ["create", "editdelete", "status", "add", "join", "end", "lost", "claimreq", "claimresult", "revoked", "revokedlost"];
const requested = process.env.LATENCY_ONLY?.split(",").filter(Boolean);
if (requested?.some((name) => !KINDS.includes(name))) {
  throw new Error(`LATENCY_ONLY는 ${KINDS.join(", ")} 중에서 고른다.`);
}
/** 정식 측정: §6.7의 종류·횟수·방 수를 모두 채운 실행. 축소 실행은 정식 합격이 아니다. */
const FULL = !requested && COUNT >= 100 && ROOMS >= 10 && CONVERGE_SAMPLES >= 10;
const only = (name: string) => !process.env.LATENCY_ONLY || process.env.LATENCY_ONLY.split(",").includes(name);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function openClients(live: LiveRoom): Promise<LiveClient[]> {
  runId += 1;
  const run = runId;
  const clients: LiveClient[] = [];
  for (let i = 0; i < live.members.length; i++) {
    clients.push(await mountClient(live, i, (code, key) => storage.setItem(`ddallang:identity:${code}`, key), run));
  }
  return clients;
}

const closeClients = (clients: LiveClient[]) => clients.forEach((c) => c.unmount());

/** 변경 한 건: 관측을 먼저 걸고, T0(요청 송신 직전)부터 각 화면이 조건을 만족하기까지를 기록한다. */
async function measure(
  kind: string,
  clients: LiveClient[],
  send: () => Promise<unknown>,
  condition: (container: HTMLElement) => boolean,
) {
  // 사전 점검: 변경 전에는 조건이 거짓이어야 한다(처음부터 참이면 0ms로 잘못 합격한다).
  const already = clients.filter((c) => c.holds(condition)).map((c) => c.index);
  if (already.length > 0) throw new Error(`${kind}: 변경 전에 이미 조건을 만족한 화면 ${already.join(",")} (측정 무효)`);
  const watches = clients.map((c) => c.observe(condition, WAIT_MS));
  const t0 = Date.now();
  await send();
  const seen = await Promise.all(watches);
  for (const [i, at] of seen.entries()) {
    if (at === null) {
      timeouts[kind] = (timeouts[kind] ?? 0) + 1;
      const stuck = clients[i]!;
      process.stdout.write(`[시간 초과] ${kind} 화면 ${stuck.index}: ${(stuck.container.textContent ?? "").slice(0, 400)}\n`);
      (samples[kind] ??= []).push(WAIT_MS);
    } else {
      (samples[kind] ??= []).push(at - t0);
    }
  }
  // 다음 변경이 앞 변경의 남은 갱신과 겹치지 않게 한다(변경은 한 번에 하나, §6.7).
  await sleep(150);
}

/** 방 밖 화면(요청자·접근 상실) 한 건: 연결 상태와 무관하게 조건만 본다. */
async function measureRaw(
  kind: string,
  client: LiveClient,
  send: () => Promise<unknown>,
  condition: (container: HTMLElement) => boolean,
  limitMs = WAIT_MS,
) {
  if (condition(client.container)) throw new Error(`${kind}: 변경 전에 이미 조건을 만족함(측정 무효)`);
  const watch = client.observeRaw(condition, limitMs);
  const t0 = Date.now();
  await send();
  const at = await watch;
  if (at === null) {
    timeouts[kind] = (timeouts[kind] ?? 0) + 1;
    process.stdout.write(`[시간 초과] ${kind}: ${(client.container.textContent ?? "").slice(0, 400)}\n`);
  }
  (samples[kind] ??= []).push(at === null ? limitMs : at - t0);
  await sleep(150);
}

const saveKey = (code: string, key: string) => storage.setItem(`ddallang:identity:${code}`, key);
const claimRow = (nickname: string) => (container: HTMLElement) =>
  (section(container, "이어받기 요청")?.textContent ?? "").includes(`${nickname} 이어받기 요청`);
/** 접근 상실 안내가 보이고 데이터 영역(방 화면)이 닫혔다(S5 §6.7 "안내·차단", 검수 F7). */
const accessLost = (container: HTMLElement) =>
  (container.textContent ?? "").includes(ACCESS_LOST_NOTICE) && section(container, "누적 손익") === null;
/** 요청자 화면이 방 화면(현황)으로 들어갔다. */
const inRoom = (container: HTMLElement) => section(container, "누적 손익") !== null && (container.textContent ?? "").includes("참0");

/** 거래 행의 사유 줄(`<span>사유: …</span>`)을 요소 단위로 찾는다(텍스트를 이어 붙이면 뒤 숫자와 섞인다). */
const showsReason = (reason: string) => (container: HTMLElement) =>
  Array.from(container.querySelectorAll("span")).some((el) => el.textContent === `사유: ${reason}`);
const lacksReason = (reason: string) => (container: HTMLElement) => !showsReason(reason)(container);
const participantRow = (nickname: string) => (container: HTMLElement) =>
  Array.from(section(container, "참여자")?.querySelectorAll("li") ?? []).find((li) =>
    li.textContent?.includes(nickname),
  );
/** 비활성 배지(방장 화면의 `비활성화` 버튼 글자와 구분하려고 배지 요소 자체를 본다). */
const isInactive = (li: Element) => Array.from(li.querySelectorAll("span")).some((el) => el.textContent === "비활성");

describe("화면 반영 지연 (FE-S5-6, S5 §6.7)", () => {
  afterAll(() => {
    const lines: string[] = [];
    for (const [kind, values] of Object.entries(samples)) {
      const s = summarize(values);
      lines.push(`${kind.padEnd(14)} 표본 ${String(s.count).padStart(5)}  p95 ${String(s.p95).padStart(5)}ms  max ${String(s.max).padStart(5)}ms  시간초과 ${timeouts[kind] ?? 0}`);
    }
    const screens = Object.entries(samples).filter(([k]) => !k.includes("유실 수렴")).flatMap(([, v]) => v);
    const all = screens.length > 0 ? summarize(screens) : null;
    if (all) lines.push(`${"전체(수렴 제외)".padEnd(12)} 표본 ${String(all.count).padStart(5)}  p95 ${String(all.p95).padStart(5)}ms  max ${String(all.max).padStart(5)}ms`);
    process.stdout.write(`\n[지연 측정 결과] 화면 반영 목표 p95 ≤ 3000ms, max ≤ 5000ms / 수렴 ≤ 20000ms\n${lines.join("\n")}\n\n`);
    const path = process.env.LATENCY_REPORT;
    if (path) {
      const byKind = Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, { ...summarize(v), timeouts: timeouts[k] ?? 0 }]));
      writeFileSync(path, JSON.stringify({ measuredAt: new Date().toISOString(), full: FULL, count: COUNT, rooms: ROOMS, byKind, all }, null, 2));
    }
  });

  it.runIf(only("create"))("[AC-VIEW-005-8] 거래 생성: 활성 참여자 10명·거래 900건 → 1,000건", async () => {
    const live = await createLiveRoom(10);
    await seedTransactions(live, 900);
    const clients = await openClients(live);
    try {
      for (let n = 1; n <= COUNT; n++) {
        await measure("거래 생성", clients, () => createTransaction(live, `측정-생성-${n}`), showsReason(`측정-생성-${n}`));
      }
    } finally {
      closeClients(clients);
    }
  });

  it.runIf(only("editdelete"))("[AC-VIEW-005-8] 거래 수정·삭제: 활성 참여자 10명·거래 1,000건", async () => {
    const live = await createLiveRoom(10);
    await seedTransactions(live, 1000);
    const clients = await openClients(live);
    try {
      for (let n = 1; n <= COUNT; n++) {
        const [target] = await recentTransactions(live, 1);
        await measure("거래 수정", clients, () => updateTransaction(live, target!.id, `측정-수정-${n}`), showsReason(`측정-수정-${n}`));
      }
      for (let n = 1; n <= COUNT; n++) {
        const [target] = await recentTransactions(live, 1);
        const reason = target!.reason!;
        await measure("거래 삭제", clients, () => deleteTransaction(live, target!.id), lacksReason(reason));
      }
    } finally {
      closeClients(clients);
    }
  });

  it.runIf(only("status"))("[AC-VIEW-005-8] 참여자 상태 변경: 참여자 10명·거래 1,000건", async () => {
    const live = await createLiveRoom(10);
    await seedTransactions(live, 1000);
    const clients = await openClients(live);
    try {
      const target = live.participants[2]!;
      for (let n = 1; n <= COUNT; n++) {
        const next = n % 2 === 1 ? "INACTIVE" : "ACTIVE"; // 활성·비활성 번갈아
        await measure(
          "참여자 상태 변경",
          clients,
          () => setParticipantStatus(live.host, live.room.id, target.id, next),
          (container) => {
            const li = participantRow(target.nickname)(container);
            return li !== undefined && isInactive(li) === (next === "INACTIVE");
          },
        );
      }
    } finally {
      closeClients(clients);
    }
  });

  // 참여자 생성은 입장과 직접 추가를 따로 잰다(S5 §6.7 v0.3.0): 참여자 9명(SSE 9개)·거래 1,000건 방마다 1건.
  it.runIf(only("add"))("[AC-VIEW-005-8] 참여자 생성(직접 추가): 참여자 9명·거래 1,000건 방 여러 개(방마다 1건)", async () => {
    for (let r = 1; r <= ROOMS; r++) {
      const live = await createLiveRoom(9);
      await seedTransactions(live, 1000);
      const clients = await openClients(live);
      try {
        const nickname = `추가${r}`;
        await measure("참여자 생성(직접 추가)", clients, () => registerParticipant(live.host, live.room.id, nickname), (container) => participantRow(nickname)(container) !== undefined);
      } finally {
        closeClients(clients);
      }
    }
  });

  it.runIf(only("join"))("[AC-VIEW-005-8] 참여자 생성(입장): 참여자 9명·거래 1,000건 방 여러 개(방마다 1건)", async () => {
    for (let r = 1; r <= ROOMS; r++) {
      const live = await createLiveRoom(9);
      await seedTransactions(live, 1000);
      const clients = await openClients(live);
      try {
        const nickname = `입장${r}`;
        await measure("참여자 생성(입장)", clients, () => joinRoom(live.room.inviteCode, nickname), (container) => participantRow(nickname)(container) !== undefined);
      } finally {
        closeClients(clients);
      }
    }
  });

  it.runIf(only("end"))("[AC-VIEW-005-8] 게임 종료: 진행 중·참여자 10명·거래 1,000건 방 여러 개(방마다 1건)", async () => {
    for (let r = 1; r <= ROOMS; r++) {
      const live = await createLiveRoom(10);
      await seedTransactions(live, 1000);
      const clients = await openClients(live);
      try {
        await measure("게임 종료", clients, () => endGame(live), (container) => section(container, "최종 정산") !== null);
      } finally {
        closeClients(clients);
      }
    }
  });

  it.runIf(only("lost"))("[AC-VIEW-005-8] 알림 유실 시 하트비트로 20초 안에 수렴한다", async () => {
    const live = await createLiveRoom(10);
    const lossyKey = live.members[9]!.key;
    let dropping = false;
    let dropped = 0;
    let opens = 0; // 이 접속자가 스트림을 연 횟수(재연결 감지)
    let heartbeats = 0; // 이 접속자에게 전달된 하트비트 수
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await realFetch(input, init);
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const auth = new Headers(init?.headers).get("Authorization");
      if (!url.endsWith("/events") || auth !== `Bearer ${lossyKey}` || !response.body) return response;
      opens += 1;
      // 이 접속자의 스트림에서 변경 알림 프레임만 버린다(ready·heartbeat는 통과).
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let pending = "";
      const filtered = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            pending += decoder.decode(chunk, { stream: true });
            const frames = pending.split("\n\n");
            pending = frames.pop() ?? "";
            for (const frame of frames) {
              const lossy = dropping && /^event: (?!ready|heartbeat)/m.test(frame);
              if (/^event: heartbeat/m.test(frame)) heartbeats += 1;
              if (lossy) dropped += 1;
              else controller.enqueue(encoder.encode(`${frame}\n\n`));
            }
          },
        }),
      );
      return new Response(filtered, { status: response.status, headers: response.headers });
    });
    // 스트림이 열리기 전에 가로채야 하므로 접속자 렌더링은 fetch를 바꾼 뒤에 한다.
    const clients = await openClients(live);
    try {
      const lossy = clients[9]!;
      for (let n = 1; n <= CONVERGE_SAMPLES; n++) {
        dropping = true;
        const droppedBefore = dropped;
        const opensBefore = opens;
        const heartbeatsBefore = heartbeats;
        const reason = `측정-유실-${n}`;
        const watch = lossy.observe(showsReason(reason), CONVERGE_LIMIT_MS + 10_000);
        const t0 = Date.now();
        await createTransaction(live, reason);
        const at = await watch;
        dropping = false;
        // 알림이 실제로 버려졌어야 하트비트 경로를 잰 것이다(안 버려졌다면 측정 무효).
        if (dropped === droppedBefore) throw new Error("유실 수렴: 변경 알림이 버려지지 않아 측정이 무효입니다.");
        // 재연결(새 ready)로 복구된 표본은 하트비트 경로를 잰 것이 아니다. 하트비트가 도착한 뒤 수렴했어야 한다.
        if (opens !== opensBefore) throw new Error("유실 수렴: 스트림이 재연결되어 하트비트 경로 측정이 무효입니다.");
        if (heartbeats === heartbeatsBefore) throw new Error("유실 수렴: 하트비트 없이 수렴해 측정이 무효입니다.");
        (samples["유실 수렴"] ??= []).push(at === null ? CONVERGE_LIMIT_MS + 10_000 : at - t0);
        await sleep(500);
      }
    } finally {
      vi.unstubAllGlobals();
      closeClients(clients);
    }
  });

  // 이어받기 요청 생성·취소(방장 화면): 신원 있는 9명 SSE 연결 + 직접 추가 1명, 방 밖 브라우저가 그 참여자를 요청.
  it.runIf(only("claimreq"))("[AC-VIEW-005-9] 이어받기 요청 생성·취소가 방장 화면의 대기 목록에 반영된다", async () => {
    const live = await createLiveRoom(9, { added: 1 });
    await seedTransactions(live, 1000);
    const clients = await openClients(live);
    const target = live.participants[9]!.nickname;
    const requester = newKey();
    try {
      let claimId = "";
      for (let n = 1; n <= COUNT; n++) {
        if (n % 2 === 1) {
          await measure("이어받기 요청 생성·취소", [clients[0]!], async () => {
            claimId = (await requestClaim(live, requester, target)).claim.id;
          }, claimRow(target));
        } else {
          await measure("이어받기 요청 생성·취소", [clients[0]!], () => cancelClaim(live, requester, claimId), (c) => !claimRow(target)(c));
        }
      }
    } finally {
      closeClients(clients);
    }
  });

  // 이어받기 승인·거절(요청자 화면, S5 §6.8): 같은 구성의 방, 대기 요청 1건. 거절은 같은 방에서 반복, 승인은 방마다 1건.
  it.runIf(only("claimresult"))("[AC-VIEW-005-9] 승인·거절 결과가 요청자 화면에 주기 조회로 표시된다", async () => {
    for (let r = 1; r <= ROOMS; r++) {
      const live = await createLiveRoom(9, { added: 1 });
      await seedTransactions(live, 1000);
      const clients = await openClients(live);
      const target = live.participants[9]!.nickname;
      try {
        // 거절: 새 키로 요청 → 요청자 화면이 대기 → 방장 거절.
        const rejectedKey = newKey();
        const pending = await requestClaim(live, rejectedKey, target);
        const rejected = await mountRequester(live.room.inviteCode, rejectedKey, saveKey);
        try {
          await measureRaw("이어받기 거절(요청자)", rejected, () => rejectClaim(live, pending.claim.id), (c) =>
            (c.textContent ?? "").includes("방장이 이어받기 요청을 거절했습니다."),
          );
        } finally {
          rejected.unmount();
        }
        // 승인: 새 키로 요청 → 대기 → 방장 승인 → 요청자가 입장 요청으로 방 화면에 들어간다.
        const approvedKey = newKey();
        const next = await requestClaim(live, approvedKey, target);
        const approved = await mountRequester(live.room.inviteCode, approvedKey, saveKey);
        try {
          await measureRaw("이어받기 승인(요청자)", approved, () => approveClaim(live, next.claim.id), inRoom);
        } finally {
          approved.unmount();
          storage.removeItem(`ddallang:identity:${live.room.inviteCode}`);
        }
      } finally {
        closeClients(clients);
      }
    }
  });

  // 접근 상실 안내(이전 브라우저): 10명 모두 SSE 연결, 대상 참여자의 이전 브라우저가 안내를 띄우기까지.
  it.runIf(only("revoked"))("[AC-VIEW-005-9] 이어받기 승인으로 이전 브라우저가 접근 상실 안내를 표시한다", async () => {
    for (let r = 1; r <= ROOMS; r++) {
      const live = await createLiveRoom(10);
      const clients = await openClients(live);
      const old = clients[9]!;
      const target = live.members[9]!.me.nickname;
      try {
        const claim = await requestClaim(live, newKey(), target);
        // 변경은 한 번에 하나(§6.7): 요청 생성(`claim.created`)이 방장 화면까지 반영된 뒤 승인한다(검수 F7).
        if ((await clients[0]!.observe(claimRow(target), WAIT_MS)) === null) throw new Error("접근 상실 안내: 요청 반영 대기 시간 초과");
        await measureRaw("접근 상실 안내", old, () => approveClaim(live, claim.claim.id), accessLost);
      } finally {
        closeClients(clients);
      }
    }
  });

  // 접근 상실 유실 수렴: 승인 직후의 `access.revoked`를 버리고 다음 하트비트의 신원 재확인으로 20초 안에 안내·차단된다.
  it.runIf(only("revokedlost"))("[AC-VIEW-005-9] access.revoked가 유실돼도 하트비트 재확인으로 20초 안에 안내된다", async () => {
    for (let r = 1; r <= CONVERGE_SAMPLES; r++) {
      const live = await createLiveRoom(10);
      const lossyKey = live.members[9]!.key;
      let dropped = 0;
      let firstDropped = false;
      let opens = 0; // 이 접속자가 스트림을 연 횟수(재연결 감지)
      const realFetch = globalThis.fetch;
      vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await realFetch(input, init);
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const auth = new Headers(init?.headers).get("Authorization");
        if (!url.endsWith("/events") || auth !== `Bearer ${lossyKey}`) return response;
        opens += 1;
        if (!response.body) return response;
        // 이 접속자의 스트림에서 첫 `access.revoked` 프레임만 버린다(재확인으로 다시 오는 것은 통과).
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let pending = "";
        const filtered = response.body.pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
              pending += decoder.decode(chunk, { stream: true });
              const frames = pending.split("\n\n");
              pending = frames.pop() ?? "";
              for (const frame of frames) {
                if (!firstDropped && /^event: access\.revoked/m.test(frame)) {
                  firstDropped = true;
                  dropped += 1;
                  continue;
                }
                controller.enqueue(encoder.encode(`${frame}\n\n`));
              }
            },
          }),
        );
        return new Response(filtered, { status: response.status, headers: response.headers });
      });
      const clients = await openClients(live);
      try {
        const claim = await requestClaim(live, newKey(), live.members[9]!.me.nickname);
        if ((await clients[0]!.observe(claimRow(live.members[9]!.me.nickname), WAIT_MS)) === null) {
          throw new Error("접근 상실 유실 수렴: 요청 반영 대기 시간 초과");
        }
        const opensBefore = opens;
        await measureRaw("접근 상실 유실 수렴", clients[9]!, () => approveClaim(live, claim.claim.id), accessLost, CONVERGE_LIMIT_MS + 10_000);
        if (dropped === 0) throw new Error("접근 상실 유실 수렴: access.revoked가 버려지지 않아 측정이 무효입니다.");
        // 서버는 access.revoked를 보낸 뒤 스트림을 닫는다(S5 §4.2). 클라이언트가 재연결해 401로 안내했다면 하트비트 경로가
        // 아니므로 측정이 무효다(검수 F1). 이 경로는 클라이언트 쪽 필터로 재현할 수 없어 서버 측정(BE-M8)에 맡긴다.
        if (opens !== opensBefore) {
          throw new Error("접근 상실 유실 수렴: 재연결(401) 경로로 수렴해 하트비트 경로 측정이 무효입니다(서버가 스트림을 닫음).");
        }
      } finally {
        vi.unstubAllGlobals();
        closeClients(clients);
      }
    }
  });

  it("[AC-VIEW-005-8] [AC-VIEW-005-9] 목표를 지켰다: 화면 반영 p95 3초·최대 5초, 수렴 20초 이하, 시간 초과 0건, 정식 횟수 충족", () => {
    // 정식 합격은 §6.7의 종류·횟수·방 수를 모두 채운 실행뿐이다. 축소·부분 실행은 `LATENCY_ALLOW_PARTIAL=1`로 목표만 확인한다.
    if (!FULL && process.env.LATENCY_ALLOW_PARTIAL !== "1") {
      throw new Error("축소·부분 실행은 정식 합격이 아닙니다(정식: 기본 횟수·방 수, LATENCY_ONLY 없음). 연습용이면 LATENCY_ALLOW_PARTIAL=1.");
    }
    const CONVERGE_KINDS = ["유실 수렴", "접근 상실 유실 수렴"];
    const expected: Record<string, number> = {
      "거래 생성": COUNT * 10,
      "거래 수정": COUNT * 10,
      "거래 삭제": COUNT * 10,
      "참여자 상태 변경": COUNT * 10,
      "참여자 생성(직접 추가)": ROOMS * 9,
      "참여자 생성(입장)": ROOMS * 9,
      "게임 종료": ROOMS * 10,
      "유실 수렴": CONVERGE_SAMPLES,
      "이어받기 요청 생성·취소": COUNT,
      "이어받기 승인(요청자)": ROOMS,
      "이어받기 거절(요청자)": ROOMS,
      "접근 상실 안내": ROOMS,
      "접근 상실 유실 수렴": CONVERGE_SAMPLES,
    };
    if (FULL) {
      for (const [kind, count] of Object.entries(expected)) {
        const got = samples[kind]?.length ?? 0;
        if (got < count) failures.push(`${kind}: 표본 ${got}개 < 정식 ${count}개`);
      }
    }
    for (const [kind, values] of Object.entries(samples)) {
      const summary = summarize(values);
      if (CONVERGE_KINDS.includes(kind)) failures.push(...judge(kind, summary, { p95Ms: CONVERGE_LIMIT_MS, maxMs: CONVERGE_LIMIT_MS }));
      else failures.push(...judge(kind, summary, SCREEN_LIMITS));
    }
    const screens = Object.entries(samples).filter(([k]) => !CONVERGE_KINDS.includes(k)).flatMap(([, v]) => v);
    if (screens.length > 0) failures.push(...judge("전체", summarize(screens), SCREEN_LIMITS));
    else failures.push("측정된 화면 반영 표본이 없습니다.");
    for (const [kind, n] of Object.entries(timeouts)) failures.push(`${kind}: 시간 초과 ${n}건`);
    expect(failures).toEqual([]);
  });
});
