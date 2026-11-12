import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// 실서버 연동 점검(FE-I1): 실서버가 필요하며 기본 `pnpm test`에는 포함되지 않는다(`pnpm test:integration`).
// 서버 주소는 `INTEGRATION_API_BASE_URL`(없으면 `LATENCY_API_BASE_URL`)로 넘긴다.
const base = process.env.INTEGRATION_API_BASE_URL ?? process.env.LATENCY_API_BASE_URL ?? "";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fromRoot("./src"), "styled-system": fromRoot("./styled-system") },
  },
  test: {
    environment: "jsdom",
    include: ["src/integration/integration.test.tsx"],
    css: false,
    globals: false,
    testTimeout: 300_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    env: { NEXT_PUBLIC_API_BASE_URL: base, LATENCY_API_BASE_URL: base },
  },
});
