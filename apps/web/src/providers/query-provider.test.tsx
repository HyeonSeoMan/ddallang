import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QueryProvider } from "./query-provider";

function Probe() {
  return <span>{useQueryClient() ? "connected" : "missing"}</span>;
}

describe("QueryProvider", () => {
  it("하위 컴포넌트에 QueryClient를 제공한다", () => {
    render(
      <QueryProvider>
        <Probe />
      </QueryProvider>,
    );

    expect(screen.getByText("connected")).toBeInTheDocument();
  });
});
