"use client";

import { useAtomValue } from "jotai";
import { css } from "styled-system/css";
import { snapshotAtom } from "@/features/room/state";
import { Badge } from "@/ui/badge";
import { Money } from "@/ui/money";

/**
 * 누적 손익 영역(FE-S3-1, S3 §4.2·§9). `balances`를 서버 순서 그대로(재정렬 없음) 보인다. 비활성·거래 없는
 * 참여자도 포함하고, 부호 있는 순손익을 방의 `unit`으로 표시한다(환산 없음). 이 영역에는 거래 항목이 없다.
 */
export function BalancesSection() {
  const snapshot = useAtomValue(snapshotAtom);
  if (!snapshot) return null;
  const { balances, room } = snapshot;

  if (balances.length === 0) return <p>참여자가 없습니다.</p>;
  return (
    <ul className={css({ display: "flex", flexDirection: "column", gap: "2" })}>
      {balances.map((b) => (
        <li
          key={b.participantId}
          className={css({ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "2" })}
        >
          <span>
            {b.nickname} {b.status === "INACTIVE" ? <Badge tone="neutral">비활성</Badge> : null}
          </span>
          <Money value={b.balance} unit={room.unit} signed />
        </li>
      ))}
    </ul>
  );
}
