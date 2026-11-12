import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient, NetworkError } from "@/lib/api";
import * as fixtures from "@/test/fixtures";
import { fetchRoomSnapshot } from "./snapshot";

const KEY = "k".repeat(43);
const request = { roomId: "room-1", identityKey: KEY, participantId: null, epoch: 3 };

type Responder = (path: string, url: URL) => Response | Promise<Response>;

function setup(responder: Responder) {
  const calls: Array<{ path: string; search: string; authorization: string }> = [];
  const resolvers: Array<() => void> = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    calls.push({
      path: url.pathname,
      search: url.search,
      authorization: (init!.headers as Record<string, string>).Authorization!,
    });
    return responder(url.pathname, url);
  });
  const api = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock });
  return { api, calls, fetchMock, resolvers };
}

function ok(path: string, kind: "EXPECTED" | "FINAL" = "EXPECTED", status = "IN_PROGRESS"): Response {
  const bodies: Record<string, unknown> = {
    "/rooms/room-1": { room: { ...fixtures.room, status }, me: fixtures.hostMember },
    "/rooms/room-1/participants": { participants: fixtures.participants },
    "/rooms/room-1/balances": { balances: fixtures.balances },
    "/rooms/room-1/transactions": { transactions: fixtures.transactions, nextCursor: "c1" },
    "/rooms/room-1/settlement": { settlement: { ...fixtures.expectedSettlement, kind } },
  };
  return new Response(JSON.stringify(bodies[path]), { status: 200 });
}

describe("fetchRoomSnapshot", () => {
  it("5개 조회를 한꺼번에 시작한다(하나가 끝나기 전에 모두 요청된다)", async () => {
    const gates: Array<() => void> = [];
    const env = setup(
      (path) =>
        new Promise<Response>((resolve) => {
          gates.push(() => resolve(ok(path)));
        }),
    );
    const promise = fetchRoomSnapshot(env.api, request);
    await Promise.resolve();
    await Promise.resolve();
    expect(env.calls.map((c) => c.path).sort()).toEqual([
      "/rooms/room-1",
      "/rooms/room-1/balances",
      "/rooms/room-1/participants",
      "/rooms/room-1/settlement",
      "/rooms/room-1/transactions",
    ]);
    gates.forEach((release) => release());
    const result = await promise;
    expect(result.ok).toBe(true);
  });

  it("모두 성공하면 현재 연결 세대가 기록된 하나의 스냅샷을 만든다", async () => {
    const env = setup((path) => ok(path));
    const result = await fetchRoomSnapshot(env.api, request);
    expect(result.ok && result.snapshot).toMatchObject({
      epoch: 3,
      room: { id: "room-1" },
      me: { id: "member-host" },
      nextCursor: "c1",
      settlement: { kind: "EXPECTED" },
    });
    expect(result.ok && result.snapshot.participants).toHaveLength(3);
    expect(env.calls.every((c) => c.authorization === `Bearer ${KEY}`)).toBe(true);
    expect(env.calls.every((c) => !c.search.includes(KEY))).toBe(true);
  });

  it("[AC-VIEW-005-7] 거래 목록은 현재 필터를 유지한 첫 페이지(새 순회)이고 정산·손익·방 조회에는 쿼리가 없다", async () => {
    const env = setup((path) => ok(path));
    await fetchRoomSnapshot(env.api, { ...request, participantId: "p-2" });
    const byPath = Object.fromEntries(env.calls.map((c) => [c.path, c.search]));
    expect(byPath["/rooms/room-1/transactions"]).toBe("?participantId=p-2");
    expect(byPath["/rooms/room-1/settlement"]).toBe("");
    expect(byPath["/rooms/room-1/balances"]).toBe("");
    expect(byPath["/rooms/room-1"]).toBe("");
    expect(env.calls.find((c) => c.path.endsWith("/transactions"))!.search).not.toContain("cursor");
  });

  it.each([
    ["5xx", () => new Response("{}", { status: 503 }), ApiError],
    ["네트워크 오류", () => Promise.reject(new TypeError("Failed to fetch")), NetworkError],
  ])("5개 중 하나가 %s이면 스냅샷 없이 오류를 던진다(부분 반영 없음)", async (_name, bad, errorType) => {
    const env = setup((path) => (path.endsWith("/balances") ? bad() : ok(path)));
    await expect(fetchRoomSnapshot(env.api, request)).rejects.toBeInstanceOf(errorType);
  });

  it("401·404 오류는 ApiError로 그대로 던진다(호출자가 재시도 없이 오류 상태로 간다)", async () => {
    const env = setup((path) =>
      path.endsWith("/participants")
        ? new Response(JSON.stringify({ error: { code: "ROOM_NOT_FOUND", message: "m" } }), { status: 404 })
        : ok(path),
    );
    await expect(fetchRoomSnapshot(env.api, request)).rejects.toMatchObject({ status: 404, code: "ROOM_NOT_FOUND" });
  });

  it("접근 불가(401·ROOM_NOT_FOUND)가 다른 실패와 섞이면 접근 불가 오류를 우선한다", async () => {
    const env = setup((path) => {
      if (path.endsWith("/balances")) return new Response("{}", { status: 503 });
      if (path.endsWith("/settlement"))
        return new Response(JSON.stringify({ error: { code: "ROOM_NOT_FOUND", message: "m" } }), { status: 404 });
      return ok(path);
    });
    await expect(fetchRoomSnapshot(env.api, request)).rejects.toMatchObject({ status: 404, code: "ROOM_NOT_FOUND" });
  });

  it("중단 신호를 5개 요청 모두에 전달해 진행 중인 조회를 취소한다", async () => {
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          signals.push(init!.signal!);
          init!.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const api = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock });
    const controller = new AbortController();
    const pending = fetchRoomSnapshot(api, request, controller.signal);
    await Promise.resolve();
    expect(signals).toHaveLength(5);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it("방 status와 정산 kind가 어긋나면 반영하지 않는다", async () => {
    const mismatch = setup((path) => ok(path, "FINAL", "IN_PROGRESS"));
    expect(await fetchRoomSnapshot(mismatch.api, request)).toEqual({ ok: false, reason: "status-mismatch" });
    const reverse = setup((path) => ok(path, "EXPECTED", "ENDED"));
    expect(await fetchRoomSnapshot(reverse.api, request)).toEqual({ ok: false, reason: "status-mismatch" });
    const ended = setup((path) => ok(path, "FINAL", "ENDED"));
    expect((await fetchRoomSnapshot(ended.api, request)).ok).toBe(true);
  });
});
