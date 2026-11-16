import { describe, expect, it } from "vitest";
import { ApiError, NetworkError } from "@/lib/api";
import { isIdentityRevokedError, isInaccessibleError } from "./access";

const err = (status: number, code: string) => new ApiError({ status, code, message: "m" });

describe("isInaccessibleError", () => {
  it("401과 404 ROOM_NOT_FOUND만 접근 불가다", () => {
    expect(isInaccessibleError(err(401, "UNAUTHENTICATED"))).toBe(true);
    expect(isInaccessibleError(err(404, "ROOM_NOT_FOUND"))).toBe(true);
  });

  it("다른 404(라우트 오류)·403·429·5xx·네트워크 오류는 아니다", () => {
    expect(isInaccessibleError(err(404, "ROUTE_NOT_FOUND"))).toBe(false);
    expect(isInaccessibleError(err(403, "HOST_ONLY"))).toBe(false);
    expect(isInaccessibleError(err(429, "CONNECTION_LIMIT_EXCEEDED"))).toBe(false);
    expect(isInaccessibleError(err(503, "X"))).toBe(false);
    expect(isInaccessibleError(new NetworkError("network"))).toBe(false);
    expect(isInaccessibleError(undefined)).toBe(false);
  });
});

describe("isIdentityRevokedError", () => {
  it("401 IDENTITY_REVOKED는 접근 상실이고 접근 불가가 아니다(FD-21)", () => {
    expect(isIdentityRevokedError(err(401, "IDENTITY_REVOKED"))).toBe(true);
    expect(isInaccessibleError(err(401, "IDENTITY_REVOKED"))).toBe(false);
    expect(isIdentityRevokedError(err(401, "UNAUTHENTICATED"))).toBe(false);
    expect(isIdentityRevokedError(new NetworkError("network"))).toBe(false);
  });
});
