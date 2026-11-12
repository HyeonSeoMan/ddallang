"use client";

import { useAtom, useAtomValue } from "jotai";
import { useRef } from "react";
import { useState } from "react";
import { css } from "styled-system/css";
import {
  ApiError,
  bearerHeader,
  getApiClient,
  NetworkError,
  type Participant,
  type ParticipantStatus,
} from "@/lib/api";
import { getStoredKey } from "@/lib/identity";
import { validateRoomText } from "@/lib/validation/room-text";
import { reasonMessage } from "@/features/room/messages";
import { useCanMutate } from "@/features/room/server-data-gate";
import { sessionAtom, snapshotAtom } from "@/features/room/state";
import { useAnnounce } from "@/ui/announcer";
import { Badge } from "@/ui/badge";
import { Banner } from "@/ui/banner";
import { Button } from "@/ui/button";
import { TextField } from "@/ui/text-field";
import { participantDraftsAtom } from "./state";

/** 닉네임 비교 키: NFC로 정규화하고 `A-Z`만 소문자로 바꾼다(S1 §3.2). */
export function nicknameKey(nickname: string): string {
  return nickname.normalize("NFC").replace(/[A-Z]/g, (c) => c.toLowerCase());
}

const NO_KEY_MESSAGE = "이 브라우저에 저장된 신원 정보를 찾을 수 없습니다. 초대 링크로 다시 입장해 주세요.";
const UNKNOWN_RESULT_MESSAGE = "응답을 받지 못했습니다. 참여자 목록에서 결과를 확인해 주세요.";

const isUnknownResult = (error: unknown) =>
  error instanceof NetworkError || (error instanceof ApiError && error.status >= 500);

/**
 * 참여자 영역(FE-S1-4, S1 §4.5~4.7·§6.5·§9). 목록은 `order` 순(서버 순서)이고 비활성 참여자도 보인다.
 * 방장에게만 등록·비활성화·재활성화 컨트롤이 있으며 게임이 종료되면 컨트롤을 숨긴다(AC-PART-004-3).
 * 변경 결과는 스트림의 변경 알림 뒤 갱신으로 목록에 반영된다.
 */
export function ParticipantsSection() {
  const snapshot = useAtomValue(snapshotAtom);
  const session = useAtomValue(sessionAtom);
  const announce = useAnnounce();
  const canMutate = useCanMutate();
  const [drafts, setDrafts] = useAtom(participantDraftsAtom);
  /** 상태 변경 요청(재시도의 목록 조회 구간 포함)이 진행 중인가. 이중 클릭이 같은 요청을 두 번 보내지 않게 한다. */
  const busy = useRef(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  /** 상태 변경이 진행 중인 참여자 ID와, 결과를 알 수 없어 재시도를 기다리는 변경. */
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // 결과를 알 수 없는 상태 변경: 참여자별로 보존한다(다른 참여자의 처리 결과가 이 정보를 지우면 재조회 보호가 우회된다).
  const [unknownToggles, setUnknownToggles] = useState<Record<string, ParticipantStatus>>({});
  const markUnknown = (id: string, target: ParticipantStatus) => setUnknownToggles((prev) => ({ ...prev, [id]: target }));
  const clearUnknown = (id: string) =>
    setUnknownToggles((prev) => {
      if (!(id in prev)) return prev;
      const rest = { ...prev };
      delete rest[id];
      return rest;
    });
  const [rowNotice, setRowNotice] = useState<{ id: string; message: string } | null>(null);

  if (!snapshot || !session) return null;
  const { room, me, participants } = snapshot;
  const canControl = me.isHost && canMutate;
  const draft = drafts[room.id] ?? "";
  const setDraft = (value: string) => setDrafts((prev) => ({ ...prev, [room.id]: value }));
  const base = `/rooms/${encodeURIComponent(room.id)}/participants`;

  function authHeaders() {
    const key = getStoredKey(session!.inviteCode);
    return key ? bearerHeader(key) : null;
  }

  async function fetchParticipants(headers: Record<string, string>) {
    const { data } = await getApiClient().request<{ participants: Participant[] }>({
      method: "GET",
      path: base,
      headers,
    });
    return data.participants;
  }

  async function onRegister(event: React.FormEvent) {
    event.preventDefault();
    if (registering) return;
    const check = validateRoomText(draft);
    setNotice(null);
    setErrors(check.reasons.map((code) => reasonMessage(code)));
    if (check.reasons.length > 0) return;
    const headers = authHeaders();
    if (!headers) {
      setNotice(NO_KEY_MESSAGE);
      return;
    }

    setRegistering(true);
    try {
      await getApiClient().request({ method: "POST", path: base, body: { nickname: check.value }, headers });
      setDraft("");
      announce("참여자를 등록했습니다.");
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
        const reasons = error.details.filter((d) => d.field === "nickname").map((d) => reasonMessage(d.code));
        if (reasons.length > 0) setErrors(reasons);
        else setNotice(error.message); // 필드에 매핑되지 않는 사유도 숨기지 않는다
      } else if (error instanceof ApiError && error.code === "NICKNAME_TAKEN") {
        // 응답이 유실된 뒤 재등록일 수 있다. 목록을 다시 조회해 같은 닉네임이 있는지 확인한다(S1 §6.5).
        try {
          const current = await fetchParticipants(headers);
          const exists = current.some((p) => nicknameKey(p.nickname) === nicknameKey(check.value));
          // 유실된 요청의 성공을 단정하지 않는다: 기존 등록 사실만 알린다.
          setNotice(exists ? "이미 등록되어 있습니다" : error.message);
        } catch {
          setNotice(error.message);
        }
      } else if (isUnknownResult(error)) {
        setNotice(UNKNOWN_RESULT_MESSAGE); // 저장 여부를 단정하지 않는다
      } else if (error instanceof ApiError) {
        setNotice(error.message); // 한도 초과(닉네임 유지)·HOST_ONLY·GAME_ENDED 등은 서버 안내 그대로
      } else {
        throw error;
      }
    } finally {
      setRegistering(false);
    }
  }

  /** PATCH를 보내고 결과를 행에 반영한다. 호출자가 `busy`를 잡고 있어야 한다. */
  async function sendStatus(participant: Participant, target: ParticipantStatus) {
    const headers = authHeaders();
    if (!headers) {
      setRowNotice({ id: participant.id, message: NO_KEY_MESSAGE });
      return;
    }
    setTogglingId(participant.id);
    setRowNotice(null);
    try {
      await getApiClient().request({
        method: "PATCH",
        path: `${base}/${encodeURIComponent(participant.id)}`,
        body: { status: target },
        headers,
      });
      clearUnknown(participant.id);
      announce(target === "INACTIVE" ? "참여자를 비활성화했습니다." : "참여자를 재활성화했습니다.");
    } catch (error) {
      if (isUnknownResult(error)) {
        markUnknown(participant.id, target);
        setRowNotice({ id: participant.id, message: "결과를 확인하지 못했습니다." });
      } else if (error instanceof ApiError) {
        clearUnknown(participant.id);
        setRowNotice({ id: participant.id, message: error.message });
      } else {
        throw error;
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function changeStatus(participant: Participant, target: ParticipantStatus) {
    if (busy.current) return; // 이중 클릭
    busy.current = true;
    try {
      await sendStatus(participant, target);
    } finally {
      busy.current = false;
    }
  }

  /** 결과 불명 뒤 재시도: 다른 방장 탭이 바꿨을 수 있으므로 먼저 목록을 다시 조회해 현재 상태를 확인한다. */
  async function retryStatus(participant: Participant, target: ParticipantStatus) {
    if (busy.current) return; // 목록 조회 구간의 이중 클릭도 막는다
    busy.current = true;
    try {
      const headers = authHeaders();
      if (!headers) {
        setRowNotice({ id: participant.id, message: NO_KEY_MESSAGE });
        return;
      }
      try {
        const current = (await fetchParticipants(headers)).find((p) => p.id === participant.id);
        if (current?.status === target) {
          clearUnknown(participant.id);
          setRowNotice({ id: participant.id, message: "이미 해당 상태입니다." });
          return;
        }
      } catch (error) {
        setRowNotice({
          id: participant.id,
          message: error instanceof ApiError ? error.message : "결과를 확인하지 못했습니다.",
        });
        return;
      }
      await sendStatus(participant, target);
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "3" })}>
      {participants.length === 0 ? <p>등록된 참여자가 없습니다.</p> : null}
      <ul className={css({ display: "flex", flexDirection: "column", gap: "2" })}>
        {participants.map((p) => {
          const next: ParticipantStatus = p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
          // 다른 접속자의 변경·재조회로 이미 목표 상태가 되었다면 결과 불명 안내와 재시도를 걷는다.
          const unknownTarget = unknownToggles[p.id];
          const isUnknown = unknownTarget !== undefined && p.status !== unknownTarget;
          return (
            <li key={p.id} className={css({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2" })}>
              <span>{p.nickname}</span>
              {p.status === "INACTIVE" ? <Badge tone="neutral">비활성</Badge> : null}
              {canControl ? (
                isUnknown ? (
                  <Button
                    variant="secondary"
                    disabled={togglingId !== null}
                    onClick={() => void retryStatus(p, unknownTarget)}
                    aria-label={`${p.nickname} 상태 변경 다시 시도`}
                  >
                    다시 시도
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={togglingId !== null}
                    onClick={() => void changeStatus(p, next)}
                    aria-label={`${p.nickname} ${next === "INACTIVE" ? "비활성화" : "재활성화"}`}
                  >
                    {next === "INACTIVE" ? "비활성화" : "재활성화"}
                  </Button>
                )
              ) : null}
              {isUnknown && rowNotice?.id !== p.id ? (
                <span role="alert" className={css({ color: "errorText" })}>
                  결과를 확인하지 못했습니다.
                </span>
              ) : null}
              {rowNotice?.id === p.id && !(unknownTarget !== undefined && p.status === unknownTarget) ? (
                <span role="alert" className={css({ color: "errorText" })}>
                  {rowNotice.message}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {canControl ? (
        <form onSubmit={(e) => void onRegister(e)} noValidate className={css({ display: "flex", flexDirection: "column", gap: "2" })}>
          <TextField
            label="참여자 닉네임"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            errors={errors}
            disabled={registering}
            autoComplete="off"
          />
          {notice ? <Banner tone="error">{notice}</Banner> : null}
          <Button type="submit" disabled={registering}>
            {registering ? "등록 중…" : "참여자 등록"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
