import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/providers/providers";
import "@/styles/global.css";

export const metadata: Metadata = {
  title: "DDALLANG",
  description: "딸랑 (DDALLANG)",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
