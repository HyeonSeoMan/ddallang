"use client";

import { type ReactNode, useId } from "react";
import { css } from "styled-system/css";
import { useAtomValue } from "jotai";
import { connectionPhaseAtom } from "@/features/realtime/state";
import { BagIcon, BookIcon, CoinIcon, HouseIcon, PencilIcon, PeopleIcon } from "@/ui/icons";
import { SectionSkeleton, type SkeletonShape } from "@/ui/skeleton";
import { canMutateAtom, dataVisibleAtom, readOnlySelfAtom } from "./state";
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

/** 구역 제목 곁의 장식 아이콘(FD-18 (3)). 아이콘은 `aria-hidden`이라 제목의 접근 가능한 이름은 그대로다. */
const SECTION_ICONS: Record<RoomSectionId, (props: { size?: number }) => ReactNode> = {
  info: HouseIcon,
  balances: CoinIcon,
  settlement: BagIcon,
  entry: PencilIcon,
  transactions: BookIcon,
  participants: PeopleIcon,
};

/** 데이터 영역이 가려질 때의 스켈레톤 모양(FD-29, DV-23). */
const SKELETON_SHAPES: Record<RoomSectionId, SkeletonShape> = {
  info: "lines",
  balances: "rows",
  settlement: "rows",
  entry: "form",
  transactions: "rows",
  participants: "rows",
};

/**
 * 구역 제목은 항상 보이고, 본문은 `ServerDataGate` 아래에만 그린다. 제목은 카드 밖 회색 바탕 위에 있고(DV-13)
 * 본문이 그 아래 흰 카드다(그림자 없음, FD-18).
 */
export function RoomSection({
  id,
  title = ROOM_SECTION_TITLES[id],
  children,
  after,
}: {
  id: RoomSectionId;
  title?: string;
  children?: ReactNode;
  /** 카드 아래 바탕 위에 두는 요소(정산의 `게임 종료`, 시안). 본문과 같이 게이트 아래에서만 그린다. */
  after?: ReactNode;
}) {
  const headingId = useId();
  // 서버 유래 값에 따라 달라지는 제목(`titles`)은 게이트가 열렸을 때만 쓴다. 끊김 중에는 기본 제목이다.
  const visible = useAtomValue(dataVisibleAtom);
  const canMutate = useAtomValue(canMutateAtom);
  const readOnly = useAtomValue(readOnlySelfAtom);
  // 401·404로 재시도하지 않는 상태(S5 §6.6)는 기다려도 데이터가 오지 않으므로 스켈레톤을 그리지 않는다(Q-C7).
  const inaccessible = useAtomValue(connectionPhaseAtom) === "inaccessible";
  const loading = !visible && !inaccessible;
  const heading = visible ? title : ROOM_SECTION_TITLES[id];
  const SectionIcon = SECTION_ICONS[id];
  // 구역 구조는 바꾸지 않는다(FD-12). 첫 로딩·끊김 중에는 카드 안에 값 없는 스켈레톤을 그린다(FD-29, 가려진 이유는
  // 연결 배너가 알린다). 접근 불가 상태, 그리고 데이터가 보이는데 게임이 끝나 거래 입력 폼이 없는 거래 입력 구역은
  // 바탕 위 제목만 남고 카드가 없다(S2 §9, 방향 문서 §5.1). 조회 전용 본인은 비활성화된 폼이 있으므로 카드를 그린다(FD-26).
  const compact = (!visible && inaccessible) || (visible && id === "entry" && !canMutate && !readOnly);
  return (
    <section
      aria-labelledby={headingId}
      data-section={id}
      // 구역 사이 28px, 첫 구역(연결 배너 바로 뒤 포함)은 12px(DV-13, 시안 `.sec-head`).
      className={css({ mt: "7", _firstOfType: { mt: "3" } })}
      data-compact={compact ? "true" : undefined}
      aria-busy={loading ? true : undefined}
    >
      <h2
        id={headingId}
        className={css({ display: "flex", alignItems: "center", gap: "2", px: "1", fontSize: "xl", fontWeight: "bold" })}
      >
        <SectionIcon size={28} />
        {heading}
      </h2>
      {compact ? (
        <ServerDataGate>{children}</ServerDataGate>
      ) : (
        <div className={css({ mt: "3", p: "5", bgColor: "paper", borderRadius: "lg" })}>
          {visible ? <ServerDataGate>{children}</ServerDataGate> : <SectionSkeleton shape={SKELETON_SHAPES[id]} />}
        </div>
      )}
      {after ? <ServerDataGate>{after}</ServerDataGate> : null}
    </section>
  );
}

export interface RoomSectionsProps {
  /** 그릴 구역. 생략하면 전부이며 순서는 항상 `ROOM_SECTION_TITLES`의 순서(FD-12)다. */
  only?: readonly RoomSectionId[];
  slots?: Partial<Record<RoomSectionId, ReactNode>>;
  /** 구역 카드 아래 바탕 위 요소. */
  after?: Partial<Record<RoomSectionId, ReactNode>>;
  /** 구역 제목 바꾸기. 데이터 영역이 보일 때만 적용되고 끊김 중에는 기본 제목이다. */
  titles?: Partial<Record<RoomSectionId, string>>;
}

/** 컨테이너 없는 구역 묶음. 페이지(현황·기록·정산·방)는 자기 구역만 골라 쓴다(FD-12 개정, 페이지 분리). */
export function RoomSections({ only, slots = {}, titles = {}, after = {} }: RoomSectionsProps) {
  const ids = (Object.keys(ROOM_SECTION_TITLES) as RoomSectionId[]).filter((id) => !only || only.includes(id));
  return (
    <>
      {ids.map((id) => (
        <RoomSection key={id} id={id} title={titles[id]} after={after[id]}>
          {slots[id]}
        </RoomSection>
      ))}
    </>
  );
}

export interface RoomLayoutProps extends RoomSectionsProps {
  /** 연결 배너 자리(S5-4). 서버 유래 값을 담지 않으므로 게이트 밖이다. */
  banner?: ReactNode;
  /** 화면 아래에 떠 있는 요소. 마지막 구역을 가리지 않도록 스스로 자리를 만든다. */
  floating?: ReactNode;
}

/** 모바일 우선 한 열(가로 스크롤 없음). 구역을 전부 한 화면에 쌓는 이전 구성이며 시험과 비교용으로 남겨 둔다. */
export function RoomLayout({ banner, floating, ...sections }: RoomLayoutProps) {
  return (
    <div className={css({ maxW: "md", mx: "auto", p: "4" })}>
      {banner}
      <RoomSections {...sections} />
      {floating}
    </div>
  );
}
