const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** CSPRNG 32바이트를 base64url(패딩 없음) 43자로 만든다(S1 §3.1). */
export function generateIdentityKey(): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

/** 시도 ID(생성 대기 항목 이름). 16바이트 난수의 base64url. */
export function generateAttemptId(): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

export function isValidIdentityKey(value: unknown): value is string {
  return typeof value === "string" && KEY_PATTERN.test(value);
}
