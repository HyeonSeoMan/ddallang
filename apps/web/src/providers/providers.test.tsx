import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { atom, useAtomValue } from "jotai";
import { describe, expect, it } from "vitest";
import { Providers } from "./providers";

const probeAtom = atom("jotai-ok");

function Probe() {
  const value = useAtomValue(probeAtom);
  return <span>{useQueryClient() ? `connected ${value}` : "missing"}</span>;
}

describe("Providers", () => {
  it("Jotai와 QueryClient를 함께 제공한다", () => {
    render(
      <Providers>
        <Probe />
      </Providers>,
    );

    expect(screen.getByText("connected jotai-ok")).toBeInTheDocument();
  });
});
