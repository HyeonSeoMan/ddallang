import { setupServer } from "msw/node";

/** 모든 시험이 공유하는 MSW 서버. `vitest.setup.ts`가 시작·초기화·종료를 맡는다. */
export const server = setupServer();
