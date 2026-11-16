"use client";

import { useAtomValue } from "jotai";
import { css } from "styled-system/css";
import { snapshotAtom } from "@/features/room/state";
import { useCopyFeedback } from "@/lib/use-copy-feedback";
import { buildSettlementText } from "@/lib/settlement-text";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { InfoIcon } from "@/ui/icons";
import { Money } from "@/ui/money";

export const EMPTY_SETTLEMENT = "정산할 내역이 없습니다.";
export const EXPECTED_NOTE = "거래가 바뀌면 달라질 수 있습니다.";
const COPIED = "정산 내용을 복사했습니다.";
const COPY_FAILED = "복사하지 못했습니다. 정산 내용을 직접 선택해 복사해 주세요.";

/**
 * 정산 영역(FE-S4-2, S4 §6.4·§6.6·§9). 서버 `items` 순서 그대로 닉네임과 금액을 방의 `unit`으로 보인다(환산 없음).
 * `EXPECTED`는 `예상 정산`(제목은 호출자가 정한다)과 `진행 중` 배지·안내를 보이고 복사 컨트롤이 없다. `FINAL`은 `게임 종료` 배지와
 * 복사 버튼(항목이 있을 때만 활성)이 있다. 방 상태와 `kind`가 일치한 스냅샷만 반영되므로(S5 §6.4) 여기서는 `kind`를 따른다.
 * 정산 조회에는 참여자 필터가 적용되지 않는다(AC-SET-008-6).
 */
export function SettlementSection() {
  const snapshot = useAtomValue(snapshotAtom);
  const { copy, status } = useCopyFeedback({ success: COPIED, failure: COPY_FAILED });
  if (!snapshot) return null;
  const { settlement, room } = snapshot;
  const final = settlement.kind === "FINAL" && room.status === "ENDED";
  const items = settlement.items;

  async function onCopy() {
    if (!snapshot || !final || items.length === 0) return;
    // 현재 표시 중인 최종 정산 응답과 방 이름·단위로만 만든다. 쓰기가 끝난 뒤에만 성공을 표시한다(FD-14).
    await copy(buildSettlementText(room.name, items, room.unit));
  }

  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "3" })}>
      <div>
        <Badge tone={final ? "neutral" : "info"}>{final ? "게임 종료" : "진행 중"}</Badge>
      </div>
      {/* 예상 정산 안내는 일반 문단이다(역할 없음). 모양만 info 띠(방향 문서 §4 띠). */}
      {!final ? (
        <p
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "2.5",
            px: "4",
            py: "3",
            borderRadius: "tile",
            bgColor: "infoBg",
            color: "infoText",
            fontSize: "sm",
            fontWeight: "semibold",
          })}
        >
          <InfoIcon size={20} />
          {EXPECTED_NOTE}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p>{EMPTY_SETTLEMENT}</p>
      ) : (
        // 정산 행(방향 문서 §4): 아바타 없음, "가온 → 나래" 왼쪽(최소 160px)·금액 오른쪽, 행 사이 구분선.
        <ol className={css({ display: "flex", flexDirection: "column" })}>
          {items.map((item, index) => (
            <li
              key={`${item.payerId}-${item.payeeId}-${index}`}
              className={css({
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                columnGap: "3",
                rowGap: "1",
                minH: "56px",
                borderBottomWidth: "1px",
                borderBottomColor: "divider",
                _last: { borderBottomWidth: "0" },
              })}
            >
              <span className={css({ flex: "1 1 160px", minW: "160px", overflowWrap: "anywhere" })}>
                {item.payerNickname} → {item.payeeNickname}
              </span>
              <span className={css({ ml: "auto" })}>
                <Money value={item.amount} unit={room.unit} />
              </span>
            </li>
          ))}
        </ol>
      )}

      {final ? (
        <>
          <Button variant="secondaryBlock" onClick={() => void onCopy()} disabled={items.length === 0}>
            정산 복사
          </Button>
          <p aria-live="polite" className={css({ color: "inkMuted", fontSize: "sm", fontWeight: "medium" })}>
            {status}
          </p>
        </>
      ) : null}
    </div>
  );
}
