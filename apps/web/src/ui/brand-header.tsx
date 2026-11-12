import { css } from "styled-system/css";
import { BellIcon } from "./icons";

/** 카드: 회색 바탕 위에 뜬 흰 면(FD-18). 홈·입장 화면처럼 구역이 없는 화면이 쓴다. */
export const cardClass = css({ bg: "paper", p: "5", borderRadius: "lg", boxShadow: "card" });

/** 화면 맨 위의 서비스 이름. 방울 아이콘은 장식이라 제목의 접근 가능한 이름은 `DDALLANG` 그대로다. */
export function BrandHeader() {
  return (
    <h1
      className={css({ display: "flex", alignItems: "center", gap: "2", fontSize: "2xl", fontWeight: "bold", mb: "4" })}
    >
      <BellIcon size={36} />
      DDALLANG
    </h1>
  );
}
