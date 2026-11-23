import { css } from "styled-system/css";
import { HomeGuide } from "@/features/home/home-guide";
import { CreateRoomForm } from "@/features/room/create-room-form";
import { BrandHeader, cardClass } from "@/ui/brand-header";

export default function HomePage() {
  return (
    <main className={css({ maxW: "md", mx: "auto", p: "4" })}>
      <BrandHeader />
      {/* 처음 온 사람이 무엇을 하는 서비스인지 먼저 알게 한다(U-27, DV-24). */}
      <p className={css({ color: "inkMuted", fontWeight: "medium", mb: "4", wordBreak: "keep-all" })}>
        모임에서 주고받은 돈·점수를 함께 기록하고, 끝나면 누가 누구에게 얼마를 보낼지 정산해 주는 서비스예요.
      </p>
      <section className={cardClass}>
        <h2 className={css({ fontSize: "xl", fontWeight: "bold", mb: "4" })}>방 만들기</h2>
        <CreateRoomForm />
      </section>
      <HomeGuide />
    </main>
  );
}
