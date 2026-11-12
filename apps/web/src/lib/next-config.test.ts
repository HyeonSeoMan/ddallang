import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("next.config 환경 변수 검증", () => {
  it.each(["phase-development-server", "phase-production-build", "phase-production-server"])(
    "%s에서 NEXT_PUBLIC_API_BASE_URL이 없으면 실패한다",
    (phase) => {
      vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
      expect(() => nextConfig(phase)).toThrow("NEXT_PUBLIC_API_BASE_URL");
    },
  );

  it("값이 있으면 통과한다", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3001");
    expect(nextConfig("phase-production-build")).toMatchObject({ reactStrictMode: true });
  });

  it("기동·빌드가 아닌 단계(typegen 등)는 막지 않는다", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    expect(() => nextConfig("phase-export")).not.toThrow();
  });
});
