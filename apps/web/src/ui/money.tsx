import { css } from "styled-system/css";
import { formatMoney, formatSignedMoney } from "@/lib/format";

const base = css({ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", fontWeight: "bold" });
const gain = css({ color: "gain" });
const loss = css({ color: "loss" });

/**
 * 금액 요소는 줄바꿈하지 않는다(FD-10, NFR-009). 안전 정수가 아니면 예외가 난다.
 * `signed`이면 이익은 초록, 손실은 빨강으로 보이되 부호(`+`·`−`)를 항상 글자로 함께 쓴다(색에만 의존하지 않음, FD-18).
 */
export function Money({ value, unit, signed = false }: { value: number; unit: string; signed?: boolean }) {
  const text = signed ? formatSignedMoney(value, unit) : formatMoney(value, unit);
  const tone = signed ? (value > 0 ? gain : value < 0 ? loss : "") : "";
  return <span className={`${base} ${tone}`.trim()}>{text}</span>;
}
