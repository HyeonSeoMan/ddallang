// 필수 기능 검사(S5 §3.1, FE-F4). 하나라도 없으면 진입을 차단한다. 폴리필·폴백은 만들지 않는다(NFR-008).
import { checkLocks, checkStorage } from "@/lib/identity";

export const CAPABILITY_LABELS = {
  locks: "탭 간 잠금",
  random: "보안 난수",
  storage: "브라우저 저장소",
  streaming: "스트리밍 통신",
  connection: "연결 상태 감지",
} as const;

export type CapabilityId = keyof typeof CAPABILITY_LABELS;

const checks: Record<CapabilityId, () => boolean> = {
  // 1. Web Locks(저장소·잠금 확인은 신원 키 모듈의 검사 함수를 호출한다)
  locks: checkLocks,
  // 2. 암호학적 난수
  random: () => typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function",
  // 3. localStorage 읽기·쓰기
  storage: checkStorage,
  // 4. fetch 스트리밍 응답 본문, TextDecoder, AbortController
  streaming: () =>
    typeof fetch === "function" &&
    typeof Response !== "undefined" &&
    "body" in Response.prototype &&
    typeof ReadableStream !== "undefined" &&
    typeof ReadableStream.prototype.getReader === "function" &&
    typeof TextDecoder !== "undefined" &&
    typeof AbortController !== "undefined",
  // 5. navigator.onLine, visibilitychange, 타이머
  connection: () =>
    typeof navigator !== "undefined" &&
    typeof navigator.onLine === "boolean" &&
    typeof document !== "undefined" &&
    "visibilityState" in document &&
    typeof setTimeout === "function" &&
    typeof clearTimeout === "function",
};

/** 없는 기능의 목록. 비어 있으면 모두 있다. 검사 중 예외는 "없음"으로 본다. */
export function detectMissingCapabilities(): CapabilityId[] {
  return (Object.keys(checks) as CapabilityId[]).filter((id) => {
    try {
      return !checks[id]();
    } catch {
      return true;
    }
  });
}
