"use client";

import { useEffect } from "react";
import { wakeApi } from "@/lib/wake-api";

/** 문서가 열릴 때 한 번 백엔드를 깨운다(`wakeApi`). 화면에는 아무것도 그리지 않는다. */
export function ApiWakeUp() {
  useEffect(() => {
    wakeApi();
  }, []);
  return null;
}
