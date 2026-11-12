import { formatMoney } from "@/lib/format";
import type { SettlementItem } from "@/lib/api";

/**
 * 최종 정산 복사 텍스트(FE-S4-3, S4 §6.5): 방 이름, 고정 문자열 `게임 종료`, 빈 줄, 이어서 서버 `items` 순서 그대로
 * `지급자 → 수취자 금액 단위` 한 줄씩. 줄바꿈은 `\n`, 마지막 줄 뒤에는 붙이지 않는다. 금액은 세 자리마다 ASCII 쉼표
 * (브라우저 로캘과 무관)이며 화면 서식과 같은 함수를 쓴다. 사유·라운드·작성자·`kind` 표기는 포함하지 않는다.
 */
export function buildSettlementText(roomName: string, items: SettlementItem[], unit: string): string {
  const lines = items.map(
    (item) => `${item.payerNickname} → ${item.payeeNickname} ${formatMoney(item.amount, unit)}`,
  );
  return [roomName, "게임 종료", "", ...lines].join("\n");
}
