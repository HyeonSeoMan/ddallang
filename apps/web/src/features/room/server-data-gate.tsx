"use client";

import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { canMutateAtom, dataVisibleAtom } from "./state";

/**
 * 서버 유래 영역의 유일한 관문(FD-3). 연결됨이고 **현재 연결 세대의 스냅샷이 있을 때만** 자식을 그린다.
 * 끊김·스냅샷 없음·이전 세대 스냅샷에서는 이전 값도 "최신 아님" 표시도 없이 아무것도 그리지 않는다(S5 §6.5).
 */
export function ServerDataGate({ children }: { children: ReactNode }) {
  const visible = useAtomValue(dataVisibleAtom);
  return visible ? <>{children}</> : null;
}

/** 변경 컨트롤(등록·수정·삭제·참여자 변경·종료)의 사용 가능 여부. */
export function useCanMutate(): boolean {
  return useAtomValue(canMutateAtom);
}
