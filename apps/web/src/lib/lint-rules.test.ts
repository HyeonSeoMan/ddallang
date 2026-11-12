import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

async function lint(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  if (!result) throw new Error("lintText 결과가 없습니다");
  return result.messages.filter((m) => m.severity === 2).map((m) => m.ruleId);
}

const feature = "src/features/room/violation.tsx";

describe("ESLint 제한 규칙", { timeout: 30_000 }, () => {
  it("EventSource를 막는다", async () => {
    expect(await lint("export const s = new EventSource('/x');\n", feature)).toContain(
      "no-restricted-globals",
    );
    expect(
      await lint("export const s = new window.EventSource('/x');\n", feature),
    ).toContain("no-restricted-properties");
  });

  it("dangerouslySetInnerHTML을 막는다", async () => {
    const jsx = "export const A = () => <div dangerouslySetInnerHTML={{ __html: 'x' }} />;\n";
    expect(await lint(jsx, feature)).toContain("no-restricted-syntax");
    const props = "export const p = { dangerouslySetInnerHTML: { __html: 'x' } };\n";
    expect(await lint(props, "src/features/room/violation.ts")).toContain("no-restricted-syntax");
  });

  it("localStorage 직접 사용을 신원 키 모듈 밖에서 막는다", async () => {
    expect(await lint("export const v = localStorage.getItem('a');\n", feature)).toContain(
      "no-restricted-globals",
    );
    expect(
      await lint("export const v = window.localStorage.getItem('a');\n", feature),
    ).toContain("no-restricted-properties");
  });

  it("navigator.locks 직접 사용을 신원 키 모듈 밖에서 막는다", async () => {
    expect(
      await lint("export const l = navigator.locks.request('a', () => {});\n", feature),
    ).toContain("no-restricted-properties");
  });

  it("console 출력을 막는다", async () => {
    expect(await lint("console.log('key');\n", feature)).toContain("no-console");
  });

  it("신원 키 모듈은 저장소·잠금을 쓸 수 있다", async () => {
    const code =
      "export const v = localStorage.getItem('a');\nexport const l = navigator.locks;\n";
    expect(await lint(code, "src/lib/identity/store.ts")).toEqual([]);
  });

  it("신원 키 모듈에서도 EventSource는 막는다", async () => {
    expect(await lint("export const s = new EventSource('/x');\n", "src/lib/identity/x.ts")).toContain(
      "no-restricted-globals",
    );
  });
});
