// 이어받기 요청자의 결과 수신(FE-M4, FD-23, S5 §6.8): 요청자는 방 비참여자라 스트림을 열 수 없으므로
// 내 요청 조회(S1 §4.10)를 2초 간격으로 한다. 끊김 배너 모델은 적용하지 않는다.
import type { MyClaim } from "@/lib/api";
import type { ConnectionEnv } from "@/features/realtime/connection";

export const CLAIM_POLL_INTERVAL_MS = 2_000;
/** 요청당 시간 제한(S5 §6.8). */
export const CLAIM_POLL_TIMEOUT_MS = 10_000;

export interface ClaimPollerDeps {
  /** 내 요청을 한 번 조회한다. `signal`로 중단할 수 있어야 한다. */
  fetchClaim(signal: AbortSignal): Promise<MyClaim>;
  /** 조회에 성공할 때마다 부른다. `PENDING`이 아니면 그 뒤로 조회하지 않는다. */
  onClaim(claim: MyClaim): void;
  env: Pick<ConnectionEnv, "on" | "isVisible">;
}

export interface ClaimPoller {
  start(): void;
  stop(): void;
}

/**
 * 화면이 보일 때만 2초 간격으로 조회하고, 다시 보이거나 `online`이면 즉시 한 번 조회한다. 실패(네트워크·시간 초과·
 * 오류 응답)는 다음 간격에 다시 한다. 결과가 나오면(`PENDING`이 아니면) 멈춘다. 요청은 한 번에 하나만 보낸다.
 */
export function createClaimPoller(deps: ClaimPollerDeps): ClaimPoller {
  let stopped = true;
  let inFlight: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let removeListeners: Array<() => void> = [];

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  function schedule() {
    clear();
    if (stopped || !deps.env.isVisible()) return; // 숨겨진 동안은 조회하지 않는다
    timer = setTimeout(() => void poll(), CLAIM_POLL_INTERVAL_MS);
  }

  async function poll() {
    if (stopped || inFlight || !deps.env.isVisible()) return;
    clear();
    const controller = new AbortController();
    inFlight = controller;
    try {
      const claim = await deps.fetchClaim(controller.signal);
      if (stopped || inFlight !== controller) return;
      deps.onClaim(claim);
      if (claim.status !== "PENDING") stop();
    } catch {
      // 다음 간격에 다시 한다.
    } finally {
      if (inFlight === controller) inFlight = null;
      schedule();
    }
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    clear();
    inFlight?.abort();
    inFlight = null;
    for (const remove of removeListeners) remove();
    removeListeners = [];
  }

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      const now = () => void poll();
      removeListeners = [
        deps.env.on("visibilitychange", () => {
          if (deps.env.isVisible()) now();
          else clear();
        }),
        deps.env.on("online", now),
      ];
      schedule();
    },
    stop,
  };
}
