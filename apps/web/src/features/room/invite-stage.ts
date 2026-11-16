// `/invite/{inviteCode}` 한 화면의 단계 상태기계(FD-2, 2.0.0 FD-22). 화면은 이 순수 함수의 결과만 그린다.
// 확인 중 → {연결됨: 복원 중 → 방 화면 | 없음: 선택 | 대기: 대기 | 접근 상실: (FD-21) → 없음}.
import type { ClaimRejectReason, InviteLookup, MyClaim } from "@/lib/api";

export type InviteStage =
  /**
   * 초대 조회 중. `recheck`가 있으면 결과 불명인 이어받기 요청 뒤의 재조회다(S1 §6.5): 그 시도 전에 페이지 메모리에
   * 있던 요청 ID와 다른 끝난 요청만 이번 결과로 안내한다. `returnTo`는 조회 뒤 돌아갈 단계(후보 다시 불러오기).
   */
  | { stage: "checking"; recheck?: { previousClaimId: string | null }; returnTo?: "candidates" }
  /** 신원 없음: 새로 입장·이어받기 선택(종료된 방은 이어받기만, 후보가 없으면 이어받기도 숨김). */
  | { stage: "choose" }
  | { stage: "nickname" }
  | { stage: "joining" }
  /** 연결된 키(또는 승인된 요청)로 닉네임 없이 입장 요청을 보내는 중. */
  | { stage: "restoring" }
  | { stage: "candidates" }
  /** 후보를 골라 확인 대화상자를 연 상태. */
  | { stage: "confirm"; nickname: string }
  | { stage: "requesting"; nickname: string }
  /** 방장의 승인을 기다린다. 방 정보는 보이지 않는다(AC-ROOM-009-1). */
  | { stage: "waiting"; claim: MyClaim }
  | { stage: "canceling"; claim: MyClaim }
  /** 취소의 결과 불명·`CLAIM_ALREADY_RESOLVED` 뒤 내 요청 조회 중. 주기 조회는 멈추지 않는다. */
  | { stage: "cancel-checking"; claim: MyClaim }
  /** 결과 불명인 이어받기 요청 뒤 재조회도 실패했다. 사용자가 누를 때만 다시 조회한다. */
  | { stage: "unconfirmed"; previousClaimId: string | null }
  | { stage: "room" }
  /** 초대 코드가 없거나 입장할 수 없다(`INVITE_NOT_FOUND`, 복원 실패 등). */
  | { stage: "error"; code: string };

export type InviteNotice =
  /** 끝난 요청의 결과(S1 §9, AC-ROOM-009-7). `REJECTED`면 사유가 있다. */
  | { kind: "claim-result"; status: "REJECTED"; reason: ClaimRejectReason | null }
  | { kind: "claim-result"; status: "CANCELED" }
  /** 결과 불명인 취소 뒤 확인한 상태가 `CANCELED`: 이번 취소의 결과라고 단정하지 않는다(S1 §6.5). */
  | { kind: "claim-canceled-state" }
  /** 결과 불명인 이어받기 요청의 결과를 확인하지 못했다. */
  | { kind: "claim-unconfirmed" }
  /** 취소를 보냈지만 요청은 아직 대기 중이다. */
  | { kind: "cancel-not-done" }
  /** 취소 결과와 현재 상태를 모두 확인하지 못했다(주기 조회가 이어서 확인한다). */
  | { kind: "cancel-unconfirmed" }
  /** 후보를 다시 불러왔지만 이어받을 수 있는 참여자가 없다. */
  | { kind: "no-candidates" }
  /** 서버 `message`를 그대로 보인다. `claimable`이면 이어받기 안내를 덧붙인다(AC-ROOM-002-6, 008-8). */
  | { kind: "server"; message: string; claimable?: boolean };

export interface InviteState {
  view: InviteStage;
  /** 마지막 초대 조회의 방 상태. 종료된 방은 새 입장을 보이지 않는다(AC-ROOM-002-5). */
  ended: boolean;
  /** 마지막 초대 조회의 이어받기 후보(방장 제외, `order` 순). */
  candidates: string[];
  notice: InviteNotice | null;
  /** 페이지 메모리에 있는 가장 최근 요청 ID(조회·요청 응답에서). 결과 불명 판단의 기준이다. */
  lastClaimId: string | null;
  /** 이 페이지에서 결과를 이미 안내한 요청 ID. 같은 요청의 결과는 한 번만 안내한다(FE-C5). */
  shownClaimId: string | null;
}

export type InviteEvent =
  | { type: "CHECKED"; lookup: InviteLookup }
  | { type: "CHECK_FAILED"; code: string }
  /** `unconfirmed`에서 사용자가 `다시 확인`을 눌렀다. */
  | { type: "RECHECK" }
  | { type: "CHOOSE_JOIN" }
  /** 선택 화면 또는 입장 거부 안내의 `이어받기로 가기`. */
  | { type: "CHOOSE_CLAIM" }
  /** 한 단계 뒤로(닉네임·후보 → 선택, 확인 → 후보). */
  | { type: "BACK" }
  | { type: "SUBMIT_NICKNAME" }
  | { type: "JOINED" }
  /** 새 입장 거부. 코드별로 다음 단계를 정한다. 닉네임은 화면이 유지한다. */
  | { type: "JOIN_REJECTED"; code: string; message: string }
  | { type: "RESTORE_FAILED"; code: string }
  | { type: "SELECT_CANDIDATE"; nickname: string }
  | { type: "CONFIRM_CLAIM" }
  | { type: "CLAIM_CREATED"; claim: MyClaim }
  | { type: "CLAIM_REJECTED"; code: string; message: string }
  /** 이어받기 요청의 응답을 받지 못했다(`NetworkError`). 같은 키로 자동 재전송하지 않고 초대 조회를 다시 한다. */
  | { type: "CLAIM_LOST" }
  /**
   * 내 요청의 현재 상태. `poll`은 주기 조회, `check`는 취소 뒤 확인 조회다. 취소 확인 중에 도착한 주기 조회의
   * PENDING은 취소 전에 보낸 조회일 수 있어 확인 결과로 쓰지 않는다.
   */
  | { type: "CLAIM_STATUS"; claim: MyClaim; source: "poll" | "check" }
  /** 취소 뒤 확인 조회까지 실패했다. */
  | { type: "CLAIM_STATUS_FAILED" }
  | { type: "CANCEL" }
  | { type: "CANCELED"; claim: MyClaim }
  /** 취소의 결과 불명 또는 `CLAIM_ALREADY_RESOLVED`. 내 요청 조회로 현재 상태를 확인한다. */
  | { type: "CANCEL_UNCERTAIN" }
  /** 그 밖의 취소 거부. 서버 안내를 보이고 대기에 남는다(주기 조회가 이어서 상태를 확인한다). */
  | { type: "CANCEL_FAILED"; message: string }
  | { type: "ACCESS_REVOKED" }
  | { type: "RETRY" };

export const initialInviteState: InviteState = {
  view: { stage: "checking" },
  ended: false,
  candidates: [],
  notice: null,
  lastClaimId: null,
  shownClaimId: null,
};

/** 방을 방금 만든 브라우저는 응답의 room·me로 바로 방 화면이다. */
export const roomInviteState: InviteState = { ...initialInviteState, view: { stage: "room" } };

const isFinished = (claim: MyClaim) => claim.status === "REJECTED" || claim.status === "CANCELED";

function resultNotice(claim: MyClaim): InviteNotice {
  return claim.status === "CANCELED"
    ? { kind: "claim-result", status: "CANCELED" }
    : { kind: "claim-result", status: "REJECTED", reason: claim.rejectReason };
}

/** 초대 조회 결과로 신원 상태별 단계를 정한다. 일반 진입과 결과 불명 뒤 재조회가 같은 분기를 탄다. */
function afterLookup(state: InviteState, check: Extract<InviteStage, { stage: "checking" }>, lookup: InviteLookup): InviteState {
  const base: InviteState = {
    ...state,
    ended: lookup.room.status === "ENDED",
    candidates: lookup.claimableNicknames,
    lastClaimId: lookup.claim?.id ?? state.lastClaimId,
  };
  switch (lookup.identity) {
    case "PARTICIPANT":
      return { ...base, view: { stage: "restoring" } };
    case "PENDING":
      // 대기 키의 `claim`은 그 PENDING 요청이다(S1 §4.2).
      return lookup.claim
        ? { ...base, view: { stage: "waiting", claim: lookup.claim } }
        : { ...base, view: { stage: "error", code: "INVALID_RESPONSE" } };
    case "NONE":
    case "REVOKED": {
      // REVOKED는 화면이 키를 지운 뒤(FD-21) 신원 없음과 같이 다룬다.
      const claim = lookup.claim;
      let notice = state.notice;
      let shownClaimId = state.shownClaimId;
      if (check.recheck) {
        // 결과 불명 뒤: 이번 시도 전부터 알던 요청의 결과를 이번 요청의 결과로 단정하지 않는다(AC-ROOM-009-7).
        const isNew = claim !== null && claim.id !== check.recheck.previousClaimId && isFinished(claim);
        notice = isNew ? resultNotice(claim) : { kind: "claim-unconfirmed" };
        if (isNew) shownClaimId = claim.id;
      } else if (claim && isFinished(claim) && claim.id !== state.shownClaimId) {
        notice = resultNotice(claim);
        shownClaimId = claim.id;
      }
      if (check.returnTo === "candidates") {
        if (lookup.claimableNicknames.length > 0) return { ...base, notice, shownClaimId, view: { stage: "candidates" } };
        return { ...base, notice: { kind: "no-candidates" }, shownClaimId, view: { stage: "choose" } };
      }
      return { ...base, notice, shownClaimId, view: { stage: "choose" } };
    }
  }
}

/** 끝난 요청의 상태로 대기를 끝낸다. */
function finishClaim(state: InviteState, claim: MyClaim, notice: InviteNotice): InviteState {
  return { ...state, notice, shownClaimId: claim.id, lastClaimId: claim.id, view: { stage: "choose" } };
}

/** 주기 조회·확인 조회가 알려 준 내 요청의 상태로 전이한다(S5 §6.8, S1 §6.5). */
function onClaimStatus(state: InviteState, claim: MyClaim, source: "poll" | "check"): InviteState {
  const view = state.view;
  if (view.stage !== "waiting" && view.stage !== "canceling" && view.stage !== "cancel-checking") return state;
  if (view.claim.id !== claim.id) return state;
  // 취소 확인 중의 PENDING은 확인 조회 결과만 쓴다(늦게 온 주기 조회는 취소 전 상태일 수 있다).
  if (view.stage === "cancel-checking" && source === "poll" && claim.status === "PENDING") return state;
  const afterCancel = view.stage === "cancel-checking";
  switch (claim.status) {
    case "PENDING":
      if (view.stage === "canceling") return state; // 취소 응답을 기다린다
      return {
        ...state,
        notice: afterCancel ? { kind: "cancel-not-done" } : state.notice,
        view: { stage: "waiting", claim },
      };
    case "APPROVED":
      // 승인되면 입장 요청(복원)으로 방에 들어간다(S5 §6.8).
      return { ...state, notice: null, lastClaimId: claim.id, view: { stage: "restoring" } };
    case "REJECTED":
      return finishClaim(state, claim, resultNotice(claim));
    case "CANCELED":
      // 취소 결과가 불명이었거나 다른 탭이 취소했다: 이 화면의 취소 결과라고 단정하지 않는다.
      return finishClaim(state, claim, { kind: "claim-canceled-state" });
  }
}

export function inviteReducer(state: InviteState, event: InviteEvent): InviteState {
  const view = state.view;
  switch (event.type) {
    case "CHECKED":
      return view.stage === "checking" ? afterLookup(state, view, event.lookup) : state;
    case "CHECK_FAILED":
      if (view.stage !== "checking") return state;
      return view.recheck
        ? { ...state, view: { stage: "unconfirmed", previousClaimId: view.recheck.previousClaimId } }
        : { ...state, view: { stage: "error", code: event.code } };
    case "RECHECK":
      return view.stage === "unconfirmed"
        ? { ...state, view: { stage: "checking", recheck: { previousClaimId: view.previousClaimId } } }
        : state;
    case "CHOOSE_JOIN":
      return view.stage === "choose" && !state.ended ? { ...state, notice: null, view: { stage: "nickname" } } : state;
    case "CHOOSE_CLAIM":
      if (view.stage !== "choose" && view.stage !== "nickname") return state;
      if (state.candidates.length > 0) return { ...state, notice: null, view: { stage: "candidates" } };
      // 입장 거부 뒤의 `이어받기로 가기`: 처음 조회한 후보가 비어 있었어도 그 사이 생겼을 수 있으니 다시 불러온다.
      return view.stage === "nickname"
        ? { ...state, notice: null, view: { stage: "checking", returnTo: "candidates" } }
        : state;
    case "BACK":
      if (view.stage === "nickname" || view.stage === "candidates") return { ...state, notice: null, view: { stage: "choose" } };
      if (view.stage === "confirm") return { ...state, view: { stage: "candidates" } };
      return state;
    case "SUBMIT_NICKNAME":
      return view.stage === "nickname" ? { ...state, notice: null, view: { stage: "joining" } } : state;
    case "JOINED":
      return view.stage === "joining" || view.stage === "restoring" ? { ...state, notice: null, view: { stage: "room" } } : state;
    case "JOIN_REJECTED": {
      if (view.stage !== "joining") return state;
      // 대기 중인 요청이 있거나(다른 탭) 그 사이 종료됐다: 초대 조회를 다시 해 대기·종료 화면으로 간다.
      if (event.code === "CLAIM_PENDING" || event.code === "GAME_ENDED") return { ...state, view: { stage: "checking" } };
      const claimable = event.code === "NICKNAME_TAKEN" || event.code === "PARTICIPANT_LIMIT_EXCEEDED";
      return { ...state, notice: { kind: "server", message: event.message, claimable }, view: { stage: "nickname" } };
    }
    case "RESTORE_FAILED":
      return view.stage === "restoring" ? { ...state, view: { stage: "error", code: event.code } } : state;
    case "SELECT_CANDIDATE":
      return view.stage === "candidates" && state.candidates.includes(event.nickname)
        ? { ...state, notice: null, view: { stage: "confirm", nickname: event.nickname } }
        : state;
    case "CONFIRM_CLAIM":
      return view.stage === "confirm" ? { ...state, view: { stage: "requesting", nickname: view.nickname } } : state;
    case "CLAIM_CREATED":
      return view.stage === "requesting"
        ? { ...state, notice: null, lastClaimId: event.claim.id, view: { stage: "waiting", claim: event.claim } }
        : state;
    case "CLAIM_REJECTED": {
      if (view.stage !== "requesting") return state;
      switch (event.code) {
        case "ALREADY_PARTICIPANT": // 이미 연결된 키: 다시 조회하면 복원한다
          return { ...state, view: { stage: "checking" } };
        case "CLAIM_PENDING": // 첫 요청이 저장됐을 수 있다(S1 §6.5): 다시 조회해 현재 요청을 안내한다
          return { ...state, view: { stage: "checking", recheck: { previousClaimId: state.lastClaimId } } };
        case "PARTICIPANT_NOT_FOUND": // 후보가 바뀌었다: 후보를 다시 불러온다
          return { ...state, notice: { kind: "server", message: event.message }, view: { stage: "checking", returnTo: "candidates" } };
        default:
          return { ...state, notice: { kind: "server", message: event.message }, view: { stage: "candidates" } };
      }
    }
    case "CLAIM_LOST":
      return view.stage === "requesting"
        ? { ...state, view: { stage: "checking", recheck: { previousClaimId: state.lastClaimId } } }
        : state;
    case "CLAIM_STATUS":
      return onClaimStatus(state, event.claim, event.source);
    case "CLAIM_STATUS_FAILED":
      return view.stage === "cancel-checking"
        ? { ...state, notice: { kind: "cancel-unconfirmed" }, view: { stage: "waiting", claim: view.claim } }
        : state;
    case "CANCEL":
      return view.stage === "waiting" ? { ...state, notice: null, view: { stage: "canceling", claim: view.claim } } : state;
    case "CANCELED":
      return view.stage === "canceling" && event.claim.id === view.claim.id
        ? finishClaim(state, event.claim, { kind: "claim-result", status: "CANCELED" })
        : state;
    case "CANCEL_UNCERTAIN":
      return view.stage === "canceling" ? { ...state, view: { stage: "cancel-checking", claim: view.claim } } : state;
    case "CANCEL_FAILED":
      return view.stage === "canceling"
        ? { ...state, notice: { kind: "server", message: event.message }, view: { stage: "waiting", claim: view.claim } }
        : state;
    case "ACCESS_REVOKED":
      return { ...state, notice: null, view: { stage: "checking" } };
    case "RETRY":
      return view.stage === "error" ? { ...state, notice: null, view: { stage: "checking" } } : state;
  }
}
