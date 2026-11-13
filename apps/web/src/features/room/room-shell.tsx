"use client";

import { useAtomValue } from "jotai";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { css } from "styled-system/css";
import { ConnectionBanner } from "@/features/realtime/connection-banner";
import { RoomHeader, roomBasePath } from "./room-header";
import { dataVisibleAtom, snapshotAtom } from "./state";

/**
 * 게임이 끝난 방: `기록`은 쓸 수 없으므로 정산으로 보낸다(S2 §9). 처음 들어온 곳이 현황이면 정산에서 시작한다
 * (종료 직후 최종 정산이 눈에 띄게, FD-12). 그 뒤 사용자가 직접 현황을 누르면 막지 않는다.
 * 라우터가 필요하므로 경로를 알 수 있을 때(실제 앱)만 그린다.
 */
function EndedRedirect({ inviteCode, pathname }: { inviteCode: string; pathname: string }) {
  const router = useRouter();
  const snapshot = useAtomValue(snapshotAtom);
  const visible = useAtomValue(dataVisibleAtom);
  const ended = visible && snapshot?.room.status === "ENDED";
  const landed = useRef(false);

  useEffect(() => {
    if (!ended) return;
    const base = roomBasePath(inviteCode);
    if (pathname === `${base}/record` || (!landed.current && pathname === base)) {
      router.replace(`${base}/settlement`);
    }
    landed.current = true;
  }, [ended, pathname, inviteCode, router]);

  return null;
}

/**
 * 방 화면의 공통 틀(레이아웃). 헤더 탭·연결 배너를 한 번만 그리고 현재 페이지(`children`)를 그 아래에 둔다.
 * 실시간 연결과 방 스냅샷은 이 틀 위(`InviteScreen`)에 있어 페이지를 옮겨도 다시 연결하지 않는다(S5 §4.1의 연결 한도).
 */
export function RoomShell({ inviteCode, children }: { inviteCode: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className={css({ maxW: "md", mx: "auto", px: "4", pb: "4" })}>
      {pathname ? <EndedRedirect inviteCode={inviteCode} pathname={pathname} /> : null}
      <RoomHeader inviteCode={inviteCode} />
      <ConnectionBanner />
      {children}
    </div>
  );
}
