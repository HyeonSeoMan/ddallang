import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// 화면 반영 지연 측정(FE-S5-6): 실서버가 필요하며 기본 `pnpm test`에는 포함되지 않는다(`pnpm test:latency`).
// 서버 주소는 `LATENCY_API_BASE_URL`로 넘긴다(앱의 `NEXT_PUBLIC_API_BASE_URL`로 쓴다).
const base = process.env.LATENCY_API_BASE_URL ?? "";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fromRoot("./src"), "styled-system": fromRoot("./styled-system") },
  },
  test: {
    environment: "jsdom",
    include: ["src/latency/latency.test.tsx"],
    css: false,
    globals: false,
    testTimeout: 1_800_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    env: { NEXT_PUBLIC_API_BASE_URL: base },
  },
});
