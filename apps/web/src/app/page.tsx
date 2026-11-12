import { css } from "styled-system/css";
import { CreateRoomForm } from "@/features/room/create-room-form";
import { BrandHeader, cardClass } from "@/ui/brand-header";

export default function HomePage() {
  return (
    <main className={css({ maxW: "md", mx: "auto", p: "4" })}>
      <BrandHeader />
      <section className={cardClass}>
        <h2 className={css({ fontSize: "xl", fontWeight: "bold", mb: "4" })}>방 만들기</h2>
        <CreateRoomForm />
      </section>
    </main>
  );
}
