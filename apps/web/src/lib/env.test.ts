import { describe, expect, it } from "vitest";
import { parseApiBaseUrl } from "./env";

describe("parseApiBaseUrl", () => {
  it("누락·빈 값이면 실패한다", () => {
    expect(() => parseApiBaseUrl(undefined)).toThrow("NEXT_PUBLIC_API_BASE_URL");
    expect(() => parseApiBaseUrl("  ")).toThrow("NEXT_PUBLIC_API_BASE_URL");
  });

  it("URL이 아니거나 http(s)가 아니면 실패한다", () => {
    expect(() => parseApiBaseUrl("localhost:3001")).toThrow();
    expect(() => parseApiBaseUrl("ftp://example.com")).toThrow("http");
  });

  it("끝의 슬래시를 제거해 돌려준다", () => {
    expect(parseApiBaseUrl("http://localhost:3001/")).toBe("http://localhost:3001");
    expect(parseApiBaseUrl("https://api.example.com")).toBe("https://api.example.com");
  });
});
