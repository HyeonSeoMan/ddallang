import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateRoomText } from "./room-text";

const reasons = (input: string) => validateRoomText(input).reasons;

describe("validateRoomText (S1 §3.2)", () => {
  it("빈 문자열은 REQUIRED", () => {
    expect(validateRoomText("")).toEqual({ value: "", reasons: ["REQUIRED"] });
  });

  it("허용 예시: 영문·숫자·한글·단독 자모·가운데 공백 한 칸", () => {
    for (const ok of ["Friday 7", "Chip 10", "포인트", "점수", "원", "ㅎㅏㄴ", "a", "가나다라마바사아자차카타"]) {
      expect(reasons(ok), ok).toEqual([]);
    }
  });

  it("길이: 1·12 허용, 13 거부(코드 포인트 기준)", () => {
    expect(reasons("a".repeat(12))).toEqual([]);
    expect(reasons("a".repeat(13))).toEqual(["LENGTH_OUT_OF_RANGE"]);
    expect(reasons("가".repeat(13))).toEqual(["LENGTH_OUT_OF_RANGE"]);
  });

  it("분해형 한글 12자(36 코드 포인트)는 NFC로 합쳐 허용하고, 합친 값을 돌려준다", () => {
    const composed = "한글이름열두글자입니다요".slice(0, 12);
    const decomposed = composed.normalize("NFD");
    expect([...decomposed].length).toBeGreaterThan(12);
    expect(validateRoomText(decomposed)).toEqual({ value: composed, reasons: [] });
    expect(validateRoomText(decomposed).value).toBe(validateRoomText(composed).value);
  });

  it("원본이 64 코드 포인트를 넘으면 정규화하지 않고 길이 위반만 낸다", () => {
    const long = "ㅎ".repeat(65);
    expect(validateRoomText(long)).toEqual({ value: long, reasons: ["LENGTH_OUT_OF_RANGE"] });
    expect(reasons("ㅎ".repeat(64))).toEqual(["LENGTH_OUT_OF_RANGE"]); // 64는 정규화 후 12 초과
  });

  it("허용 범위 밖 문자를 거부한다", () => {
    const bad: Array<[string, string]> = [
      ["특수문자", "Friday!"],
      ["이모지", "친구😀"],
      ["전각 문자", "Ａ"],
      ["영문 외 라틴(é)", "café"],
      ["NFC로 é가 되는 결합 문자", "café"],
      ["한글 채움 문자 U+3164", "가ㅤ"],
      ["조합용 자모 U+1100", "ᄀ"],
      ["고어 자모 U+3165", "ㅥ"],
      ["제어 문자(탭)", "a\tb"],
      ["줄바꿈", "a\nb"],
      ["전각 공백", "a　b"],
    ];
    for (const [name, input] of bad) expect(reasons(input), name).toContain("INVALID_CHARACTER");
  });

  it("공백 규칙: 앞뒤 공백과 연속 공백은 자동 제거 없이 거부", () => {
    expect(reasons(" Friday")).toEqual(["LEADING_OR_TRAILING_SPACE"]);
    expect(reasons("Friday ")).toEqual(["LEADING_OR_TRAILING_SPACE"]);
    expect(reasons("Friday  7")).toEqual(["CONSECUTIVE_SPACES"]);
    expect(validateRoomText(" Friday").value).toBe(" Friday"); // 제거하지 않는다
  });

  it("독립 위반은 한 번에 모아서 반환한다", () => {
    expect(reasons("  가나다라마바사아자차카타!")).toEqual([
      "LENGTH_OUT_OF_RANGE",
      "INVALID_CHARACTER",
      "LEADING_OR_TRAILING_SPACE",
      "CONSECUTIVE_SPACES",
    ]);
  });

  it("[속성] 허용 문자만으로 앞뒤·연속 공백 없이 1~12자이면 항상 유효하다", () => {
    const allowed = fc.constantFrom(..."abcXYZ019가나다힣ㄱㅏ".split(""));
    const word = fc.array(allowed, { minLength: 1, maxLength: 4 }).map((a) => a.join(""));
    fc.assert(
      fc.property(fc.array(word, { minLength: 1, maxLength: 3 }), (words) => {
        const text = words.join(" ");
        fc.pre([...text].length <= 12);
        expect(validateRoomText(text).reasons).toEqual([]);
      }),
    );
  });

  it("[속성] 허용 문자 밖의 문자가 하나라도 섞이면 INVALID_CHARACTER가 포함된다", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 5, unit: fc.constantFrom(..."abc가".split("")) }),
        fc.constantFrom("!", "😀", "é", "\t", "Ａ", "ㅤ", "-", "_", "."),
        (prefix, bad) => {
          expect(reasons(prefix + bad)).toContain("INVALID_CHARACTER");
        },
      ),
    );
  });
});
