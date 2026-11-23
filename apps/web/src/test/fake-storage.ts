import { vi } from "vitest";
import { ONBOARDING_SEEN_KEYS } from "@/lib/identity/onboarding";

export interface FakeStorageOptions {
  /** 쓰기 시 예외(용량 초과·접근 차단). */
  failOnSet?: boolean;
  failOnGet?: boolean;
  failOnRemove?: boolean;
  /** 쓰기는 성공한 것처럼 보이나 읽으면 값이 없는 저장소(재확인 실패 시험). */
  dropWrites?: boolean;
}

export class FakeStorage implements Storage {
  private data = new Map<string, string>();
  options: FakeStorageOptions;

  constructor(options: FakeStorageOptions = {}) {
    this.options = options;
  }

  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    if (this.options.failOnGet) throw new DOMException("denied", "SecurityError");
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    if (this.options.failOnRemove) throw new DOMException("denied", "SecurityError");
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.options.failOnSet) throw new DOMException("quota", "QuotaExceededError");
    if (this.options.dropWrites) return;
    this.data.set(key, String(value));
  }
  /** 시험이 저장된 키를 직접 확인한다. */
  keys(): string[] {
    return [...this.data.keys()];
  }
}

/** `localStorage`를 가짜 저장소로 바꾼다. `vi.unstubAllGlobals()`로 되돌린다. */
export function installFakeStorage(options?: FakeStorageOptions): FakeStorage {
  const storage = new FakeStorage(options);
  vi.stubGlobal("localStorage", storage);
  return storage;
}

/**
 * 방 온보딩(FD-33)을 이미 본 브라우저로 만든다. 온보딩이 아닌 방 화면 동작을 보는 시험이 쓴다
 * (처음 방에 들어온 브라우저라 온보딩 대화상자가 화면과 포커스를 덮지 않게).
 */
export function skipRoomOnboarding(storage: Storage): void {
  storage.setItem(ONBOARDING_SEEN_KEYS.room, "1");
}
