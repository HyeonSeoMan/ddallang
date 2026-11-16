import { type ReactNode, useId } from "react";

/**
 * 면 아이콘 12종(FD-18 (3)). 외곽선 없이 2~3색 면으로 그리고 그림자를 넣지 않는다. 새 아이콘 라이브러리를 쓰지 않고
 * 코드 안의 SVG로 둔다(그림은 `docs/design/mockup-v2.html`). 모두 장식이라 보조기기에는 숨기며(`aria-hidden`),
 * 의미를 전해야 하면 곁에 텍스트를 둔다.
 */
export interface IconProps {
  /** 한 변의 픽셀 크기. */
  size?: number;
  className?: string;
}

function Icon({ size = 40, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flex: "none" }}
    >
      {children}
    </svg>
  );
}

/** 한 화면에 같은 아이콘이 여러 번 나와도 마스크 id가 겹치지 않게 한다. */
function useMaskId(): string {
  return `m${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/** 딸랑 로고 "동전 종". 동전이 종 몸통이 되고 양옆 소리 표시로 "딸랑!"을 낸다. 홈·입장 화면에만 쓴다. */
export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <g transform="rotate(-12 24 24)">
        <circle cx="24" cy="5.5" r="3" fill="#E08A00" />
        <circle cx="24" cy="41.5" r="3.8" fill="#C86E00" />
        <path d="M12 25L8 34h32l-4-9z" fill="#FDB927" />
        <circle cx="24" cy="21" r="14" fill="#FDB927" />
        <rect x="6" y="32" width="36" height="6" rx="3" fill="#FFC93C" />
        <path
          d="M17.25 16.5l3.15 9 3.6-6.75 3.6 6.75 3.15-9"
          stroke="#FFF6E0"
          strokeWidth="3.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M14.55 21h3.15M30.3 21h3.15" stroke="#FFF6E0" strokeWidth="2.7" strokeLinecap="round" />
      </g>
      <path d="M6 13l-3-3M4.5 22.5H.5M42 13l3-3M43.5 22.5h4" stroke="#FDB927" strokeWidth="3" strokeLinecap="round" />
    </Icon>
  );
}

/** 노랑 ₩ 코인(누적 손익, 거래 행). 글리프는 글꼴 글자가 아니라 도형이라 글꼴 로딩과 무관하다. */
export function CoinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="24" cy="24" r="20" fill="#FDB927" />
      <path
        d="M14.5 17l4.5 14 5-11 5 11 4.5-14"
        stroke="#FFF6E0"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M11.5 24h5M31.5 24h5" stroke="#FFF6E0" strokeWidth="3.5" strokeLinecap="round" />
    </Icon>
  );
}

/** 초록 장부(거래 내역). */
export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="5" width="30" height="38" rx="5" fill="#00C176" />
      <path d="M31 5h3a5 5 0 015 5v28a5 5 0 01-5 5h-3z" fill="#009A5B" />
      <rect x="14" y="10" width="7" height="9" rx="2" fill="#E6FFF3" />
    </Icon>
  );
}

/** 연필(거래 입력, 직접 입력 단위). */
export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M32 9l7 7-21 21-7-7z" fill="#FFC93C" />
      <path d="M32 9l2.5-2.5a3 3 0 014.2 0l2.8 2.8a3 3 0 010 4.2L39 16z" fill="#E08A00" />
      <path d="M11 30l7 7-10.5 3.5z" fill="#FFE3A0" />
      <path d="M8.6 35.4l4 4-5.1 1.1z" fill="#3B2314" />
    </Icon>
  );
}

/** 돈주머니(정산). */
export function BagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16.5 5h15l-3 6h-9z" fill="#FDB927" />
      <rect x="15" y="10" width="18" height="5" rx="2.5" fill="#C86E00" />
      <path
        d="M18 15c-6.5 3.5-10 10-10 17 0 4.5 2 9 5.5 10h21c3.5-1 5.5-5.5 5.5-10 0-7-3.5-13.5-10-17z"
        fill="#FDB927"
      />
      <path
        d="M16 25l3.5 10.5 4.5-8.5 4.5 8.5L32 25"
        stroke="#FFF6E0"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M13.5 30.5h3.5M31 30.5h3.5" stroke="#FFF6E0" strokeWidth="3" strokeLinecap="round" />
    </Icon>
  );
}

/** 집(방 정보). */
export function HouseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21L24 12l12 9v18a4 4 0 01-4 4H16a4 4 0 01-4-4z" fill="#FBAFC1" />
      <path
        d="M7 22.5L24 10l17 12.5"
        stroke="#EC7C9C"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="18" y="24" width="5" height="5" rx="1.5" fill="#FFEAF0" />
      <rect x="25" y="24" width="5" height="5" rx="1.5" fill="#FFEAF0" />
      <rect x="18" y="31" width="5" height="5" rx="1.5" fill="#FFEAF0" />
      <rect x="25" y="31" width="5" height="5" rx="1.5" fill="#FFEAF0" />
    </Icon>
  );
}

/** 얼굴 둘(참여자). 뒤 얼굴은 앞 얼굴 둘레만큼 비워 겹친 경계를 만든다. */
export function PeopleIcon(props: IconProps) {
  const maskId = useMaskId();
  return (
    <Icon {...props}>
      <defs>
        <mask id={maskId}>
          <rect width="48" height="48" fill="#fff" />
          <circle cx="18" cy="29" r="15.5" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        <circle cx="32" cy="17" r="12" fill="#FFAE42" />
        <circle cx="29" cy="16" r="1.8" fill="#3B2314" />
        <circle cx="36" cy="16" r="1.8" fill="#3B2314" />
      </g>
      <circle cx="18" cy="29" r="13" fill="#FFC93C" />
      <ellipse cx="13.5" cy="27" rx="2" ry="2.5" fill="#3B2314" />
      <ellipse cx="22.5" cy="27" rx="2" ry="2.5" fill="#3B2314" />
      <path d="M12.5 33c3 3.5 8 3.5 11 0" stroke="#C86E00" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </Icon>
  );
}

/** 완료(최신 상태로 갱신됨, 저장 안내). */
export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="24" cy="24" r="20" fill="#00C176" />
      <path
        d="M15 24.5l6 6 12-12"
        stroke="#E6FFF3"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Icon>
  );
}

/** 안내(연결 중, 예상 정산 안내). */
export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="24" cy="24" r="20" fill="#2EA6F7" />
      <rect x="21.5" y="21" width="5" height="14" rx="2.5" fill="#F2FAFF" />
      <circle cx="24" cy="14.5" r="3" fill="#F2FAFF" />
    </Icon>
  );
}

/** 끊김(연결 끊김·다시 연결 중·연결할 수 없음). */
export function OfflineIcon(props: IconProps) {
  const maskId = useMaskId();
  return (
    <Icon {...props}>
      <defs>
        <mask id={maskId}>
          <rect width="48" height="48" fill="#fff" />
          <circle cx="36" cy="34" r="11" fill="#000" />
        </mask>
      </defs>
      <path
        d="M14 38a9 9 0 01-1.5-17.9A12 12 0 0135.6 17 10.5 10.5 0 0135 38z"
        fill="#C3C8CF"
        mask={`url(#${maskId})`}
      />
      <circle cx="36" cy="34" r="8" fill="#F2635E" />
      <rect x="34.5" y="29" width="3" height="6" rx="1.5" fill="#fff" />
      <circle cx="36" cy="38" r="1.7" fill="#fff" />
    </Icon>
  );
}

/** 별(정산 단위 `점수`). */
export function StarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M24 4.5l5.6 12 13 1.5-9.6 8.9 2.6 12.9L24 33.3l-11.6 6.5 2.6-12.9-9.6-8.9 13-1.5z"
        fill="#2EA6F7"
        stroke="#2EA6F7"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M24 12l3.2 7" stroke="#BFE6FF" strokeWidth="3.5" strokeLinecap="round" />
    </Icon>
  );
}

/** 칩(정산 단위 `칩`). */
export function ChipIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="24" cy="24" r="20" fill="#F2635E" />
      <path
        d="M24 4v7M24 37v7M4 24h7M37 24h7M9.9 9.9l5 5M33.1 33.1l5 5M38.1 9.9l-5 5M14.9 33.1l-5 5"
        stroke="#FFF6E0"
        strokeWidth="4"
        strokeLinecap="butt"
      />
      <circle cx="24" cy="24" r="10.5" fill="#C8433F" />
      <circle cx="24" cy="24" r="6.5" fill="#FFF6E0" />
    </Icon>
  );
}
