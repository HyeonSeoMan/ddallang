import { describe, expect, it } from "vitest";
import { judge, percentile, summarize } from "./stats";

describe("지연 통계 (FE-S5-6)", () => {
  it("95백분위는 최근접 순위법이다", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile([5, 1, 3], 95)).toBe(5);
    expect(percentile([7], 95)).toBe(7);
  });

  it("표본이 없으면 예외다", () => {
    expect(() => percentile([], 95)).toThrow();
  });

  it("목표 초과는 불합격이고 경계값은 합격이다", () => {
    const limits = { p95Ms: 3000, maxMs: 5000 };
    const boundary = [...Array.from({ length: 19 }, () => 3000), 5000]; // 20건: p95는 19번째(3000), max는 5000
    expect(judge("x", summarize(boundary), limits)).toEqual([]);
    expect(judge("x", summarize([3001, 100]), limits)).toHaveLength(1);
    expect(judge("x", summarize([100, 5001]), limits)).toHaveLength(2); // p95와 max 모두 초과
  });
});
