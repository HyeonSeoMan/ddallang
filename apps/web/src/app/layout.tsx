import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { ApiWakeUp } from "@/providers/api-wake-up";
import { Providers } from "@/providers/providers";
import { FeatureGate } from "@/ui/feature-gate";
import "@/styles/global.css";

/**
 * 파비콘(FD-18 (6), DV-15 A안): `docs/design/favicon-v2/`의 SVG를 헤드리스 Chrome으로 한 번 래스터화한 PNG다(`public/`).
 * 16·32는 크기별 전용 그림이고 둥근 사각 밖은 투명이다. 180(iOS 홈 화면)은 iOS가 투명 픽셀을 검정으로 채우므로 초록을
 * 끝까지 채운 불투명 정사각형이다. SVG 아이콘은 쓰지 않는다(브라우저가 SVG를 먼저 골라 16·32 전용 그림이 쓰이지 않는다).
 */
export const metadata: Metadata = {
  title: "DDALLANG",
  description: "딸랑 (DDALLANG)",
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-64.png", sizes: "64x64", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
