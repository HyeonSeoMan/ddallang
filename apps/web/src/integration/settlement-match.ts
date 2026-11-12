// 예상 정산 구역이 서버 정산 항목과 "정확히" 같은지 비교한다(FE-I1·AC 보강).
// 방향(지급자 → 수취자)·금액·항목 수·서버 순서를 모두 엄격히 본다. 부분 문자열 포함으로 비교하면
// `300 원`이 `1,300 원`에, 지급자와 수취자를 뒤집은 항목도 통과하는 허점이 있다.
export interface ServerItem {
  payerNickname: string;
  payeeNickname: string;
  amount: number;
}

const compact = (text: string) => text.replace(/\s+/g, "");

export function expectedRows(items: ServerItem[], unit = "원"): string[] {
  return items.map((i) => compact(`${i.payerNickname}→${i.payeeNickname}${i.amount.toLocaleString("en-US")}${unit}`));
}

export function actualRows(area: Element): string[] {
  return Array.from(area.querySelectorAll("li")).map((li) => compact(li.textContent ?? ""));
}

/** 항목이 없으면 빈 문구, 있으면 행이 서버 순서·내용과 정확히 같아야 한다. */
export function settlementMatches(area: Element | null, items: ServerItem[], unit = "원"): boolean {
  if (!area) return false;
  if (items.length === 0) {
    // 빈 문구가 있어도 항목 행이 하나라도 남아 있으면 불일치다.
    return area.querySelectorAll("li").length === 0 && compact(area.textContent ?? "").includes(compact("정산할 내역이 없습니다."));
  }
  const actual = actualRows(area);
  const expected = expectedRows(items, unit);
  return actual.length === expected.length && actual.every((row, i) => row === expected[i]);
}
