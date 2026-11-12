"use client";

import { useReducer } from "react";
import { css } from "styled-system/css";
import { initialInviteStage, inviteReducer } from "./invite-stage";
import { RoomLayout } from "./room-layout";

/**
 * `/invite/{inviteCode}` 화면의 셸. 단계 전환 로직은 `invite-stage.ts`에 있고
 * 각 단계의 내용은 이후 Task(S1-2 입장, S5 코어·S1-3~ 방 화면)가 채운다.
 */
export function InviteScreen({ inviteCode }: { inviteCode: string }) {
  const [state] = useReducer(inviteReducer, initialInviteStage);

  return (
    <main data-invite-code={inviteCode} data-stage={state.stage}>
      <h1 className={css({ fontSize: "2xl", fontWeight: "bold", p: "4" })}>DDALLANG</h1>
      {state.stage === "checking" ? <p className={css({ px: "4" })}>확인 중…</p> : null}
      {state.stage === "room" ? <RoomLayout /> : null}
    </main>
  );
}
