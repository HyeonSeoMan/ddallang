import { atom, useAtom } from "jotai";
import type { FieldErrors, TxField } from "./messages";

/** 요청 범위(`mutationScope`)별로 "이 응답에서 고친 필드" 기록을 메모리에 둔다. 재마운트·연결 끊김 뒤 복원에도 유지되도록 원자로 둔다. */
const dismissedAtom = atom<Record<string, { state: unknown; fields: readonly TxField[] }>>({});

/**
 * 서버가 거부한 응답(422)의 필드 오류 중 사용자가 **고친 필드**만 숨긴다(고치지 않은 필드의 오류는 유지).
 * 숨김은 그 응답(`state` 객체)에만 적용되어 새 응답이 오면 다시 전부 보인다. 로컬 검증 오류가 모두 지워져
 * 서버 오류로 되돌아가도, 컴포넌트가 다시 마운트되어도(초안·응답은 원자에 남는다) 고친 필드의 옛 오류가 다시 나타나지 않는다.
 */
export function useDismissedServerErrors(scope: string, state: unknown) {
  const [all, setAll] = useAtom(dismissedAtom);
  const entry = all[scope];
  const current = entry && entry.state === state ? entry.fields : [];
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
      setAll((prev) => {
        const before = prev[scope] && prev[scope]!.state === state ? prev[scope]!.fields : [];
        return { ...prev, [scope]: { state, fields: [...before, ...fields] } };
      });
    },
  };
}
