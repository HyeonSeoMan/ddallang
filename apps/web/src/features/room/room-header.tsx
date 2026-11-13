"use client";

import { useAtomValue } from "jotai";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { css, cx } from "styled-system/css";
import { BagIcon, BellIcon, BookIcon, CoinIcon, PeopleIcon } from "@/ui/icons";
import { dataVisibleAtom, snapshotAtom } from "./state";

export type RoomPageKey = "status" | "record" | "settlement" | "room";

interface Tab {
  key: RoomPageKey;
  label: string;
  suffix: string;
  Icon: (props: { size?: number }) => React.ReactNode;
}

/** 방 화면의 페이지(페이지 분리): 주소는 모두 초대 링크 아래다(U-3 유지). */
const TABS: readonly Tab[] = [
  { key: "status", label: "현황", suffix: "", Icon: CoinIcon },
  { key: "record", label: "기록", suffix: "/record", Icon: BookIcon },
  { key: "settlement", label: "정산", suffix: "/settlement", Icon: BagIcon },
  { key: "room", label: "방", suffix: "/room", Icon: PeopleIcon },
];

export const roomBasePath = (inviteCode: string) => `/invite/${encodeURIComponent(inviteCode)}`;

/** 현재 경로가 어느 페이지인지. 경로를 모르면(시험·초기 렌더) 현황이다. */
export function pageOfPath(pathname: string | null, inviteCode: string): RoomPageKey {
  if (!pathname) return "status";
  const base = roomBasePath(inviteCode);
  for (const tab of TABS) {
    if (tab.suffix && pathname === `${base}${tab.suffix}`) return tab.key;
  }
  return "status";
}

/**
 * 위에 떠 있는 방 헤더와 페이지 탭(FD-12 개정). 방 이름·진행 상태는 서버 유래 값이라 데이터가 가려진 동안(끊김)에는
 * 보이지 않고 `DDALLANG`만 남는다. 게임이 끝나면 거래를 입력할 수 없으므로 `기록` 탭이 사라진다(S2 §9).
 */
export function RoomHeader({ inviteCode }: { inviteCode: string }) {
  const pathname = usePathname();
  const snapshot = useAtomValue(snapshotAtom);
  const visible = useAtomValue(dataVisibleAtom);
  const ended = visible && snapshot?.room.status === "ENDED";
  const base = roomBasePath(inviteCode);
  const current = pageOfPath(pathname, inviteCode);
  const tabs = TABS.filter((tab) => !(ended && tab.key === "record"));

  return (
    // 위쪽 틈(안전 영역 포함)으로 스크롤되는 카드가 비치지 않도록 고정 래퍼가 캔버스 색으로 덮고, 헤더 아래는 부드럽게 사라진다.
    <div
      data-testid="room-header-sticky"
      className={css({
        position: "sticky",
        top: "0",
        zIndex: 20,
        pt: "calc(12px + env(safe-area-inset-top, 0px))",
        pb: "4",
        background: "linear-gradient(token(colors.canvas) calc(100% - 16px), transparent)",
      })}
    >
    <header
      className={css({
        p: "3",
        borderRadius: "26px",
        borderWidth: "1px",
        borderColor: "rgba(0, 0, 0, 0.06)",
        bg: "rgba(255, 255, 255, 0.86)",
        backdropFilter: "blur(18px)",
        boxShadow: "float",
      })}
    >
      <div className={css({ display: "flex", alignItems: "center", gap: "2", px: "2", pb: "2" })}>
        <BellIcon size={30} />
        <h1
          className={css({
            flex: "1",
            minW: "0",
            fontSize: "lg",
            fontWeight: "extrabold",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          })}
        >
          {visible && snapshot ? snapshot.room.name : "DDALLANG"}
        </h1>
        {visible && snapshot ? (
          <span
            className={cx(
              css({ px: "3", py: "1", borderRadius: "full", fontSize: "sm", fontWeight: "bold", boxShadow: "chip" }),
              css(ended ? { bg: "neutralBg", color: "neutralText" } : { bg: "successBg", color: "successText" }),
            )}
          >
            {ended ? "게임 종료" : "진행 중"}
          </span>
        ) : null}
      </div>
      <nav
        aria-label="방 페이지"
        className={css({ display: "grid", gap: "1", p: "1", borderRadius: "18px", bg: "paperSubtle" })}
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map(({ key, label, suffix, Icon }) => (
          <Link
            key={key}
            href={`${base}${suffix}`}
            aria-current={current === key ? "page" : undefined}
            className={cx(
              css({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "1",
                minH: "touch",
                borderRadius: "14px",
                fontSize: "sm",
                fontWeight: "semibold",
                color: "ink",
                textDecoration: "none",
              }),
              current === key
                ? css({ bg: "primary", color: "primaryText", fontWeight: "extrabold", boxShadow: "button" })
                : undefined,
            )}
          >
            <Icon size={22} />
            {label}
          </Link>
        ))}
      </nav>
    </header>
    </div>
  );
}
