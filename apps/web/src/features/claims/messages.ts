// 방장의 이어받기 요청 구역 문구(plan §7 2.0.0, FE-C9).
import type { ClaimStatus } from "@/lib/api";

export const CLAIM_REQUESTS_TITLE = "이어받기 요청";
export const claimRowTitle = (nickname: string) => `${nickname} 이어받기 요청`;
export const duplicateNotice = (count: number) => `같은 참여자에 요청이 ${count}건 있습니다. 하나만 승인할 수 있습니다.`;
export const approveTitle = (nickname: string) => `${nickname} 이어받기를 승인할까요?`;
export const APPROVE_BODY = "승인하면 지금 그 참여자로 접속 중인 브라우저가 있다면 접근을 잃습니다. 되돌릴 수 없습니다.";
export const CLAIM_ARRIVED = "이어받기 요청이 왔습니다.";
/** 방 탭 배지의 접근 가능한 이름. */
export const pendingBadgeLabel = (count: number) => `대기 중인 이어받기 요청 ${count}건`;

const STATUS_LABELS: Record<ClaimStatus, string> = {
  PENDING: "대기 중",
  APPROVED: "승인됨",
  REJECTED: "거절됨",
  CANCELED: "취소됨",
};

/** 이미 처리된(또는 결과 불명인) 요청의 현재 상태. 그 처리가 이번 요청의 결과라고 단정하지 않는다(S1 §6.5). */
export function resolvedNotice(status: ClaimStatus, resolvedBy: string | null): string {
  const head = status === "PENDING" ? "요청이 아직 대기 중입니다." : `이미 처리된 요청입니다. 현재 상태: ${STATUS_LABELS[status]}`;
  return resolvedBy ? `${head} 처리: ${resolvedBy}` : head;
}
