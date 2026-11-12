"use client";

import { useState } from "react";
import { css } from "styled-system/css";
import { useCanMutate } from "@/features/room/server-data-gate";
import type { Room, RoomMember, Transaction } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { validateAmount, validateReason, validateRound } from "@/lib/validation/transaction";
import { useAnnounce } from "@/ui/announcer";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { TextField } from "@/ui/text-field";
import { type FieldErrors, fieldReasonMessage } from "./messages";
import { MutationNotice } from "./mutation-notice";
import { useRoomMutation } from "./mutation-state";

/** 삭제 확인(plan §7). 기본 포커스는 `취소`다. */
const DELETE_TITLE = "거래를 삭제할까요?";
const DELETE_BODY = "삭제한 거래는 누적 손익과 정산에서 빠지며 되돌릴 수 없습니다.";

/** 작성자 또는 방장에게만 수정·삭제를 보인다. 노출과 무관하게 서버가 권한을 최종 판정한다(S2 §3.1). */
export function canEditTransaction(transaction: Transaction, me: RoomMember): boolean {
  return transaction.authorId === me.id || me.isHost;
}

/**
 * 거래 행의 수정·삭제 컨트롤(FE-S2-3, S2 §4.2·§4.3·§9). 수정은 금액·사유·라운드만(당사자 입력 없음)이며 확인 없이 저장한다.
 * 삭제는 확인 대화상자를 거친 뒤에만 요청하고, 취소하면 아무것도 보내지 않는다. 게임이 종료되면 컨트롤을 숨긴다.
 */
export function TransactionActions({ transaction, me, room }: { transaction: Transaction; me: RoomMember; room: Room }) {
  const canMutate = useCanMutate();
  const announce = useAnnounce();
  const update = useRoomMutation(`update:${transaction.id}`);
  const remove = useRoomMutation(`delete:${transaction.id}`);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [reason, setReason] = useState(transaction.reason ?? "");
  const [round, setRound] = useState(transaction.round ?? "");
  const [errors, setErrors] = useState<FieldErrors | null>(null);

  if (!canMutate || !canEditTransaction(transaction, me)) return null;
  const path = `/rooms/${encodeURIComponent(room.id)}/transactions/${encodeURIComponent(transaction.id)}`;
  const updating = update.state?.kind === "pending";
  const deleting = remove.state?.kind === "pending";
  const shownErrors: FieldErrors = errors ?? (update.state?.kind === "rejected" ? update.state.fieldErrors : {});

  function buildUpdate(): { body: Record<string, unknown> } | { errors: FieldErrors } {
    const found: FieldErrors = {};
    const parsedAmount = validateAmount(amount);
    if (!parsedAmount.ok) found.amount = [fieldReasonMessage("amount", parsedAmount.reason)];
    const parsedReason = validateReason(reason);
    if (parsedReason.reasons.length > 0) found.reason = parsedReason.reasons.map((c) => fieldReasonMessage("reason", c));
    const parsedRound = validateRound(round);
    if (parsedRound.reasons.length > 0) found.round = parsedRound.reasons.map((c) => fieldReasonMessage("round", c));
    if (!parsedAmount.ok || Object.keys(found).length > 0) return { errors: found };
    // 수정은 세 값을 통째로 교체한다. 입력 없음은 null로 지운다(S2 §4.2). 당사자 필드는 보내지 않는다(AC-TXN-005-6).
    return { body: { amount: parsedAmount.value, reason: parsedReason.value, round: parsedRound.value } };
  }

  async function save(options?: { confirmNewAttempt?: boolean }) {
    if (updating) return;
    const built = buildUpdate();
    if ("errors" in built) {
      setErrors(built.errors);
      return;
    }
    setErrors(null);
    const result = await update.run({ method: "PUT", path, body: built.body }, options);
    if (result?.kind === "success") {
      setEditing(false);
      update.clear();
      announce("거래를 수정했습니다.");
    }
  }

  async function confirmDelete(options?: { confirmNewAttempt?: boolean }) {
    if (deleting) return;
    const result = await remove.run({ method: "DELETE", path }, options);
    if (result && result.kind !== "pending") setConfirming(false);
    if (result?.kind === "success") announce("거래를 삭제했습니다.");
  }

  function startEdit() {
    setAmount(String(transaction.amount));
    setReason(transaction.reason ?? "");
    setRound(transaction.round ?? "");
    setErrors(null);
    update.clear();
    setEditing(true);
  }

  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "2" })}>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          noValidate
          className={css({ display: "flex", flexDirection: "column", gap: "2" })}
          aria-label={`거래 ${formatMoney(transaction.amount, room.unit)} 수정`}
        >
          <TextField label="금액" inputMode="numeric" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} errors={shownErrors.amount} />
          <TextField label="사유 (선택)" autoComplete="off" value={reason} onChange={(e) => setReason(e.target.value)} errors={shownErrors.reason} />
          <TextField label="라운드 (선택)" autoComplete="off" value={round} onChange={(e) => setRound(e.target.value)} errors={shownErrors.round} />
          <MutationNotice state={update.state} onRetry={() => void save()} onConfirmNew={() => void save({ confirmNewAttempt: true })} disabled={updating} />
          <div className={css({ display: "flex", gap: "2" })}>
            <Button type="submit" disabled={updating}>
              {updating ? "저장 중…" : "저장"}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={updating}>
              취소
            </Button>
          </div>
        </form>
      ) : (
        <div className={css({ display: "flex", gap: "2" })}>
          <Button variant="secondary" onClick={startEdit} aria-label={`거래 ${formatMoney(transaction.amount, room.unit)} 수정`}>
            수정
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(true)} disabled={deleting} aria-label={`거래 ${formatMoney(transaction.amount, room.unit)} 삭제`}>
            삭제
          </Button>
        </div>
      )}

      {!editing ? (
        <MutationNotice state={remove.state} onRetry={() => void confirmDelete()} onConfirmNew={() => void confirmDelete({ confirmNewAttempt: true })} disabled={deleting} />
      ) : null}

      <ConfirmDialog
        open={confirming}
        title={DELETE_TITLE}
        description={DELETE_BODY}
        confirmLabel="삭제"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
