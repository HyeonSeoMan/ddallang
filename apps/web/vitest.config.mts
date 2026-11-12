import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      "styled-system": fromRoot("./styled-system"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
    css: false,
    // 실서버 지연 측정은 별도 설정(`pnpm test:latency`)으로만 돌린다.
    exclude: [...configDefaults.exclude, "src/latency/latency.test.tsx"],
    env: { NEXT_PUBLIC_API_BASE_URL: "http://api.test" },
  },
});
