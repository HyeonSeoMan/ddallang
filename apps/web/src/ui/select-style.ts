import { css } from "styled-system/css";

/**
 * 네이티브 `<select>`의 공통 모양. 기본 화살표는 안쪽 여백을 무시하고 오른쪽 끝에 붙어 쏠려 보이므로
 * `appearance: none`으로 끄고, 안쪽 여백(16px)에 맞춘 단색 화살표를 배경으로 그린다.
 * 화살표는 코드 안의 SVG 데이터 주소라 외부 요청이 없고(FD-13), 장식이므로 접근성 트리에 나타나지 않는다.
 */
export const selectClass = css({
  minH: "touch",
  pl: "4",
  pr: "12",
  borderWidth: "2px",
  borderColor: "line",
  borderRadius: "md",
  bg: "paper",
  color: "ink",
  appearance: "none",
  cursor: "pointer",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 9l6 6 6-6' fill='none' stroke='%2355615a' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 16px center",
  backgroundSize: "16px 16px",
  _disabled: { opacity: 0.6, cursor: "not-allowed" },
});
