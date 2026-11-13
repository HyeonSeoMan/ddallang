"use client";

import { useEffect } from "react";
import { wakeApiOnce } from "@/lib/wake-api";

/** 문서가 열릴 때 한 번 백엔드를 깨운다(`wakeApiOnce`, StrictMode에서도 1회). 화면에는 아무것도 그리지 않는다. */
export function ApiWakeUp() {
  useEffect(() => {
    wakeApiOnce();
  }, []);
  return null;
}
