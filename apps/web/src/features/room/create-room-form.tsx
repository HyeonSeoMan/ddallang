"use client";

import { useMutation } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { css } from "styled-system/css";
import {
  ApiError,
  bearerHeader,
  getApiClient,
  NetworkError,
  type Room,
  type RoomMember,
} from "@/lib/api";
import {
  beginCreateAttempt,
  type CreateAttempt,
  completeCreateAttempt,
  discardCreateAttempt,
  getCreateAttempt,
} from "@/lib/identity";
import { validateRoomText } from "@/lib/validation/room-text";
import { Banner } from "@/ui/banner";
import { Button } from "@/ui/button";
import { selectClass } from "@/ui/select-style";
import { TextField } from "@/ui/text-field";
import { CREATE_UNKNOWN_NOTICE, IDENTITY_KEY_NOTICE, reasonMessage } from "./messages";
import { sessionAtom } from "./state";

const UNIT_PRESETS = ["원", "점수", "칩"] as const;
const CUSTOM_UNIT = "__custom__";

type Field = "name" | "unit" | "nickname";
type FieldErrors = Partial<Record<Field, string[]>>;

interface CreateBody {
  name: string;
  unit: string;
  nickname: string;
}

interface Sent {
  attempt: CreateAttempt;
  body: CreateBody;
}

interface Created {
  attemptId: string;
  room: Room;
  me: RoomMember;
}

const STORAGE_FAILURE_MESSAGES = {
  "storage-failed":
    "브라우저 저장소를 사용할 수 없어 방을 만들 수 없습니다. 저장소 차단(시크릿 모드 등)을 해제해 주세요.",
  "key-not-confirmed": "신원 정보를 이 브라우저에 저장했지만 확인하지 못해 방을 만들 수 없습니다.",
  "locks-unsupported": "이 브라우저에서는 방을 만들 수 없습니다.",
} as const;

/**
 * 방 생성 화면(FE-S1-1, S1 §3.1·§3.2·§4.1·§6.5·§9). 입력은 메모리에만 두며 저장소에 초안을 쓰지 않는다
 * (새로고침하면 사라진다, AC-SYS-002-4). 응답을 받지 못하면 자동 재전송 없이 같은 시도의 키로 사용자가 재시도한다.
 */
export function CreateRoomForm() {
  const router = useRouter();
  const setSession = useSetAtom(sessionAtom);
  const unitSelectId = useId();

  const [name, setName] = useState("");
  const [unitChoice, setUnitChoice] = useState<string>(UNIT_PRESETS[0]);
  const [customUnit, setCustomUnit] = useState("");
  const [nickname, setNickname] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [unknown, setUnknown] = useState(false);
  /** 결과를 알 수 없는 시도. 재시도는 같은 시도의 키·내용을 쓴다. */
  const sentRef = useRef<Sent | null>(null);
  /** 방은 만들어졌지만 키 연결에 실패한 시도. 새 방을 또 만들지 않고 연결만 다시 시도한다(F05). */
  const [linkPending, setLinkPending] = useState<Created | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const mutation = useMutation({
    mutationFn: ({ attempt, body }: Sent) =>
      getApiClient().request<{ room: Room; me: RoomMember }>({
        method: "POST",
        path: "/rooms",
        body,
        headers: bearerHeader(attempt.key),
      }),
    retry: false,
  });
  const pending = mutation.isPending;
  /** 결과 불명·연결 대기 중에는 입력을 잠가 재시도가 처음 보낸 내용과 어긋나지 않게 한다. */
  const locked = pending || unknown || linkPending !== null;

  async function send(sent: Sent) {
    setNotice(null);
    setErrors({});
    setUnknown(false);
    try {
      const { data } = await mutation.mutateAsync(sent);
      sentRef.current = null;
      link({ attemptId: sent.attempt.attemptId, room: data.room, me: data.me });
    } catch (error) {
      const resultUnknown =
        error instanceof NetworkError ||
        (error instanceof ApiError && (error.status >= 500 || (error.status >= 200 && error.status < 300)));
      if (resultUnknown) {
        sentRef.current = sent; // 자동 재전송 없이 같은 시도로 사용자 재시도
        if (mounted.current) setUnknown(true);
        return;
      }
      // 서버가 거부(4xx)했다: 방이 만들어지지 않았으므로 시도를 끝내고 입력을 유지한다.
      sentRef.current = null;
      discardCreateAttempt(sent.attempt.attemptId);
      if (!mounted.current) return;
      if (error instanceof ApiError) {
        const next: FieldErrors = {};
        for (const detail of error.details) {
          if (detail.field === "name" || detail.field === "unit" || detail.field === "nickname") {
            (next[detail.field] ??= []).push(reasonMessage(detail.code));
          }
        }
        setErrors(next);
        if (Object.keys(next).length === 0) setNotice(error.message);
        return;
      }
      throw error;
    }
  }

  /** 키를 초대 코드에 연결하고 방 화면으로 간다. 실패하면 새 방을 만들지 않고 연결만 다시 시도하게 한다. */
  function link(created: Created) {
    // 방이 만들어졌다면 화면을 떠났더라도 키 연결(저장소 작업)은 끝낸다. 화면 갱신·이동만 막는다.
    const linked = completeCreateAttempt(created.attemptId, created.room.inviteCode);
    if (!mounted.current) return;
    if (!linked.ok) {
      setLinkPending(created);
      setNotice(
        `방은 만들어졌지만 이 브라우저에 신원 정보를 저장하지 못했습니다. ${STORAGE_FAILURE_MESSAGES[linked.reason]}`,
      );
      return;
    }
    setLinkPending(null);
    setNotice(null);
    setSession({ inviteCode: created.room.inviteCode, roomId: created.room.id, me: created.me });
    router.push(`/invite/${encodeURIComponent(created.room.inviteCode)}`);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending || linkPending) return;

    const unitRaw = unitChoice === CUSTOM_UNIT ? customUnit : unitChoice;
    const checks = {
      name: validateRoomText(name),
      unit: validateRoomText(unitRaw),
      nickname: validateRoomText(nickname),
    };
    const nextErrors: FieldErrors = {};
    for (const field of ["name", "unit", "nickname"] as const) {
      if (checks[field].reasons.length > 0) {
        nextErrors[field] = checks[field].reasons.map((code) => reasonMessage(code));
      }
    }
    setNotice(null);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return; // 사유 전체를 한 번에 표시하고 보내지 않는다

    const begun = beginCreateAttempt();
    if (!begun.ok) {
      setNotice(STORAGE_FAILURE_MESSAGES[begun.reason]);
      return;
    }
    void send({
      attempt: begun.attempt,
      body: { name: checks.name.value, unit: checks.unit.value, nickname: checks.nickname.value },
    });
  }

  function retry() {
    const sent = sentRef.current;
    if (!sent || pending) return;
    // 다른 탭이 대기 항목을 지웠다면 같은 키를 쓸 수 없다. 새 키로 몰래 재전송하지 않고 처음부터 다시 하게 한다.
    if (!getCreateAttempt(sent.attempt.attemptId)) {
      sentRef.current = null;
      setUnknown(false);
      setNotice("이전 시도 정보를 찾을 수 없습니다. 입력을 확인하고 처음부터 다시 만들어 주세요.");
      return;
    }
    void send(sent);
  }

  function cancelRetry() {
    if (sentRef.current) discardCreateAttempt(sentRef.current.attempt.attemptId);
    sentRef.current = null;
    setUnknown(false);
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={css({ display: "flex", flexDirection: "column", gap: "4" })}
    >
      <TextField
        label="방 이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
        errors={errors.name}
        disabled={locked}
        autoComplete="off"
      />

      <div className={css({ display: "flex", flexDirection: "column", gap: "1" })}>
        <label htmlFor={unitSelectId} className={css({ fontWeight: "semibold" })}>
          정산 단위
        </label>
        <select
          id={unitSelectId}
          value={unitChoice}
          onChange={(e) => setUnitChoice(e.target.value)}
          disabled={locked}
          aria-invalid={unitChoice !== CUSTOM_UNIT && errors.unit ? true : undefined}
          aria-describedby={unitChoice !== CUSTOM_UNIT && errors.unit ? `${unitSelectId}-error` : undefined}
          className={selectClass}
        >
          {UNIT_PRESETS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
          <option value={CUSTOM_UNIT}>직접 입력</option>
        </select>
        {/* 목록에서 고른 단위를 서버가 거부하면(예: 허용 규칙 변경) 여기에 사유를 보인다. */}
        {unitChoice !== CUSTOM_UNIT && errors.unit ? (
          <div id={`${unitSelectId}-error`} aria-live="polite" className={css({ color: "errorText" })}>
            {errors.unit.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        ) : null}
      </div>
      {unitChoice === CUSTOM_UNIT ? (
        <TextField
          label="정산 단위 직접 입력"
          value={customUnit}
          onChange={(e) => setCustomUnit(e.target.value)}
          errors={errors.unit}
          disabled={locked}
          autoComplete="off"
        />
      ) : null}

      <TextField
        label="내 닉네임"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        errors={errors.nickname}
        disabled={locked}
        autoComplete="off"
      />

      <p className={css({ color: "inkMuted", fontSize: "sm" })}>{IDENTITY_KEY_NOTICE}</p>

      {notice ? <Banner tone="error">{notice}</Banner> : null}

      {linkPending ? (
        <Button onClick={() => link(linkPending)}>신원 정보 저장 다시 시도</Button>
      ) : unknown ? (
        <>
          <Banner tone="warning">{CREATE_UNKNOWN_NOTICE}</Banner>
          <div className={css({ display: "flex", gap: "2" })}>
            <Button onClick={retry} disabled={pending}>
              다시 시도
            </Button>
            <Button variant="secondary" onClick={cancelRetry} disabled={pending}>
              취소
            </Button>
          </div>
        </>
      ) : (
        <Button type="submit" disabled={pending}>
          {pending ? "만드는 중…" : "방 만들기"}
        </Button>
      )}
    </form>
  );
}
