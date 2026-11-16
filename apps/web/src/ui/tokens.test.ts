import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/test/contrast";
import { avatarColors, colors, nonTextPairs, shadows, textPairs, TOUCH_TARGET_PX } from "./tokens";

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

  // FE-V1 완료 기준 (a): 지운 토큰이 남지 않고 새 토큰이 있다(Panda는 모르는 토큰을 타입 오류로 막지 않는다).
  it("지운 색·그림자 토큰은 없고 새 토큰은 있다(FD-18 1.3.0)", () => {
    const colorKeys = Object.keys(colors);
    for (const removed of ["accent", "accentText", "accentSoft", "secondary", "secondaryText"]) {
      expect(colorKeys).not.toContain(removed);
    }
    for (const added of ["primaryPressed", "brandText", "brandBright", "primarySoft", "coin", "disabledBg", "disabledText"]) {
      expect(colorKeys).toContain(added);
    }
    const shadowKeys = Object.keys(shadows);
    for (const removed of ["card", "button", "buttonAccent", "buttonPressed", "chip"]) {
      expect(shadowKeys).not.toContain(removed);
    }
    expect(shadowKeys).toContain("float");
  });

  it("손실은 검정 글자(`ink`)이고 톤 대응은 확정본 값과 같다", () => {
    expect(colors.loss).toBe(colors.ink);
    expect(colors.successBg).toBe(colors.primarySoft);
    expect(colors.successText).toBe(colors.brandText);
    expect(colors.neutralBg).toBe(colors.paperSubtle);
    expect(colors.neutralText).toBe(colors.inkMuted);
    expect(colors.focus).toBe(colors.primary);
  });

  it("아바타 6색은 모두 `ink` 글자와 4.5:1 이상이다", () => {
    expect(avatarColors).toHaveLength(6);
    for (const bg of avatarColors) expect(contrastRatio(colors.ink, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("최소 터치 목표는 44px이다", () => {
    expect(TOUCH_TARGET_PX).toBe(44);
  });
});
