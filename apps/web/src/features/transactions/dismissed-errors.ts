import { atom, useAtom } from "jotai";
import { useEffect } from "react";
import type { FieldErrors, TxField } from "./messages";

type Entry = { state: unknown; fields: readonly TxField[] };

/** 요청 범위(`mutationScope`)별로 "이 응답에서 고친 필드" 기록을 메모리에 둔다. 재마운트·연결 끊김 뒤 복원에도 유지되도록 원자로 둔다. */
/** 시험용으로 내보낸다. */
export const dismissedAtom = atom<Record<string, Entry>>({});

/**
 * 서버가 거부한 응답(422)의 필드 오류 중 사용자가 **고친 필드**만 숨긴다(고치지 않은 필드의 오류는 유지).
 * 숨김은 그 응답(`state` 객체)에만 적용되어 새 응답이 오면 다시 전부 보인다. 로컬 검증 오류가 모두 지워져 서버 오류로
 * 되돌아가도, 컴포넌트가 다시 마운트되어도(초안·응답은 원자에 남는다) 고친 필드의 옛 오류가 다시 나타나지 않는다.
 *
 * 기록은 유한하다: 서버 오류가 있는 필드만 필드 집합(최대 필드 수)으로 기록하고, 그 응답이 더 이상 거부 응답이 아니게 되면
 * (새 응답·성공·취소 등) 이 범위의 기록을 지운다.
 */
export function useDismissedServerErrors(scope: string, state: unknown, serverErrors: FieldErrors) {
  const [all, setAll] = useAtom(dismissedAtom);
  const entry = all[scope];
  const current = entry && entry.state === state ? entry.fields : [];
  const hasServerErrors = Object.keys(serverErrors).length > 0;

  // 이 범위의 응답이 바뀌었거나 서버 오류가 없어졌다면 낡은 기록을 정리한다.
  useEffect(() => {
    if (entry && (entry.state !== state || !hasServerErrors)) {
      setAll((prev) => {
        if (!(scope in prev)) return prev;
        const next = { ...prev };
        delete next[scope];
        return next;
      });
    }
  }, [entry, state, hasServerErrors, scope, setAll]);

  return {
    /** 고친 필드를 뺀 서버 필드 오류. */
    filter(errors: FieldErrors): FieldErrors {
      const next: FieldErrors = {};
      for (const [field, messages] of Object.entries(errors) as Array<[TxField, string[]]>) {
        if (!current.includes(field)) next[field] = messages;
      }
      return next;
    },
    /** 이 필드들을 고쳤다고 기록한다. 서버 오류가 있는 필드만, 중복 없이 기록한다. */
    dismiss(fields: readonly TxField[]) {
      const relevant = fields.filter((f) => f in serverErrors && !current.includes(f));
      if (relevant.length === 0) return;
      setAll((prev) => {
        const before = prev[scope] && prev[scope]!.state === state ? prev[scope]!.fields : [];
        return { ...prev, [scope]: { state, fields: Array.from(new Set([...before, ...relevant])) } };
      });
    },
  };
}
