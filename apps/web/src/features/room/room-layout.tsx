"use client";

import { type ReactNode, useId } from "react";
import { css } from "styled-system/css";
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

/** 구역 제목은 항상 보이고, 본문은 `ServerDataGate` 아래에만 그린다. */
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
  return (
    <section aria-labelledby={headingId} data-section={id} className={css({ mt: "5" })}>
      <h2 id={headingId} className={css({ fontSize: "lg", fontWeight: "bold", mb: "2" })}>
        {title}
      </h2>
      <ServerDataGate>{children}</ServerDataGate>
    </section>
  );
}

export interface RoomLayoutProps {
  /** 연결 배너 자리(S5-4). 서버 유래 값을 담지 않으므로 게이트 밖이다. */
  banner?: ReactNode;
  slots?: Partial<Record<RoomSectionId, ReactNode>>;
  /** 구역 제목 바꾸기(서버 유래 값에 따라 달라지는 제목은 게이트를 통과한 뒤에만 넘긴다). */
  titles?: Partial<Record<RoomSectionId, string>>;
}

/** 모바일 우선 한 열(가로 스크롤 없음). 각 Task가 자기 구역의 `slots`를 채운다. */
export function RoomLayout({ banner, slots = {}, titles = {} }: RoomLayoutProps) {
  return (
    <div className={css({ maxW: "md", mx: "auto", p: "4" })}>
      {banner}
      {(Object.keys(ROOM_SECTION_TITLES) as RoomSectionId[]).map((id) => (
        <RoomSection key={id} id={id} title={titles[id]}>
          {slots[id]}
        </RoomSection>
      ))}
    </div>
  );
}
