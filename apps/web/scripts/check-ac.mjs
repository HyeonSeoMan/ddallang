// ac-matrix.md의 모든 AC에 `[AC-…]` 태그가 달린 시험이 있는지 대조한다(FE-F7, plan §8).
// 사용: node scripts/check-ac.mjs [--matrix <파일>] [--src <디렉터리>]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AC_ROW = /^\|\s*(AC-[A-Z]+-\d+-\d+)\s*\|/;
const TAG = /\[(AC-[A-Z]+-\d+-\d+)\]/g;
// it/test(.each(...)) ("제목") 형태의 시험 제목 문자열만 센다. describe 제목, skip·todo는 세지 않는다.
const TEST_CALL =
  /\b(?:it|test)((?:\.[A-Za-z]+(?:\([^)]*\))?)*)\(\s*(["'`])((?:(?!\2)[^\\]|\\.)*?)\2/g;

/** @param {string} matrixText */
export function parseAcIds(matrixText) {
  const ids = [];
  for (const line of matrixText.split("\n")) {
    const match = AC_ROW.exec(line);
    if (match) ids.push(match[1]);
  }
  return [...new Set(ids)];
}

/** @param {string} source */
export function collectTaggedAcs(source) {
  const found = new Set();
  for (const call of source.matchAll(TEST_CALL)) {
    const modifiers = call[1] ?? "";
    if (/\.(skip|todo)\b/.test(modifiers)) continue;
    for (const tag of (call[3] ?? "").matchAll(TAG)) found.add(tag[1]);
  }
  return found;
}

/**
 * @param {string} matrixText
 * @param {string[]} testSources
 */
export function findMissingAcs(matrixText, testSources) {
  const tagged = new Set();
  for (const source of testSources) for (const id of collectTaggedAcs(source)) tagged.add(id);
  return parseAcIds(matrixText).filter((id) => !tagged.has(id));
}

/** @param {string} dir @returns {string[]} */
function listTestFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...listTestFiles(path));
    else if (/\.test\.(ts|tsx)$/.test(name)) files.push(path);
  }
  return files;
}

function main() {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 ? resolve(args[index + 1]) : fallback;
  };
  const here = dirname(fileURLToPath(import.meta.url));
  const matrixPath = option("--matrix", resolve(here, "../../../docs/plans/web/ac-matrix.md"));
  const srcDir = option("--src", resolve(here, "../src"));

  const matrixText = readFileSync(matrixPath, "utf8");
  const total = parseAcIds(matrixText).length;
  const missing = findMissingAcs(
    matrixText,
    listTestFiles(srcDir).map((file) => readFileSync(file, "utf8")),
  );
  if (missing.length > 0) {
    console.error(`태그 시험이 없는 AC ${missing.length}/${total}개:`);
    for (const id of missing) console.error(`  ${id}`);
    process.exit(1);
  }
  console.log(`모든 AC(${total}개)에 태그 시험이 있습니다.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
