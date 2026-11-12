import { css } from "styled-system/css";
import { formatMoney, formatSignedMoney } from "@/lib/format";

/** 금액 요소는 줄바꿈하지 않는다(FD-10, NFR-009). 안전 정수가 아니면 예외가 난다. */
export function Money({ value, unit, signed = false }: { value: number; unit: string; signed?: boolean }) {
  return (
    <span className={css({ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" })}>
      {signed ? formatSignedMoney(value, unit) : formatMoney(value, unit)}
    </span>
  );
}
