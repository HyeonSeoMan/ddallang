"use client";

import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { css } from "styled-system/css";
import { useAnnounce } from "@/ui/announcer";
import { Banner } from "@/ui/banner";
import { CheckIcon, InfoIcon, OfflineIcon } from "@/ui/icons";
import type { ConnectionPhase } from "./connection";
import { connectionPhaseAtom } from "./state";

/** 끊김 중 서버 유래 영역을 가린 이유와 복구 방법(plan §7). */
export const HIDDEN_GUIDANCE = "연결이 끊겨 최신 정보를 표시할 수 없습니다. 연결되면 자동으로 다시 표시됩니다.";
export const LIMIT_MESSAGE = "이 방을 연 화면이 너무 많습니다. 다른 탭을 닫아 주세요. 잠시 뒤 자동으로 다시 시도합니다.";
export const INACCESSIBLE_MESSAGE = "이 방에 접근할 수 없습니다. 초대 링크로 다시 입장해 주세요.";

interface BannerContent {
  tone: "info" | "warning" | "error" | "success";
  title: string;
  /** 서버 유래 영역이 가려져 있을 때 덧붙이는 설명. */
  detail?: string;
}

/** 연결 단계 → 배너 문구. `connected`는 배너가 없다. */
export function bannerFor(phase: ConnectionPhase): BannerContent | null {
  switch (phase) {
    case "connecting":
      return { tone: "info", title: "연결 중", detail: "연결되면 방 정보가 표시됩니다." };
    case "reconnecting":
      return { tone: "warning", title: "연결 끊김 · 다시 연결 중", detail: HIDDEN_GUIDANCE };
    case "offline":
      return { tone: "warning", title: "연결 끊김 · 네트워크에 연결되어 있지 않습니다", detail: HIDDEN_GUIDANCE };
    case "limit":
      return { tone: "error", title: "연결 끊김", detail: LIMIT_MESSAGE };
    case "inaccessible":
      return { tone: "error", title: "연결할 수 없음", detail: INACCESSIBLE_MESSAGE };
    case "recovered":
      return { tone: "success", title: "최신 상태로 갱신됨" };
    case "revoked":
      return null; // 방 화면을 닫고 초대 화면이 접근 상실 배너를 보인다(FD-21)
    case "connected":
      return null;
  }
}

/** 띠 왼쪽 장식 아이콘(방향 문서 §4 띠): info = 안내, warning·error = 끊김, success = 완료. */
function BannerIcon({ tone }: { tone: BannerContent["tone"] }) {
  if (tone === "success") return <CheckIcon size={20} />;
  if (tone === "info") return <InfoIcon size={20} />;
  return <OfflineIcon size={20} />;
}

/**
 * 연결 배너(FE-S5-4, S5 §6.5): 상시 영역이다. 끊김·재연결·복구·한도·접근 불가를 알리고, 이전 값이나
 * "최신 아님" 표시는 보이지 않는다(서버 유래 영역은 `ServerDataGate`가 가린다). 이 배너는 서버 유래 값을 담지 않는다.
 */
export function ConnectionBanner() {
  const phase = useAtomValue(connectionPhaseAtom);
  const announce = useAnnounce();
  const content = bannerFor(phase);

  // 끊김 중에는 알림 영역에 남아 있던 지난 문구(예: "거래를 저장했습니다.")를 비운다. 배너가 현재 상태를 알린다.
  const hidden = phase !== "connected" && phase !== "recovered";
  useEffect(() => {
    if (hidden) announce("");
  }, [hidden, announce]);

  if (!content) return null;
  return (
    <div data-connection-phase={phase}>
      <Banner tone={content.tone} icon={<BannerIcon tone={content.tone} />}>
        {/* 리셋의 `strong { font-weight: bolder }`가 600을 900으로 만들지 않게 굵기를 정한다(띠 제목 14/600). */}
        <strong className={css({ fontWeight: "semibold" })}>{content.title}</strong>
        {/* 상세는 다음 줄 14/400. 앞 공백은 이어 읽을 때 제목과 붙지 않게 둔다. */}
        {content.detail ? <span className={css({ display: "block", fontWeight: "normal" })}> {content.detail}</span> : null}
      </Banner>
    </div>
  );
}
