// `/invite/{inviteCode}` 한 화면의 단계 상태기계(FD-2): 확인 중 → 닉네임 입력 → 입장 중 → 방 화면.
export type InviteStage =
  | { stage: "checking" }
  | { stage: "nickname" }
  | { stage: "joining" }
  | { stage: "room" }
  /** 초대 코드가 없거나 입장할 수 없다(`INVITE_NOT_FOUND` 등). */
  | { stage: "error"; code: string };

export type InviteEvent =
  /** `GET /invites` 결과. 이미 멤버(`isMember`)면 닉네임 없이 복원 입장으로 간다. */
  | { type: "CHECKED"; isMember: boolean }
  | { type: "CHECK_FAILED"; code: string }
  | { type: "SUBMIT_NICKNAME" }
  | { type: "JOINED" }
  /** 입장 거부(`NICKNAME_TAKEN`·한도 등). 입력한 닉네임을 유지한 채 닉네임 단계로 돌아간다. */
  | { type: "JOIN_REJECTED" }
  /** 복원 입장이 실패하면 닉네임 단계가 아니라 오류다(키는 있는데 방이 없는 경우 등). */
  | { type: "RESTORE_FAILED"; code: string };

export const initialInviteStage: InviteStage = { stage: "checking" };

export function inviteReducer(state: InviteStage, event: InviteEvent): InviteStage {
  switch (event.type) {
    case "CHECKED":
      return state.stage === "checking"
        ? { stage: event.isMember ? "joining" : "nickname" }
        : state;
    case "CHECK_FAILED":
      return state.stage === "checking" ? { stage: "error", code: event.code } : state;
    case "SUBMIT_NICKNAME":
      return state.stage === "nickname" ? { stage: "joining" } : state;
    case "JOINED":
      return state.stage === "joining" ? { stage: "room" } : state;
    case "JOIN_REJECTED":
      return state.stage === "joining" ? { stage: "nickname" } : state;
    case "RESTORE_FAILED":
      return state.stage === "joining" ? { stage: "error", code: event.code } : state;
  }
}
