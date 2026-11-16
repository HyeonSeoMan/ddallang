"use client";

import { atom, useAtom, useAtomValue } from "jotai";
import { type FormEvent, useState } from "react";
import { css } from "styled-system/css";
import { useCanMutate } from "@/features/room/server-data-gate";
import { readOnlySelfAtom, snapshotAtom } from "@/features/room/state";
import { type ValidationReasonCode } from "@/lib/api";
import { validateAmount, validateReason, validateRound } from "@/lib/validation/transaction";
import { useAnnounce } from "@/ui/announcer";
import { Banner } from "@/ui/banner";
import { Button } from "@/ui/button";
import { ChoiceChips } from "@/ui/choice-chips";
import { CheckIcon } from "@/ui/icons";
import { amountInputClass, TextField } from "@/ui/text-field";
import { useDismissedServerErrors } from "./dismissed-errors";
import { type FieldErrors, fieldReasonMessage, READ_ONLY_SELF_NOTICE, type TxField } from "./messages";
import { MutationNotice } from "./mutation-notice";
import { mutationScope, useRoomMutation } from "./mutation-state";

interface Draft {
  payerId: string;
  payeeId: string;
  amount: string;
  reason: string;
  round: string;
}

const EMPTY: Draft = { payerId: "", payeeId: "", amount: "", reason: "", round: "" };

/**
 * 거래 입력 초안. 메모리 원자라서 연결이 끊겨 영역이 가려져도 유지되고(AC-SYS-001-5) 새로고침하면 사라진다(AC-SYS-002-4).
 * 끊김 중에 작성한 입력은 복구 때 자동 제출되지 않는다(AC-SYS-002-2).
 */
export const transactionDraftsAtom = atom<Record<string, Draft>>({});

/** 초안의 키: 방과 요청자 참여자별로 분리한다(S2 §5.1). 다른 방·신원으로 바뀌어도 초안이 이어지지 않는다. */
export const draftKey = (roomId: string, memberId: string) => `${roomId}:${memberId}`;

const toErrors = (field: TxField, code: ValidationReasonCode) => [fieldReasonMessage(field, code)];


/** 지급자·수취자 칩(FD-18 (8), DV-17). 선택지는 활성 참여자이고 값은 참여자 id, 빈 값이면 아직 고르지 않았다. */
function ParticipantChips({
  label,
  value,
  onChange,
  options,
  errors,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; nickname: string }>;
  errors: string[] | undefined;
}) {
  return (
    <ChoiceChips
      legend={label}
      options={options.map((p) => ({ value: p.id, label: p.nickname }))}
      value={value}
      onChange={onChange}
      errors={errors}
    />
  );
}

/**
 * 거래 입력 폼(FE-S2-2, S2 §3.2·§3.3·§9). 지급자·수취자는 **활성 참여자만** 고를 수 있다(비활성 제외).
 * 클라이언트 검증은 편의이며(서버가 최종) 오류가 있으면 보내지 않고 입력을 유지한다. 저장 중에는 저장 컨트롤을 비활성화한다.
 * 게임이 종료되면 폼을 숨긴다. 일괄 입력 UI는 없다.
 */
export function TransactionForm() {
  const snapshot = useAtomValue(snapshotAtom);
  const canMutate = useCanMutate();
  const readOnly = useAtomValue(readOnlySelfAtom);
  const announce = useAnnounce();
  const [drafts, setDrafts] = useAtom(transactionDraftsAtom);
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  // 저장한 뒤 이 페이지에 머문다(페이지 분리). 눈에 보이는 안내이며 다음 입력을 시작하면 사라진다.
  const [savedNotice, setSavedNotice] = useState(false);
  const roomId = snapshot?.room.id ?? "";
  const key = draftKey(roomId, snapshot?.me.id ?? "");
  const draft = drafts[key] ?? EMPTY;
  const setDraft = (update: Draft | ((prev: Draft) => Draft)) =>
    setDrafts((all) => {
      const prev = all[key] ?? EMPTY;
      return { ...all, [key]: typeof update === "function" ? update(prev) : update };
    });
  // 작업 범위는 요청자 참여자별로 분리한다(S2 §5.1).
  const scope = mutationScope("create", roomId, snapshot?.me.id ?? "");
  const mutation = useRoomMutation(scope);
  const serverErrors: FieldErrors = mutation.state?.kind === "rejected" ? mutation.state.fieldErrors : {};
  const dismissedServer = useDismissedServerErrors(scope, mutation.state, serverErrors);

  // 종료 후에는 폼을 숨긴다(초안은 메모리에 남는다). 조회 전용 본인은 폼을 남기되 비활성화한다(FD-26).
  if (!snapshot || (!canMutate && !readOnly)) return null;
  const active = snapshot.participants.filter((p) => p.status === "ACTIVE");
  // 복구 뒤 더 이상 활성이 아닌 참여자 선택은 비운다(비활성화된 참여자를 몰래 보내지 않는다).
  const payerId = active.some((p) => p.id === draft.payerId) ? draft.payerId : "";
  const payeeId = active.some((p) => p.id === draft.payeeId) ? draft.payeeId : "";
  const pending = mutation.state?.kind === "pending";
  // 필드별로 합친다: 로컬 검증 오류가 있는 필드는 그것을, 나머지는 고치지 않은 필드의 서버 오류를 그대로 보인다.
  const errors: FieldErrors = { ...dismissedServer.filter(serverErrors), ...(clientErrors ?? {}) };

  const set = (patch: Partial<Draft>) => {
    setSavedNotice(false);
    setDraft((prev) => ({ ...prev, ...patch }));
    // 고친 필드의 서버 거부 오류도 숨긴다(고치지 않은 필드의 오류는 남는다). 지급자를 고치면 "같은 사람" 오류도 함께 걷는다.
    const fixed = Object.keys(patch) as TxField[];
    if ("payerId" in patch && serverErrors.payeeId?.includes(fieldReasonMessage("payeeId", "SAME_AS_PAYER"))) fixed.push("payeeId");
    dismissedServer.dismiss(fixed);
    // 고친 필드의 이전 검증 오류는 지운다(다음 제출 때 다시 검증한다).
    setClientErrors((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      for (const field of Object.keys(patch) as TxField[]) delete next[field];
      // 지급자를 고치면 수취자 쪽의 "같은 사람" 오류는 더 이상 맞지 않을 수 있으니 함께 지운다(다른 오류는 남긴다).
      if ("payerId" in patch && next.payeeId?.includes(fieldReasonMessage("payeeId", "SAME_AS_PAYER"))) delete next.payeeId;
      return Object.keys(next).length > 0 ? next : null;
    });
  };

  /** 현재 입력이 유효하면 보낼 본문을, 아니면 필드별 오류를 돌려준다. */
  function build(): { body: Record<string, unknown> } | { errors: FieldErrors } {
    const found: FieldErrors = {};
    if (!payerId) found.payerId = toErrors("payerId", "REQUIRED");
    if (!payeeId) found.payeeId = toErrors("payeeId", "REQUIRED");
    if (payerId && payeeId && payerId === payeeId) found.payeeId = toErrors("payeeId", "SAME_AS_PAYER");
    const amount = validateAmount(draft.amount);
    if (!amount.ok) found.amount = toErrors("amount", amount.reason);
    const reason = validateReason(draft.reason);
    if (reason.reasons.length > 0) found.reason = reason.reasons.map((c) => fieldReasonMessage("reason", c));
    const round = validateRound(draft.round);
    if (round.reasons.length > 0) found.round = round.reasons.map((c) => fieldReasonMessage("round", c));
    if (Object.keys(found).length > 0 || !amount.ok) return { errors: found };
    return {
      body: {
        payerId,
        payeeId,
        amount: amount.value,
        // 입력 없음은 보내지 않는다(서버는 없음·null·""을 같은 입력 없음으로 본다).
        ...(reason.value !== null ? { reason: reason.value } : {}),
        ...(round.value !== null ? { round: round.value } : {}),
      },
    };
  }

  async function submit(options?: { confirmNewAttempt?: boolean }) {
    if (pending || readOnly) return;
    const built = build();
    if ("errors" in built) {
      setClientErrors(built.errors); // 오류가 있으면 보내지 않고 입력을 유지한다
      return;
    }
    setClientErrors(null);
    const submitted = { ...draft, payerId, payeeId }; // 이 요청이 보낸 입력
    const result = await mutation.run(
      { method: "POST", path: `/rooms/${encodeURIComponent(roomId)}/transactions`, body: built.body },
      options,
    );
    if (result?.kind === "success") {
      // 서버가 확정 성공으로 응답한 뒤에만 비운다. 응답을 기다리는 사이 입력을 바꿨다면 새 입력은 보존한다.
      setDraft((prev) =>
        prev.payerId === submitted.payerId &&
        prev.payeeId === submitted.payeeId &&
        prev.amount === submitted.amount &&
        prev.reason === submitted.reason &&
        prev.round === submitted.round
          ? EMPTY
          : prev,
      );
      mutation.clear();
      setSavedNotice(true);
      announce("거래를 저장했습니다.");
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  return (
    <form onSubmit={onSubmit} noValidate className={css({ display: "flex", flexDirection: "column", gap: "3" })}>
      {readOnly ? <Banner tone="info">{READ_ONLY_SELF_NOTICE}</Banner> : null}
      {/* 조회 전용이면 입력 칸·저장을 비활성화하되 입력값은 남긴다(재활성화되면 그 값으로 저장할 수 있다, S2 §9). */}
      <fieldset disabled={readOnly} className={css({ display: "contents" })}>
      {savedNotice ? (
        // 스크린리더에는 알림 영역(`announce`)이 같은 문장을 이미 읽으므로 중복해서 읽지 않게 숨긴다.
        <p
          aria-hidden="true"
          data-testid="saved-notice"
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "2.5",
            px: "4",
            py: "3",
            borderRadius: "tile",
            bgColor: "successBg",
            color: "successText",
            fontSize: "sm",
            fontWeight: "semibold",
          })}
        >
          <CheckIcon size={20} />
          거래를 저장했습니다.
        </p>
      ) : null}
      <ParticipantChips
        label="지급자"
        value={payerId}
        onChange={(value) => set({ payerId: value })}
        options={active}
        errors={errors.payerId}
      />
      {/* 지급자 → 수취자 방향을 보이는 장식 구분선. 방향은 두 라벨이 전한다. */}
      <div
        aria-hidden="true"
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "2",
          color: "inkMuted",
          fontSize: "sm",
          _before: { content: '""', flex: "1", h: "1px", bgColor: "divider" },
          _after: { content: '""', flex: "1", h: "1px", bgColor: "divider" },
        })}
      >
        →
      </div>
      <ParticipantChips
        label="수취자"
        value={payeeId}
        onChange={(value) => set({ payeeId: value })}
        options={active}
        errors={errors.payeeId}
      />
      <TextField
        label="금액"
        suffix={snapshot.room.unit}
        className={amountInputClass}
        inputMode="numeric"
        autoComplete="off"
        value={draft.amount}
        onChange={(e) => set({ amount: e.target.value })}
        errors={errors.amount}
      />
      <TextField
        label="사유 (선택)"
        autoComplete="off"
        value={draft.reason}
        onChange={(e) => set({ reason: e.target.value })}
        errors={errors.reason}
      />
      <TextField
        label="라운드 (선택)"
        autoComplete="off"
        value={draft.round}
        onChange={(e) => set({ round: e.target.value })}
        errors={errors.round}
      />

      <MutationNotice
        state={mutation.state}
        onRetry={() => void submit()}
        onConfirmNew={() => void submit({ confirmNewAttempt: true })}
        disabled={pending}
      />
      <Button type="submit" variant="primary" size="large" disabled={pending}>
        {pending ? "저장 중…" : "저장"}
      </Button>
      </fieldset>
    </form>
  );
}
