import { atom } from "jotai";
import type { ConnectionPhase } from "./connection";

/** 연결 배너(S5-4)가 읽는 연결 단계. 서버 유래 영역의 표시 여부는 `connectionAtom`과 스냅샷이 정한다. */
export const connectionPhaseAtom = atom<ConnectionPhase>("connecting");

/**
 * 거래 목록의 참여자 필터(S3-2가 설정한다). 갱신 주기의 거래 조회가 이 필터를 유지한 채 첫 페이지부터
 * 새 순회를 한다(AC-VIEW-005-7).
 */
export const participantFilterAtom = atom<string | null>(null);
