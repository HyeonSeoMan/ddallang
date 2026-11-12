// 화면 반영 지연 측정(FE-S5-6, S5 §6.7, AC-VIEW-005-8): 실서버에 방마다 실제 FE 클라이언트 10개를 연결하고
// 변경 종류별로 T0(요청 송신 시각, 보수 기준)부터 각 접속자 화면에 새 값이 보이기까지를 잰다.
// 기본 `pnpm test`에는 포함되지 않는다. 실행: `LATENCY_API_BASE_URL=http://localhost:3001 pnpm test:latency`.
// 한계: jsdom의 DOM 변경 시각까지이며 브라우저 페인트 시간은 포함하지 않는다.
import { writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { installFakeLocks } from "@/test/fake-locks";
import { installFakeStorage } from "@/test/fake-storage";
import { type LiveClient, mountClient, section } from "./client";
import {
  createLiveRoom,
  createTransaction,
  deleteTransaction,
  endGame,
  type LiveRoom,
  recentTransactions,
  registerParticipant,
  seedTransactions,
  setParticipantStatus,
  updateTransaction,
} from "./server";
import { judge, summarize, type Summary } from "./stats";

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
  const already = clients.filter((c) => condition(c.container)).map((c) => c.index);
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
    const screens = Object.entries(samples).filter(([k]) => k !== "유실 수렴").flatMap(([, v]) => v);
    const all = screens.length > 0 ? summarize(screens) : null;
    if (all) lines.push(`${"전체(수렴 제외)".padEnd(12)} 표본 ${String(all.count).padStart(5)}  p95 ${String(all.p95).padStart(5)}ms  max ${String(all.max).padStart(5)}ms`);
    process.stdout.write(`\n[지연 측정 결과] 화면 반영 목표 p95 ≤ 3000ms, max ≤ 5000ms / 수렴 ≤ 20000ms\n${lines.join("\n")}\n\n`);
    const path = process.env.LATENCY_REPORT;
    if (path) {
      const byKind = Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, { ...summarize(v), timeouts: timeouts[k] ?? 0 }]));
      writeFileSync(path, JSON.stringify({ measuredAt: new Date().toISOString(), count: COUNT, rooms: ROOMS, byKind, all }, null, 2));
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

  it.runIf(only("register"))("[AC-VIEW-005-8] 참여자 등록: 참여자 9명·거래 1,000건 방 여러 개(방마다 1건)", async () => {
    for (let r = 1; r <= ROOMS; r++) {
      const live = await createLiveRoom(9);
      await seedTransactions(live, 1000);
      const clients = await openClients(live);
      try {
        const nickname = `신규${r}`;
        await measure("참여자 등록", clients, () => registerParticipant(live.host, live.room.id, nickname), (container) => participantRow(nickname)(container) !== undefined);
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
    const live = await createLiveRoom(3);
    const lossyKey = live.members[9]!.key;
    let dropping = false;
    let dropped = 0;
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await realFetch(input, init);
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const auth = new Headers(init?.headers).get("Authorization");
      if (!url.endsWith("/events") || auth !== `Bearer ${lossyKey}` || !response.body) return response;
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
        const reason = `측정-유실-${n}`;
        const watch = lossy.observe(showsReason(reason), CONVERGE_LIMIT_MS + 10_000);
        const t0 = Date.now();
        await createTransaction(live, reason);
        const at = await watch;
        dropping = false;
        // 알림이 실제로 버려졌어야 하트비트 경로를 잰 것이다(안 버려졌다면 측정 무효).
        if (dropped === droppedBefore) throw new Error("유실 수렴: 변경 알림이 버려지지 않아 측정이 무효입니다.");
        (samples["유실 수렴"] ??= []).push(at === null ? CONVERGE_LIMIT_MS + 10_000 : at - t0);
        await sleep(500);
      }
    } finally {
      vi.unstubAllGlobals();
      closeClients(clients);
    }
  });

  it("[AC-VIEW-005-8] 목표를 지켰다: 화면 반영 p95 3초·최대 5초, 수렴 20초 이하, 시간 초과 0건", () => {
    const summaries: Record<string, Summary> = {};
    for (const [kind, values] of Object.entries(samples)) summaries[kind] = summarize(values);
    for (const [kind, summary] of Object.entries(summaries)) {
      if (kind === "유실 수렴") failures.push(...judge(kind, summary, { p95Ms: CONVERGE_LIMIT_MS, maxMs: CONVERGE_LIMIT_MS }));
      else failures.push(...judge(kind, summary, SCREEN_LIMITS));
    }
    const screens = Object.entries(samples).filter(([k]) => k !== "유실 수렴").flatMap(([, v]) => v);
    if (screens.length > 0) failures.push(...judge("전체", summarize(screens), SCREEN_LIMITS));
    for (const [kind, n] of Object.entries(timeouts)) failures.push(`${kind}: 시간 초과 ${n}건`);
    expect(failures).toEqual([]);
  });
});
