import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// 제한 규칙(FE-F1, plan FD-1·FD-4·FD-8·FD-13).
const eventSourceGlobal = {
  name: "EventSource",
  message: "SSE는 fetch 스트리밍으로 구현한다(FD-8). EventSource는 쓰지 않는다.",
};
const localStorageGlobal = {
  name: "localStorage",
  message: "저장소 접근은 신원 키 모듈(src/lib/identity)만 한다(FD-4).",
};
const storageProperties = ["window", "globalThis", "self"].map((object) => ({
  object,
  property: "localStorage",
  message: "저장소 접근은 신원 키 모듈(src/lib/identity)만 한다(FD-4).",
}));
const eventSourceProperties = ["window", "globalThis", "self"].map((object) => ({
  object,
  property: "EventSource",
  message: "SSE는 fetch 스트리밍으로 구현한다(FD-8). EventSource는 쓰지 않는다.",
}));
const locksProperty = {
  object: "navigator",
  property: "locks",
  message: "Web Locks 접근은 신원 키 모듈(src/lib/identity)만 한다(FD-4).",
};
const noInnerHtml = [
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: "dangerouslySetInnerHTML은 쓰지 않는다(FD-13).",
  },
  {
    selector: "Property[key.name='dangerouslySetInnerHTML']",
    message: "dangerouslySetInnerHTML은 쓰지 않는다(FD-13).",
  },
];

const restrictionRules = ({ allowStorage }) => ({
  "no-restricted-globals": [
    "error",
    eventSourceGlobal,
    ...(allowStorage ? [] : [localStorageGlobal]),
  ],
  "no-restricted-properties": [
    "error",
    ...eventSourceProperties,
    ...(allowStorage ? [] : [...storageProperties, locksProperty]),
  ],
  "no-restricted-syntax": ["error", ...noInnerHtml],
  // 신원 키가 로그에 남지 않도록 콘솔 출력을 막는다(FD-4).
  "no-console": "error",
});

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "styled-system/**", "next-env.d.ts"]),
  { files: ["src/**/*.{ts,tsx}"], rules: restrictionRules({ allowStorage: false }) },
  {
    // 저장소·잠금을 독점하는 모듈과 시험은 접근할 수 있다.
    files: ["src/lib/identity/**", "src/**/*.test.{ts,tsx}", "src/test/**"],
    rules: restrictionRules({ allowStorage: true }),
  },
]);
