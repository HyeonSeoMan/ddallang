import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { resetMutationManagers } from "@/features/transactions/mutation-state";
import { restoreNavigatorStubs } from "@/test/navigator-stub";
import { server } from "@/test/msw-server";

// 처리기가 없는 요청(프레임)은 실패시킨다(모의되지 않은 실서버 호출을 막는다).
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.unstubAllGlobals();
  restoreNavigatorStubs();
  resetMutationManagers();
});

afterAll(() => server.close());
