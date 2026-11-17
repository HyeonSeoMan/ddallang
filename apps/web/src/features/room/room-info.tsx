"use client";

import { useAtomValue } from "jotai";
import { QRCodeSVG } from "qrcode.react";
import { useId } from "react";
import { css, cx } from "styled-system/css";
import { useCopyFeedback } from "@/lib/use-copy-feedback";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { fieldFrameClass } from "@/ui/text-field";
import { colors } from "@/ui/tokens";
import { snapshotAtom } from "./state";

export function inviteLink(inviteCode: string): string {
  return `${window.location.origin}/invite/${encodeURIComponent(inviteCode)}`;
}

/**
 * 방 정보 영역(FE-S1-3, S1 §4.4·§9): 방 이름·정산 단위·진행 상태, 내 닉네임과 방장 여부,
 * 초대 링크 표시와 복사, 진행 중이면 초대 링크 QR(FD-28). 방 정보를 바꾸는 UI는 없다(AC-ROOM-003-1). 서버 유래 값이므로
 * `ServerDataGate` 아래에서만 그려진다.
 */
export function RoomInfo() {
  const linkId = useId();
  const snapshot = useAtomValue(snapshotAtom);
  const { copy, status } = useCopyFeedback({
    success: "초대 링크를 복사했습니다.",
    failure: "복사하지 못했습니다. 링크를 직접 선택해 복사해 주세요.",
  });
  if (!snapshot) return null;
  const { room, me } = snapshot;
  const link = inviteLink(room.inviteCode);
  const ended = room.status === "ENDED";

  async function onCopy() {
    await copy(link); // 쓰기가 끝난 뒤에만 성공을 표시한다(FD-14)
  }

  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "2.5", alignItems: "flex-start" })}>
      <p className={css({ fontSize: "xl", fontWeight: "bold", overflowWrap: "anywhere" })}>{room.name}</p>
      <p>정산 단위: {room.unit}</p>
      <div>
        <Badge tone={ended ? "neutral" : "info"}>{ended ? "게임 종료" : "진행 중"}</Badge>
      </div>
      <p className={css({ overflowWrap: "anywhere" })}>
        내 닉네임: {me.nickname} {me.isHost ? <Badge tone="info">방장</Badge> : null}
      </p>

      <div className={css({ display: "flex", flexDirection: "column", gap: "1.5", alignSelf: "stretch", mt: "2" })}>
        <label htmlFor={linkId} className={css({ fontSize: "sm", fontWeight: "semibold", color: "inkMuted" })}>
          초대 링크
        </label>
        <input
          id={linkId}
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          className={cx(fieldFrameClass, css({ minH: "52px", px: "4", minW: "0", textOverflow: "ellipsis" }))}
        />
        <Button variant="secondary" className={css({ alignSelf: "flex-start" })} onClick={() => void onCopy()}>
          초대 링크 복사
        </Button>
        <p aria-live="polite" className={css({ color: "inkMuted", fontSize: "sm", fontWeight: "medium" })}>
          {status}
        </p>
        {/* 종료 뒤에는 새로 입장할 수 없어(OQ-043) 찍어도 들어올 수 없으므로 QR을 숨긴다(Q-C3). */}
        {ended ? null : (
          <div className={css({ display: "flex", flexDirection: "column", gap: "2", alignItems: "flex-start" })}>
            <QRCodeSVG
              value={link}
              size={160}
              level="M"
              marginSize={4}
              fgColor={colors.ink}
              bgColor={colors.paper}
              role="img"
              aria-label="초대 링크 QR 코드"
              data-testid="invite-qr"
            />
            <p className={css({ color: "inkMuted", fontSize: "sm", fontWeight: "medium" })}>
              휴대폰 카메라로 찍으면 초대 링크가 열립니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
