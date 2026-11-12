import { defineConfig } from "@pandacss/dev";
import { colors, FONT_STACK, fontSizes, radii, shadows, TOUCH_TARGET_PX } from "./src/ui/tokens";

const toTokens = (values: Record<string, string>) =>
  Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { value }]));

export default defineConfig({
  presets: ["@pandacss/preset-base", "@pandacss/preset-panda"],
  preflight: true,
  include: ["./src/**/*.{ts,tsx}"],
  exclude: [],
  outdir: "styled-system",
  jsxFramework: "react",
  theme: {
    extend: {
      tokens: {
        colors: toTokens(colors),
        sizes: { touch: { value: `${TOUCH_TARGET_PX}px` } },
        // 기존 코드가 쓰는 `md`·`lg`를 컨트롤·카드 모서리로 바꿔 한 번에 시안 모양을 따르게 한다.
        radii: { ...toTokens(radii), md: { value: radii.control }, lg: { value: radii.card } },
        shadows: toTokens(shadows),
        fonts: { body: { value: FONT_STACK } },
        fontSizes: { amount: { value: fontSizes.amount } },
      },
    },
  },
  globalCss: {
    body: { bg: "canvas", color: "ink", fontFamily: "body", lineHeight: "1.5", wordBreak: "keep-all", overflowWrap: "break-word" },
    "*:focus-visible": { outline: "3px solid", outlineColor: "focus", outlineOffset: "2px" },
  },
});
