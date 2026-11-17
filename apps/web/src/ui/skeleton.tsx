import { css } from "styled-system/css";
import { listClass, rowBodyClass, rowClass } from "./list-row";

/** 스켈레톤 모양(DV-23): 방 정보 막대, 목록 행, 거래 입력 폼. */
export type SkeletonShape = "lines" | "rows" | "form";

/** 행·막대 수는 고정이다. 이전 값의 정보(행 수)를 흘리지 않는다(RK-F29). */
const COUNT = 3;

const barClass = css({
  bgColor: "paperSubtle",
  borderRadius: "md",
  animation: "pulse",
  _motionReduce: { animation: "none" },
});

function Bar({ w, h = "14px", radius }: { w: string; h?: string; radius?: string }) {
  return <div className={barClass} style={{ width: w, height: h, borderRadius: radius }} />;
}

/**
 * 서버 유래 구역이 가려질 때(첫 로딩·끊김) 카드 안에 두는 값 없는 자리 표시(FD-29). 글자·숫자가 없고 장식이라
 * 보조기기에는 숨긴다. 가려진 이유는 연결 배너가 알린다.
 */
export function SectionSkeleton({ shape }: { shape: SkeletonShape }) {
  return (
    <div aria-hidden="true" data-skeleton={shape}>
      {shape === "lines" ? (
        <div className={css({ display: "flex", flexDirection: "column", gap: "3" })}>
          <Bar w="60%" h="20px" />
          <Bar w="40%" />
          <Bar w="75%" />
        </div>
      ) : shape === "rows" ? (
        <div className={listClass}>
          {Array.from({ length: COUNT }, (_, index) => (
            <div key={index} className={rowClass}>
              <Bar w="40px" h="40px" radius="9999px" />
              <div className={rowBodyClass}>
                <Bar w="50%" />
                <Bar w="30%" h="12px" />
              </div>
              <Bar w="72px" h="18px" />
            </div>
          ))}
        </div>
      ) : (
        <div className={css({ display: "flex", flexDirection: "column", gap: "4" })}>
          <Bar w="100%" h="52px" />
          <Bar w="100%" h="52px" />
          <Bar w="100%" h="52px" radius="12px" />
        </div>
      )}
    </div>
  );
}
