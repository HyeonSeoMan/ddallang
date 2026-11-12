export type CopyResult = { ok: true } | { ok: false; reason: "unsupported" | "failed" };

/**
 * 클립보드에 쓴다(FD-14). **쓰기가 끝난 뒤에만** 성공을 돌려준다.
 * 미지원·실패는 실패 결과이며, `execCommand` 같은 폴백은 만들지 않는다.
 */
export async function copyText(text: string): Promise<CopyResult> {
  const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
  if (!clipboard || typeof clipboard.writeText !== "function") {
    return { ok: false, reason: "unsupported" };
  }
  try {
    await clipboard.writeText(text);
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
