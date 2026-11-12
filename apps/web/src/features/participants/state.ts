import { atom } from "jotai";

/**
 * 참여자 등록 입력 초안(방 ID별). 메모리 원자라서 연결이 끊겨 영역이 가려져도 입력이 유지되고(AC-SYS-001-5),
 * 새로고침하면 사라진다(AC-SYS-002-4). 방마다 따로 둬서 다른 방으로 이동해도 초안이 새지 않는다.
 */
export const participantDraftsAtom = atom<Record<string, string>>({});
