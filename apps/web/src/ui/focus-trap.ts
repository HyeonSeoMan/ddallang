import type { KeyboardEvent } from "react";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** 대화상자 안에서 `Tab`·`Shift+Tab`이 처음과 끝을 돌게 한다. 밖에 있던 포커스도 안으로 가져온다. */
export function trapTab(event: KeyboardEvent<HTMLElement>, container: HTMLElement | null): void {
  if (event.key !== "Tab") return;
  const focusable = Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !container?.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !container?.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}
