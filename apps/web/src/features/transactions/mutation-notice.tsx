"use client";

import { useAtomValue } from "jotai";
import { epochAtom } from "@/features/room/state";
import { Banner } from "@/ui/banner";
import { Button } from "@/ui/button";
import { CLOCK_HINT, EXPIRED_GUIDE, UNKNOWN_AFTER_RECOVERY, UNKNOWN_RESULT } from "./messages";
import type { MutationUi } from "./mutation-state";

/**
 * 거래 변경 요청의 결과 안내(FE-S2-1). 성공을 단정하지 않는다: 결과 불명은 "결과를 확인하지 못했습니다"이고,
 * 연결이 복구된 뒤에도 확인되지 않으면 "저장 여부를 확인할 수 없습니다"를 유지한다. 자동 재전송은 없고 재시도는 사용자가 한다.
 */
export function MutationNotice({
  state,
  onRetry,
  onConfirmNew,
  disabled,
}: {
  state: MutationUi | null;
  /** 결과 불명 뒤 같은 키로 다시 시도한다. */
  onRetry: () => void;
  /** 24시간이 지난 시도를 거래 내역 확인 뒤 새 키로 다시 저장한다. */
  onConfirmNew: () => void;
  disabled?: boolean;
}) {
  const currentEpoch = useAtomValue(epochAtom);
  if (!state) return null;

  switch (state.kind) {
    case "rejected":
      return state.message ? <Banner tone="error">{state.message}</Banner> : null;
    case "error":
      return <Banner tone="error">{state.message}</Banner>;
    case "unknown": {
      // 불명이 된 뒤 연결이 다시 맺어져(세대가 올라감) 재조회했는데도 이 화면에서 확정할 수 없다.
      const recovered = currentEpoch > state.epoch;
      return (
        <>
          <Banner tone="warning">{recovered ? UNKNOWN_AFTER_RECOVERY : UNKNOWN_RESULT}</Banner>
          <Button variant="secondary" onClick={onRetry} disabled={disabled}>
            다시 시도
          </Button>
        </>
      );
    }
    case "needs-confirmation":
      return (
        <>
          <Banner tone="warning">{`첫 시도 후 24시간이 지났습니다. ${EXPIRED_GUIDE} ${CLOCK_HINT}`}</Banner>
          <Button variant="secondary" onClick={onConfirmNew} disabled={disabled}>
            저장되지 않았음을 확인했습니다. 새로 저장
          </Button>
        </>
      );
    default:
      return null; // pending·success는 호출자가 컨트롤 상태와 알림으로 표현한다
  }
}
