import { ApiError } from "@/lib/api";

/**
 * 이 방에 접근할 수 없다는 오류인가(S5 §6.6): `401`이거나 `404 ROOM_NOT_FOUND`.
 * 재시도하지 않고 오류를 안내한다. 다른 404(예: 라우트 오류)는 일반 실패처럼 재시도한다.
 */
export function isInaccessibleError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 401 || (error.status === 404 && error.code === "ROOM_NOT_FOUND"))
  );
}
