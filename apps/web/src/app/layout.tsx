import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { ApiWakeUp } from "@/providers/api-wake-up";
import { Providers } from "@/providers/providers";
import { FeatureGate } from "@/ui/feature-gate";
import "@/styles/global.css";

export const metadata: Metadata = {
  title: "DDALLANG",
  description: "딸랑 (DDALLANG)",
};

/**
 * Pretendard 가변 글꼴을 자체 호스팅한다(FD-18, SIL OFL 1.1, 라이선스는 `src/fonts`). 외부 글꼴 서버를 쓰지 않는다.
 * 파일이 커서(약 2MB) 첫 화면을 막지 않도록 `swap`으로 시스템 글꼴을 먼저 보인다(RK-F16).
 */
const pretendard = localFont({
  src: "../fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "45 920",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>
        <ApiWakeUp />
        <Providers>
          <FeatureGate>{children}</FeatureGate>
        </Providers>
      </body>
    </html>
  );
}
