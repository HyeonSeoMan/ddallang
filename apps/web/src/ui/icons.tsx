import type { ReactNode } from "react";
import { css, cx } from "styled-system/css";

/**
 * 단색 2톤 아이콘(FD-18). 새 아이콘 라이브러리를 쓰지 않고 코드 안의 SVG로 둔다. 모두 장식이라 보조기기에는
 * 숨기며(`aria-hidden`), 의미를 전해야 하면 곁에 텍스트를 둔다. 아래로 떨어지는 은은한 그림자로 깊이를 준다.
 */
export interface IconProps {
  /** 한 변의 픽셀 크기. */
  size?: number;
  className?: string;
}

const shadow = css({ filter: "drop-shadow(0 4px 5px rgba(0, 0, 0, 0.2))", flex: "none" });

function Icon({ size = 40, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cx(shadow, className)}
    >
      {children}
    </svg>
  );
}

/** 노랑 ₩ 코인. 글리프는 글꼴 글자가 아니라 도형이라 글꼴 로딩과 무관하다. */
export function CoinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="24" cy="24" r="21" fill="#f8bd3e" />
      <path
        d="M14 16.500 18.500 32 24 17.500 29.500 32 34 16.500M12.500 22.500h23M13.500 27.500h21"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Icon>
  );
}

/** 딸랑 방울. */
export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="24" cy="6.500" r="3" fill="#f0a91c" />
      <path d="M24 8.500c-7.500 0-12.500 5.200-12.500 12.500v7L8 33h32l-3.500-5v-7c0-7.300-5-12.500-12.500-12.500z" fill="#ffc93c" />
      <rect x="7" y="32" width="34" height="6" rx="3" fill="#f0a91c" />
      <circle cx="24" cy="42" r="4" fill="#e59a14" />
    </Icon>
  );
}

/** 정산 돈주머니. */
export function BagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M17 17c-5.500 4-9 9.500-9 16 0 6.500 6 10 16 10s16-3.500 16-10c0-6.500-3.500-12-9-16z" fill="#f8bd3e" />
      <path
        d="M16 8.500c0-1 .8-1.500 1.800-1.200 2 .6 3.400 1.200 6.200 1.200s4.200-.6 6.200-1.200c1-.3 1.800.2 1.800 1.200V15c0 1.400-1 2.500-2.500 2.500h-11C17 17.500 16 16.400 16 15z"
        fill="#d98d1b"
      />
      <path
        d="M16.500 28l3.500 9 4-9 4 9 3.500-9M15.500 31.500h17"
        stroke="#ffffff"
        strokeWidth="2.600"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Icon>
  );
}

/** 거래 내역 노트. */
export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="4" width="30" height="40" rx="6" fill="#3f97f3" />
      <path d="M29 4h4a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6h-4z" fill="#2a78d8" />
      <rect x="15" y="10" width="8" height="7" rx="2" fill="#ffffff" />
    </Icon>
  );
}

/** 참여자 두 사람. */
export function PeopleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="31" cy="15" r="7.500" fill="#59b57d" />
      <path d="M19 40c0-7 5-11.500 12-11.500S43 33 43 40z" fill="#3d9460" />
      <circle cx="17" cy="18" r="8.500" fill="#ffd45e" />
      <path d="M3 43c0-8.500 6-14 14-14s14 5.500 14 14z" fill="#f4b62a" />
    </Icon>
  );
}
