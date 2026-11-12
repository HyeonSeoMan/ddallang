// 신원 키·생성 대기 항목의 저장소와 Web Locks 접근은 이 모듈이 독점한다(FD-4).
// 키는 로그·URL·화면에 싣지 않는다. 저장소 접근은 모두 try/catch이며 실패하면 입장을 막는 결과를 돌려준다.
import { generateAttemptId, generateIdentityKey, isValidIdentityKey } from "./key";

const IDENTITY_PREFIX = "ddallang:identity:";
const PENDING_PREFIX = "ddallang:pending-create:";
const LOCK_PREFIX = "ddallang-identity:";
const PROBE_KEY = "ddallang:storage-probe";

export type IdentityFailure =
  /** `navigator.locks`가 없다. 입장을 막고 안내한다. */
  | "locks-unsupported"
  /** 저장소를 읽거나 쓸 수 없다(차단·용량 초과). */
  | "storage-failed"
  /** 저장했지만 다시 읽어 확인하지 못했다. */
  | "key-not-confirmed";

export type KeyResult = { ok: true; key: string } | { ok: false; reason: IdentityFailure };

function getStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function getLocks(): LockManager | null {
  try {
    const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
    return locks && typeof locks.request === "function" ? locks : null;
  } catch {
    return null;
  }
}

/** 쓰기·읽기·삭제 왕복으로 `localStorage`를 쓸 수 있는지 확인한다(FE-F4가 소비). */
export function checkStorage(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    const probe = String(Date.now());
    storage.setItem(PROBE_KEY, probe);
    const readBack = storage.getItem(PROBE_KEY);
    storage.removeItem(PROBE_KEY);
    return readBack === probe;
  } catch {
    return false;
  }
}

/** Web Locks API(`navigator.locks`)가 있는지 확인한다(FE-F4가 소비). */
export function checkLocks(): boolean {
  return getLocks() !== null;
}

/** 저장된 키를 읽기만 한다. 없거나 형식이 틀리거나 저장소를 읽을 수 없으면 `null`. */
export function getStoredKey(inviteCode: string): string | null {
  try {
    const value = getStorage()?.getItem(IDENTITY_PREFIX + inviteCode) ?? null;
    return isValidIdentityKey(value) ? value : null;
  } catch {
    return null;
  }
}

/** 저장하고 다시 읽어 확인한 값을 돌려준다. 확인하지 못하면 실패 사유. */
function writeAndConfirm(storage: Storage, name: string, value: string): KeyResult {
  try {
    storage.setItem(name, value);
  } catch {
    return { ok: false, reason: "storage-failed" };
  }
  try {
    const confirmed = storage.getItem(name);
    return isValidIdentityKey(confirmed)
      ? { ok: true, key: confirmed }
      : { ok: false, reason: "key-not-confirmed" };
  } catch {
    return { ok: false, reason: "storage-failed" };
  }
}

/**
 * 입장용 키를 얻는다(S1 §3.1). 하나의 배타 구간에서: 잠금 → 잠금 안에서 저장소 재읽기
 * → 없을 때만 생성·저장 → **다시 읽어 확인** → 잠금 해제. 요청에는 확인한 값만 쓴다.
 * 실패해도 예외를 던지지 않는다.
 */
export async function acquireIdentityKey(inviteCode: string): Promise<KeyResult> {
  const locks = getLocks();
  if (!locks) return { ok: false, reason: "locks-unsupported" };
  const storage = getStorage();
  if (!storage) return { ok: false, reason: "storage-failed" };

  try {
    return await locks.request(LOCK_PREFIX + inviteCode, { mode: "exclusive" }, async () => {
      let existing: string | null;
      try {
        existing = storage.getItem(IDENTITY_PREFIX + inviteCode);
      } catch {
        return { ok: false, reason: "storage-failed" } satisfies KeyResult;
      }
      if (isValidIdentityKey(existing)) return { ok: true, key: existing } satisfies KeyResult;
      return writeAndConfirm(storage, IDENTITY_PREFIX + inviteCode, generateIdentityKey());
    });
  } catch {
    return { ok: false, reason: "locks-unsupported" };
  }
}

export interface CreateAttempt {
  attemptId: string;
  key: string;
}

export type AttemptResult =
  | { ok: true; attempt: CreateAttempt }
  | { ok: false; reason: IdentityFailure };

function readPendingKey(storage: Storage, attemptId: string): string | null {
  try {
    const raw = storage.getItem(PENDING_PREFIX + attemptId);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    const key = (parsed as { key?: unknown } | null)?.key;
    return isValidIdentityKey(key) ? key : null;
  } catch {
    return null;
  }
}

/**
 * 방 생성 시도를 시작한다: 새 시도 ID와 새 키를 만들어 "생성 대기" 항목으로 저장하고 다시 읽어 확인한다.
 * 서로 다른 정상적인 방 생성 시도는 각각 새 키를 쓴다.
 */
export function beginCreateAttempt(): AttemptResult {
  const storage = getStorage();
  if (!storage) return { ok: false, reason: "storage-failed" };
  const attemptId = generateAttemptId();
  const key = generateIdentityKey();
  try {
    storage.setItem(PENDING_PREFIX + attemptId, JSON.stringify({ key }));
  } catch {
    return { ok: false, reason: "storage-failed" };
  }
  const confirmed = readPendingKey(storage, attemptId);
  return confirmed
    ? { ok: true, attempt: { attemptId, key: confirmed } }
    : { ok: false, reason: "key-not-confirmed" };
}

/** 결과 불명 뒤 같은 시도를 재시도할 때 기존 키를 다시 가져온다(새 키를 만들지 않는다). */
export function getCreateAttempt(attemptId: string): CreateAttempt | null {
  const storage = getStorage();
  const key = storage ? readPendingKey(storage, attemptId) : null;
  return key ? { attemptId, key } : null;
}

/**
 * `201` 응답의 초대 코드에 키를 연결하고(저장·재확인) 대기 항목을 지운다.
 * 연결에 실패하면 대기 항목을 남겨 키를 잃지 않게 한다.
 */
export function completeCreateAttempt(attemptId: string, inviteCode: string): KeyResult {
  const storage = getStorage();
  if (!storage) return { ok: false, reason: "storage-failed" };
  const key = readPendingKey(storage, attemptId);
  if (!key) return { ok: false, reason: "key-not-confirmed" };
  const linked = writeAndConfirm(storage, IDENTITY_PREFIX + inviteCode, key);
  if (linked.ok) discardCreateAttempt(attemptId);
  return linked;
}

/** 4xx 거부 또는 사용자 취소로 시도가 끝났을 때 대기 항목을 지운다. */
export function discardCreateAttempt(attemptId: string): void {
  try {
    getStorage()?.removeItem(PENDING_PREFIX + attemptId);
  } catch {
    // 지우지 못해도 이 시도의 키는 다시 쓰이지 않는다.
  }
}
