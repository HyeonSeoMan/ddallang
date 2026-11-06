import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Counter } from "@/components/counter";
import { Providers } from "./providers";

function QueryProbe() {
  return <span>{useQueryClient() ? "connected" : "missing"}</span>;
}

describe("Providers", () => {
  it("Jotai와 QueryClient를 함께 제공한다", async () => {
    render(
      <Providers>
        <QueryProbe />
        <Counter />
      </Providers>,
    );

    expect(screen.getByText("connected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "딸랑 0" }));
    expect(screen.getByRole("button", { name: "딸랑 1" })).toBeInTheDocument();
  });
});
