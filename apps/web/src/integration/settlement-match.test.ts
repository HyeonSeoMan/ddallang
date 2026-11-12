import { describe, expect, it } from "vitest";
import { type ServerItem, settlementMatches } from "./settlement-match";

function area(rows: string[], text = ""): HTMLElement {
  const el = document.createElement("section");
  el.innerHTML = `<h2>예상 정산</h2>${text}<ul>${rows.map((r) => `<li>${r}</li>`).join("")}</ul>`;
  return el;
}
const item = (payer: string, payee: string, amount: number): ServerItem => ({ payerNickname: payer, payeeNickname: payee, amount });

describe("정산 비교 도우미 (FE-I1·AC 보강)", () => {
  it("방향·금액·순서가 같을 때만 일치한다", () => {
    const items = [item("참0", "참1", 300)];
    expect(settlementMatches(area(["<span>참0</span> → <span>참1</span><span>300 원</span>"]), items)).toBe(true);
    expect(settlementMatches(area(["참1 → 참0300 원"]), items)).toBe(false); // 방향이 뒤집힘
    expect(settlementMatches(area(["참0 → 참11,300 원"]), items)).toBe(false); // 금액 `1,300`은 `300`이 아니다
    expect(settlementMatches(area(["참0 → 참1300 원", "참2 → 참0100 원"]), items)).toBe(false); // 항목이 더 많음
    expect(settlementMatches(area([]), items)).toBe(false);
  });

  it("서버 순서를 지키고 항목이 없으면 빈 문구를 요구한다", () => {
    const items = [item("참0", "참1", 300), item("참2", "참0", 100)];
    expect(settlementMatches(area(["참0 → 참1300 원", "참2 → 참0100 원"]), items)).toBe(true);
    expect(settlementMatches(area(["참2 → 참0100 원", "참0 → 참1300 원"]), items)).toBe(false);
    expect(settlementMatches(area([], "<p>정산할 내역이 없습니다.</p>"), [])).toBe(true);
    expect(settlementMatches(area(["참0 → 참1300 원"]), [])).toBe(false);
    expect(settlementMatches(null, [])).toBe(false);
  });
});
