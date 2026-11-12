"use client";

import { type ReactNode, useRef, useSyncExternalStore } from "react";
import { css } from "styled-system/css";
import {
  CAPABILITY_LABELS,
  type CapabilityId,
  detectMissingCapabilities,
} from "@/lib/capabilities";

const subscribe = () => () => undefined;
const serverSnapshot = () => null;

/**
 * 진입 시 필수 기능 5개를 검사한다(S5 §3.1). 하나라도 없으면 **앱 본문을 렌더링하지 않고**
 * 없는 기능을 안내한다. 검사는 브라우저에서만 가능하므로 서버 렌더링과 검사 전에는 본문을 그리지 않는다.
 */
export function FeatureGate({
  children,
  detect = detectMissingCapabilities,
}: {
  children: ReactNode;
  detect?: () => CapabilityId[];
}) {
  // 검사는 저장소에 쓰기 때문에 렌더링마다 반복하지 않고 `detect`별로 한 번만 한다.
  const cache = useRef<{ detect: typeof detect; value: string } | null>(null);
  const missingKey = useSyncExternalStore(
    subscribe,
    () => {
      if (cache.current?.detect !== detect) cache.current = { detect, value: detect().join(",") };
      return cache.current.value;
    },
    serverSnapshot,
  );

  if (missingKey === null) return null;
  if (missingKey === "") return <>{children}</>;

  const missing = missingKey.split(",") as CapabilityId[];
  return (
    <main className={css({ p: "4", maxW: "md", mx: "auto" })}>
      <h1 className={css({ fontSize: "xl", fontWeight: "bold", mb: "2" })}>
        이 브라우저에서는 사용할 수 없습니다
      </h1>
      <p>
        필요한 기능이 없습니다: {missing.map((id) => CAPABILITY_LABELS[id]).join(", ")}. 최신 Chrome,
        Edge, Firefox, Safari로 열어 주세요.
      </p>
    </main>
  );
}
