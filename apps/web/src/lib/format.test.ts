import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatAmount, formatMoney, formatSigned, formatSignedMoney } from "./format";

// BigInt 기준 구현(독립 구현과 비교한다).
function reference(value: number): string {
  let digits = BigInt(Math.abs(value)).toString();
  let out = "";
  while (digits.length > 3) {
    out = "," + digits.slice(-3) + out;
    digits = digits.slice(0, -3);
  }
  return (value < 0 ? "−" : "") + digits + out;
}

describe("포맷 모듈", () => {
  it("[속성] 안전 정수 전 범위에서 BigInt 기준 구현과 일치한다", () => {
    fc.assert(
      fc.property(fc.integer({ min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }), (n) => {
        expect(formatAmount(n)).toBe(reference(n));
      }),
      { numRuns: 500 },
    );
    fc.assert(
      fc.property(fc.integer({ min: -2_000_000_000_000, max: 2_000_000_000_000 }), (n) => {
        expect(formatAmount(n)).toBe(reference(n));
      }),
    );
  });

  it("쉼표는 ASCII이고 약 10^12까지 정확하다", () => {
    expect(formatAmount(1_000_000_000_000)).toBe("1,000,000,000,000");
    expect(formatAmount(999_999_999)).toBe("999,999,999");
    expect(formatAmount(1250000)).toBe("1,250,000");
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(1_234)).not.toMatch(/[^\d,]/);
  });

  it("부호: 양수 +, 음수 −(U+2212), 0은 부호 없음", () => {
    expect(formatSigned(1250)).toBe("+1,250");
    expect(formatSigned(-1250)).toBe("−1,250");
    expect(formatSigned(-1250)).not.toContain("-");
    expect(formatSigned(0)).toBe("0");
    expect(formatSigned(-0)).toBe("0");
  });

  it("금액 뒤에 공백 한 칸과 방의 단위를 붙인다(환산 없음)", () => {
    expect(formatMoney(1250, "점수")).toBe("1,250 점수");
    expect(formatSignedMoney(-300, "칩")).toBe("−300 칩");
    expect(formatSignedMoney(0, "원")).toBe("0 원");
  });

  it("안전 정수가 아니면 예외를 던진다(표시하지 않는다)", () => {
    for (const bad of [Number.MAX_SAFE_INTEGER + 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => formatAmount(bad)).toThrow(RangeError);
      expect(() => formatSigned(bad)).toThrow(RangeError);
      expect(() => formatMoney(bad, "원")).toThrow(RangeError);
    }
  });
});
