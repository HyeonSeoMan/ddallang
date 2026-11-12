import { css } from "styled-system/css";

// 방 생성 화면 자리(FE-S1-1이 채운다).
export default function HomePage() {
  return (
    <main className={css({ p: "4" })}>
      <h1 className={css({ fontSize: "2xl", fontWeight: "bold" })}>DDALLANG</h1>
    </main>
  );
}
