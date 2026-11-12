"use client";

import { type ReactNode, useId } from "react";
import { css } from "styled-system/css";
import { useAtomValue } from "jotai";
import { BagIcon, BellIcon, BookIcon, CoinIcon, PeopleIcon } from "@/ui/icons";
import { canMutateAtom, dataVisibleAtom } from "./state";
import { ServerDataGate } from "./server-data-gate";

/** 방 화면 구역 순서(FD-12, 제안): 연결 배너 → 방 정보 → 누적 손익 → 정산 → 거래 입력 → 거래 내역 → 참여자. */
export const ROOM_SECTION_TITLES = {
  info: "방 정보",
  balances: "누적 손익",
  /** 기본 제목. S4-2가 `kind`에 따라 `예상 정산`·`최종 정산`으로 바꾼다(`titles`). */
  settlement: "정산",
  entry: "거래 입력",
  transactions: "거래 내역",
  participants: "참여자",
} as const;

export type RoomSectionId = keyof typeof ROOM_SECTION_TITLES;

/** 구역 제목 곁의 장식 아이콘(FD-18). 아이콘은 `aria-hidden`이라 제목의 접근 가능한 이름은 그대로다. */
const SECTION_ICONS: Record<RoomSectionId, (props: { size?: number }) => ReactNode> = {
  info: BellIcon,
  balances: CoinIcon,
  settlement: BagIcon,
  entry: CoinIcon,
  transactions: BookIcon,
  participants: PeopleIcon,
};

/** 구역 제목은 항상 보이고, 본문은 `ServerDataGate` 아래에만 그린다. 구역은 회색 바탕 위의 흰 카드다(FD-18). */
export function RoomSection({
  id,
  title = ROOM_SECTION_TITLES[id],
  children,
}: {
  id: RoomSectionId;
  title?: string;
  children?: ReactNode;
}) {
  const headingId = useId();
  // 서버 유래 값에 따라 달라지는 제목(`titles`)은 게이트가 열렸을 때만 쓴다. 끊김 중에는 기본 제목이다.
  const visible = useAtomValue(dataVisibleAtom);
  const canMutate = useAtomValue(canMutateAtom);
  const heading = visible ? title : ROOM_SECTION_TITLES[id];
  const SectionIcon = SECTION_ICONS[id];
  // 게임이 끝나면 거래 입력 폼이 없어(S2 §9) 제목만 있는 빈 카드가 된다. 데이터가 보이는 종료 상태에서는 구역을 그리지 않는다.
  // 끊김 중에는 다른 구역과 같이 제목만 남긴다(가려진 이유는 연결 배너가 알린다).
  if (id === "entry" && visible && !canMutate) return null;
  return (
    <section
      aria-labelledby={headingId}
      data-section={id}
      className={css({ mt: "4", p: "5", bg: "paper", borderRadius: "lg", boxShadow: "card" })}
      data-hidden={visible ? undefined : "true"}
    >
      <h2
        id={headingId}
        className={css({ display: "flex", alignItems: "center", gap: "2", fontSize: "xl", fontWeight: "bold" })}
      >
        <SectionIcon size={28} />
        {heading}
      </h2>
      {/* 본문이 가려진 동안(끊김)에는 제목만 남아 카드가 무겁지 않게 제목 아래 여백을 두지 않는다. */}
      {visible ? <div className={css({ mt: "3" })}><ServerDataGate>{children}</ServerDataGate></div> : <ServerDataGate>{children}</ServerDataGate>}
    </section>
  );
}

export interface RoomLayoutProps {
  /** 연결 배너 자리(S5-4). 서버 유래 값을 담지 않으므로 게이트 밖이다. */
  banner?: ReactNode;
  slots?: Partial<Record<RoomSectionId, ReactNode>>;
  /** 구역 제목 바꾸기. 데이터 영역이 보일 때만 적용되고 끊김 중에는 기본 제목이다. */
  titles?: Partial<Record<RoomSectionId, string>>;
  /** 화면 아래에 떠 있는 요소(고정 `거래 기록하기` 버튼, U-6). 마지막 구역을 가리지 않도록 스스로 자리를 만든다. */
  floating?: ReactNode;
}

/** 모바일 우선 한 열(가로 스크롤 없음). 각 Task가 자기 구역의 `slots`를 채운다. */
export function RoomLayout({ banner, slots = {}, titles = {}, floating }: RoomLayoutProps) {
  return (
    <div className={css({ maxW: "md", mx: "auto", p: "4" })}>
      {banner}
      {(Object.keys(ROOM_SECTION_TITLES) as RoomSectionId[]).map((id) => (
        <RoomSection key={id} id={id} title={titles[id]}>
          {slots[id]}
        </RoomSection>
      ))}
      {floating}
    </div>
  );
}
