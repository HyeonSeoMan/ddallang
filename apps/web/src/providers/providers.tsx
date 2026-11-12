"use client";

import { Provider as JotaiProvider } from "jotai";
import type { ReactNode } from "react";
import { AnnouncerProvider } from "@/ui/announcer";
import { QueryProvider } from "./query-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <JotaiProvider>
      <QueryProvider>
        <AnnouncerProvider>{children}</AnnouncerProvider>
      </QueryProvider>
    </JotaiProvider>
  );
}
