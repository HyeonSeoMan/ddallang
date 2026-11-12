import { atom } from "jotai";

/**
 * 참여자 등록 입력 초안. 메모리 원자라서 연결이 끊겨 영역이 가려져도 입력이 유지되고(AC-SYS-001-5),
 * 새로고침하면 사라진다(AC-SYS-002-4).
 */
export const participantDraftAtom = atom("");
