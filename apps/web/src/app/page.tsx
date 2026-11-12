import { css } from "styled-system/css";
import { CreateRoomForm } from "@/features/room/create-room-form";

export default function HomePage() {
  return (
    <main className={css({ maxW: "md", mx: "auto", p: "4" })}>
      <h1 className={css({ fontSize: "2xl", fontWeight: "bold", mb: "4" })}>DDALLANG</h1>
      <h2 className={css({ fontSize: "lg", fontWeight: "semibold", mb: "3" })}>방 만들기</h2>
      <CreateRoomForm />
    </main>
  );
}
