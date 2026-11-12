import { act, renderHook } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { dismissedAtom, useDismissedServerErrors } from "./dismissed-errors";
import type { FieldErrors } from "./messages";

const errors: FieldErrors = { amount: ["금액 오류"], reason: ["사유 오류"] };

function setup(initial: { state: unknown; errors: FieldErrors }) {
  const store = createStore();
  const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
  const hook = renderHook((props: { state: unknown; errors: FieldErrors }) => useDismissedServerErrors("scope", props.state, props.errors), {
    wrapper,
    initialProps: initial,
  });
  return { store, hook };
}

describe("고친 필드의 서버 오류 숨김 기록 (S2 검수 공백)", () => {
  it("고친 필드만 숨기고 고치지 않은 필드는 남긴다", () => {
    const state = {};
    const { hook } = setup({ state, errors });
    act(() => hook.result.current.dismiss(["amount"]));
    expect(hook.result.current.filter(errors)).toEqual({ reason: ["사유 오류"] });
  });

  it("같은 필드를 여러 번 고쳐도 기록은 중복 없이 필드 집합으로 유지된다", () => {
    const state = {};
    const { store, hook } = setup({ state, errors });
    for (let i = 0; i < 20; i += 1) act(() => hook.result.current.dismiss(["amount"]));
    act(() => hook.result.current.dismiss(["amount", "reason"]));
    expect(store.get(dismissedAtom).scope?.fields).toEqual(["amount", "reason"]);
  });

  it("서버 오류가 없는 필드의 입력은 기록하지 않는다", () => {
    const state = {};
    const { store, hook } = setup({ state, errors: {} });
    act(() => hook.result.current.dismiss(["amount", "reason", "round"]));
    expect(store.get(dismissedAtom)).toEqual({});
    const other = setup({ state, errors });
    act(() => other.hook.result.current.dismiss(["round"])); // 서버 오류가 없는 필드
    expect(other.store.get(dismissedAtom)).toEqual({});
  });

  it("새 응답이 오거나 서버 오류가 없어지면(성공·취소) 이 범위의 기록을 지우고 새 응답에서는 다시 모두 보인다", () => {
    const first = {};
    const { store, hook } = setup({ state: first, errors });
    act(() => hook.result.current.dismiss(["amount"]));
    expect(store.get(dismissedAtom).scope).toBeDefined();

    hook.rerender({ state: {}, errors }); // 새 거부 응답(새 상태 객체)
    expect(hook.result.current.filter(errors)).toEqual(errors);
    expect(store.get(dismissedAtom)).toEqual({});

    act(() => hook.result.current.dismiss(["reason"]));
    expect(store.get(dismissedAtom).scope).toBeDefined();
    hook.rerender({ state: null, errors: {} }); // 성공·취소 등으로 거부 응답이 사라짐
    expect(store.get(dismissedAtom)).toEqual({});
  });
});
