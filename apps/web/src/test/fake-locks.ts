import { stubNavigator } from "./navigator-stub";

type LockCallback<T> = (lock: { name: string; mode: "exclusive" } | null) => Promise<T> | T;

/** 같은 이름의 `exclusive` 요청을 한 번에 하나씩 처리하는 가짜 `navigator.locks`. */
export class FakeLockManager {
  private tails = new Map<string, Promise<unknown>>();
  /** 잠금 안에서 동시에 실행 중인 콜백의 최대 개수(이름별). 배타성 확인용. */
  maxConcurrent = new Map<string, number>();
  private running = new Map<string, number>();

  request<T>(name: string, callback: LockCallback<T>): Promise<T>;
  request<T>(name: string, options: { mode?: "exclusive" }, callback: LockCallback<T>): Promise<T>;
  request<T>(
    name: string,
    optionsOrCallback: { mode?: "exclusive" } | LockCallback<T>,
    maybeCallback?: LockCallback<T>,
  ): Promise<T> {
    const callback = (typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback)!;
    const previous = this.tails.get(name) ?? Promise.resolve();
    const run = previous.then(async () => {
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
