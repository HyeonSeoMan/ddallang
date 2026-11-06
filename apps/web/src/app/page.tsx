import { css } from "styled-system/css";
import { Counter } from "@/components/counter";

export default function HomePage() {
  return (
    <main
      className={css({
        minH: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "6",
        bg: "stone.900",
        color: "stone.50",
      })}
    >
      <h1 className={css({ fontSize: "5xl", fontWeight: "extrabold", letterSpacing: "wider" })}>
        DDALLANG
      </h1>
      <Counter />
    </main>
  );
}
