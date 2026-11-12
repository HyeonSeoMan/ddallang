/** 백엔드 주소 검증. 누락·형식 오류면 예외를 던진다(FD-1). */
export function parseApiBaseUrl(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL이 설정되지 않았습니다. 백엔드 주소를 지정하세요(예: http://localhost:3001).",
    );
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("NEXT_PUBLIC_API_BASE_URL이 올바른 URL이 아닙니다.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_API_BASE_URL은 http 또는 https여야 합니다.");
  }
  return raw.replace(/\/+$/, "");
}

/** 클라이언트 번들에 인라인되도록 리터럴로 읽는다. */
export function getApiBaseUrl(): string {
  return parseApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
}
