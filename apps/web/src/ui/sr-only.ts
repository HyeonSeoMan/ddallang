import { css } from "styled-system/css";

/** 화면에는 보이지 않고 보조기기만 읽는 글자. */
export const srOnly = css({
  position: "absolute",
  width: "1px",
  height: "1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
});
