/**
 * 첫 방문 소개를 끝냈거나 건너뛴 브라우저에 남기는 표시(U-28, FD-32). 저장소 접근은 이 모듈 묶음만 한다(FD-4).
 * 신원 키가 아니며 값은 보지 않고 있는지만 본다.
 */
export const ONBOARDING_SEEN_KEY = "ddallang:onboarding-seen";

/** 저장소를 읽지 못하면 본 것으로 친다. 소개는 홈의 `딸랑 소개 다시 보기`로 언제든 열 수 있다. */
export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) !== null;
  } catch {
    return true;
  }
}

export function markOnboardingSeen(): void {
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
  } catch {
    // 남기지 못해도 이번 화면에서는 닫는다. 다음 방문에 다시 보일 뿐이다.
  }
}
