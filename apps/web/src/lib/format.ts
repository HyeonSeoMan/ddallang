// 숫자 서식은 이 모듈 하나가 맡는다(FD-10). `Intl`은 로캘에 따라 달라질 수 있어 쓰지 않는다.
const MINUS = "−";

function assertSafeInteger(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`안전한 정수가 아닌 값은 표시할 수 없습니다: ${String(value)}`);
  }
}

function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 세 자리마다 ASCII 쉼표. 음수는 `−`(U+2212)를 앞에 붙인다. 복사 텍스트도 이 함수를 쓴다. */
export function formatAmount(value: number): string {
  assertSafeInteger(value);
  const digits = groupDigits(String(Math.abs(value)));
  return value < 0 ? `${MINUS}${digits}` : digits;
}

/** 부호 있는 표시: 양수 `+`, 음수 `−`(U+2212), 0은 부호 없이 `0`. */
export function formatSigned(value: number): string {
  assertSafeInteger(value);
  if (value === 0) return "0";
  return value > 0 ? `+${formatAmount(value)}` : formatAmount(value);
}

/** 금액과 단위(방의 `unit`) 사이에 공백 한 칸. 환산하지 않는다. */
export function formatMoney(value: number, unit: string): string {
  return `${formatAmount(value)} ${unit}`;
}

/** 부호 있는 순손익과 단위. */
export function formatSignedMoney(value: number, unit: string): string {
  return `${formatSigned(value)} ${unit}`;
}
