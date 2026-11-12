"use client";

import { type KeyboardEvent, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { css } from "styled-system/css";
import { Button } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** 요청 진행 중이면 두 버튼이 비활성화되고 `Esc`도 무시한다. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 접근성 확인 대화상자(FD-11). `role="dialog"`, `aria-modal`, 포커스 가둠, 닫을 때 포커스 복귀,
 * `Esc`는 취소, 기본 포커스는 `취소`다. 파괴적 동작이므로 바깥 클릭으로는 닫히지도 확정되지도 않는다.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "취소",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // 문서 수준 Esc 리스너가 항상 최신 값을 보도록 ref로 들고 있다.
  const latest = useRef({ busy, onCancel });
  useEffect(() => {
    latest.current = { busy, onCancel };
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    // 마우스로 대화상자 밖을 눌러 포커스가 빠져나가면 되돌린다.
    const keepFocusInside = (event: FocusEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        cancelRef.current?.focus();
      }
    };
    // 포커스가 어디 있든 Esc는 취소다(진행 중이면 무시).
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (!latest.current.busy) latest.current.onCancel();
    };
    document.addEventListener("focusin", keepFocusInside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("focusin", keepFocusInside);
      document.removeEventListener("keydown", onEscape);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  // 진행 중에는 버튼이 비활성화되어 포커스가 body로 빠지므로 대화상자에 두고, 끝나면 취소로 되돌린다.
  useEffect(() => {
    if (!open) return;
    if (busy) dialogRef.current?.focus();
    else if (!dialogRef.current?.contains(document.activeElement)) cancelRef.current?.focus();
    else if (document.activeElement === dialogRef.current) cancelRef.current?.focus();
  }, [open, busy]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className={css({
        position: "fixed",
        inset: "0",
        bg: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: "4",
      })}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={css({ bg: "paper", color: "ink", borderRadius: "lg", p: "6", maxW: "md", w: "full", boxShadow: "float" })}
      >
        <h2 id={titleId} className={css({ fontSize: "xl", fontWeight: "bold", mb: "2" })}>
          {title}
        </h2>
        <p id={descriptionId} className={css({ mb: "4" })}>
          {description}
        </p>
        <div className={css({ display: "flex", gap: "2", justifyContent: "flex-end" })}>
          <Button ref={cancelRef} variant="secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
