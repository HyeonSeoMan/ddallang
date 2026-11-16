import { css } from "styled-system/css";
import { formatMoney, formatSignedMoney } from "@/lib/format";

const base = css({ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", fontWeight: "bold" });
const gain = css({ color: "gain" });
const loss = css({ color: "loss" });

export type AmountSize = "18px" | "15px" | "13px";

/**
 * 금액 폭 맞춤(FD-18 (2), RK-F14). 금액 덩어리(부호·숫자·공백·단위 포함) 글자 수 N(코드 포인트)이
 * 18 이하면 18px, 19~24면 15px, 25 이상이면 13px. 가장 긴 경우(N = 29)도 375px 화면 카드 안에 한 줄로 든다.
 */
export function amountFontSize(text: string): AmountSize {
  const length = [...text].length;
  if (length <= 18) return "18px";
  if (length <= 24) return "15px";
  return "13px";
}

const sizeClass: Record<AmountSize, string> = {
  "18px": css({ fontSize: "amountList" }),
  "15px": css({ fontSize: "15px" }),
  "13px": css({ fontSize: "13px" }),
};

/**
 * 금액 요소는 줄바꿈하지 않는다(FD-10, NFR-009). 안전 정수가 아니면 예외가 난다.
 * `signed`이면 이익은 초록, 손실은 검정으로 보이고 부호(`+`·`−`)를 항상 글자로 함께 쓴다(색에만 의존하지 않음, FD-18).
 */
export function Money({ value, unit, signed = false }: { value: number; unit: string; signed?: boolean }) {
  const text = signed ? formatSignedMoney(value, unit) : formatMoney(value, unit);
  const tone = signed ? (value > 0 ? gain : value < 0 ? loss : "") : "";
  return <span className={`${base} ${sizeClass[amountFontSize(text)]} ${tone}`.trim()}>{text}</span>;
}
