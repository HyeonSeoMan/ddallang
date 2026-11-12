import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/test/contrast";
import { colors, nonTextPairs, textPairs, TOUCH_TARGET_PX } from "./tokens";

describe("디자인 토큰", () => {
  it.each(textPairs)("글자 쌍 %s / %s은 대비 4.5:1 이상이다", (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(nonTextPairs)("경계·초점 쌍 %s / %s은 대비 3:1 이상이다", (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(3);
  });

  it("대비 4.5:1 미만인 쌍은 실패로 판정한다(검사기 자체 시험)", () => {
    expect(contrastRatio("#777777", "#888888")).toBeLessThan(4.5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("최소 터치 목표는 44px이다", () => {
    expect(TOUCH_TARGET_PX).toBe(44);
  });
});
