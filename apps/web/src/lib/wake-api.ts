import { getApiBaseUrl } from "./env";

/** 깨우기 요청이 오래 걸려도 연결을 붙들고 있지 않도록 하는 상한(무료 호스팅의 첫 요청은 수십 초가 걸린다). */
export const WAKE_TIMEOUT_MS = 90_000;

/**
 * 백엔드를 미리 깨운다. 무료 호스팅은 한동안 요청이 없으면 잠들어 첫 요청이 50초 넘게 걸리는데, 읽기 요청의
 * 시간 제한은 10초(Spec)라서 처음 연 사용자가 시간 초과를 보게 된다. 화면이 열릴 때 `GET /health`(인증·DB 없음)를
 * 보내 두면 사용자가 입력하는 동안 서버가 깨어난다. 결과는 쓰지 않고 실패해도 아무것도 하지 않는다(재시도·표시 없음).
 * 시간 제한이나 재시도 계약(S5)을 바꾸지 않는다. 이 앱의 백엔드 외 다른 곳으로는 요청하지 않는다(FD-13).
 */
export function wakeApi(options: { baseUrl?: string; fetchImpl?: typeof fetch } = {}): void {
  // 이 동작은 필수 기능 검사(`FeatureGate`) 바깥에서 실행된다. 필수 기능이 없는 브라우저에서도 예외를 던져
  // 지원 불가 안내(S5 §3.1·§9)를 방해하지 않도록 모든 실패를 조용히 삼키고 생략한다.
  try {
    const baseUrl = options.baseUrl ?? getApiBaseUrl(); // 설정 오류는 빌드·기동 단계에서 이미 막힌다
    const doFetch = options.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
    if (!doFetch || typeof AbortController === "undefined") return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WAKE_TIMEOUT_MS);
    void Promise.resolve(
      doFetch(`${baseUrl}/health`, { method: "GET", cache: "no-store", credentials: "omit", signal: controller.signal }),
    )
      .catch(() => undefined)
      .finally(() => clearTimeout(timer));
  } catch {
    // 아무것도 하지 않는다.
  }
}

let requested = false;

/**
 * 문서(페이지 로드)당 한 번만 깨운다. React StrictMode(개발 모드)는 효과를 두 번 실행하므로 컴포넌트가 아니라
 * 모듈 상태로 중복을 막는다. 새 문서가 로드되면 모듈이 새로 만들어져 다시 한 번 깨운다.
 */
export function wakeApiOnce(): void {
  if (requested) return;
  requested = true;
  wakeApi();
}

/** 시험 전용: 문서당 1회 보호를 되돌린다. */
export function resetWakeApiOnceForTests(): void {
  requested = false;
}
