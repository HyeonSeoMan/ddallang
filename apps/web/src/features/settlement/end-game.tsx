"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { css } from "styled-system/css";
import { requestRefreshAtom } from "@/features/realtime/state";
import { useCanMutate } from "@/features/room/server-data-gate";
import { snapshotAtom } from "@/features/room/state";
import { MutationNotice } from "@/features/transactions/mutation-notice";
import { mutationScope, useRoomMutation } from "@/features/transactions/mutation-state";
import { useAnnounce } from "@/ui/announcer";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";

/** 종료 확인(plan §7). 되돌릴 수 없고 이후 거래·참여자 변경이 잠긴다는 점을 알린다(S4 §9). 기본 포커스는 `취소`다. */
export const END_TITLE = "게임을 종료할까요?";
export const END_BODY = "종료하면 되돌릴 수 없습니다. 이후 거래와 참여자를 바꿀 수 없고, 최종 정산이 표시됩니다.";
/** 종료 결과 불명의 안내. 종료됐다고 단정하지 않는다. */
const END_MESSAGES = {
  unknown: "결과를 확인하지 못했습니다. 게임이 종료되었는지 단정할 수 없습니다.",
  unknownAfterRecovery: "종료 여부를 확인할 수 없습니다. 방 상태를 확인해 주세요.",
  expired: "방의 현재 상태를 먼저 확인해 주세요.",
  confirmNew: "종료되지 않았음을 확인했습니다. 다시 종료",
} as const;

/**
 * 게임 종료 컨트롤(FE-S4-1, S4 §4.1·§9). 방장에게만, 진행 중(`IN_PROGRESS`)일 때만 보인다(비방장·`ENDED`이면 숨김).
 * 누르면 확인 대화상자를 거치고 확인한 뒤에만 `POST /rooms/{id}/end`를 보낸다(취소하면 요청 없음). Idempotency Key 수명은
 * 거래와 같은 매니저가 맡는다(S2 §9). 종료 반영은 `200` 응답이 아니라 재동기화한 방 `status`가 기준이다.
 */
export function EndGame() {
  const snapshot = useAtomValue(snapshotAtom);
  const canMutate = useCanMutate();
  const announce = useAnnounce();
  const requestRefresh = useSetAtom(requestRefreshAtom);
  const [confirming, setConfirming] = useState(false);
  // 24시간 경과 뒤 "다시 종료"로 연 대화상자인지: 확인하면 새 키로 보낸다(확인 절차는 첫 시도와 같다).
  const [newAttempt, setNewAttempt] = useState(false);
  const roomId = snapshot?.room.id ?? "";
  const mutation = useRoomMutation(mutationScope("end", roomId, snapshot?.me.id ?? ""), {
    expiredGuide: END_MESSAGES.expired,
  });

  if (!snapshot || !snapshot.me.isHost) return null;
  // 다른 탭이 먼저 종료해 재동기화로 방이 `ENDED`가 되어도, 거부 사유(서버 message)는 컨트롤이 사라진 뒤에도 보인다.
  if (!canMutate) {
    return snapshot.room.status === "ENDED" && mutation.state?.kind === "rejected" ? (
      <MutationNotice state={mutation.state} onRetry={() => undefined} onConfirmNew={() => undefined} messages={END_MESSAGES} />
    ) : null;
  }
  const pending = mutation.state?.kind === "pending";

  async function end(options?: { confirmNewAttempt?: boolean }) {
    if (pending) return;
    const result = await mutation.run(
      { method: "POST", path: `/rooms/${encodeURIComponent(roomId)}/end` },
      options,
    );
    if (!result || result.kind === "pending") return;
    setConfirming(false);
    if (result.kind === "success") {
      // 확정 성공(200). 실제 반영은 재동기화한 방 status가 기준이므로 즉시 갱신을 요청한다.
      requestRefresh();
      announce("게임을 종료했습니다.");
    } else if (result.kind === "rejected" && result.code === "GAME_ENDED") {
      requestRefresh(); // 다른 탭·다른 요청이 먼저 종료했을 수 있다: 서버 message를 보이고 현재 상태를 가져온다
    }
  }

  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "2" })}>
      <Button variant="danger" onClick={() => {
          setNewAttempt(false);
          setConfirming(true);
        }}
        disabled={pending}>
        게임 종료
      </Button>
      <MutationNotice
        state={mutation.state}
        onRetry={() => void end()}
        onConfirmNew={() => {
          setNewAttempt(true);
          setConfirming(true);
        }}
        disabled={pending}
        messages={END_MESSAGES}
      />
      <ConfirmDialog
        open={confirming}
        title={END_TITLE}
        description={END_BODY}
        confirmLabel="게임 종료"
        busy={pending}
        onConfirm={() => void end(newAttempt ? { confirmNewAttempt: true } : undefined)}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
