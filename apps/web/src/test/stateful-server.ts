// 상태 있는 가짜 서버(FD-16): 갱신 주기 시나리오 전용이며 작게 유지한다.
// `revision`·이벤트·조회 응답이 서로 맞아야 하는 시험만 쓴다. 순손익·정산은 시험이 정한 값을 그대로 돌려준다.
import { delay, type HttpHandler, http, HttpResponse, type JsonBodyType } from "msw";
import type { Balance, Claim, IdentityState, MyClaim, Participant, Room, Settlement, Transaction } from "@/lib/api";
import { createFakeSse, type FakeSse } from "./fake-sse";
import * as fixtures from "./fixtures";
import { apiUrl, errorResponse } from "./handlers";

export type WriteOperation =
  | "createTransaction"
  | "updateTransaction"
  | "deleteTransaction"
  | "registerParticipant"
  | "setParticipantStatus"
  | "endGame"
  | "join"
  | "requestClaim"
  | "cancelClaim"
  | "approveClaim"
  | "rejectClaim";

export type ReadEndpoint = "room" | "participants" | "balances" | "transactions" | "settlement" | "claims";

export interface FakeBackend {
  room: Room;
  /** 연결된 키가 없는 요청에 방 조회가 돌려주는 요청자(기본 방장). 비방장 시험은 서버 응답을 바꾼다. */
  me: Participant;
  /** 신원 키 → 연결된 참여자 ID(S1 §2.2 연결됨). 등록된 키로 온 방 요청은 그 참여자가 `me`다. */
  identities: Map<string, string>;
  /** 이어받기 승인으로 접근을 잃은 키(S1 §2.2 REVOKED). 방 요청은 `401 IDENTITY_REVOKED`. */
  revokedKeys: Set<string>;
  /** 이어받기 요청 전체(끝난 것 포함). */
  claims: Claim[];
  /** 요청 ID → 요청한 키(서버만 아는 값, S1 §2.1). */
  claimKeys: Map<string, string>;
  participants: Participant[];
  balances: Balance[];
  transactions: Transaction[];
  settlement: Settlement;
  revision: number;
  /** 엔드포인트별 응답 지연(ms). */
  latency: Partial<Record<ReadEndpoint, number>>;
  /** 이 엔드포인트가 5xx로 실패한다. */
  failing: Set<ReadEndpoint>;
  /** 지금까지 받은 조회 요청 수(엔드포인트별). */
  requests: Record<ReadEndpoint, number>;
  /** 조회 엔드포인트별로 받은 쿼리 문자열 기록(정산·손익·방 조회에 쿼리가 없는지 검증용). */
  searches: Record<ReadEndpoint, string[]>;
  /** 거래 목록 조회 쿼리 기록(필터·커서 검증용). */
  transactionQueries: Array<{ participantId: string | null; cursor: string | null }>;
  /** 마지막 `/events` 연결. 시험이 이벤트를 밀어 넣는다. */
  stream: FakeSse | null;
  /** 지금까지 열린 모든 `/events` 연결(접속자 여럿). 변경 이벤트는 모든 연결로 간다. */
  streams: FakeSse[];
  /** 각 연결을 연 신원 키(`access.revoked` 대상 판정용). */
  streamKeys: Map<FakeSse, string | null>;
  /** `/events` 요청 수(거부된 것 포함). 재연결 여부 검증용. */
  eventRequests: number;
  /** true이면 `/events`가 503으로 실패한다(특정 접속자를 끊어 둘 때). */
  blockEvents: boolean;
  /** 변경(쓰기) 요청을 처리한 뒤·이벤트를 보내기 전에 호출된다. 시험이 순손익·정산 같은 파생 값을 정한다. */
  afterChange: (() => void) | null;
  /** 이 쓰기 작업은 서버에 반영하되 응답을 유실시킨다(네트워크 오류). 한 번 쓰이면 해제된다. */
  dropResponseOnce: Set<WriteOperation>;
  /** 쓰기 요청이 받은 Idempotency-Key 기록. */
  writes: Array<{ operation: string; key: string | null }>;
  /** 변경 하나를 반영한다: `revision`을 올리고 이벤트를 스트림으로 보낸다. */
  commit(event: string, extra?: Record<string, unknown>): number;
  handlers: HttpHandler[];
}

export function createFakeBackend(): FakeBackend {
  const backend: FakeBackend = {
    room: structuredClone(fixtures.room),
    me: structuredClone(fixtures.hostParticipant),
    identities: new Map(),
    revokedKeys: new Set(),
    claims: [],
    claimKeys: new Map(),
    participants: structuredClone(fixtures.participants),
    balances: structuredClone(fixtures.balances),
    transactions: structuredClone(fixtures.transactions),
    settlement: structuredClone(fixtures.expectedSettlement),
    revision: 1,
    latency: {},
    failing: new Set(),
    requests: { room: 0, participants: 0, balances: 0, transactions: 0, settlement: 0, claims: 0 },
    searches: { room: [], participants: [], balances: [], transactions: [], settlement: [], claims: [] },
    transactionQueries: [],
    stream: null,
    streams: [],
    streamKeys: new Map(),
    eventRequests: 0,
    blockEvents: false,
    afterChange: null,
    dropResponseOnce: new Set(),
    writes: [],
    commit(event, extra = {}) {
      backend.revision += 1;
      for (const stream of backend.streams) {
        stream.pushEvent({
          id: backend.revision,
          event,
          data: {
            roomId: backend.room.id,
            revision: backend.revision,
            serverTime: new Date().toISOString(),
            ...extra,
          },
        });
      }
      return backend.revision;
    },
    handlers: [],
  };

  let sequence = 100;
  const base = `/rooms/${fixtures.room.id}`;
  /** 변경을 서버에 반영한 뒤(파생 값 갱신 → 이벤트) 응답을 만든다. 응답 유실 설정이면 반영하고도 네트워크 오류를 낸다. */
  const write = (
    operation: WriteOperation,
    request: Request,
    apply: () => { event: string; extra?: Record<string, unknown>; response: () => Response },
  ): Response => {
    if (backend.revokedKeys.has(keyOf(request) ?? "")) return errorResponse("IDENTITY_REVOKED");
    backend.writes.push({ operation, key: request.headers.get("Idempotency-Key") });
    const { event, extra, response } = apply();
    backend.afterChange?.();
    backend.commit(event, extra);
    if (backend.dropResponseOnce.delete(operation)) return HttpResponse.error();
    return response();
  };

  const keyOf = (request: Request): string | null =>
    /^Bearer (.+)$/.exec(request.headers.get("Authorization") ?? "")?.[1] ?? null;
  /** 키의 이 방 상태(S1 §2.2). */
  const identityOf = (key: string | null): IdentityState => {
    if (key === null) return "NONE";
    if (backend.identities.has(key)) return "PARTICIPANT";
    if (backend.revokedKeys.has(key)) return "REVOKED";
    const pending = backend.claims.some((c) => c.status === "PENDING" && backend.claimKeys.get(c.id) === key);
    return pending ? "PENDING" : "NONE";
  };
  /** 방 요청의 요청자: 연결된 키면 그 참여자, 등록되지 않은 키는 `backend.me`(1.x 시험 호환). */
  const meOf = (request: Request): Participant => {
    const id = backend.identities.get(keyOf(request) ?? "");
    return backend.participants.find((p) => p.id === id) ?? backend.me;
  };
  const revoked = (request: Request) => backend.revokedKeys.has(keyOf(request) ?? "");
  const toMyClaim = ({ id, nickname, status, rejectReason, createdAt, resolvedAt }: Claim): MyClaim => ({
    id,
    nickname,
    status,
    rejectReason,
    createdAt,
    resolvedAt,
  });
  const compareKey = (nickname: string) => nickname.normalize("NFC").replace(/[A-Z]/g, (c) => c.toLowerCase());
  const invite = `/invites/${fixtures.room.inviteCode}`;
  /** 쓰기 없이(이벤트 없이) 처리 결과만 돌려주는 경로의 응답 유실 흉내. */
  const respond = (operation: WriteOperation, response: Response): Response =>
    backend.dropResponseOnce.delete(operation) ? HttpResponse.error() : response;

  const read = (endpoint: ReadEndpoint, path: string, body: (request: Request) => JsonBodyType) =>
    http.get(apiUrl(`/rooms/${fixtures.room.id}${path}`), async ({ request }) => {
      if (revoked(request)) return errorResponse("IDENTITY_REVOKED");
      backend.requests[endpoint] += 1;
      backend.searches[endpoint].push(new URL(request.url).search);
      const wait = backend.latency[endpoint];
      if (wait) await delay(wait);
      if (backend.failing.has(endpoint)) return new HttpResponse(null, { status: 503 });
      return HttpResponse.json(structuredClone(body(request)));
    });

  backend.handlers = [
    read("room", "", (request) => ({ room: backend.room, me: meOf(request) })),
    read("participants", "/participants", () => ({ participants: backend.participants })),
    read("balances", "/balances", () => ({ balances: backend.balances })),
    // 거래 목록: 필터(`participantId`)와 20건 단위 커서(`c<offset>`)를 흉내 낸다. 서버의 정렬 규칙은 다시 구현하지 않고
    // 시험이 정한 `backend.transactions` 순서를 그대로 쓴다. `c-bad` 같은 커서는 cursor 오류(422)다.
    http.get(apiUrl(`/rooms/${fixtures.room.id}/transactions`), async ({ request }) => {
      backend.requests.transactions += 1;
      const url = new URL(request.url);
      const participantId = url.searchParams.get("participantId");
      const cursor = url.searchParams.get("cursor");
      backend.transactionQueries.push({ participantId, cursor });
      backend.searches.transactions.push(url.search);
      const wait = backend.latency.transactions;
      if (wait) await delay(wait);
      if (backend.failing.has("transactions")) return new HttpResponse(null, { status: 503 });
      let offset = 0;
      if (cursor !== null) {
        const match = /^c(\d+)$/.exec(cursor);
        if (!match) {
          return errorResponse("VALIDATION_FAILED", { details: [{ field: "cursor", code: "INVALID_VALUE" }] });
        }
        offset = Number(match[1]);
      }
      const all = participantId
        ? backend.transactions.filter((t) => t.payerId === participantId || t.payeeId === participantId)
        : backend.transactions;
      const page = all.slice(offset, offset + 20);
      return HttpResponse.json({
        transactions: structuredClone(page),
        nextCursor: offset + 20 < all.length ? `c${offset + 20}` : null,
      });
    }),
    read("settlement", "/settlement", () => ({ settlement: backend.settlement })),
    http.get(apiUrl(`/rooms/${fixtures.room.id}/events`), ({ request }) => {
      backend.eventRequests += 1;
      if (revoked(request)) return errorResponse("IDENTITY_REVOKED");
      if (backend.blockEvents) return new HttpResponse(null, { status: 503 });
      const sse = createFakeSse();
      backend.stream = sse;
      backend.streams.push(sse);
      backend.streamKeys.set(sse, keyOf(request));
      sse.pushEvent({
        event: "ready",
        data: {
          roomId: backend.room.id,
          revision: backend.revision,
          serverTime: new Date().toISOString(),
        },
      });
      return sse.response();
    }),
    // ---- 변경(쓰기) 요청: 서버의 비즈니스 규칙을 다시 구현하지 않고 목록·상태만 바꾸고 이벤트를 보낸다.
    http.post(apiUrl(`${base}/transactions`), async ({ request }) => {
      const body = (await request.json()) as Partial<Transaction>;
      return write("createTransaction", request, () => {
        const now = new Date().toISOString();
        const transaction: Transaction = {
          id: `t-${++sequence}`,
          payerId: body.payerId!,
          payeeId: body.payeeId!,
          amount: body.amount!,
          reason: body.reason ?? null,
          round: body.round ?? null,
          authorId: meOf(request).id,
          createdAt: now,
          updatedAt: now,
        };
        backend.transactions.unshift(transaction);
        return {
          event: "transaction.created",
          extra: { transactionId: transaction.id },
          response: () => HttpResponse.json({ transaction }, { status: 201 }),
        };
      });
    }),
    http.put(apiUrl(`${base}/transactions/:transactionId`), async ({ request, params }) => {
      const body = (await request.json()) as Partial<Transaction>;
      const target = backend.transactions.find((t) => t.id === params.transactionId);
      if (!target) return errorResponse("TRANSACTION_NOT_FOUND");
      return write("updateTransaction", request, () => {
        Object.assign(target, { amount: body.amount, reason: body.reason ?? null, round: body.round ?? null, updatedAt: new Date().toISOString() });
        return { event: "transaction.updated", extra: { transactionId: target.id }, response: () => HttpResponse.json({ transaction: target }) };
      });
    }),
    http.delete(apiUrl(`${base}/transactions/:transactionId`), ({ request, params }) => {
      const index = backend.transactions.findIndex((t) => t.id === params.transactionId);
      if (index < 0) return errorResponse("TRANSACTION_NOT_FOUND");
      return write("deleteTransaction", request, () => {
        const [removed] = backend.transactions.splice(index, 1);
        return {
          event: "transaction.deleted",
          extra: { transactionId: removed!.id },
          response: () => HttpResponse.json({ transactionId: removed!.id, deletedAt: new Date().toISOString() }),
        };
      });
    }),
    http.post(apiUrl(`${base}/participants`), async ({ request }) => {
      const body = (await request.json()) as { nickname: string };
      return write("registerParticipant", request, () => {
        const participant: Participant = {
          id: `p-${++sequence}`,
          roomId: backend.room.id,
          nickname: body.nickname,
          status: "ACTIVE",
          order: backend.participants.length + 1,
          isHost: false,
          createdAt: new Date().toISOString(),
        };
        backend.participants.push(participant);
        return { event: "participant.created", extra: { participantId: participant.id }, response: () => HttpResponse.json({ participant }, { status: 201 }) };
      });
    }),
    http.patch(apiUrl(`${base}/participants/:participantId`), async ({ request, params }) => {
      const body = (await request.json()) as { status: Participant["status"] };
      const target = backend.participants.find((p) => p.id === params.participantId);
      if (!target) return errorResponse("PARTICIPANT_NOT_FOUND");
      return write("setParticipantStatus", request, () => {
        target.status = body.status;
        return { event: "participant.status_changed", extra: { participantId: target.id }, response: () => HttpResponse.json({ participant: target }) };
      });
    }),
    http.post(apiUrl(`${base}/end`), ({ request }) => {
      if (backend.room.status === "ENDED") return errorResponse("GAME_ENDED", { message: "이미 종료된 게임입니다" });
      return write("endGame", request, () => {
        backend.room = { ...backend.room, status: "ENDED" };
        backend.settlement = { ...backend.settlement, kind: "FINAL" };
        return { event: "room.ended", response: () => HttpResponse.json({ roomId: backend.room.id, status: "ENDED" }) };
      });
    }),
    // ---- 초대 경로(S1 §4.2, §4.3, §4.9~§4.11): 키 상태 분기만 흉내 내고 검증 규칙은 다시 구현하지 않는다.
    http.get(apiUrl(invite), ({ request }) => {
      const key = keyOf(request);
      const identity = identityOf(key);
      const mine = backend.claims.filter((c) => backend.claimKeys.get(c.id) === key);
      const latest = mine[mine.length - 1];
      return HttpResponse.json({
        room: { name: backend.room.name, unit: backend.room.unit, status: backend.room.status },
        identity,
        claim: latest ? toMyClaim(latest) : null,
        claimableNicknames:
          identity === "NONE" || identity === "REVOKED"
            ? backend.participants.filter((p) => !p.isHost).map((p) => p.nickname)
            : [],
      });
    }),
    http.post(apiUrl(`${invite}/members`), async ({ request }) => {
      const key = keyOf(request);
      if (key === null) return errorResponse("UNAUTHENTICATED");
      const body = (await request.json().catch(() => ({}))) as { nickname?: string };
      const room = { id: backend.room.id, name: backend.room.name, unit: backend.room.unit, status: backend.room.status };
      switch (identityOf(key)) {
        case "PARTICIPANT":
          return respond("join", HttpResponse.json({ room, me: meOf(request) }));
        case "REVOKED":
          return errorResponse("IDENTITY_REVOKED");
        case "PENDING":
          return errorResponse("CLAIM_PENDING");
        case "NONE":
          break;
      }
      if (backend.room.status === "ENDED") return errorResponse("GAME_ENDED");
      const nickname = body.nickname ?? "";
      if (backend.participants.some((p) => compareKey(p.nickname) === compareKey(nickname))) {
        return errorResponse("NICKNAME_TAKEN");
      }
      if (backend.participants.length >= 10) return errorResponse("PARTICIPANT_LIMIT_EXCEEDED", { details: [{ limit: 10 }] });
      return write("join", request, () => {
        const participant: Participant = {
          id: `p-${++sequence}`,
          roomId: backend.room.id,
          nickname,
          status: "ACTIVE",
          order: Math.max(0, ...backend.participants.map((p) => p.order)) + 1,
          isHost: false,
          createdAt: new Date().toISOString(),
        };
        backend.participants.push(participant);
        backend.identities.set(key, participant.id);
        return {
          event: "participant.created",
          extra: { participantId: participant.id },
          response: () => HttpResponse.json({ room, me: participant }, { status: 201 }),
        };
      });
    }),
    http.post(apiUrl(`${invite}/claims`), async ({ request }) => {
      const key = keyOf(request);
      if (key === null) return errorResponse("UNAUTHENTICATED");
      switch (identityOf(key)) {
        case "PARTICIPANT":
          return errorResponse("ALREADY_PARTICIPANT");
        case "REVOKED":
          return errorResponse("IDENTITY_REVOKED");
        case "PENDING":
          return errorResponse("CLAIM_PENDING");
        case "NONE":
          break;
      }
      const body = (await request.json().catch(() => ({}))) as { nickname?: unknown };
      if (typeof body.nickname !== "string" || body.nickname === "") {
        return errorResponse("VALIDATION_FAILED", { details: [{ field: "nickname", code: "REQUIRED" }] });
      }
      const target = backend.participants.find((p) => compareKey(p.nickname) === compareKey(body.nickname as string));
      if (!target || target.isHost) return errorResponse("PARTICIPANT_NOT_FOUND");
      return write("requestClaim", request, () => {
        const claim: Claim = {
          id: `claim-${++sequence}`,
          participantId: target.id,
          nickname: target.nickname,
          status: "PENDING",
          rejectReason: null,
          createdAt: new Date().toISOString(),
          resolvedAt: null,
          resolvedById: null,
        };
        backend.claims.push(claim);
        backend.claimKeys.set(claim.id, key);
        return {
          event: "claim.created",
          extra: { claimId: claim.id },
          response: () => HttpResponse.json({ claim: toMyClaim(claim) }, { status: 201 }),
        };
      });
    }),
    http.get(apiUrl(`${invite}/claims/:claimId`), ({ request, params }) => {
      const key = keyOf(request);
      if (key === null) return errorResponse("UNAUTHENTICATED");
      if (backend.revokedKeys.has(key)) return errorResponse("IDENTITY_REVOKED");
      const claim = backend.claims.find((c) => c.id === params.claimId && backend.claimKeys.get(c.id) === key);
      if (!claim) return errorResponse("CLAIM_NOT_FOUND");
      return HttpResponse.json({ claim: toMyClaim(claim) });
    }),
    http.post(apiUrl(`${invite}/claims/:claimId/cancel`), ({ request, params }) => {
      const key = keyOf(request);
      if (key === null) return errorResponse("UNAUTHENTICATED");
      if (backend.revokedKeys.has(key)) return errorResponse("IDENTITY_REVOKED");
      const claim = backend.claims.find((c) => c.id === params.claimId && backend.claimKeys.get(c.id) === key);
      if (!claim) return errorResponse("CLAIM_NOT_FOUND");
      if (claim.status !== "PENDING") return errorResponse("CLAIM_ALREADY_RESOLVED");
      return write("cancelClaim", request, () => {
        Object.assign(claim, { status: "CANCELED", resolvedAt: new Date().toISOString() });
        return {
          event: "claim.canceled",
          extra: { claimId: claim.id },
          response: () => HttpResponse.json({ claim: toMyClaim(claim) }),
        };
      });
    }),
    // ---- 방장 이어받기 경로(S1 §4.12~§4.15).
    read("claims", "/claims", () => ({ claims: backend.claims.filter((c) => c.status === "PENDING") })),
    http.get(apiUrl(`${base}/claims/:claimId`), ({ request, params }) => {
      if (revoked(request)) return errorResponse("IDENTITY_REVOKED");
      if (!meOf(request).isHost) return errorResponse("HOST_ONLY");
      const claim = backend.claims.find((c) => c.id === params.claimId);
      if (!claim) return errorResponse("CLAIM_NOT_FOUND");
      return HttpResponse.json({ claim });
    }),
    http.post(apiUrl(`${base}/claims/:claimId/approve`), ({ request, params }) => {
      if (revoked(request)) return errorResponse("IDENTITY_REVOKED");
      const host = meOf(request);
      if (!host.isHost) return errorResponse("HOST_ONLY");
      const claim = backend.claims.find((c) => c.id === params.claimId);
      if (!claim) return errorResponse("CLAIM_NOT_FOUND");
      if (claim.status !== "PENDING") return errorResponse("CLAIM_ALREADY_RESOLVED");
      const requesterKey = backend.claimKeys.get(claim.id)!;
      const target = backend.participants.find((p) => p.id === claim.participantId)!;
      const now = new Date().toISOString();
      if (backend.identities.has(requesterKey)) {
        // 승인 시점에 요청 키가 이미 연결됨: 그 요청만 REJECTED로 바꾸고 409(S1 §4.13 3, §2.3 I9).
        Object.assign(claim, { status: "REJECTED", rejectReason: "REQUESTER_LINKED", resolvedAt: now, resolvedById: host.id });
        backend.commit("claim.resolved", { claimId: claim.id });
        return errorResponse("CLAIM_REQUESTER_LINKED");
      }
      return write("approveClaim", request, () => {
        const previousKeys = [...backend.identities].filter(([, id]) => id === target.id).map(([key]) => key);
        for (const key of previousKeys) {
          backend.identities.delete(key);
          backend.revokedKeys.add(key);
        }
        backend.identities.set(requesterKey, target.id);
        Object.assign(claim, { status: "APPROVED", resolvedAt: now, resolvedById: host.id });
        for (const other of backend.claims) {
          if (other !== claim && other.participantId === target.id && other.status === "PENDING") {
            Object.assign(other, { status: "REJECTED", rejectReason: "TARGET_CLAIMED", resolvedAt: now, resolvedById: host.id });
          }
        }
        // 접근을 잃은 키로 연 스트림에만 `access.revoked`를 보내고 닫는다(S5 §4.2).
        for (const [stream, key] of backend.streamKeys) {
          if (key !== null && previousKeys.includes(key)) {
            stream.pushEvent({ event: "access.revoked", data: { roomId: backend.room.id, serverTime: now } });
            stream.close();
            backend.streamKeys.delete(stream);
            backend.streams = backend.streams.filter((s) => s !== stream);
          }
        }
        return {
          event: "claim.resolved",
          extra: { claimId: claim.id },
          response: () => HttpResponse.json({ claim, participant: target }),
        };
      });
    }),
    http.post(apiUrl(`${base}/claims/:claimId/reject`), ({ request, params }) => {
      if (revoked(request)) return errorResponse("IDENTITY_REVOKED");
      const host = meOf(request);
      if (!host.isHost) return errorResponse("HOST_ONLY");
      const claim = backend.claims.find((c) => c.id === params.claimId);
      if (!claim) return errorResponse("CLAIM_NOT_FOUND");
      if (claim.status !== "PENDING") return errorResponse("CLAIM_ALREADY_RESOLVED");
      return write("rejectClaim", request, () => {
        Object.assign(claim, {
          status: "REJECTED",
          rejectReason: "HOST_REJECTED",
          resolvedAt: new Date().toISOString(),
          resolvedById: host.id,
        });
        return { event: "claim.resolved", extra: { claimId: claim.id }, response: () => HttpResponse.json({ claim }) };
      });
    }),
    http.get(apiUrl("/rooms/:roomId/*"), () => errorResponse("ROOM_NOT_FOUND")),
  ] as HttpHandler[];

  return backend;
}
