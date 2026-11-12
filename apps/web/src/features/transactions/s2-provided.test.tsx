import { screen } from "@testing-library/react";
import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { ApiError, ERROR_CODES } from "@/lib/api";
import { installFakeStorage } from "@/test/fake-storage";
import * as fixtures from "@/test/fixtures";
import { renderApp } from "@/test/render";
import { seedRoom } from "@/test/room-seed";
import { describeApiError, fieldReasonMessage } from "./messages";
import { TransactionActions } from "./transaction-actions";
import { TransactionForm } from "./transaction-form";

describe("S2 오류 코드 → 화면 문구 연결 전수 (FE-S2-4)", () => {
  const error = (code: string, extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {}) =>
    new ApiError({ status: 409, code, message: `${code} 안내`, ...extra });

  it.each(ERROR_CODES)("오류 코드 %s는 사용자에게 보일 문구(서버 message 또는 필드 사유)로 연결된다", (code) => {
    const details = code === "VALIDATION_FAILED" ? [{ field: "amount", code: "OUT_OF_RANGE" }] : [];
    const described = describeApiError(error(code, { details }), { fresh: false });
    const hasText = described.message.length > 0 || Object.values(described.fieldErrors).some((m) => (m?.length ?? 0) > 0);
    expect(hasText, `${code}가 화면 문구로 연결되지 않았다`).toBe(true);
  });

  it("서버 message를 그대로 쓰고(분기는 code) 특별 안내는 해당 코드에만 덧붙는다", () => {
    for (const code of ["GAME_ENDED", "TRANSACTION_LIMIT_EXCEEDED", "NOT_AUTHOR_OR_HOST", "TRANSACTION_DELETED", "TRANSACTION_NOT_FOUND"]) {
      expect(describeApiError(error(code), { fresh: true }).message).toBe(`${code} 안내`);
    }
    expect(describeApiError(error("IDEMPOTENCY_CONFLICT"), { fresh: false }).message).toContain("다시 저장해 주세요");
  });

  it("IDEMPOTENCY_KEY_EXPIRED: 목록 확인은 항상, 시계 확인은 방금 시작한 요청이거나 시각 차이가 5분을 넘을 때만 덧붙인다", () => {
    const now = Date.parse("2026-11-08T03:00:00.000Z");
    const skewed = error("IDEMPOTENCY_KEY_EXPIRED", { details: [{ serverTime: "2026-11-08T03:10:00.000Z" }] });
    const close = error("IDEMPOTENCY_KEY_EXPIRED", { details: [{ serverTime: "2026-11-08T03:01:00.000Z" }] });
    expect(describeApiError(close, { fresh: false, now }).message).toContain("거래 내역에서 저장 여부를 먼저 확인해 주세요.");
    expect(describeApiError(close, { fresh: false, now }).message).not.toContain("기기의 날짜·시간");
    expect(describeApiError(skewed, { fresh: false, now }).message).toContain("기기의 날짜·시간");
    expect(describeApiError(close, { fresh: true, now }).message).toContain("기기의 날짜·시간");
  });

  it("422 검증 사유 코드는 필드별 문구로 연결된다(모든 사유 코드)", () => {
    for (const code of ["REQUIRED", "INVALID_TYPE", "INVALID_VALUE", "INVALID_CHARACTER", "LEADING_OR_TRAILING_SPACE", "OUT_OF_RANGE", "SAME_AS_PAYER", "PARTICIPANT_NOT_FOUND", "NOT_ALLOWED_FIELD", "LENGTH_OUT_OF_RANGE"]) {
      for (const field of ["payerId", "payeeId", "amount", "reason", "round"] as const) {
        expect(fieldReasonMessage(field, code).length, `${field}/${code}`).toBeGreaterThan(0);
      }
    }
  });

  it("firstAttemptAt 검증 실패(시계 오차)는 기기 시계 확인을 안내한다", () => {
    const described = describeApiError(
      error("VALIDATION_FAILED", { status: 422, message: "요청 시각이 올바르지 않습니다", details: [{ field: "firstAttemptAt", code: "INVALID_VALUE", serverTime: "x" }] }),
      { fresh: true },
    );
    expect(described.message).toContain("기기의 날짜·시간 설정을 확인해 주세요.");
  });
});

describe("S2 비제공 UI 점검 (FE-S2-4)", () => {
  const FORBIDDEN = /일괄|여러 건|한꺼번에|당사자 변경|지급자 변경|수취자 변경|정정|변경 이력|이력|감사|되돌리기|복구하기/;

  it("[AC-TXN-001-5] 일괄 입력 UI가 없다(거래 입력은 한 건씩, 폼은 하나뿐이다)", () => {
    installFakeStorage();
    const store = createStore();
    seedRoom(store);
    renderApp(<main><TransactionForm /></main>, store);
    expect(document.querySelectorAll("form")).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(FORBIDDEN);
    expect(screen.queryByRole("textbox", { name: /여러|목록|csv/i })).not.toBeInTheDocument();
    expect(document.querySelector("textarea")).toBeNull(); // 여러 줄 붙여넣기 입력 없음
  });

  it("[AC-TXN-009-4] 정정 거래·당사자 변경·변경 이력 UI가 없다(수정 폼은 금액·사유·라운드뿐)", () => {
    installFakeStorage();
    const store = createStore();
    seedRoom(store, { me: fixtures.hostMember });
    renderApp(
      <main>
        <TransactionActions transaction={fixtures.transactions[0]!} me={fixtures.hostMember} room={fixtures.room} />
      </main>,
      store,
    );
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["수정", "삭제"]);
    expect(document.body.textContent).not.toMatch(FORBIDDEN);
  });
});
