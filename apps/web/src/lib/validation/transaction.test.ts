import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { AMOUNT_MAX, validateAmount, validateReason, validateRound } from "./transaction";

const reasons = (text: string) => validateReason(text).reasons;

describe("사유·라운드 검증 (S2 §3.2)", () => {
  it("[AC-TXN-001-6] 빈 문자열은 입력 없음(null)이다", () => {
    expect(validateReason("")).toEqual({ value: null, reasons: [] });
    expect(validateRound("")).toEqual({ value: null, reasons: [] });
  });

  it("[AC-TXN-001-6] 사유 50자·라운드 12자는 허용하고 51자·13자는 거부한다(코드 포인트 기준)", () => {
    expect(reasons("가".repeat(50))).toEqual([]);
    expect(reasons("가".repeat(51))).toEqual(["LENGTH_OUT_OF_RANGE"]);
    expect(validateRound("a".repeat(12)).reasons).toEqual([]);
    expect(validateRound("a".repeat(13)).reasons).toEqual(["LENGTH_OUT_OF_RANGE"]);
    expect(reasons("😀".repeat(50))).toEqual([]); // 이모지는 코드 포인트 1개
  });

  it("원본이 한도(사유 200·라운드 48 코드 포인트)를 넘으면 정규화하지 않고 길이 위반만 낸다", () => {
    const long = "ㅎ".repeat(201);
    expect(validateReason(long)).toEqual({ value: long, reasons: ["LENGTH_OUT_OF_RANGE"] });
    expect(validateRound("a".repeat(49)).reasons).toEqual(["LENGTH_OUT_OF_RANGE"]);
  });

  it("[AC-TXN-001-6] 줄바꿈·탭·제어·제로폭·방향 제어·채움 문자·전각 공백은 거부한다", () => {
    const bad: Array<[string, string]> = [
      ["줄바꿈", "a\nb"],
      ["탭", "a\tb"],
      ["제어 문자(NUL)", "a\u0000b"],
      ["제로폭 공백 U+200B", "a​b"],
      ["ZWJ U+200D", "a‍b"],
      ["방향 제어 U+202E", "a‮b"],
      ["한글 채움 U+3164", "aㅤb"],
      ["한글 채움 U+115F", "aᅟb"],
      ["전각 공백 U+3000", "a　b"],
      ["줄 구분자 U+2028", "a b"],
      ["NBSP U+00A0", "a b"],
      ["사용자 정의 U+E000", "ab"],
      ["단독 서로게이트", "a\uD800b"],
    ];
    for (const [name, text] of bad) expect(reasons(text), name).toContain("INVALID_CHARACTER");
  });

  it("[AC-TXN-001-6] 내부 공백(연속 포함)·이모지·기호·결합 문자는 허용한다", () => {
    for (const ok of ["일반 공백 하나", "연속  공백도 허용", "😀 이모지", "#1 라운드!", "é", "50% 할인", "A→B"]) {
      expect(reasons(ok), ok).toEqual([]);
    }
  });

  it("[AC-TXN-001-6] 앞뒤 공백(공백만인 값 포함)은 거부하고 자동으로 지우지 않는다", () => {
    expect(reasons(" 앞공백")).toEqual(["LEADING_OR_TRAILING_SPACE"]);
    expect(reasons("뒤공백 ")).toEqual(["LEADING_OR_TRAILING_SPACE"]);
    expect(reasons("   ")).toEqual(["LEADING_OR_TRAILING_SPACE"]);
    expect(validateReason(" 앞공백").value).toBe(" 앞공백");
  });

  it("독립 위반은 한 번에 모아서 반환한다(길이·문자·공백 순)", () => {
    expect(reasons(` ${"가".repeat(50)}\n`)).toEqual([
      "LENGTH_OUT_OF_RANGE",
      "INVALID_CHARACTER",
      "LEADING_OR_TRAILING_SPACE",
    ]);
  });

  it("분해형 한글은 NFC로 합친 값을 돌려주고 길이는 합친 뒤 센다", () => {
    const composed = "가".repeat(12);
    expect(validateRound(composed.normalize("NFD"))).toEqual({ value: composed, reasons: [] });
  });

  it("[속성] 안전한 문자(한글·영문·숫자·내부 공백)로 한도 이내이면 항상 유효하다", () => {
    const unit = fc.constantFrom(..."abcXYZ019가나다힣 ".split(""));
    fc.assert(
      fc.property(fc.array(unit, { minLength: 1, maxLength: 50 }), (chars) => {
        const text = chars.join("");
        fc.pre(!text.startsWith(" ") && !text.endsWith(" "));
        expect(validateReason(text).reasons).toEqual([]);
      }),
    );
  });
});

describe("금액 검증 (S2 §3.3)", () => {
  it("누락은 REQUIRED", () => {
    expect(validateAmount("")).toEqual({ ok: false, reason: "REQUIRED" });
  });

  it("정수 1 이상 999,999,999 이하만 유효하다(경계)", () => {
    expect(validateAmount("1")).toEqual({ ok: true, value: 1 });
    expect(validateAmount("999999999")).toEqual({ ok: true, value: AMOUNT_MAX });
    expect(validateAmount("0100")).toEqual({ ok: true, value: 100 });
    expect(validateAmount("0")).toEqual({ ok: false, reason: "OUT_OF_RANGE" });
    expect(validateAmount("1000000000")).toEqual({ ok: false, reason: "OUT_OF_RANGE" });
    expect(validateAmount("-5")).toEqual({ ok: false, reason: "OUT_OF_RANGE" });
    expect(validateAmount("9".repeat(30))).toEqual({ ok: false, reason: "OUT_OF_RANGE" });
  });

  it("소수는 INVALID_VALUE, 숫자가 아닌 값(쉼표·공백·문자·지수 표기)은 INVALID_TYPE", () => {
    expect(validateAmount("1.5")).toEqual({ ok: false, reason: "INVALID_VALUE" });
    expect(validateAmount("1.")).toEqual({ ok: false, reason: "INVALID_VALUE" });
    expect(validateAmount(".5")).toEqual({ ok: false, reason: "INVALID_VALUE" });
    for (const bad of ["abc", "1,000", " 100", "100 ", "1e3", "０１", "+5", "1-"]) {
      expect(validateAmount(bad), bad).toEqual({ ok: false, reason: "INVALID_TYPE" });
    }
  });

  it("[속성] 1~999,999,999 정수는 항상 유효하고 같은 값을 돌려준다", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: AMOUNT_MAX }), (n) => {
        expect(validateAmount(String(n))).toEqual({ ok: true, value: n });
      }),
    );
  });
});
