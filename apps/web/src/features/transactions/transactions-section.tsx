"use client";

import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { type ReactNode, useId, useState } from "react";
import { css } from "styled-system/css";
import { ApiError, bearerHeader, getApiClient, type RoomMember, type Room, type Transaction } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getStoredKey } from "@/lib/identity";
import { participantFilterAtom, requestRefreshAtom } from "@/features/realtime/state";
import { type RoomSnapshot, sessionAtom, snapshotAtom } from "@/features/room/state";
import { Banner } from "@/ui/banner";
import { Button } from "@/ui/button";
import { Money } from "@/ui/money";

const ALL = "";
const LOAD_MORE_ERROR = "더 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.";

export interface TransactionRowContext {
  me: RoomMember;
  room: Room;
  /** 거래 요약(예: `가온 → 나래 100 원`). 컨트롤의 접근 가능한 이름에 써서 같은 금액의 행을 구분한다. */
  summary: string;
}

/** 같은 순회 안에서 같은 `id`가 두 번 오면 하나만 둔다(S3 §6.4, 방어). 서버 순서는 그대로다. */
function uniqueById(items: Transaction[]): Transaction[] {
  const seen = new Set<string>();
  return items.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
}

interface Extra {
  /** 이 "더 보기" 결과가 속한 순회(= 스냅샷). 스냅샷이 바뀌면 버린다. */
  base: RoomSnapshot;
  items: Transaction[];
  cursor: string | null;
}

/**
 * 거래 내역 영역(FE-S3-2, S3 §4.1·§6.3·§6.4·§9). 서버 순서 그대로(재정렬 없음), 20건 단위 `더 보기`,
 * 참여자 1명 필터. 필터 변경·`cursor` 오류·변경 알림 뒤 갱신은 **새 순회**다: 불러온 페이지와 커서를 모두 버리고
 * 첫 페이지로 교체하며 병합하지 않는다. 이전에 "더 보기"로 불러온 범위는 자동 복원하지 않는다(사용자 결정 U-4).
 */
export function TransactionsSection({
  renderActions,
}: {
  /** 거래 행의 수정·삭제 컨트롤 자리(S2-3). 권한 판단은 호출자가 `authorId`·`me`로 한다. */
  renderActions?: (transaction: Transaction, context: TransactionRowContext) => ReactNode;
}) {
  const snapshot = useAtomValue(snapshotAtom);
  const session = useAtomValue(sessionAtom);
  const [filter, setFilter] = useAtom(participantFilterAtom);
  const requestRefresh = useSetAtom(requestRefreshAtom);
  const [extra, setExtra] = useState<Extra | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const store = useStore();
  const filterId = useId();

  if (!snapshot || !session) return null;
  const { room, me, participants } = snapshot;

  // 스냅샷이 새로 반영되면(변경 알림 뒤 갱신 포함) "더 보기" 결과는 다른 순회의 것이므로 쓰지 않는다.
  const current = extra?.base === snapshot ? extra : null;
  const items = uniqueById([...snapshot.transactions, ...(current?.items ?? [])]);
  const nextCursor = current ? current.cursor : snapshot.nextCursor;
  // 필터를 바꾼 뒤 새 순회가 반영되기 전: 기존 목록을 유지하다가 한 번에 교체한다.
  const switching = filter !== snapshot.transactionFilter;
  const nameOf = (id: string) => participants.find((p) => p.id === id)?.nickname ?? "알 수 없음";

  async function loadMore() {
    const base = snapshot;
    const cursor = nextCursor;
    const key = getStoredKey(session!.inviteCode);
    if (!base || !cursor || loading) return;
    if (!key) {
      setNotice("이 브라우저에 저장된 신원 정보를 찾을 수 없습니다. 초대 링크로 다시 입장해 주세요.");
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const { data } = await getApiClient().request<{ transactions: Transaction[]; nextCursor: string | null }>({
        method: "GET",
        path: `/rooms/${encodeURIComponent(base.room.id)}/transactions`,
        // 순회를 시작할 때의 필터로 이어 간다(커서는 발급 때의 필터에 묶여 있다).
        query: { cursor, participantId: base.transactionFilter ?? undefined },
        headers: bearerHeader(key),
      });
      if (store.get(snapshotAtom) !== base) return; // 그 사이 새 순회로 교체되었다: 이 결과는 버린다
      setExtra({ base, items: [...(extra?.base === base ? extra.items : []), ...data.transactions], cursor: data.nextCursor });
    } catch (error) {
      if (store.get(snapshotAtom) !== base) return;
      if (error instanceof ApiError && error.details.some((d) => d.field === "cursor")) {
        // 커서가 맞지 않는다: 새 순회를 시작해 첫 페이지로 교체한다(S3 §6.4 (2)).
        setNotice("목록이 바뀌어 처음부터 다시 불러옵니다.");
        requestRefresh();
      } else if (error instanceof ApiError && error.status < 500) {
        setNotice(error.message);
      } else {
        setNotice(LOAD_MORE_ERROR);
      }
    } finally {
      setLoading(false);
    }
  }

  function onFilterChange(value: string) {
    setFilter(value === ALL ? null : value); // 선택·변경·해제 모두 새 순회
    setNotice(null);
    requestRefresh();
  }

  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "3" })} aria-busy={switching}>
      <div className={css({ display: "flex", flexDirection: "column", gap: "1" })}>
        <label htmlFor={filterId} className={css({ fontWeight: "semibold" })}>
          참여자 필터
        </label>
        <select
          id={filterId}
          value={filter ?? ALL}
          onChange={(e) => onFilterChange(e.target.value)}
          className={css({ minH: "touch", px: "4", borderWidth: "2px", borderColor: "line", borderRadius: "md", bg: "paper", color: "ink" })}
        >
          <option value={ALL}>전체</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nickname}
              {p.status === "INACTIVE" ? " (비활성)" : ""}
            </option>
          ))}
        </select>
        {switching ? <p aria-live="polite" className={css({ color: "inkMuted", fontSize: "sm" })}>필터를 적용하는 중…</p> : null}
      </div>

      {items.length === 0 ? (
        <p>{snapshot.transactionFilter ? "이 참여자의 거래가 없습니다." : "거래가 없습니다."}</p>
      ) : (
        <ul className={css({ display: "flex", flexDirection: "column", gap: "3" })}>
          {items.map((t) => (
            <li key={t.id} className={css({ display: "flex", flexDirection: "column", gap: "1", borderBottomWidth: "1px", borderColor: "divider", pb: "2" })}>
              <div className={css({ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "2" })}>
                <span>
                  {nameOf(t.payerId)} → {nameOf(t.payeeId)}
                </span>
                <Money value={t.amount} unit={room.unit} />
              </div>
              {/* 사유·라운드는 항상 일반 텍스트로 이스케이프해 보인다(React 텍스트 노드). */}
              {t.reason ? <span>사유: {t.reason}</span> : null}
              {t.round ? <span>라운드: {t.round}</span> : null}
              <span className={css({ color: "inkMuted", fontSize: "sm" })}>{formatDateTime(t.createdAt)}</span>
              {renderActions?.(t, { me, room, summary: `${nameOf(t.payerId)} → ${nameOf(t.payeeId)} ${formatMoney(t.amount, room.unit)}` })}
            </li>
          ))}
        </ul>
      )}

      {notice ? <Banner tone="warning">{notice}</Banner> : null}
      {nextCursor ? (
        <Button variant="secondary" onClick={() => void loadMore()} disabled={loading}>
          {loading ? "불러오는 중…" : "더 보기"}
        </Button>
      ) : null}
    </div>
  );
}
