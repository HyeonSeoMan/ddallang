import { RecordPage, RoomPage, SettlementPage, StatusPage } from "@/features/room/room-pages";

/**
 * 시험용: 방 화면의 페이지 4개를 한꺼번에 그린다. 페이지 분리 전의 "한 화면에 전부" 단언(AC)을 그대로 유지하되
 * 구역은 실제 페이지 컴포넌트가 만든다. 페이지별 구성은 `room-pages.test.tsx`가 따로 확인한다.
 */
export function AllPages() {
  return (
    <>
      <StatusPage />
      <RecordPage />
      <SettlementPage />
      <RoomPage />
    </>
  );
}
