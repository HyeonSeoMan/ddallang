import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { countAtom } from "@/state/counter";
import { Counter } from "./counter";

describe("Counter", () => {
  it("클릭하면 Jotai 상태가 증가하고 화면에 반영된다", async () => {
    const store = createStore();
    render(
      <Provider store={store}>
        <Counter />
      </Provider>,
    );

    const button = screen.getByRole("button", { name: "딸랑 0" });
    await userEvent.click(button);

    expect(screen.getByRole("button", { name: "딸랑 1" })).toBeInTheDocument();
    expect(store.get(countAtom)).toBe(1);
  });
});
