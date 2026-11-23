"use client";

import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { css } from "styled-system/css";
import { hasSeenOnboarding, markOnboardingSeen } from "@/lib/identity";
import { Button } from "@/ui/button";
import { BagIcon, CoinIcon, HouseIcon, PencilIcon } from "@/ui/icons";
import { OnboardingDialog, type OnboardingSlide } from "@/ui/onboarding-dialog";
import type { RoomPageKey } from "./room-header";
import { canMutateAtom } from "./state";

/** 방 온보딩: 방 화면 사용법(DV-26). 장마다 헤더 탭 하나(현황·기록·정산·방)를 지금 쓰는 순서대로 설명한다. */
const ROOM_SLIDES: readonly OnboardingSlide[] = [
  {
    title: "현황에서 손익을 봐요",
    body: "누적 손익과 거래 내역이 모두의 화면에 바로 반영돼요. 거래를 남긴 사람과 방장은 여기서 거래를 고치거나 지울 수 있어요.",
    Icon: CoinIcon,
  },
  {
    title: "기록에서 거래를 남겨요",
    body: "누가 누구에게 얼마를 줬는지 고르고 저장하면 돼요. 방에 들어온 참여자라면 누구나 기록할 수 있어요.",
    Icon: PencilIcon,
  },
  {
    title: "정산에서 보낼 금액을 봐요",
    body: "진행 중에는 예상 정산을, 방장이 게임을 끝내면 최종 정산을 보여 줘요. 결과는 복사해서 공유할 수 있어요.",
    Icon: BagIcon,
  },
  {
    title: "방에서 친구를 불러요",
    body: "초대 링크를 복사해 보내거나 QR을 보여 주세요. 참여자 목록도 여기서 봐요.",
    Icon: HouseIcon,
  },
];

/** 장마다 보여 줄 페이지(U-31). `ROOM_SLIDES`와 같은 순서다. */
export const ROOM_SLIDE_PAGES: readonly RoomPageKey[] = ["status", "record", "settlement", "room"];

/** `방 사용법 다시 보기`가 연 상태. 방 화면 틀(`RoomShell`)의 `RoomOnboarding`이 읽는다. */
const roomOnboardingRequestedAtom = atom(false);

/**
 * 방 온보딩(U-30, FD-33). 이 브라우저에서 처음으로 **기록할 수 있는 방**(데이터가 보이고 진행 중이며 본인이 활성,
 * `canMutate`)을 보면 한 번 연다. 끝난 방·조회 전용·연결 전에는 저절로 열지 않는다. 방마다가 아니라 브라우저에 한 번이다.
 * 장이 바뀌면 `onShowPage`로 그 장이 설명하는 페이지를 알린다(U-31: 뒤 화면이 현황 → 기록 → 정산 → 방으로 함께 바뀐다).
 * 닫으면 그 페이지에 머문다.
 */
export function RoomOnboarding({ onShowPage }: { onShowPage?: (page: RoomPageKey) => void }) {
  const canMutate = useAtomValue(canMutateAtom);
  const [requested, setRequested] = useAtom(roomOnboardingRequestedAtom);
  const [dismissed, setDismissed] = useState(() => hasSeenOnboarding("room"));
  if (!requested && (dismissed || !canMutate)) return null;
  return (
    <OnboardingDialog
      slides={ROOM_SLIDES}
      onSlideChange={(index) => onShowPage?.(ROOM_SLIDE_PAGES[index]!)}
      onClose={() => {
        markOnboardingSeen("room");
        setDismissed(true);
        setRequested(false);
      }}
    />
  );
}

/** `방` 페이지 맨 아래의 다시 보기 버튼. 설명이 진행 중 방의 사용법이라 끝난 방에서는 그리지 않는다. */
export function RoomOnboardingButton() {
  const canMutate = useAtomValue(canMutateAtom);
  const setRequested = useSetAtom(roomOnboardingRequestedAtom);
  if (!canMutate) return null;
  return (
    <div className={css({ mt: "6" })}>
      <Button variant="secondary" onClick={() => setRequested(true)}>
        방 사용법 다시 보기
      </Button>
    </div>
  );
}
