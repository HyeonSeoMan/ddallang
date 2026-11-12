"use client";

import { useAtom } from "jotai";
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
import { type EditDraft, editDraftKey, editDraftsAtom } from "./edit-state";
import { mutationScope, useRoomMutation } from "./mutation-state";

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
export function TransactionActions({
  transaction,
  me,
  room,
  summary,
}: {
  transaction: Transaction;
  me: RoomMember;
  room: Room;
  /** 접근 가능한 이름에 쓸 거래 요약(예: `가온 → 나래 100 원`). 같은 금액의 거래 행을 구분한다. 없으면 금액만 쓴다. */
  summary?: string;
}) {
  const canMutate = useCanMutate();
  const announce = useAnnounce();
  // 작업 범위는 요청자(RoomMember)별로 분리한다(S2 §5.1: 키의 효력 범위는 방+요청자).
  const update = useRoomMutation(mutationScope("update", transaction.id, me.id));
  const remove = useRoomMutation(mutationScope("delete", transaction.id, me.id));
  const [drafts, setDrafts] = useAtom(editDraftsAtom);
  const [confirming, setConfirming] = useState(false);
  const [errors, setErrors] = useState<FieldErrors | null>(null);

  if (!canMutate || !canEditTransaction(transaction, me)) return null;
  // 삭제가 확정되었다면 스트림 갱신으로 행이 사라질 때까지 컨트롤을 보이지 않는다(삭제된 거래를 다시 수정·삭제하지 못하게).
  if (remove.state?.kind === "success") return null;
  const draftKeyId = editDraftKey(me.id, transaction.id);
  const draft: EditDraft | undefined = drafts[draftKeyId];
  const editing = draft?.open === true;
  const path = `/rooms/${encodeURIComponent(room.id)}/transactions/${encodeURIComponent(transaction.id)}`;
  const updating = update.state?.kind === "pending";
  const deleting = remove.state?.kind === "pending";
  const shownErrors: FieldErrors = errors ?? (update.state?.kind === "rejected" ? update.state.fieldErrors : {});
  /** 결과를 알 수 없는 수정이 남아 있다(성공으로 단정하지 않고 같은 내용으로 수동 재시도해야 한다). */
  const unresolved = update.state?.kind === "unknown" || update.state?.kind === "needs-confirmation";

  /** 고친 필드의 이전 검증 오류를 지운다(다음 저장 때 다시 검증한다). */
  const clearError = (field: "amount" | "reason" | "round") =>
    setErrors((prev) => {
      if (!prev?.[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return Object.keys(next).length > 0 ? next : null;
    });

  const setDraft = (patch: Partial<EditDraft>) =>
    setDrafts((prev) => {
      const current = prev[draftKeyId] ?? {
        amount: String(transaction.amount),
        reason: transaction.reason ?? "",
        round: transaction.round ?? "",
        open: true,
      };
      return { ...prev, [draftKeyId]: { ...current, ...patch } };
    });
  const dropDraft = () =>
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[draftKeyId];
      return next;
    });

  function buildUpdate(values: EditDraft): { body: Record<string, unknown> } | { errors: FieldErrors } {
    const found: FieldErrors = {};
    const parsedAmount = validateAmount(values.amount);
    if (!parsedAmount.ok) found.amount = [fieldReasonMessage("amount", parsedAmount.reason)];
    const parsedReason = validateReason(values.reason);
    if (parsedReason.reasons.length > 0) found.reason = parsedReason.reasons.map((c) => fieldReasonMessage("reason", c));
    const parsedRound = validateRound(values.round);
    if (parsedRound.reasons.length > 0) found.round = parsedRound.reasons.map((c) => fieldReasonMessage("round", c));
    if (!parsedAmount.ok || Object.keys(found).length > 0) return { errors: found };
    // 수정은 세 값을 통째로 교체한다. 입력 없음은 null로 지운다(S2 §4.2). 당사자 필드는 보내지 않는다(AC-TXN-005-6).
    return { body: { amount: parsedAmount.value, reason: parsedReason.value, round: parsedRound.value } };
  }

  async function save(options?: { confirmNewAttempt?: boolean }) {
    if (updating || !draft) return;
    const submitted = draft; // 이 요청이 보낸 입력
    const built = buildUpdate(submitted);
    if ("errors" in built) {
      setErrors(built.errors);
      setDraft({ open: true }); // 닫힌 상태의 재시도라면 폼을 열어 입력 오류를 보여 준다(무반응처럼 보이지 않게)
      return;
    }
    setErrors(null);
    const result = await update.run({ method: "PUT", path, body: built.body }, options);
    // 결과를 알 수 없게 된 요청이 보낸 입력을 기억해 둔다. 취소하면 이 내용으로 되돌려 재시도가 같은 요청의 같은 키 재시도가 되게 한다.
    if (result?.kind === "unknown" || result?.kind === "needs-confirmation") {
      setDraft({ sent: { amount: submitted.amount, reason: submitted.reason, round: submitted.round } });
    }
    // 서버가 필드별 사유로 거부했는데 폼이 닫혀 있으면 열어서 보여 준다(필드 사유는 폼 안에서만 표시된다).
    if (result?.kind === "rejected" && Object.keys(result.fieldErrors).length > 0) setDraft({ open: true });
    if (result?.kind === "success") {
      // 응답을 기다리는 사이 입력을 바꿨다면 새 입력은 보존한다(저장된 것으로 오인해 지우지 않는다).
      setDrafts((prev) => {
        const current = prev[draftKeyId];
        const unchanged =
          current !== undefined &&
          current.amount === submitted.amount &&
          current.reason === submitted.reason &&
          current.round === submitted.round;
        if (unchanged || current === undefined) {
          const next = { ...prev };
          delete next[draftKeyId];
          return next;
        }
        return prev;
      });
      update.clear();
      announce("거래를 수정했습니다.");
    }
  }

  async function confirmDelete(options?: { confirmNewAttempt?: boolean }) {
    if (deleting) return;
    const result = await remove.run({ method: "DELETE", path }, options);
    if (result && result.kind !== "pending") setConfirming(false);
    if (result?.kind === "success") {
      dropDraft(); // 삭제된 거래의 수정 초안을 남기지 않는다
      announce("거래를 삭제했습니다.");
    }
  }

  /**
   * 수정 폼 열기. **초안이 있으면 덮어쓰지 않고 그대로 다시 연다**(결과 불명·거부 상태와 입력 모두 보존).
   * 서버 값으로 새 초안을 만드는 것은 초안이 없을 때뿐이다.
   */
  function startEdit() {
    setErrors(null);
    if (draft) {
      setDraft({ open: true });
      return;
    }
    update.clear();
    setDrafts((prev) => ({
      ...prev,
      [draftKeyId]: {
        amount: String(transaction.amount),
        reason: transaction.reason ?? "",
        round: transaction.round ?? "",
        open: true,
      },
    }));
  }

  /** 취소. 결과 불명인 수정만 보냈던 입력을 남겨 같은 키로 다시 시도할 수 있게 하고, 그 밖에는 초안과 결과를 함께 버린다. */
  function cancelEdit() {
    if (unresolved) setDraft({ open: false, ...(draft?.sent ?? {}) }); // 보냈던 입력으로 되돌린다
    else {
      dropDraft();
      update.clear();
    }
    setErrors(null);
  }

  const label = `거래 ${summary ?? formatMoney(transaction.amount, room.unit)}`;
  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "2" })}>
      {editing && draft ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          noValidate
          className={css({ display: "flex", flexDirection: "column", gap: "2" })}
          aria-label={`${label} 수정`}
        >
          <TextField label="금액" inputMode="numeric" autoComplete="off" value={draft.amount} onChange={(e) => {
              setDraft({ amount: e.target.value });
              clearError("amount");
            }} errors={shownErrors.amount} />
          <TextField label="사유 (선택)" autoComplete="off" value={draft.reason} onChange={(e) => {
              setDraft({ reason: e.target.value });
              clearError("reason");
            }} errors={shownErrors.reason} />
          <TextField label="라운드 (선택)" autoComplete="off" value={draft.round} onChange={(e) => {
              setDraft({ round: e.target.value });
              clearError("round");
            }} errors={shownErrors.round} />
          <MutationNotice state={update.state} onRetry={() => void save()} onConfirmNew={() => void save({ confirmNewAttempt: true })} disabled={updating} />
          <div className={css({ display: "flex", gap: "2" })}>
            <Button type="submit" disabled={updating}>
              {updating ? "저장 중…" : "저장"}
            </Button>
            <Button variant="secondary" onClick={cancelEdit} disabled={updating}>
              취소
            </Button>
          </div>
        </form>
      ) : (
        <div className={css({ display: "flex", gap: "2" })}>
          <Button variant="secondary" onClick={startEdit} disabled={updating} aria-label={`${label} 수정`}>
            수정
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(true)} disabled={deleting} aria-label={`${label} 삭제`}>
            삭제
          </Button>
        </div>
      )}

      {!editing ? (
        <>
          {/* 폼을 닫은 상태에서도 초안이 남아 있으면 결과(불명·거부·만료)를 숨기지 않는다. 재시도는 보냈던 입력으로 한다. */}
          {draft ? (
            <MutationNotice state={update.state} onRetry={() => void save()} onConfirmNew={() => void save({ confirmNewAttempt: true })} disabled={updating} />
          ) : null}
          <MutationNotice state={remove.state} onRetry={() => void confirmDelete()} onConfirmNew={() => void confirmDelete({ confirmNewAttempt: true })} disabled={deleting} />
        </>
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
