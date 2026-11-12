import { defineConfig } from "@pandacss/dev";
import { colors, TOUCH_TARGET_PX } from "./src/ui/tokens";

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
        colors: Object.fromEntries(Object.entries(colors).map(([name, value]) => [name, { value }])),
        sizes: { touch: { value: `${TOUCH_TARGET_PX}px` } },
      },
    },
  },
  globalCss: {
    body: { bg: "paper", color: "ink", lineHeight: "1.5" },
    "*:focus-visible": { outline: "3px solid", outlineColor: "focus", outlineOffset: "2px" },
  },
});
