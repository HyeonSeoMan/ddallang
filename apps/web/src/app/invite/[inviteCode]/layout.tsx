import type { ReactNode } from "react";
import { InviteScreen } from "@/features/room/invite-screen";

// 초대 코드는 런타임에 생기므로 미리 만들 수 없다. 요청 때 렌더링한다(FD-2, FD-17).
// 입장 흐름·실시간 연결·헤더 탭은 이 레이아웃에 한 번만 있고, 페이지를 옮겨도 다시 만들어지지 않는다.
export default async function InviteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;
  return <InviteScreen inviteCode={inviteCode}>{children}</InviteScreen>;
}
