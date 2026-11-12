// 지연 측정 통계(FE-S5-6, S5 §6.7): 95번째 백분위는 최근접 순위법(올림 순위)으로 구한다.
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) throw new Error("표본이 없습니다.");
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1]!;
}

export interface Summary {
  count: number;
  p95: number;
  max: number;
}

export function summarize(values: readonly number[]): Summary {
  return { count: values.length, p95: percentile(values, 95), max: Math.max(...values) };
}

export interface Limits {
  p95Ms: number;
  maxMs: number;
}

/** 목표를 초과하면 불합격 사유를 돌려준다(경계값은 합격). */
export function judge(label: string, summary: Summary, limits: Limits): string[] {
  const failures: string[] = [];
  if (summary.p95 > limits.p95Ms) failures.push(`${label}: 95백분위 ${summary.p95}ms > ${limits.p95Ms}ms`);
  if (summary.max > limits.maxMs) failures.push(`${label}: 최댓값 ${summary.max}ms > ${limits.maxMs}ms`);
  return failures;
}
