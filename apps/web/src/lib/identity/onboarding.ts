/**
 * 온보딩을 끝냈거나 건너뛴 브라우저에 남기는 표시(U-28·U-30, FD-32·FD-33). 저장소 접근은 이 모듈 묶음만 한다(FD-4).
 * 신원 키가 아니며 값은 보지 않고 있는지만 본다. 홈(서비스 소개)과 방(방 화면 사용법)을 따로 남긴다.
 */
export type OnboardingKind = "home" | "room";

export const ONBOARDING_SEEN_KEYS: Readonly<Record<OnboardingKind, string>> = {
  home: "ddallang:onboarding-seen",
  room: "ddallang:room-onboarding-seen",
};

/** 저장소를 읽지 못하면 본 것으로 친다. 온보딩은 `다시 보기` 버튼으로 언제든 열 수 있다. */
export function hasSeenOnboarding(kind: OnboardingKind): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SEEN_KEYS[kind]) !== null;
  } catch {
    return true;
  }
}

export function markOnboardingSeen(kind: OnboardingKind): void {
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEYS[kind], "1");
  } catch {
    // 남기지 못해도 이번 화면에서는 닫는다. 다음 방문에 다시 보일 뿐이다.
  }
}
