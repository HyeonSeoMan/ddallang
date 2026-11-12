// 연결 제어·재연결(FE-S5-3, S5 §6.5·§6.6): 스트림 하나를 열고 끊김을 판정하며 다시 연결한다.
// 시간·네트워크·브라우저 이벤트는 모두 주입받아 가짜 시계와 가짜 스트림으로 시험한다(FD-8).
import { isInaccessibleError } from "./access";
import type { Coordinator } from "./coordinator";
import type { EventStreamEnd } from "./event-stream";
import type { SseItem } from "./sse-parser";

/** 마지막 수신 후 이 시간이 지나면 끊김(하트비트 두 번 연속 누락). */
export const STALE_AFTER_MS = 40_000;
/** 페이지가 숨겨져 있던 시간이 이를 넘으면 돌아올 때 즉시 끊김으로 본다(하트비트 간격). */
export const HIDDEN_LIMIT_MS = 15_000;
export const RECONNECT_BASE_MS = 1_000;
export const RECONNECT_MAX_MS = 30_000;
/** 429에 `Retry-After`가 없을 때 쓰는 값(서버는 30초를 보낸다). */
export const DEFAULT_LIMIT_WAIT_MS = 30_000;
/** 복구 직후 `최신 상태로 갱신됨`을 보이는 시간(plan §7 제안). */
export const RECOVERED_NOTICE_MS = 3_000;

export type ConnectionPhase =
  /** 처음 연결하는 중. */
  | "connecting"
  /** 스트림이 열려 있고 최신 갱신이 끝났다. */
  | "connected"
  /** 끊겼다가 복구된 직후(3초). */
  | "recovered"
  /** 끊겨서 다시 연결하는 중(대기 포함). */
  | "reconnecting"
  /** 기기가 오프라인이다. */
  | "offline"
  /** 연결 수 한도(429). 다른 탭을 닫아야 한다. */
  | "limit"
  /** 401·404: 이 방에 접근할 수 없다. 재시도하지 않는다. */
  | "inaccessible";

export interface ConnectionEnv {
  /** `online`·`offline`·`visibilitychange`를 구독하고 해제 함수를 돌려준다. */
  on(type: "online" | "offline" | "visibilitychange", listener: () => void): () => void;
  isOnline(): boolean;
  isVisible(): boolean;
}

export interface StreamHandlers {
  signal: AbortSignal;
  onOpen(): void;
  onActivity(): void;
  onItem(item: SseItem): void;
}

export interface ConnectionDeps {
  /** 스트림을 열고 끝날 때까지 읽는다. 키가 없으면 401 거부를 돌려줘야 한다. */
  openStream(handlers: StreamHandlers): Promise<EventStreamEnd>;
  /** 새 `ready`마다 만든다. 갱신 주기가 성공·실패하면 훅으로 알린다. */
  createCoordinator(
    epoch: number,
    hooks: { onCycleSucceeded(): void; onRefreshFailed(error: unknown): void },
  ): Coordinator;
  /** 연결 상태 원자를 바꾼다. `false`가 되면 스냅샷이 즉시 비워진다(S5 §6.5). */
  setConnected(connected: boolean): void;
  /** 새 연결 세대를 시작하고(스냅샷도 비운다) 세대 번호를 돌려준다. */
  startEpoch(): number;
  setPhase(phase: ConnectionPhase): void;
  now(): number;
  /** 0 이상 1 미만(재연결 간격의 ±20% 무작위). */
  random(): number;
  env: ConnectionEnv;
}

export interface RoomConnection {
  start(): void;
  stop(): void;
  /** 현재 연결의 전체 갱신을 한 번 더 요청한다(필터 변경 등). 연결되어 있지 않으면 무시된다. */
  requestRefresh(): void;
}

/** 1초에서 시작해 연속 실패마다 2배(최대 30초)에 ±20% 무작위를 더한 대기 시간. */
export function reconnectDelay(failures: number, random: number): number {
  const base = Math.min(RECONNECT_BASE_MS * 2 ** failures, RECONNECT_MAX_MS);
  return Math.round(base * (0.8 + random * 0.4));
}

export function createRoomConnection(deps: ConnectionDeps): RoomConnection {
  const { env } = deps;
  let stopped = false;
  let fatal = false;
  /** 연결 번호. 끊김·재연결마다 올라가며 이전 연결의 늦은 콜백을 걸러낸다. */
  let connSeq = 0;
  let controller: AbortController | null = null;
  let coordinator: Coordinator | null = null;
  let lastActivity = 0;
  let hiddenSince: number | null = null;
  /** 연속 실패 횟수. 재연결 뒤 첫 갱신 주기가 성공해야만 0으로 돌아간다. */
  let failures = 0;
  let firstCycleDone = false;
  let hasBeenDisconnected = false;
  /** 429 이후 이 시각 전에는 어떤 이벤트(online·visibilitychange·offline→online)로도 다시 연결하지 않는다. */
  let limitUntil = 0;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  /** 스트림이 열린 뒤 `ready`가 오지 않는 경우를 끊는 시한(열기 전 시한은 `watchdog`이 맡는다). */
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let recoveredTimer: ReturnType<typeof setTimeout> | undefined;
  let removeListeners: Array<() => void> = [];

  const clearTimer = (timer: ReturnType<typeof setTimeout> | undefined) => {
    if (timer !== undefined) clearTimeout(timer);
  };

  function armWatchdog() {
    clearTimer(watchdog);
    watchdog = setTimeout(() => {
      if (deps.now() - lastActivity >= STALE_AFTER_MS) goDisconnected("reconnect-wait");
      else armWatchdog();
    }, STALE_AFTER_MS);
  }

  /** 현재 연결을 버린다: 스트림 중단, 데이터 영역 숨김(스냅샷 비움), 이전 연결의 콜백 무시. */
  function dropConnection() {
    connSeq += 1;
    clearTimer(watchdog);
    clearTimer(readyTimer);
    clearTimer(recoveredTimer);
    controller?.abort();
    controller = null;
    coordinator?.dispose();
    coordinator = null;
    firstCycleDone = false;
    deps.setConnected(false);
  }

  function goDisconnected(next: "reconnect-wait" | "immediate") {
    if (stopped || fatal) return;
    dropConnection();
    hasBeenDisconnected = true;
    if (!env.isOnline()) {
      deps.setPhase("offline"); // `online` 이벤트가 오면 즉시 다시 연결한다
      return;
    }
    deps.setPhase("reconnecting");
    if (next === "immediate") void connect();
    else scheduleReconnect(0);
  }

  function scheduleReconnect(minDelayMs: number) {
    clearTimer(retryTimer);
    if (stopped || fatal || !env.isOnline()) return;
    const delay = Math.max(reconnectDelay(failures, deps.random()), minDelayMs);
    failures += 1;
    if (minDelayMs > 0) limitUntil = deps.now() + delay; // 서버가 정한 재시도 제한(429 Retry-After)
    retryTimer = setTimeout(() => void connect(), delay);
  }

  function goFatal() {
    fatal = true;
    dropConnection();
    clearTimer(retryTimer);
    deps.setPhase("inaccessible");
  }

  function onCycleSucceeded(connId: number) {
    if (connId !== connSeq || firstCycleDone) return;
    firstCycleDone = true;
    failures = 0; // 재연결 뒤 첫 갱신 주기가 성공한 뒤에만 간격을 되돌린다
    if (hasBeenDisconnected) {
      hasBeenDisconnected = false;
      deps.setPhase("recovered");
      clearTimer(recoveredTimer);
      recoveredTimer = setTimeout(() => {
        if (connId === connSeq) deps.setPhase("connected");
      }, RECOVERED_NOTICE_MS);
    } else {
      deps.setPhase("connected");
    }
  }

  function onRefreshFailed(connId: number, error: unknown) {
    if (connId !== connSeq) return;
    if (isInaccessibleError(error)) {
      goFatal(); // 재시도 없이 오류를 안내한다
      return;
    }
    goDisconnected("reconnect-wait"); // 갱신 실패 → 끊김 → 재연결(간격은 초기화되지 않는다)
  }

  function handleEnd(connId: number, end: EventStreamEnd) {
    if (connId !== connSeq || stopped || fatal) return;
    switch (end.kind) {
      case "aborted":
        return;
      case "rejected": {
        const { status, retryAfterSeconds } = end.error;
        if (isInaccessibleError(end.error)) {
          goFatal();
          return;
        }
        if (status === 429) {
          // `Retry-After` 이상 간격으로만 재시도하고 연결 수 한도를 안내한다.
          dropConnection();
          hasBeenDisconnected = true;
          deps.setPhase("limit");
          scheduleReconnect((retryAfterSeconds ?? DEFAULT_LIMIT_WAIT_MS / 1000) * 1000);
          return;
        }
        goDisconnected("reconnect-wait"); // 5xx 등은 위 간격으로 계속 재시도
        return;
      }
      default: // network · ended · broken
        goDisconnected("reconnect-wait");
    }
  }

  async function connect() {
    if (stopped || fatal) return;
    clearTimer(retryTimer);
    limitUntil = 0;
    if (!env.isOnline()) {
      deps.setPhase("offline");
      return;
    }
    // 이전 연결이 남아 있다면 정리한다(즉시 재시도 이벤트가 대기 중에 온 경우 등).
    if (controller) dropConnection();
    const ctl = new AbortController();
    controller = ctl;
    const connId = ++connSeq;
    deps.setPhase(hasBeenDisconnected ? "reconnecting" : "connecting");
    // 연결을 시도하는 동안에도 같은 무수신 시한을 적용한다. 응답 헤더가 오지 않고 `fetch`가 멈춰도 복구된다.
    lastActivity = deps.now();
    armWatchdog();

    const end = await deps.openStream({
      signal: ctl.signal,
      onOpen() {
        if (connId !== connSeq) return;
        lastActivity = deps.now();
        armWatchdog();
        deps.setConnected(true);
        // 열린 뒤 `ready`가 오지 않으면(하트비트만 오는 경우 포함) 데이터가 영원히 비므로 끊고 다시 연결한다.
        clearTimer(readyTimer);
        readyTimer = setTimeout(() => {
          if (connId === connSeq && !coordinator) goDisconnected("reconnect-wait");
        }, STALE_AFTER_MS);
      },
      onActivity() {
        if (connId !== connSeq) return;
        lastActivity = deps.now();
        armWatchdog();
      },
      onItem(item) {
        if (connId !== connSeq) return;
        if (item.kind === "event" && item.event === "ready") {
          // 새 `ready`마다 연결 세대를 올리고(스냅샷을 비운다) `seen`을 재설정해 전체 재동기화한다.
          clearTimer(readyTimer);
          coordinator?.dispose();
          const epoch = deps.startEpoch();
          coordinator = deps.createCoordinator(epoch, {
            onCycleSucceeded: () => onCycleSucceeded(connId),
            onRefreshFailed: (error) => onRefreshFailed(connId, error),
          });
        }
        coordinator?.handle(item);
      },
    });
    handleEnd(connId, end);
  }

  const limited = () => deps.now() < limitUntil;

  function onOnline() {
    if (stopped || fatal) return;
    if (limited()) {
      deps.setPhase("limit"); // 429: Retry-After 이상 간격을 지킨다(예약된 재시도가 시각이 되면 연결한다)
      return;
    }
    if (controller) {
      checkStale(); // 연결 중이거나 열려 있으면 새로 시작하지 않되 멈춘 연결은 끊는다
      return;
    }
    void connect(); // 대기 중이어도 즉시 시도
  }

  function onOffline() {
    if (stopped || fatal) return;
    // `connected`는 `navigator.onLine`이 거짓이 아니어야 한다.
    // 429 대기 중이면 예약된 재시도와 제한 시각을 유지한다(오프라인→온라인 전환이 제한을 풀지 못한다).
    if (!limited()) clearTimer(retryTimer);
    dropConnection();
    hasBeenDisconnected = true;
    deps.setPhase("offline");
  }

  /** 연결(시도 중 포함)이 백그라운드 동안 수신을 놓쳤을 수 있다면 즉시 끊고 다시 연결한다. */
  function checkStale(hiddenFor = 0) {
    if (hiddenFor > HIDDEN_LIMIT_MS || deps.now() - lastActivity > STALE_AFTER_MS) {
      goDisconnected("immediate");
    }
  }

  function onVisibility() {
    if (stopped || fatal) return;
    if (!env.isVisible()) {
      hiddenSince = deps.now();
      return;
    }
    const hiddenFor = hiddenSince === null ? 0 : deps.now() - hiddenSince;
    hiddenSince = null;
    if (limited()) return;
    if (controller) {
      checkStale(hiddenFor);
      return;
    }
    void connect(); // 대기 중이어도 즉시 시도
  }

  return {
    start() {
      if (stopped) return;
      removeListeners = [
        env.on("online", onOnline),
        env.on("offline", onOffline),
        env.on("visibilitychange", onVisibility),
      ];
      if (!env.isVisible()) hiddenSince = deps.now();
      void connect();
    },
    requestRefresh() {
      coordinator?.requestRefresh();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearTimer(retryTimer);
      for (const remove of removeListeners) remove();
      removeListeners = [];
      dropConnection();
    },
  };
}
