import { vi } from "vitest";

export interface FakeClock {
  now(): number;
  /** 시간을 앞으로 보내며 그 사이 타이머와 대기 중인 Promise를 처리한다. */
  advance(ms: number): Promise<void>;
  /** 기기 시각만 바꾼다(시계 오차 시험). 타이머는 건드리지 않는다. */
  setSystemTime(time: number | string | Date): void;
  restore(): void;
}

/** 가짜 시계(FD-8): 모든 시한은 이 시계로 시험한다. */
export function useFakeClock(start: number | string | Date = "2026-11-08T03:00:00.000Z"): FakeClock {
  vi.useFakeTimers({ now: new Date(start) });
  return {
    now: () => Date.now(),
    advance: async (ms) => {
      await vi.advanceTimersByTimeAsync(ms);
    },
    setSystemTime: (time) => vi.setSystemTime(time),
    restore: () => vi.useRealTimers(),
  };
}
