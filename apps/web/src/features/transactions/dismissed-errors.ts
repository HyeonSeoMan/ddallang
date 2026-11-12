import { useState } from "react";
import type { FieldErrors, TxField } from "./messages";

/**
 * 서버가 거부한 응답(422)의 필드 오류 중 사용자가 **고친 필드**만 숨긴다(고치지 않은 필드의 오류는 유지).
 * 숨김은 그 응답(`state` 객체)에만 적용되어 새 응답이 오면 다시 전부 보인다. 로컬 검증 오류가 모두 지워져
 * 서버 오류로 되돌아가도 고친 필드의 옛 오류가 다시 나타나지 않는다.
 */
export function useDismissedServerErrors(state: unknown) {
  const [dismissed, setDismissed] = useState<{ state: unknown; fields: readonly TxField[] }>({ state: null, fields: [] });
  const current = dismissed.state === state ? dismissed.fields : [];
  return {
    /** 고친 필드를 뺀 서버 필드 오류. */
    filter(errors: FieldErrors): FieldErrors {
      const next: FieldErrors = {};
      for (const [field, messages] of Object.entries(errors) as Array<[TxField, string[]]>) {
        if (!current.includes(field)) next[field] = messages;
      }
      return next;
    },
    /** 이 필드들을 고쳤다고 기록한다. */
    dismiss(fields: readonly TxField[]) {
      setDismissed((prev) => ({ state, fields: [...(prev.state === state ? prev.fields : []), ...fields] }));
    },
  };
}
