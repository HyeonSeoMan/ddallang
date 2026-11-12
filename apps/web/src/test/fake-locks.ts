import { stubNavigator } from "./navigator-stub";

type LockCallback<T> = (lock: { name: string; mode: "exclusive" } | null) => Promise<T> | T;

/** 같은 이름의 `exclusive` 요청을 한 번에 하나씩 처리하는 가짜 `navigator.locks`. */
export class FakeLockManager {
  private tails = new Map<string, Promise<unknown>>();
  /** 잠금 안에서 동시에 실행 중인 콜백의 최대 개수(이름별). 배타성 확인용. */
  maxConcurrent = new Map<string, number>();
  private running = new Map<string, number>();
  private queued = new Map<string, number>();
  private gate: Promise<void> | null = null;

  /** 아직 시작하지 못하고 잠금 대기열에 있는 요청 수(이름별). */
  pending(name: string): number {
    return this.queued.get(name) ?? 0;
  }

  /** 콜백 실행을 보류한다(요청은 대기열에 쌓인다). 반환한 함수를 부르면 풀린다. 경합을 결정적으로 만드는 시험용. */
  hold(): () => void {
    let release!: () => void;
    this.gate = new Promise<void>((resolve) => {
      release = () => {
        this.gate = null;
        resolve();
      };
    });
    return release;
  }

  request<T>(name: string, callback: LockCallback<T>): Promise<T>;
  request<T>(name: string, options: { mode?: "exclusive" }, callback: LockCallback<T>): Promise<T>;
  request<T>(
    name: string,
    optionsOrCallback: { mode?: "exclusive" } | LockCallback<T>,
    maybeCallback?: LockCallback<T>,
  ): Promise<T> {
    const callback = (typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback)!;
    const previous = this.tails.get(name) ?? Promise.resolve();
    this.queued.set(name, (this.queued.get(name) ?? 0) + 1);
    const run = previous.then(async () => {
      if (this.gate) await this.gate;
      this.queued.set(name, (this.queued.get(name) ?? 1) - 1);
      const now = (this.running.get(name) ?? 0) + 1;
      this.running.set(name, now);
      this.maxConcurrent.set(name, Math.max(this.maxConcurrent.get(name) ?? 0, now));
      try {
        return await callback({ name, mode: "exclusive" });
      } finally {
        this.running.set(name, (this.running.get(name) ?? 1) - 1);
      }
    });
    this.tails.set(
      name,
      run.catch(() => undefined),
    );
    return run;
  }
}

/** `navigator.locks`를 가짜로 바꾼다. 인자가 `undefined`가 아니라 `null`이면 미지원 환경을 흉내 낸다. */
export function installFakeLocks(manager: FakeLockManager | null = new FakeLockManager()) {
  stubNavigator("locks", manager ?? undefined);
  return manager;
}
