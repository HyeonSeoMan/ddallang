import { InviteScreen } from "@/features/room/invite-screen";

// 초대 코드는 런타임에 생기므로 미리 만들 수 없다. 요청 때 렌더링한다(FD-2, FD-17).
export default async function InvitePage({ params }: { params: Promise<{ inviteCode: string }> }) {
  const { inviteCode } = await params;
  return <InviteScreen inviteCode={inviteCode} />;
}
