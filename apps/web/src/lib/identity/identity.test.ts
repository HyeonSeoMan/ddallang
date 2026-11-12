import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeLockManager, installFakeLocks } from "@/test/fake-locks";
import { FakeStorage, installFakeStorage } from "@/test/fake-storage";
import {
  acquireIdentityKey,
  beginCreateAttempt,
  checkLocks,
  checkStorage,
  completeCreateAttempt,
  discardCreateAttempt,
  getCreateAttempt,
  getStoredKey,
} from "./identity";
import { encodeBase64Url, generateIdentityKey, isValidIdentityKey } from "./key";

const CODE = "invite-abc";

afterEach(() => vi.restoreAllMocks());

describe("신원 키 형식", () => {
  it("[속성] 32바이트는 항상 패딩 없는 43자 base64url이고 되돌릴 수 있다", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 32, maxLength: 32 }), (bytes) => {
        const encoded = encodeBase64Url(bytes);
        expect(encoded).toHaveLength(43);
        expect(encoded).toMatch(/^[A-Za-z0-9_-]{43}$/);
        const standard = encoded.replaceAll("-", "+").replaceAll("_", "/") + "=";
        expect(Array.from(Uint8Array.from(atob(standard), (c) => c.charCodeAt(0)))).toEqual(
          Array.from(bytes),
        );
      }),
    );
  });

  it("생성한 키는 형식을 만족하고 매번 다르다", () => {
    const a = generateIdentityKey();
    const b = generateIdentityKey();
    expect(isValidIdentityKey(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(isValidIdentityKey("short")).toBe(false);
    expect(isValidIdentityKey(`${"a".repeat(42)}=`)).toBe(false);
  });
});

describe("acquireIdentityKey", () => {
  it("[AC-ROOM-001-1] 처음이면 만들어 저장하고 저장소에서 다시 읽은 값을 돌려준다", async () => {
    const storage = installFakeStorage();
    installFakeLocks();
    const result = await acquireIdentityKey(CODE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isValidIdentityKey(result.key)).toBe(true);
    expect(storage.getItem(`ddallang:identity:${CODE}`)).toBe(result.key);
    expect(getStoredKey(CODE)).toBe(result.key);
    // 두 번째 호출은 새로 만들지 않고 같은 키를 돌려준다.
    await expect(acquireIdentityKey(CODE)).resolves.toEqual(result);
  });

  it("[AC-ROOM-006-11] 같은 초대 코드로 동시에 두 번 호출해도 키는 하나만 만들어진다", async () => {
    const storage = installFakeStorage();
    const manager = new FakeLockManager();
    installFakeLocks(manager);
    const spy = vi.spyOn(crypto, "getRandomValues");

    const [first, second] = await Promise.all([acquireIdentityKey(CODE), acquireIdentityKey(CODE)]);

    expect(first).toEqual(second);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(storage.keys()).toEqual([`ddallang:identity:${CODE}`]);
    expect(manager.maxConcurrent.get(`ddallang-identity:${CODE}`)).toBe(1);
  });

  it("초대 코드마다 잠금과 키가 따로다", async () => {
    installFakeStorage();
    installFakeLocks();
    const a = await acquireIdentityKey("code-a");
    const b = await acquireIdentityKey("code-b");
    expect(a.ok && b.ok && a.key !== b.key).toBe(true);
  });

  it("저장하고 다시 읽은 값만 요청에 쓴다", async () => {
    const other = generateIdentityKey();
    class DifferentOnReadback extends FakeStorage {
      private writes = 0;
      override setItem(key: string, value: string) {
        this.writes += 1;
        super.setItem(key, value);
      }
      override getItem(key: string) {
        return this.writes > 0 ? other : super.getItem(key);
      }
    }
    vi.stubGlobal("localStorage", new DifferentOnReadback());
    installFakeLocks();
    await expect(acquireIdentityKey(CODE)).resolves.toEqual({ ok: true, key: other });
  });

  it("저장은 됐지만 다시 읽어 확인하지 못하면 키를 쓰지 않는다", async () => {
    installFakeStorage({ dropWrites: true });
    installFakeLocks();
    await expect(acquireIdentityKey(CODE)).resolves.toEqual({ ok: false, reason: "key-not-confirmed" });
  });

  it("저장소 쓰기·읽기 실패와 저장소 접근 차단은 입장을 막는 결과다", async () => {
    installFakeLocks();
    installFakeStorage({ failOnSet: true });
    await expect(acquireIdentityKey(CODE)).resolves.toEqual({ ok: false, reason: "storage-failed" });

    installFakeStorage({ failOnGet: true });
    await expect(acquireIdentityKey(CODE)).resolves.toEqual({ ok: false, reason: "storage-failed" });

    vi.stubGlobal("localStorage", undefined);
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
    await expect(acquireIdentityKey(CODE)).resolves.toEqual({ ok: false, reason: "storage-failed" });
    expect(checkStorage()).toBe(false);
  });

  it("Web Locks가 없으면 입장을 막는 결과다(폴백 없음)", async () => {
    installFakeStorage();
    installFakeLocks(null);
    expect(checkLocks()).toBe(false);
    await expect(acquireIdentityKey(CODE)).resolves.toEqual({ ok: false, reason: "locks-unsupported" });
  });

  it("저장된 값이 키 형식이 아니면 새로 만든다", async () => {
    const storage = installFakeStorage();
    installFakeLocks();
    storage.setItem(`ddallang:identity:${CODE}`, "broken");
    const result = await acquireIdentityKey(CODE);
    expect(result.ok && isValidIdentityKey(result.key)).toBe(true);
  });

  it("키를 콘솔에 출력하지 않는다", async () => {
    installFakeStorage();
    installFakeLocks();
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    await acquireIdentityKey(CODE);
    const attempt = beginCreateAttempt();
    if (attempt.ok) completeCreateAttempt(attempt.attempt.attemptId, "c2");
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe("getStoredKey·가용성 검사", () => {
  it("읽기 전용이다: 없으면 null이고 아무것도 만들지 않는다", () => {
    const storage = installFakeStorage();
    expect(getStoredKey(CODE)).toBeNull();
    expect(storage.keys()).toEqual([]);
  });

  it("읽기 실패는 null이다", () => {
    installFakeStorage({ failOnGet: true });
    expect(getStoredKey(CODE)).toBeNull();
  });

  it("checkStorage는 쓰기·읽기·삭제 왕복을 확인하고 흔적을 남기지 않는다", () => {
    const storage = installFakeStorage();
    expect(checkStorage()).toBe(true);
    expect(storage.keys()).toEqual([]);
    installFakeStorage({ failOnSet: true });
    expect(checkStorage()).toBe(false);
    installFakeStorage({ dropWrites: true });
    expect(checkStorage()).toBe(false);
  });

  it("checkLocks는 navigator.locks가 있을 때만 참이다", () => {
    installFakeLocks();
    expect(checkLocks()).toBe(true);
    installFakeLocks(null);
    expect(checkLocks()).toBe(false);
  });
});

describe("생성 대기 항목", () => {
  it("시도마다 새 키를 만들어 저장·재확인하고, 재시도는 같은 키를 다시 가져온다", () => {
    const storage = installFakeStorage();
    const first = beginCreateAttempt();
    const second = beginCreateAttempt();
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.attempt.key).not.toBe(second.attempt.key);
    expect(storage.keys()).toHaveLength(2);
    expect(storage.keys().every((k) => k.startsWith("ddallang:pending-create:"))).toBe(true);
    expect(getCreateAttempt(first.attempt.attemptId)).toEqual(first.attempt);
  });

  it("201 응답의 초대 코드에 키를 연결하고 대기 항목을 지운다", () => {
    const storage = installFakeStorage();
    const begun = beginCreateAttempt();
    if (!begun.ok) throw new Error("시도 시작 실패");
    const done = completeCreateAttempt(begun.attempt.attemptId, "new-code");
    expect(done).toEqual({ ok: true, key: begun.attempt.key });
    expect(getStoredKey("new-code")).toBe(begun.attempt.key);
    expect(getCreateAttempt(begun.attempt.attemptId)).toBeNull();
    expect(storage.keys()).toEqual(["ddallang:identity:new-code"]);
  });

  it("4xx·취소는 대기 항목을 지운다", () => {
    const storage = installFakeStorage();
    const begun = beginCreateAttempt();
    if (!begun.ok) throw new Error("시도 시작 실패");
    discardCreateAttempt(begun.attempt.attemptId);
    expect(storage.keys()).toEqual([]);
    expect(getCreateAttempt(begun.attempt.attemptId)).toBeNull();
  });

  it("연결에 실패하면 대기 항목을 남겨 키를 잃지 않는다", () => {
    const storage = installFakeStorage();
    const begun = beginCreateAttempt();
    if (!begun.ok) throw new Error("시도 시작 실패");
    storage.options.failOnSet = true;
    expect(completeCreateAttempt(begun.attempt.attemptId, "code-x")).toEqual({
      ok: false,
      reason: "storage-failed",
    });
    expect(getCreateAttempt(begun.attempt.attemptId)).toEqual(begun.attempt);
  });

  it("저장·재확인 실패는 시도를 시작하지 못하는 결과다", () => {
    installFakeStorage({ failOnSet: true });
    expect(beginCreateAttempt()).toEqual({ ok: false, reason: "storage-failed" });
    installFakeStorage({ dropWrites: true });
    expect(beginCreateAttempt()).toEqual({ ok: false, reason: "key-not-confirmed" });
  });

  it("알 수 없는 시도는 null이고 연결할 수 없다", () => {
    installFakeStorage();
    expect(getCreateAttempt("unknown")).toBeNull();
    expect(completeCreateAttempt("unknown", "c")).toEqual({ ok: false, reason: "key-not-confirmed" });
  });
});
