"use client";

import { Provider as JotaiProvider } from "jotai";
import type { ReactNode } from "react";
import { QueryProvider } from "./query-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <JotaiProvider>
      <QueryProvider>{children}</QueryProvider>
    </JotaiProvider>
  );
}
