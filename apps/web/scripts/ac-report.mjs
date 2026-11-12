// AC별 태그 시험 위치 보고(FE-Z1, G4 증거): ac-matrix.md의 AC마다 `[AC-…]` 태그가 달린 시험 파일을 표로 낸다.
// 사용: node scripts/ac-report.mjs > 표.md   (태그 존재만 보여 주며 시험이 통과했다는 증거는 아니다)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectTaggedAcs } from "./check-ac.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "../src");
const matrixPath = resolve(here, "../../../docs/plans/web/ac-matrix.md");
/** 기본 `pnpm test`에 들어가지 않는 실서버 시험 파일(별도 설정으로만 실행). */
/** 검사 스크립트 자체 시험의 예시 표·태그는 AC 증거가 아니다. */
const SELF_TEST = "src/test/check-ac.test.ts";
const OPT_IN = new Set(["src/latency/latency.test.tsx", "src/integration/integration.test.tsx"]);

function listTests(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules") return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listTests(path) : /\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const byAc = new Map();
for (const file of listTests(srcDir)) {
  const rel = relative(resolve(here, ".."), file);
  if (rel === SELF_TEST) continue;
  for (const id of collectTaggedAcs(readFileSync(file, "utf8"))) byAc.set(id, [...(byAc.get(id) ?? []), rel]);
}

const rows = readFileSync(matrixPath, "utf8")
  .split("\n")
  .map((line) => line.split("|").map((cell) => cell.trim()))
  .filter((cells) => /^AC-[A-Z]+-\d+-\d+$/.test(cells[1] ?? ""));

console.log("| AC | 구분 | FE 담당 Task | 연동 | 태그 시험 파일(기본 시험) | 실서버 시험(별도 실행) |");
console.log("| --- | --- | --- | --- | --- | --- |");
for (const [, id, , kind, task, link] of rows) {
  const files = byAc.get(id) ?? [];
  const base = files.filter((f) => !OPT_IN.has(f)).map((f) => f.replace(/^src\//, ""));
  const real = files.filter((f) => OPT_IN.has(f)).map((f) => f.replace(/^src\//, ""));
  console.log(`| ${id} | ${kind} | ${task} | ${link} | ${base.join("<br>") || "—"} | ${real.join("<br>") || "—"} |`);
}
