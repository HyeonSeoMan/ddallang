// 초대 화면 상태기계(FD-22) 전이 전수 시험. 1.x `room.test.tsx`의 "초대 화면 단계 상태기계"를 대체한다.
import { describe, expect, it } from "vitest";
import type { InviteLookup, MyClaim } from "@/lib/api";
import * as fixtures from "@/test/fixtures";
import {
  type InviteEvent,
  type InviteStage,
  type InviteState,
  initialInviteState,
  inviteReducer,
  roomInviteState,
} from "./invite-stage";

const run = (events: InviteEvent[], from: InviteState = initialInviteState) => events.reduce(inviteReducer, from);
const stageOf = (state: InviteState) => state.view.stage;
const at = (view: InviteStage, extra: Partial<InviteState> = {}): InviteState => ({
  ...initialInviteState,
  candidates: ["나래", "다온"],
  ...extra,
  view,
});

const claim = (overrides: Partial<MyClaim> = {}): MyClaim => ({ ...fixtures.pendingMyClaim, ...overrides });
const lookup = (overrides: Partial<InviteLookup> = {}) => fixtures.inviteLookup(overrides);
const checked = (overrides: Partial<InviteLookup> = {}): InviteEvent => ({ type: "CHECKED", lookup: lookup(overrides) });

describe("초대 화면 상태기계 (FD-22)", () => {
  describe("초대 조회 결과의 신원 상태 분기", () => {
    it("[AC-ROOM-005-1] PARTICIPANT는 닉네임 없이 복원 → 방 화면", () => {
      const restoring = run([checked({ identity: "PARTICIPANT" })]);
      expect(stageOf(restoring)).toBe("restoring");
      expect(stageOf(run([{ type: "JOINED" }], restoring))).toBe("room");
      expect(run([{ type: "RESTORE_FAILED", code: "ROOM_NOT_FOUND" }], restoring).view).toEqual({
        stage: "error",
        code: "ROOM_NOT_FOUND",
      });
    });

    it("[AC-ROOM-009-1] PENDING은 그 요청으로 대기한다", () => {
      const state = run([checked({ identity: "PENDING", claim: claim() })]);
      expect(state.view).toEqual({ stage: "waiting", claim: claim() });
      expect(state.lastClaimId).toBe("claim-1");
    });

    it("NONE은 선택이고 방 상태·후보를 기억한다. REVOKED도 신원 없음으로 다룬다(키는 화면이 지운다)", () => {
      const none = run([checked()]);
      expect(none).toMatchObject({ view: { stage: "choose" }, ended: false, candidates: ["나래", "다온"], notice: null });
      expect(stageOf(run([checked({ identity: "REVOKED" })]))).toBe("choose");
      const ended = run([checked({ room: { ...lookup().room, status: "ENDED" } })]);
      expect(ended.ended).toBe(true);
    });

    it("조회 실패는 오류이고 다시 시도하면 확인 중으로 돌아간다", () => {
      const failed = run([{ type: "CHECK_FAILED", code: "INVITE_NOT_FOUND" }]);
      expect(failed.view).toEqual({ stage: "error", code: "INVITE_NOT_FOUND" });
      expect(stageOf(run([{ type: "RETRY" }], failed))).toBe("checking");
    });
  });

  describe("[AC-ROOM-009-7] 끝난 요청의 결과 안내(페이지 메모리에서 한 번, FE-C5)", () => {
    it.each([
      ["HOST_REJECTED" as const],
      ["TARGET_CLAIMED" as const],
      ["REQUESTER_LINKED" as const],
    ])("최근 요청이 REJECTED(%s)면 사유를 안내한다", (reason) => {
      const state = run([checked({ claim: claim({ status: "REJECTED", rejectReason: reason }) })]);
      expect(state.notice).toEqual({ kind: "claim-result", status: "REJECTED", reason });
      expect(state.shownClaimId).toBe("claim-1");
    });

    it("CANCELED도 안내하고, 같은 요청은 이 페이지에서 다시 안내하지 않는다", () => {
      const first = run([checked({ claim: claim({ status: "CANCELED" }) })]);
      expect(first.notice).toEqual({ kind: "claim-result", status: "CANCELED" });
      // 다른 일로 다시 조회해도(예: 입장 거부 뒤 재조회) 같은 요청의 결과는 다시 안내하지 않는다.
      const again = run(
        [{ type: "CHOOSE_JOIN" }, { type: "SUBMIT_NICKNAME" }, { type: "JOIN_REJECTED", code: "GAME_ENDED", message: "m" }, checked({ claim: claim({ status: "CANCELED" }) })],
        first,
      );
      expect(again.notice).toBeNull();
    });

    it("PENDING·APPROVED 요청이나 요청이 없으면 결과 안내가 없다", () => {
      expect(run([checked({ claim: null })]).notice).toBeNull();
      expect(run([checked({ claim: claim({ status: "APPROVED" }) })]).notice).toBeNull();
    });
  });

  describe("선택 → 새로 입장", () => {
    it("[AC-ROOM-002-5] 진행 중이면 새로 입장 → 닉네임 → 입장 중 → 방 화면, 종료된 방은 새 입장이 없다", () => {
      const choose = run([checked()]);
      const nickname = run([{ type: "CHOOSE_JOIN" }], choose);
      expect(stageOf(nickname)).toBe("nickname");
      expect(stageOf(run([{ type: "SUBMIT_NICKNAME" }, { type: "JOINED" }], nickname))).toBe("room");
      const ended = run([checked({ room: { ...lookup().room, status: "ENDED" } }), { type: "CHOOSE_JOIN" }]);
      expect(stageOf(ended)).toBe("choose");
    });

    it("[AC-ROOM-002-6] NICKNAME_TAKEN·PARTICIPANT_LIMIT_EXCEEDED는 서버 안내와 이어받기 안내로 닉네임 단계에 남는다", () => {
      for (const code of ["NICKNAME_TAKEN", "PARTICIPANT_LIMIT_EXCEEDED"]) {
        const state = run([{ type: "JOIN_REJECTED", code, message: "서버 안내" }], at({ stage: "joining" }));
        expect(state.view).toEqual({ stage: "nickname" });
        expect(state.notice).toEqual({ kind: "server", message: "서버 안내", claimable: true });
        // 안내의 `이어받기로 가기`는 후보 선택으로 간다.
        expect(stageOf(run([{ type: "CHOOSE_CLAIM" }], state))).toBe("candidates");
      }
    });

    it("입장 거부 뒤 `이어받기로 가기`는 처음 후보가 비어 있었어도 후보를 다시 불러온다(검수 L5)", () => {
      const rejected = run(
        [{ type: "JOIN_REJECTED", code: "NICKNAME_TAKEN", message: "m" }],
        at({ stage: "joining" }, { candidates: [] }),
      );
      const reloading = run([{ type: "CHOOSE_CLAIM" }], rejected);
      expect(reloading.view).toEqual({ stage: "checking", returnTo: "candidates" });
      expect(stageOf(run([checked({ claimableNicknames: ["다온"] })], reloading))).toBe("candidates");
      expect(stageOf(run([checked({ claimableNicknames: [] })], reloading))).toBe("choose");
    });

    it("다른 거부(검증·네트워크)는 이어받기 안내 없이 닉네임 단계로 돌아간다", () => {
      const state = run([{ type: "JOIN_REJECTED", code: "VALIDATION_FAILED", message: "m" }], at({ stage: "joining" }));
      expect(state.notice).toEqual({ kind: "server", message: "m", claimable: false });
      expect(stageOf(state)).toBe("nickname");
    });

    it("[AC-ROOM-009-9] CLAIM_PENDING·GAME_ENDED는 초대 조회를 다시 한다(대기·종료 화면으로)", () => {
      for (const code of ["CLAIM_PENDING", "GAME_ENDED"]) {
        const state = run([{ type: "JOIN_REJECTED", code, message: "m" }], at({ stage: "joining" }));
        expect(state.view).toEqual({ stage: "checking" });
      }
      const waiting = run(
        [{ type: "JOIN_REJECTED", code: "CLAIM_PENDING", message: "m" }, checked({ identity: "PENDING", claim: claim() })],
        at({ stage: "joining" }),
      );
      expect(stageOf(waiting)).toBe("waiting");
    });
  });

  describe("선택 → 이어받기 요청", () => {
    it("[AC-ROOM-009-1] 후보 선택 → 확인 → 요청 중 → 대기, 뒤로는 한 단계씩", () => {
      const candidates = run([checked(), { type: "CHOOSE_CLAIM" }]);
      expect(stageOf(candidates)).toBe("candidates");
      const confirm = run([{ type: "SELECT_CANDIDATE", nickname: "나래" }], candidates);
      expect(confirm.view).toEqual({ stage: "confirm", nickname: "나래" });
      expect(stageOf(run([{ type: "BACK" }], confirm))).toBe("candidates");
      expect(stageOf(run([{ type: "BACK" }, { type: "BACK" }], confirm))).toBe("choose");
      const requesting = run([{ type: "CONFIRM_CLAIM" }], confirm);
      expect(requesting.view).toEqual({ stage: "requesting", nickname: "나래" });
      const waiting = run([{ type: "CLAIM_CREATED", claim: claim() }], requesting);
      expect(waiting.view).toEqual({ stage: "waiting", claim: claim() });
      expect(waiting.lastClaimId).toBe("claim-1");
    });

    it("후보가 없으면 이어받기로 갈 수 없고 후보 밖의 닉네임은 고를 수 없다", () => {
      expect(stageOf(run([checked({ claimableNicknames: [] }), { type: "CHOOSE_CLAIM" }]))).toBe("choose");
      expect(stageOf(run([{ type: "SELECT_CANDIDATE", nickname: "가온" }], at({ stage: "candidates" })))).toBe("candidates");
    });

    it("[AC-ROOM-009-2] 요청 거부: ALREADY_PARTICIPANT는 재조회(복원), CLAIM_PENDING은 결과 불명 재조회, PARTICIPANT_NOT_FOUND는 후보 다시 불러오기", () => {
      const requesting = at({ stage: "requesting", nickname: "나래" }, { lastClaimId: "old" });
      expect(run([{ type: "CLAIM_REJECTED", code: "ALREADY_PARTICIPANT", message: "m" }], requesting).view).toEqual({
        stage: "checking",
      });
      expect(run([{ type: "CLAIM_REJECTED", code: "CLAIM_PENDING", message: "m" }], requesting).view).toEqual({
        stage: "checking",
        recheck: { previousClaimId: "old" },
      });
      const notFound = run([{ type: "CLAIM_REJECTED", code: "PARTICIPANT_NOT_FOUND", message: "없음" }], requesting);
      expect(notFound.view).toEqual({ stage: "checking", returnTo: "candidates" });
      expect(notFound.notice).toEqual({ kind: "server", message: "없음" });
      expect(stageOf(run([checked()], notFound))).toBe("candidates");
      const other = run([{ type: "CLAIM_REJECTED", code: "KEY_storage-failed", message: "저장소" }], requesting);
      expect(other).toMatchObject({ view: { stage: "candidates" }, notice: { kind: "server", message: "저장소" } });
    });
  });

  describe("이어받기 요청의 결과 불명(S1 §6.5)", () => {
    const lost = run([{ type: "CLAIM_LOST" }], at({ stage: "requesting", nickname: "나래" }, { lastClaimId: "old" }));

    it("같은 키로 자동 재전송하지 않고 이전 요청 ID를 기억한 채 초대 조회를 다시 한다", () => {
      expect(lost.view).toEqual({ stage: "checking", recheck: { previousClaimId: "old" } });
    });

    it("PENDING이면 그 요청으로 대기한다", () => {
      expect(run([checked({ identity: "PENDING", claim: claim({ id: "new" }) })], lost).view).toEqual({
        stage: "waiting",
        claim: claim({ id: "new" }),
      });
    });

    it("그 사이 승인됐으면(PARTICIPANT) 복원한다", () => {
      expect(stageOf(run([checked({ identity: "PARTICIPANT" })], lost))).toBe("restoring");
    });

    it("그 사이 거절·취소된 새 요청이면 그 결과를 안내하고 선택으로 간다", () => {
      const rejected = run([checked({ claim: claim({ id: "new", status: "REJECTED", rejectReason: "HOST_REJECTED" }) })], lost);
      expect(rejected).toMatchObject({
        view: { stage: "choose" },
        notice: { kind: "claim-result", status: "REJECTED", reason: "HOST_REJECTED" },
      });
      const canceled = run([checked({ claim: claim({ id: "new", status: "CANCELED" }) })], lost);
      expect(canceled.notice).toEqual({ kind: "claim-result", status: "CANCELED" });
    });

    it("요청이 저장되지 않았으면(claim 없음) 확인하지 못했다고 안내한다", () => {
      expect(run([checked({ claim: null })], lost)).toMatchObject({
        view: { stage: "choose" },
        notice: { kind: "claim-unconfirmed" },
      });
    });

    it("이전 요청의 결과만 남아 있으면 이번 결과로 단정하지 않고 확인하지 못했다고 안내한다", () => {
      const state = run([checked({ claim: claim({ id: "old", status: "REJECTED", rejectReason: "HOST_REJECTED" }) })], lost);
      expect(state.notice).toEqual({ kind: "claim-unconfirmed" });
    });

    it("재조회도 실패하면 결과 확인 불가와 다시 확인(사용자가 누를 때만)", () => {
      const failed = run([{ type: "CHECK_FAILED", code: "NETWORK_ERROR" }], lost);
      expect(failed.view).toEqual({ stage: "unconfirmed", previousClaimId: "old" });
      const recheck = run([{ type: "RECHECK" }], failed);
      expect(recheck.view).toEqual({ stage: "checking", recheck: { previousClaimId: "old" } });
    });
  });

  describe("대기와 요청 취소", () => {
    const waiting = at({ stage: "waiting", claim: claim() });

    it("[AC-ROOM-009-9] 취소 성공(CANCELED)이면 취소 안내 후 선택", () => {
      const canceling = run([{ type: "CANCEL" }], waiting);
      expect(canceling.view).toEqual({ stage: "canceling", claim: claim() });
      const done = run([{ type: "CANCELED", claim: claim({ status: "CANCELED" }) }], canceling);
      expect(done).toMatchObject({ view: { stage: "choose" }, notice: { kind: "claim-result", status: "CANCELED" } });
    });

    describe("취소의 결과 불명·CLAIM_ALREADY_RESOLVED 뒤 내 요청 조회", () => {
      const checking = run([{ type: "CANCEL" }, { type: "CANCEL_UNCERTAIN" }], waiting);

      it("내 요청 조회 단계로 간다(주기 조회는 멈추지 않는다)", () => {
        expect(checking.view).toEqual({ stage: "cancel-checking", claim: claim() });
      });

      it("PENDING이면 대기를 유지하고 취소되지 않았다고 안내한다", () => {
        expect(run([{ type: "CLAIM_STATUS", claim: claim() }], checking)).toMatchObject({
          view: { stage: "waiting" },
          notice: { kind: "cancel-not-done" },
        });
      });

      it("APPROVED면 입장 요청으로 복원한다", () => {
        expect(stageOf(run([{ type: "CLAIM_STATUS", claim: claim({ status: "APPROVED" }) }], checking))).toBe("restoring");
      });

      it("REJECTED면 사유를 안내하고 선택으로", () => {
        const state = run(
          [{ type: "CLAIM_STATUS", claim: claim({ status: "REJECTED", rejectReason: "TARGET_CLAIMED" }) }],
          checking,
        );
        expect(state).toMatchObject({
          view: { stage: "choose" },
          notice: { kind: "claim-result", status: "REJECTED", reason: "TARGET_CLAIMED" },
        });
      });

      it("CANCELED면 이번 취소의 결과라고 단정하지 않는 안내로 선택", () => {
        expect(run([{ type: "CLAIM_STATUS", claim: claim({ status: "CANCELED" }) }], checking)).toMatchObject({
          view: { stage: "choose" },
          notice: { kind: "claim-canceled-state" },
        });
      });

      it("확인 조회도 실패하면 대기로 돌아가 확인하지 못했다고 안내한다", () => {
        expect(run([{ type: "CLAIM_STATUS_FAILED" }], checking)).toMatchObject({
          view: { stage: "waiting", claim: claim() },
          notice: { kind: "cancel-unconfirmed" },
        });
      });
    });

    it("결과 불명·이미 처리됨이 아닌 취소 거부는 서버 안내를 보이고 대기에 남는다(검수 L3)", () => {
      const state = run([{ type: "CANCEL" }, { type: "CANCEL_FAILED", message: "요청을 찾을 수 없습니다" }], waiting);
      expect(state).toMatchObject({
        view: { stage: "waiting", claim: claim() },
        notice: { kind: "server", message: "요청을 찾을 수 없습니다" },
      });
    });

    it("대기 중 상태 조회(주기 조회): 승인 → 복원, 거절 → 사유 안내, 다른 요청 ID는 무시", () => {
      expect(stageOf(run([{ type: "CLAIM_STATUS", claim: claim({ status: "APPROVED" }) }], waiting))).toBe("restoring");
      expect(
        run([{ type: "CLAIM_STATUS", claim: claim({ status: "REJECTED", rejectReason: "HOST_REJECTED" }) }], waiting).notice,
      ).toEqual({ kind: "claim-result", status: "REJECTED", reason: "HOST_REJECTED" });
      expect(run([{ type: "CLAIM_STATUS", claim: claim({ id: "other", status: "APPROVED" }) }], waiting)).toEqual(waiting);
      expect(run([{ type: "CLAIM_STATUS", claim: claim() }], waiting).view).toEqual(waiting.view);
    });

    it("취소 요청 중에 온 PENDING은 취소 응답을 기다린다", () => {
      const canceling = run([{ type: "CANCEL" }], waiting);
      expect(run([{ type: "CLAIM_STATUS", claim: claim() }], canceling)).toEqual(canceling);
    });

    it("승인된 요청의 복원이 끝나면 방 화면", () => {
      expect(stageOf(run([{ type: "CLAIM_STATUS", claim: claim({ status: "APPROVED" }) }, { type: "JOINED" }], waiting))).toBe(
        "room",
      );
    });
  });

  it("접근 상실은 어느 단계에서든 초대 조회부터 다시 한다", () => {
    expect(run([{ type: "ACCESS_REVOKED" }], roomInviteState).view).toEqual({ stage: "checking" });
    expect(run([{ type: "ACCESS_REVOKED" }], at({ stage: "waiting", claim: claim() })).view).toEqual({ stage: "checking" });
  });

  it("단계에 맞지 않는 이벤트는 무시한다", () => {
    const events: InviteEvent[] = [
      { type: "JOINED" },
      { type: "SUBMIT_NICKNAME" },
      { type: "CONFIRM_CLAIM" },
      { type: "CLAIM_CREATED", claim: claim() },
      { type: "CLAIM_LOST" },
      { type: "CANCEL" },
      { type: "CANCEL_UNCERTAIN" },
      { type: "CLAIM_STATUS_FAILED" },
      { type: "RECHECK" },
      { type: "RETRY" },
      { type: "BACK" },
    ];
    for (const event of events) expect(run([event])).toEqual(initialInviteState);
    // 확인 중이 아니면 조회 결과를 반영하지 않는다.
    const choose = run([checked()]);
    expect(run([checked({ identity: "PARTICIPANT" })], choose)).toEqual(choose);
  });
});
