"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useId, useRef, useState } from "react";
import { css } from "styled-system/css";
import { requestRefreshAtom } from "@/features/realtime/state";
import { dataVisibleAtom, sessionAtom, snapshotAtom } from "@/features/room/state";
import { ApiError, bearerHeader, type Claim, getApiClient, NetworkError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { getStoredKey } from "@/lib/identity";
import { useAnnounce } from "@/ui/announcer";
import { Banner } from "@/ui/banner";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { BellIcon } from "@/ui/icons";
import { listClass, rowBodyClass, rowClass, rowMetaClass, rowTitleClass } from "@/ui/list-row";
import {
  APPROVE_BODY,
  approveTitle,
  CLAIM_ARRIVED,
  CLAIM_REQUESTS_TITLE,
  claimRowTitle,
  duplicateNotice,
  resolvedNotice,
} from "./messages";

type Action = "approve" | "reject";

/**
 * 방장의 이어받기 요청 구역(FE-M5, FD-24, S1 §4.12~§4.15·§6.5·§9). 방장에게만, 대기 요청이 있을 때만 보인다.
 * 데이터 영역이 보일 때(연결됨)만 그리고 게임이 종료되어도 남는다(AC-ROOM-009-10). 승인은 확인을 거치고 거절은 바로
 * 보낸다(FE-C3). 이 요청들은 Idempotency Key가 없으므로 결과 불명·이미 처리됨은 단건 조회로 현재 상태를 안내한다.
 */
export function ClaimRequestsSection() {
  const snapshot = useAtomValue(snapshotAtom);
  const session = useAtomValue(sessionAtom);
  const visible = useAtomValue(dataVisibleAtom);
  const requestRefresh = useSetAtom(requestRefreshAtom);
  const announce = useAnnounce();
  const headingId = useId();
  const [confirming, setConfirming] = useState<Claim | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const isHost = snapshot?.me.isHost === true;
  const claims = visible && isHost && snapshot ? snapshot.claims : [];

  // 새 요청이 오면 알림 영역으로 읽어 준다(토스트는 만들지 않는다, FE-C8). 처음 보이는 목록은 알리지 않는다.
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!visible || !isHost || !snapshot) return;
    const ids = new Set(snapshot.claims.map((c) => c.id));
    if (known.current && [...ids].some((id) => !known.current!.has(id))) announce(CLAIM_ARRIVED);
    known.current = ids;
  }, [visible, isHost, snapshot, announce]);

  if (!snapshot || !session || !isHost || !visible) return null;
  if (claims.length === 0 && !notice) return null;

  const nicknameOf = (participantId: string | null) =>
    snapshot.participants.find((p) => p.id === participantId)?.nickname ?? null;
  const countByTarget = new Map<string, number>();
  for (const claim of claims) countByTarget.set(claim.participantId, (countByTarget.get(claim.participantId) ?? 0) + 1);

  /**
   * 안내를 닫는다. 대기 요청이 남아 있으면 구역 제목으로, 구역이 사라지면 다음 구역(참여자) 제목으로 포커스를 옮겨
   * 키보드·스크린리더 사용자가 위치를 잃지 않게 한다(검수 N3).
   */
  function dismissNotice() {
    setNotice(null);
    const next =
      claims.length > 0
        ? document.getElementById(headingId)
        : document.querySelector<HTMLElement>('section[data-section="participants"] h2');
    if (next) {
      next.tabIndex = -1;
      requestAnimationFrame(() => next.focus());
    }
  }

  async function send(claim: Claim, action: Action) {
    if (!session || pendingId) return;
    setPendingId(claim.id);
    setNotice(null);
    const api = getApiClient();
    const key = getStoredKey(session.inviteCode);
    const headers = key ? bearerHeader(key) : undefined;
    const base = `/rooms/${encodeURIComponent(session.roomId)}/claims/${encodeURIComponent(claim.id)}`;
    try {
      await api.request({ method: "POST", path: `${base}/${action}`, headers });
      announce(action === "approve" ? "이어받기를 승인했습니다." : "이어받기를 거절했습니다.");
      setConfirming(null);
    } catch (error) {
      if (error instanceof ApiError && error.code === "IDENTITY_REVOKED") return; // 접근 상실 처리기가 맡는다
      setConfirming(null);
      if (error instanceof NetworkError || (error instanceof ApiError && error.code === "CLAIM_ALREADY_RESOLVED")) {
        // 결과 불명·이미 처리됨: 단건 조회로 현재 상태와 처리한 방장을 안내한다. 이번 처리의 결과라고 단정하지 않는다.
        try {
          const { data } = await api.request<{ claim: Claim }>({ method: "GET", path: base, headers });
          setNotice({ tone: "info", text: resolvedNotice(data.claim.status, nicknameOf(data.claim.resolvedById)) });
        } catch {
          setNotice({ tone: "error", text: "요청 상태를 확인하지 못했습니다. 잠시 뒤 다시 확인해 주세요." });
        }
      } else {
        setNotice({ tone: "error", text: error instanceof ApiError ? error.message : "요청을 처리하지 못했습니다." });
      }
    } finally {
      setPendingId(null);
      requestRefresh(); // 목록은 서버 상태로 다시 그린다
    }
  }

  return (
    <section aria-labelledby={headingId} data-section="claims" className={css({ mt: "7", _firstOfType: { mt: "3" } })}>
      <h2
        id={headingId}
        className={css({ display: "flex", alignItems: "center", gap: "2", px: "1", fontSize: "xl", fontWeight: "bold" })}
      >
        <BellIcon size={28} />
        {CLAIM_REQUESTS_TITLE}
      </h2>
      <div className={css({ mt: "3", p: "5", bgColor: "paper", borderRadius: "lg", display: "flex", flexDirection: "column", gap: "3" })}>
        {notice ? (
          <div className={css({ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2" })}>
            <Banner tone={notice.tone}>{notice.text}</Banner>
            {/* 처리 결과 안내는 사용자가 닫는다. 대기 요청이 없으면 닫은 뒤 구역이 사라진다(검수 R5). */}
            <Button variant="secondary" onClick={dismissNotice}>
              안내 닫기
            </Button>
          </div>
        ) : null}
        {[...countByTarget].filter(([, n]) => n > 1).map(([participantId, n]) => (
          <p key={participantId} className={rowMetaClass}>
            {nicknameOf(participantId) ?? ""}: {duplicateNotice(n)}
          </p>
        ))}
        {claims.length > 0 ? (
          <ul className={listClass}>
            {claims.map((claim) => (
              <li key={claim.id} className={rowClass}>
                <div className={rowBodyClass}>
                  <span className={rowTitleClass}>{claimRowTitle(claim.nickname)}</span>
                  <span className={rowMetaClass}>{formatDateTime(claim.createdAt)}</span>
                </div>
                <div className={css({ display: "flex", gap: "2", ml: "auto" })}>
                  <Button
                    variant="secondary"
                    disabled={pendingId !== null}
                    aria-label={`${claim.nickname} 이어받기 승인`}
                    onClick={() => setConfirming(claim)}
                  >
                    승인
                  </Button>
                  <Button
                    variant="dangerText"
                    disabled={pendingId !== null}
                    aria-label={`${claim.nickname} 이어받기 거절`}
                    onClick={() => void send(claim, "reject")}
                  >
                    거절
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirming !== null}
        title={confirming ? approveTitle(confirming.nickname) : ""}
        description={APPROVE_BODY}
        confirmLabel="승인"
        busy={pendingId !== null}
        onConfirm={() => confirming && void send(confirming, "approve")}
        onCancel={() => setConfirming(null)}
      />
    </section>
  );
}
