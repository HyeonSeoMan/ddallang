"use client";

import { useAtomValue } from "jotai";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { css, cva } from "styled-system/css";
import { pendingBadgeLabel } from "@/features/claims/messages";
import { Badge } from "@/ui/badge";
import { dataVisibleAtom, snapshotAtom } from "./state";

export type RoomPageKey = "status" | "record" | "settlement" | "room";

interface Tab {
  key: RoomPageKey;
  label: string;
  suffix: string;
}

/** 방 화면의 페이지(페이지 분리): 주소는 모두 초대 링크 아래다(U-3 유지). */
const TABS: readonly Tab[] = [
  { key: "status", label: "현황", suffix: "" },
  { key: "record", label: "기록", suffix: "/record" },
  { key: "settlement", label: "정산", suffix: "/settlement" },
  { key: "room", label: "방", suffix: "/room" },
];

export const roomBasePath = (inviteCode: string) => `/invite/${encodeURIComponent(inviteCode)}`;

/** 페이지의 주소. 방 온보딩이 장마다 해당 페이지로 옮길 때 쓴다(FD-33). */
export function roomPagePath(inviteCode: string, key: RoomPageKey): string {
  return `${roomBasePath(inviteCode)}${TABS.find((tab) => tab.key === key)!.suffix}`;
}

/** 현재 경로가 어느 페이지인지. 경로를 모르면(시험·초기 렌더) 현황이다. */
export function pageOfPath(pathname: string | null, inviteCode: string): RoomPageKey {
  if (!pathname) return "status";
  const base = roomBasePath(inviteCode);
  for (const tab of TABS) {
    if (tab.suffix && pathname === `${base}${tab.suffix}`) return tab.key;
  }
  return "status";
}

/** 탭(DV-9): 글자만. 선택 = `ink` 16/700 + 아래 2px `ink` 밑줄, 비선택 = `inkMuted` 16/500. 터치 영역 44px 이상. */
const tab = cva({
  base: {
    flex: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minH: "touch",
    pt: "3",
    pb: "2.5",
    fontSize: "md",
    textDecoration: "none",
    borderBottomWidth: "2px",
  },
  variants: {
    current: {
      true: { color: "ink", fontWeight: "bold", borderBottomColor: "ink" },
      false: { color: "inkMuted", fontWeight: "medium", borderBottomColor: "transparent" },
    },
  },
});

/** 탭 이름 옆 숫자 배지(plan §7 2.0.0). 읽기용 이름은 탭 링크의 `aria-label`로 준다. */
const countBadgeClass = css({
  ml: "1",
  minW: "5",
  h: "5",
  px: "1.5",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "full",
  bgColor: "danger",
  color: "dangerText",
  fontSize: "xs",
  fontWeight: "bold",
});

/**
 * 위쪽에 붙는 방 헤더와 페이지 탭(FD-12 개정, 방향 문서 §5.1). 화면 폭 전체의 흰 막대이고(위쪽 안전 영역까지 흰색)
 * 안의 방 이름·탭은 본문과 같은 열 폭에 맞춘다. 로고·그림자·흐림은 없다. 방 이름·진행 상태는 서버 유래 값이라
 * 데이터가 가려진 동안(끊김)에는 보이지 않고 `DDALLANG`만 남는다. 게임이 끝나면 `기록` 탭이 사라진다(S2 §9).
 */
export function RoomHeader({ inviteCode }: { inviteCode: string }) {
  const pathname = usePathname();
  const snapshot = useAtomValue(snapshotAtom);
  const visible = useAtomValue(dataVisibleAtom);
  const ended = visible && snapshot?.room.status === "ENDED";
  const base = roomBasePath(inviteCode);
  const current = pageOfPath(pathname, inviteCode);
  const tabs = TABS.filter((tab) => !(ended && tab.key === "record"));
  // 방장의 대기 중인 이어받기 요청 수(FD-24). 서버 유래 값이라 데이터가 가려진 동안(끊김)에는 숨긴다(FD-12).
  const pending = visible && snapshot?.me.isHost ? snapshot.claims.length : 0;

  return (
    // 고정 래퍼가 흰 바탕을 화면 폭 전체와 위쪽 안전 영역까지 칠한다. 아래 경계는 장식 구분선이다(RK-F20).
    <div
      data-testid="room-header-sticky"
      className={css({
        position: "sticky",
        top: "0",
        zIndex: 20,
        bgColor: "paper",
        pt: "env(safe-area-inset-top, 0px)",
        borderBottomWidth: "1px",
        borderBottomColor: "divider",
      })}
    >
      <header className={css({ maxW: "md", mx: "auto", px: "4", pt: "2" })}>
        <div className={css({ display: "flex", alignItems: "center", gap: "2", minH: "36px" })}>
          <h1
            className={css({
              flex: "0 1 auto",
              minW: "0",
              fontSize: "xl",
              fontWeight: "bold",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            })}
          >
            {visible && snapshot ? snapshot.room.name : "DDALLANG"}
          </h1>
          {visible && snapshot ? <Badge tone={ended ? "neutral" : "info"}>{ended ? "게임 종료" : "진행 중"}</Badge> : null}
        </div>
        <nav aria-label="방 페이지" className={css({ display: "flex", gap: "1", mt: "1" })}>
          {tabs.map(({ key, label, suffix }) => (
            <Link
              key={key}
              href={`${base}${suffix}`}
              aria-current={current === key ? "page" : undefined}
              aria-label={key === "room" && pending > 0 ? `${label} ${pendingBadgeLabel(pending)}` : undefined}
              className={tab({ current: current === key })}
            >
              {label}
              {key === "room" && pending > 0 ? (
                <span aria-hidden="true" className={countBadgeClass}>
                  {pending}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      </header>
    </div>
  );
}
