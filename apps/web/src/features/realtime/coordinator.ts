// 갱신 코디네이터(FE-S5-2, S5 §6.3·§6.4): 연결 하나의 `seen`·`dirty`와 갱신 주기를 관리한다.
// 연결(스트림)마다 하나를 만들고, 연결이 끊기면 `dispose`한 뒤 새로 만든다(늦은 응답은 버려진다).
import type { SseItem } from "./sse-parser";
import type { SnapshotResult } from "./snapshot";
import type { RoomSnapshot } from "@/features/room/state";

/**
 * 방 상태와 정산 종류가 어긋나면 반영하지 않고 다시 조회한다. 어긋남 자체는 연결 실패가 아니며(S4 §6.4)
 * 종료는 되돌릴 수 없으므로 다시 조회하면 일치로 수렴한다. 서버가 계속 어긋나도 폭주하지 않도록
 * 재조회 사이에 짧은 대기(점점 늘어 최대 3초)를 둔다. 그동안 서버 유래 영역은 보이지 않는다.
 */
export function mismatchRetryDelay(consecutiveMismatches: number): number {
  return Math.min(250 * 2 ** (consecutiveMismatches - 1), 3_000);
}

export interface CoordinatorDeps {
  /**
   * 5개 조회를 한꺼번에 시작해 결과를 돌려준다. 실패하면 던진다. 필터는 시작 시점의 값을 쓴다.
   * `signal`은 연결이 버려질 때(`dispose`) 진행 중인 요청을 중단한다.
   */
  fetchSnapshot(signal: AbortSignal): Promise<SnapshotResult>;
  /** 스냅샷을 반영한다. 연결 세대가 현재가 아니면 `false`(늦은 응답)이며 코디네이터는 멈춘다. */
  applySnapshot(snapshot: RoomSnapshot): boolean;
  /** 갱신 주기가 성공했다(재연결 간격 초기화·복구 표시에 쓴다). */
  onCycleSucceeded(): void;
  /** 갱신 주기가 실패했다. 끊김 전환과 재연결은 호출자가 한다. */
  onRefreshFailed(error: unknown): void;
}

export interface Coordinator {
  handle(item: SseItem): void;
  /** 사용자 동작(필터 변경 등)으로 새 순회가 필요할 때 전체 갱신을 한 번 더 요청한다. `ready` 전에는 무시. */
  requestRefresh(): void;
  /** 이후의 모든 응답·이벤트를 버린다. */
  dispose(): void;
  readonly state: { seen: number; dirty: boolean; running: boolean; ready: boolean };
}

function revisionOf(item: Extract<SseItem, { kind: "event" }>): number | undefined {
  if (item.malformed) return undefined;
  const value = (item.data as { revision?: unknown } | null)?.revision;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function createCoordinator(deps: CoordinatorDeps): Coordinator {
  const state = { seen: 0, dirty: false, running: false, ready: false };
  /** `dirty`가 참으로 설정될 때마다 올라간다. 주기 도중 새 변경이 알려졌는지 판단한다. */
  let dirtyGeneration = 0;
  let latestCycle = 0;
  let mismatches = 0;
  let disposed = false;
  let failed = false;
  const abort = new AbortController();

  function markDirty() {
    state.dirty = true;
    dirtyGeneration += 1;
  }

  async function runCycles() {
    if (state.running) return; // 합치기: 한 번에 한 주기. 진행 중에 변경이 알려지면 끝난 뒤 한 주기를 더 한다.
    state.running = true;
    try {
      while (state.dirty && !disposed && !failed) {
        const generation = dirtyGeneration;
        const cycle = ++latestCycle;
        let result: SnapshotResult;
        try {
          result = await deps.fetchSnapshot(abort.signal);
        } catch (error) {
          if (disposed) return;
          failed = true; // dirty는 참으로 남고 복구는 재연결이 한다
          deps.onRefreshFailed(error);
          return;
        }
        // 가장 최근에 시작한 주기의 응답만, 그리고 이 연결이 살아 있을 때만 반영한다.
        if (disposed || cycle !== latestCycle) return;

        if (!result.ok) {
          // 반영하지 않고 다시 조회한다(dirty는 그대로 참). 연결 실패로 보지 않는다.
          mismatches += 1;
          await new Promise<void>((resolve) => {
            const timer = setTimeout(done, mismatchRetryDelay(mismatches));
            function done() {
              clearTimeout(timer);
              abort.signal.removeEventListener("abort", done);
              resolve();
            }
            abort.signal.addEventListener("abort", done, { once: true }); // dispose하면 대기를 바로 끝낸다
          });
          continue;
        }
        mismatches = 0;
        if (!deps.applySnapshot(result.snapshot)) {
          disposed = true; // 이전 세대의 늦은 응답이다
          abort.abort();
          return;
        }
        // 이 주기가 시작될 때 이미 알려진 변경만 반영된 것이다. 그 뒤에 알려진 변경은 dirty로 남는다.
        if (dirtyGeneration === generation) state.dirty = false;
        deps.onCycleSucceeded();
      }
    } finally {
      state.running = false;
    }
  }

  function refresh() {
    void runCycles();
  }

  return {
    state,
    dispose() {
      disposed = true;
      abort.abort(); // 진행 중인 조회를 중단한다(끊김·언마운트 뒤에 요청이 남지 않는다)
    },
    requestRefresh() {
      if (disposed || failed || !state.ready) return;
      markDirty();
      refresh();
    },
    handle(item) {
      if (disposed || failed || item.kind !== "event") return;

      if (item.event === "ready") {
        // 1) ready{revision: R}: seen = R, dirty = 참, 재동기화
        const revision = revisionOf(item);
        state.seen = revision ?? state.seen;
        state.ready = true;
        markDirty();
        refresh();
        return;
      }
      // 스트림을 먼저 연결하고 ready 뒤에 처음 데이터를 채운다(S5 §6.4). ready 전의 항목은 무시한다.
      if (!state.ready) return;

      const revision = revisionOf(item);
      if (item.event === "heartbeat") {
        // 3) 하트비트: 누락(H > seen)이면 갱신. 아니면 새로 할 일이 없다.
        if (item.malformed) {
          markDirty();
          refresh();
        } else if (revision !== undefined && revision > state.seen) {
          state.seen = revision;
          markDirty();
          refresh();
        }
        return;
      }
      // 2)·4) 변경 이벤트(알 수 없는 이름 포함)와 해석 실패
      if (revision === undefined) {
        markDirty();
        refresh();
        return;
      }
      if (revision <= state.seen) return; // 중복·이미 아는 과거 이벤트
      state.seen = revision; // revision > seen + 1(누락)이어도 같다. 갱신은 항상 전체를 조회한다.
      markDirty();
      refresh();
    },
  };
}
