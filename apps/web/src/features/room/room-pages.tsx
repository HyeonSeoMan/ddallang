"use client";

import { useAtomValue } from "jotai";
import { BalancesSection } from "@/features/balances/balances-section";
import { ParticipantsSection } from "@/features/participants/participants-section";
import { EndGame } from "@/features/settlement/end-game";
import { SettlementSection } from "@/features/settlement/settlement-section";
import { RecordTransactionButton } from "@/features/transactions/record-button";
import { TransactionActions } from "@/features/transactions/transaction-actions";
import { TransactionForm } from "@/features/transactions/transaction-form";
import { TransactionsSection } from "@/features/transactions/transactions-section";
import { RoomInfo } from "./room-info";
import { RoomSections } from "./room-layout";
import { snapshotAtom } from "./state";

/**
 * 방 화면의 페이지 4개(페이지 분리, FD-12 개정). 각 페이지는 자기 구역만 `RoomSections`로 고른다.
 * 손익과 거래 내역은 한 화면에서 구분해 보이도록 같은 페이지에 둔다(AC-VIEW-001-1).
 */

/** 현황: 누적 손익과 거래 내역. */
export function StatusPage() {
  return (
    <>
      <RoomSections
        only={["balances", "transactions"]}
        slots={{
          balances: <BalancesSection />,
          transactions: (
            <TransactionsSection
              renderActions={(transaction, { me, room, summary }) => (
                <TransactionActions transaction={transaction} me={me} room={room} summary={summary} />
              )}
            />
          ),
        }}
      />
      <RecordTransactionButton />
    </>
  );
}

/** 기록: 거래 입력. 저장해도 이 페이지에 머문다. */
export function RecordPage() {
  return <RoomSections only={["entry"]} slots={{ entry: <TransactionForm /> }} />;
}

/** 정산: 예상·최종 정산과 게임 종료. 정산 영역의 이름은 서버가 정한 `kind`를 따른다. */
export function SettlementPage() {
  const snapshot = useAtomValue(snapshotAtom);
  const titles = snapshot ? { settlement: snapshot.settlement.kind === "FINAL" ? "최종 정산" : "예상 정산" } : {};
  return (
    <RoomSections
      only={["settlement"]}
      titles={titles}
      slots={{
        settlement: (
          <>
            <SettlementSection />
            <EndGame />
          </>
        ),
      }}
    />
  );
}

/** 방: 방 정보(초대 링크)와 참여자. */
export function RoomPage() {
  return (
    <RoomSections
      only={["info", "participants"]}
      slots={{ info: <RoomInfo />, participants: <ParticipantsSection /> }}
    />
  );
}
