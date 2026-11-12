import { atom } from "jotai";

/** 거래 수정 폼의 입력과 열림 상태. */
export interface EditDraft {
  amount: string;
  reason: string;
  round: string;
  /** 폼이 열려 있는가. 결과 불명인 수정이 남아 있으면 닫아도 입력값은 남겨 같은 내용으로 다시 시도할 수 있다. */
  open: boolean;
  /** 결과를 알 수 없게 된 요청이 보낸 입력. 취소하면 이 내용으로 되돌려 재시도가 같은 요청의 같은 키 재시도가 되게 한다. */
  sent?: { amount: string; reason: string; round: string };
}

/** 수정 초안의 키: 요청자(RoomMember)와 거래별. 같은 방에서 신원이 바뀌어도 이전 신원의 초안이 보이지 않는다. */
export const editDraftKey = (memberId: string, transactionId: string) => `${memberId}:${transactionId}`;

/**
 * 거래 ID별 수정 초안. 메모리 원자라서 연결이 끊겨 행이 언마운트돼도 유지되고(S5 §6.5, AC-SYS-001-5) 새로고침하면
 * 사라진다(AC-SYS-002-4). 복구해도 자동 제출하지 않는다(AC-SYS-002-2).
 */
export const editDraftsAtom = atom<Record<string, EditDraft>>({});
