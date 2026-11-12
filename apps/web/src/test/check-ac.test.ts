import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectTaggedAcs, findMissingAcs, parseAcIds } from "../../scripts/check-ac.mjs";

// 시험용 매핑표. 실제 `ac-matrix.md`와 별개다(전체 통과는 FE-Z1이 확인한다).
const matrix = [
  "| AC | Spec | 구분 |",
  "| --- | --- | --- |",
  "| AC-ROOM-001-1 | S1 | FE |",
  "| AC-TXN-007-5 | S2 | FE |",
  "| NFR-008 지원 환경 | 설명 | FE-F4 |",
  "| AC-SET-005-2 | S4 | FE |",
].join("\n");

describe("check:ac", () => {
  it("매핑표에서 AC 행만 읽는다", () => {
    expect(parseAcIds(matrix)).toEqual(["AC-ROOM-001-1", "AC-TXN-007-5", "AC-SET-005-2"]);
  });

  it("시험(it/test) 제목의 태그만 센다(주석·describe·skip·todo 제외)", () => {
    const source = [
      "// [AC-ROOM-001-1] 주석은 세지 않는다",
      'it("[AC-TXN-007-5] 같은 키 재시도", () => {});',
      "it.skip(`[AC-SET-005-2] 건너뜀`, () => {});",
      'describe("그룹 [AC-ROOM-001-1]", () => {});', // describe 제목만으로는 충족되지 않는다
      'it.each([1, 2])("[AC-SET-005-2] 반복 %s", () => {});',
    ].join("\n");
    expect([...collectTaggedAcs(source)].sort()).toEqual(["AC-SET-005-2", "AC-TXN-007-5"]);
  });

  it("일부러 태그를 뺀 AC를 누락으로 찾아낸다", () => {
    const sources = ['it("[AC-ROOM-001-1] a", () => {});', 'it("[AC-TXN-007-5] b", () => {});'];
    expect(findMissingAcs(matrix, sources)).toEqual(["AC-SET-005-2"]);
    expect(findMissingAcs(matrix, [])).toHaveLength(3);
  });

  it("CLI가 누락이 있으면 종료 코드 1, 모두 있으면 0이다", () => {
    const dir = mkdtempSync(join(tmpdir(), "check-ac-"));
    try {
      const matrixPath = join(dir, "matrix.md");
      const srcDir = join(dir, "src");
      mkdirSync(srcDir);
      writeFileSync(matrixPath, matrix);
      writeFileSync(
        join(srcDir, "a.test.ts"),
        'it("[AC-ROOM-001-1] a", () => {});\nit("[AC-TXN-007-5] b", () => {});\n',
      );
      const run = () =>
        spawnSync("node", ["scripts/check-ac.mjs", "--matrix", matrixPath, "--src", srcDir], {
          cwd: process.cwd(),
          encoding: "utf8",
        });

      const failed = run();
      expect(failed.status).toBe(1);
      expect(failed.stderr).toContain("AC-SET-005-2");

      writeFileSync(join(srcDir, "b.test.ts"), 'it("[AC-SET-005-2] c", () => {});\n');
      expect(run().status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
