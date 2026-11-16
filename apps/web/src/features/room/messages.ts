import type { ValidationReasonCode } from "@/lib/api";
import type { InviteNotice } from "./invite-stage";

/** 검증 사유 코드별 안내 문구. 서버 규칙과 같은 코드를 쓰되 표시는 클라이언트 문구다(서버 `message`는 별도). */
export const REASON_MESSAGES: Partial<Record<ValidationReasonCode, string>> = {
  REQUIRED: "필수 항목입니다.",
  LENGTH_OUT_OF_RANGE: "12자 이하로 입력해 주세요.",
  INVALID_CHARACTER: "한글, 영문, 숫자, 공백만 쓸 수 있습니다.",
  LEADING_OR_TRAILING_SPACE: "앞뒤에 공백을 둘 수 없습니다.",
  CONSECUTIVE_SPACES: "공백을 연속으로 쓸 수 없습니다.",
  INVALID_TYPE: "올바른 값이 아닙니다.",
  INVALID_VALUE: "올바른 값이 아닙니다.",
};

export function reasonMessage(code: string | undefined): string {
  return REASON_MESSAGES[code as ValidationReasonCode] ?? "올바른 값이 아닙니다.";
}

/**
 * 신원 키 안내(S1 §3.1·§9, plan §7 2.0.0). 서버가 복구할 수 없다는 사실과, 기존 참여자는 방장 승인의 이어받기로만
 * 되찾을 수 있고 방장 권한은 되찾을 수 없다는 사실을 숨기지 않는다.
 */
export const IDENTITY_KEY_NOTICE =
  "이 방에는 이 브라우저에 저장된 정보로 다시 들어옵니다. 브라우저 저장소를 지우면 서버도 복구할 수 없으며, 기존 참여자는 방장의 승인을 받아 이어받기로만 되찾을 수 있습니다. 방장은 이어받을 수 없어 방장 권한은 되찾을 수 없습니다.";

/** 방 생성 결과 불명(S1 §6.5, plan §7). */
export const CREATE_UNKNOWN_NOTICE =
  "응답을 받지 못했습니다. 다시 시도하면 같은 이름의 방이 하나 더 만들어질 수 있습니다.";

/** 접근 상실 배너(S1 §3.1, §9, plan §7 2.0.0). 뒤 문장은 방이 진행 중인지 종료됐는지로 나뉜다. */
export const ACCESS_LOST_NOTICE =
  "이 브라우저는 이 방에 더 이상 접근할 수 없습니다. 방장이 다른 브라우저의 이어받기를 승인했습니다.";
export const ACCESS_LOST_NEXT_IN_PROGRESS = "다시 들어오려면 새로 입장하거나 이어받기를 요청하세요.";
export const ACCESS_LOST_NEXT_ENDED = "다시 들어오려면 이어받기를 요청하세요.";

/** 받침이 있으면 `으로`, 없거나 ㄹ 받침이면 `로`. 한글 음절로 끝나지 않으면 `(으)로`. */
export function withRo(word: string): string {
  const code = word.codePointAt(word.length - 1) ?? 0;
  if (code < 0xac00 || code > 0xd7a3) return `${word}(으)로`;
  const final = (code - 0xac00) % 28;
  return `${word}${final === 0 || final === 8 ? "로" : "으로"}`;
}

// ---- 초대 화면 2.0.0(plan §7, FE-C9)
export const ENDED_NO_JOIN = "게임이 종료되어 새로 입장할 수 없습니다.";
export const CLAIM_GUIDE = "이 브라우저의 정보를 잃었다면 방장 승인을 받아 기존 참여자로 다시 들어올 수 있습니다.";
export const CLAIMABLE_HINT = "기존 참여자라면 이어받기를 요청하세요.";
export const CLAIM_CONFIRM_BODY =
  "방장이 승인하면 이 브라우저로 들어갑니다. 그 참여자로 접속하던 다른 브라우저는 접근을 잃습니다.";
export const claimConfirmTitle = (nickname: string) => `${withRo(nickname)} 이어받을까요?`;
export const WAITING_TITLE = "방장의 승인을 기다리는 중";
export const waitingBody = (nickname: string) =>
  `${withRo(nickname)} 이어받기를 요청했습니다. 이 화면을 열어 두면 결과가 나오는 대로 바로 들어갑니다.`;
/** S1 §6.5·plan §7이 정한 문장. 저장됐다고도 안 됐다고도 단정하지 않는다. */
export const RESULT_UNCONFIRMED = "결과를 확인하지 못했습니다.";

const REJECT_MESSAGES = {
  HOST_REJECTED: "방장이 이어받기 요청을 거절했습니다.",
  TARGET_CLAIMED: "다른 요청이 승인되어 이 요청은 거절되었습니다.",
  REQUESTER_LINKED: "이 브라우저는 이미 다른 참여자로 들어와 있어 요청이 거절되었습니다.",
} as const;

/** 초대 화면 안내의 문구와 강도. */
export function inviteNoticeContent(notice: InviteNotice): { tone: "info" | "warning" | "error"; text: string } {
  switch (notice.kind) {
    case "claim-result":
      return notice.status === "CANCELED"
        ? { tone: "info", text: "이어받기 요청을 취소했습니다." }
        : { tone: "info", text: notice.reason ? REJECT_MESSAGES[notice.reason] : "이어받기 요청이 거절되었습니다." };
    case "claim-canceled-state":
      return { tone: "info", text: "이어받기 요청이 취소된 상태입니다." };
    case "claim-unconfirmed":
      return { tone: "warning", text: `${RESULT_UNCONFIRMED} 필요하면 다시 요청해 주세요.` };
    case "cancel-not-done":
      return { tone: "warning", text: "요청이 취소되지 않았습니다. 아직 방장의 승인을 기다리는 중입니다." };
    case "cancel-unconfirmed":
      return { tone: "warning", text: `${RESULT_UNCONFIRMED} 요청 상태를 계속 확인합니다.` };
    case "no-candidates":
      return { tone: "info", text: "이어받을 수 있는 참여자가 없습니다." };
    case "server":
      return { tone: "error", text: notice.message };
  }
}
