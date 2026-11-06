"use client";

import { useAtom } from "jotai";
import { css } from "styled-system/css";
import { countAtom } from "@/state/counter";

export function Counter() {
  const [count, setCount] = useAtom(countAtom);

  return (
    <button
      type="button"
      onClick={() => setCount((value) => value + 1)}
      className={css({
        px: "6",
        py: "3",
        rounded: "full",
        bg: "amber.400",
        color: "stone.900",
        fontWeight: "bold",
        cursor: "pointer",
        _hover: { bg: "amber.300" },
      })}
    >
      딸랑 {count}
    </button>
  );
}
