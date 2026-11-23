"use client";

import { type ReactNode, useId, useState } from "react";
import { css, cx } from "styled-system/css";
import { hasSeenOnboarding, markOnboardingSeen } from "@/lib/identity";
import { cardClass } from "@/ui/brand-header";
import { Button } from "@/ui/button";
import { BagIcon, BellIcon, HouseIcon, PeopleIcon } from "@/ui/icons";
import { OnboardingDialog, type OnboardingSlide } from "@/ui/onboarding-dialog";

const STEPS: ReadonlyArray<{ title: string; body: string; Icon: (props: { size?: number }) => ReactNode }> = [
  { title: "방 만들기", body: "방 이름과 정산 단위, 내 닉네임만 정하면 돼요. 회원가입은 없어요.", Icon: HouseIcon },
  {
    title: "링크·QR로 초대",
    body: "방 화면의 초대 링크를 보내거나 QR을 보여 주면, 친구가 닉네임만 넣고 들어와요.",
    Icon: PeopleIcon,
  },
  {
    title: "기록하고 정산",
    body: "누가 누구에게 얼마를 줬는지 기록하면 손익이 모두의 화면에 바로 쌓이고, 게임을 끝내면 보낼 금액을 알려 줘요.",
    Icon: BagIcon,
  },
];

/** 홈 온보딩: 서비스 소개(DV-25). 방 화면 사용법은 방 온보딩(DV-26)이 따로 맡는다. */
const HOME_SLIDES: readonly OnboardingSlide[] = [
  {
    title: "모임의 돈·점수를 함께 기록해요",
    body: "보드게임이나 카드게임처럼 여럿이 돈이나 점수를 주고받는 자리에서 누가 누구에게 얼마를 줬는지 한곳에 모아요.",
    Icon: BellIcon,
  },
  {
    title: "가입 없이 링크 하나로",
    body: "방을 만들고 초대 링크나 QR을 보내면 친구는 닉네임만 넣고 들어와요. 기록은 모두의 화면에 바로 보여요.",
    Icon: PeopleIcon,
  },
  {
    title: "끝나면 정산까지 한 번에",
    body: "게임을 끝내면 각자의 손익과 누가 누구에게 얼마를 보내면 되는지 알려 줘요. 결과는 복사해서 단톡방에 붙여 넣으면 돼요.",
    Icon: BagIcon,
  },
];

/**
 * 홈의 사용 순서 카드(DV-24)와 첫 방문 소개(DV-25). 소개는 이 브라우저에서 처음 홈을 열 때 한 번 열리고,
 * 카드의 `딸랑 소개 다시 보기`로 다시 연다. 순서는 목록 대신 단계마다 제목으로 나눈다(홈에는 목록이 없다, AC-ROOM-002-3 시험).
 */
export function HomeGuide() {
  const headingId = useId();
  const [open, setOpen] = useState(() => !hasSeenOnboarding("home"));

  return (
    <>
      <section aria-labelledby={headingId} className={cx(cardClass, css({ mt: "4" }))}>
        <h2 id={headingId} className={css({ fontSize: "xl", fontWeight: "bold", mb: "4" })}>
          이렇게 써요
        </h2>
        <div className={css({ display: "flex", flexDirection: "column", gap: "4", mb: "5" })}>
          {STEPS.map(({ title, body, Icon }, index) => (
            <div key={title} data-testid="home-step" className={css({ display: "flex", gap: "3", alignItems: "flex-start" })}>
              <Icon size={40} />
              <div className={css({ display: "flex", flexDirection: "column", gap: "1", minW: "0" })}>
                <h3 className={css({ fontSize: "md", fontWeight: "bold" })}>
                  {index + 1}. {title}
                </h3>
                <p className={css({ color: "inkMuted", fontSize: "sm", fontWeight: "medium", wordBreak: "keep-all" })}>
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          딸랑 소개 다시 보기
        </Button>
      </section>
      {open && (
        <OnboardingDialog
          slides={HOME_SLIDES}
          onClose={() => {
            markOnboardingSeen("home");
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
