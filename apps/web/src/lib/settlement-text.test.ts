import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { SettlementItem } from "@/lib/api";
import { formatAmount } from "./format";
import { buildSettlementText } from "./settlement-text";

const item = (payer: string, payee: string, amount: number): SettlementItem => ({
  payerId: `id-${payer}`,
  payerNickname: payer,
  payeeId: `id-${payee}`,
  payeeNickname: payee,
  amount,
});

describe("정산 복사 텍스트 (S4 §6.5)", () => {
  it("[AC-SET-005-3] Spec 예시와 정확히 일치한다: 방 이름, `게임 종료`, 빈 줄, `지급자 → 수취자 금액 단위`", () => {
    const text = buildSettlementText("주말 고스톱", [item("A", "C", 250), item("B", "D", 100)], "원");
    expect(text).toBe("주말 고스톱\n게임 종료\n\nA → C 250 원\nB → D 100 원");
    expect(text.endsWith("\n")).toBe(false); // 마지막 줄 뒤에 줄바꿈 없음
    expect(text).not.toContain("\r");
  });

  it("[AC-SET-004-3] 항목은 서버 순서 그대로이고 재정렬하지 않는다", () => {
    const text = buildSettlementText("방", [item("다", "가", 5), item("가", "나", 900), item("나", "다", 1)], "점수");
    expect(text.split("\n").slice(3)).toEqual(["다 → 가 5 점수", "가 → 나 900 점수", "나 → 다 1 점수"]);
  });

  it("[AC-SET-005-4] 사유·라운드·작성자·확정 상태·버전·kind 표기는 포함하지 않는다", () => {
    const text = buildSettlementText("방", [item("A", "B", 100)], "원");
    expect(text).not.toMatch(/사유|라운드|작성|확정|버전|FINAL|EXPECTED|예상|최종/);
    expect(text.split("\n")).toHaveLength(4);
  });

  it("[NFR-009] 약 10^12 금액을 ASCII 쉼표 서식으로 정확히 쓴다", () => {
    expect(buildSettlementText("방", [item("A", "B", 999_999_999_000)], "칩")).toBe(
      "방\n게임 종료\n\nA → B 999,999,999,000 칩",
    );
    expect(buildSettlementText("방", [item("A", "B", 1_250_000)], "원")).toContain("1,250,000 원");
  });

  it("항목이 없으면 머리 세 줄만 남는다(복사 버튼이 비활성이라 쓰이지 않는 경우의 방어)", () => {
    expect(buildSettlementText("방", [], "원")).toBe("방\n게임 종료\n");
  });

  it("[속성] 화면 서식과 같은 함수를 쓴다: 금액 부분은 formatAmount와 일치한다", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2_000_000_000_000 }), (amount) => {
        const line = buildSettlementText("방", [item("가", "나", amount)], "원").split("\n")[3];
        expect(line).toBe(`가 → 나 ${formatAmount(amount)} 원`);
        expect(line).not.toMatch(/[^\d,가-힣→ 원]/); // 로캘 의존 문자(예: 전각·아랍 숫자)가 없다
      }),
    );
  });
});
