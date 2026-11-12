# 프론트엔드 G4 증거 묶음 (`apps/web`, FE-Z1)

- 작성 시점: 2026-11-12. 기준 커밋: `main` 1b3d157(PR #35 병합) 위의 FE-Z1 브랜치.
- 상위 문서: Web Plan·Tasks·AC 매핑표 v1.0.0(`plan.md` §8, `tasks.md` FE-Z1·§I, `ac-matrix.md`), S1 v0.2.x~S5 v0.2.3 Spec. 이 문서는 새로 만든 증거 기록이며 승인된 상위 문서를 고치지 않는다.
- **이 문서는 사용자 승인을 대신하지 않는다.** G4 판정과 병합은 사용자 승인 사항이다. Codex·Claude 검수 PASS도 승인이 아니다.
- 규칙: 실행한 것만 "통과"로 적는다. 실행하지 못한 것·표본이 작은 것·대리 증거인 것은 그렇게 적는다.

## 1. 실행한 게이트 (FE-Z1에서 새로 실행, `apps/web`)

| 명령 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm typecheck` | 통과(exit 0) | `next typegen` + `tsc --noEmit` |
| `pnpm lint` | 통과(exit 0) | ESLint 제한 규칙 포함(`EventSource`·`localStorage`·`navigator.locks`·`console`·`dangerouslySetInnerHTML`) |
| `pnpm test` ×2 | 46파일 574개 통과, 2회 모두 exit 0 | MSW 3 모의 서버·가짜 SSE·가짜 시계. 실서버 시험 2개 파일은 제외 |
| `pnpm check:ac` | 통과: "모든 AC(79개)에 태그 시험이 있습니다" | 태그 **존재**만 확인한다. 통과 증거는 위 `pnpm test`와 §3·§4·§5 |
| `pnpm build` | 통과(exit 0) | `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001` 지정 |
| `pnpm smoke` | 통과(exit 0) | 빌드 산출물을 `next start`로 띄워 `/invite/<임의 코드>` 등 직접 접속 200, 정의되지 않은 경로 404 |
| `pnpm test:latency` | 통과(7개) — PR #34 시점 실행, §4 | 실서버 필요, 기본 시험 제외 |
| `pnpm test:integration` | 통과(5개) — PR #35 시점 실행, §5 | 실서버 필요, 기본 시험 제외 |

실서버 두 시험은 이 문서 작성을 위해 다시 돌리지 않았다(기본 게이트는 이번에 다시 돌렸다). **지연 측정은 PR #34 시점에 실행했고, 이후 PR #35에서 공유 도우미(`src/latency/client.tsx`·`server.ts`: `unit` 인자, `store` 노출, 마운트 실패 메시지)가 바뀌었다.** 기본 인자는 유지됐고 Codex가 정적으로 확인했지만 지연 측정을 그 뒤에 다시 돌리지는 않았다. 연동 점검은 #35의 최종 코드로 실행했다. 명령 출력 원본은 작성 세션의 임시 파일에만 있고 저장소에는 두지 않았다.

## 2. AC 79행 추적 (`ac-matrix.md`)

`apps/web/scripts/ac-report.mjs`가 생성한 표다(`node scripts/ac-report.mjs`). **태그가 달린 시험 파일 위치**이며 시험이 통과했다는 증거가 아니다(통과는 §1의 `pnpm test`). 검사 스크립트 자체 시험(`test/check-ac.test.ts`)의 예시 태그는 제외했다. 구분: 연동 M = 모의 서버로 FE 쪽 시험 완료, R = 실서버 점검·측정이 필요(15행).

- 태그 시험이 하나도 없는 AC: 0개. 기본 시험에 태그가 없고 실서버 시험에만 있는 AC: **AC-VIEW-005-8 하나**(지연 측정, 아래 §4와 §8).
- 위 79행은 FE 몫(`UI`·`통합`)의 태그 존재까지다. `API` 부분은 백엔드 매핑표가 증명하며 이 문서가 확인하지 않는다.

| AC | 구분 | FE 담당 Task | 연동 | 태그 시험 파일(기본 시험) | 실서버 시험(별도 실행) |
| --- | --- | --- | --- | --- | --- |
| AC-ROOM-001-1 | BE+FE | FE-S1-1, FE-F3 | M | features/room/create-room-form.test.tsx<br>lib/identity/identity.test.ts | — |
| AC-ROOM-001-12 | FE | FE-S1-1 | M | features/room/create-room-form.test.tsx | — |
| AC-ROOM-001-13 | BE+FE | FE-S1-1 | M | features/room/create-room-form.test.tsx | — |
| AC-ROOM-001-14 | BE+FE | FE-S3-1, FE-S3-2, FE-S4-2, FE-S4-3 | R | features/balances/balances-section.test.tsx<br>features/settlement/settlement-section.test.tsx<br>features/transactions/transactions-section.test.tsx | integration/integration.test.tsx |
| AC-ROOM-002-2 | BE+FE | FE-S1-5 | M | features/room/not-provided.test.tsx | — |
| AC-ROOM-002-3 | FE | FE-S1-5 | M | features/room/not-provided.test.tsx | — |
| AC-ROOM-002-4 | BE+FE | FE-S1-2 | M | features/room/invite-screen.test.tsx | — |
| AC-ROOM-003-1 | FE | FE-S1-5 | M | features/room/not-provided.test.tsx | — |
| AC-ROOM-003-3 | BE+FE | FE-S3-1, FE-S3-2, FE-S4-2 | R | features/balances/balances-section.test.tsx<br>features/settlement/settlement-section.test.tsx<br>features/transactions/transactions-section.test.tsx | integration/integration.test.tsx |
| AC-ROOM-004-5 | BE+FE | FE-S1-5 | M | features/room/not-provided.test.tsx | — |
| AC-ROOM-005-1 | BE+FE | FE-S1-2 | M | features/room/invite-screen.test.tsx | — |
| AC-ROOM-006-8 | BE+FE | FE-S1-5 | M | features/room/not-provided.test.tsx | — |
| AC-ROOM-006-11 | BE+FE | FE-S1-6, FE-F3 | R | features/room/two-tabs.test.tsx<br>lib/identity/identity.test.ts | — |
| AC-ROOM-008-1 | BE+FE | FE-S1-2 | M | features/room/invite-screen.test.tsx | — |
| AC-ROOM-008-2 | BE+FE | FE-S1-4 | M | features/participants/participants-section.test.tsx | — |
| AC-ROOM-008-3 | BE+FE | FE-S2-2 | M | features/transactions/transaction-form.test.tsx | — |
| AC-PART-001-6 | BE+FE | FE-S1-4 | M | features/participants/participants-section.test.tsx | — |
| AC-PART-002-3 | BE+FE | FE-S2-2 | M | features/transactions/transaction-form.test.tsx | — |
| AC-PART-002-4 | BE+FE | FE-S2-2 | M | features/realtime/s5-two-clients.test.tsx<br>features/transactions/transaction-form.test.tsx | — |
| AC-PART-003-1 | BE+FE | FE-S1-5 | M | features/room/not-provided.test.tsx | — |
| AC-PART-004-3 | FE | FE-S1-4 | M | features/participants/participants-section.test.tsx<br>features/settlement/ended-room.test.tsx | — |
| AC-TXN-001-3 | BE+FE | FE-S2-2 | M | features/transactions/transaction-form.test.tsx | — |
| AC-TXN-001-5 | BE+FE | FE-S2-2, FE-S2-4 | M | features/transactions/s2-provided.test.tsx | — |
| AC-TXN-001-6 | BE+FE | FE-S2-2 | M | features/transactions/transaction-form.test.tsx<br>lib/validation/transaction.test.ts | — |
| AC-TXN-005-1 | FE | FE-S2-3 | M | features/transactions/transaction-actions.test.tsx | — |
| AC-TXN-005-2 | FE | FE-S2-3 | M | features/transactions/transaction-actions.test.tsx | — |
| AC-TXN-005-6 | BE+FE | FE-S2-3 | M | features/transactions/transaction-actions.test.tsx | — |
| AC-TXN-007-1 | FE | FE-S2-2, FE-F8 | M | features/transactions/transaction-form.test.tsx<br>lib/mutation/manager.test.ts | — |
| AC-TXN-007-5 | BE+FE | FE-F8, FE-S2-1 | M | features/transactions/transaction-form.test.tsx<br>lib/mutation/manager.test.ts | — |
| AC-TXN-007-6 | FE | FE-F8, FE-S2-1 | M | features/transactions/transaction-form.test.tsx<br>lib/mutation/manager.test.ts | — |
| AC-TXN-007-12 | BE+FE | FE-F8, FE-S2-1 | M | features/transactions/transaction-form.test.tsx<br>lib/mutation/manager.test.ts | — |
| AC-TXN-008-1 | FE | FE-S2-1, FE-S2-2 | M | features/transactions/transaction-form.test.tsx | — |
| AC-TXN-008-2 | FE | FE-S2-2 | M | features/transactions/transaction-form.test.tsx | — |
| AC-TXN-008-3 | FE | FE-F8, FE-S2-1 | M | features/transactions/transaction-form.test.tsx<br>lib/mutation/manager.test.ts | — |
| AC-TXN-008-5 | BE+FE | FE-S2-1, FE-S5-5 | R | features/realtime/s5-two-clients.test.tsx<br>features/transactions/transaction-form.test.tsx | integration/integration.test.tsx |
| AC-TXN-009-3 | FE | FE-S2-2, FE-S2-3, FE-S4-4 | M | features/settlement/ended-room.test.tsx<br>features/transactions/transaction-actions.test.tsx<br>features/transactions/transaction-form.test.tsx | — |
| AC-TXN-009-4 | BE+FE | FE-S2-4 | M | features/transactions/s2-provided.test.tsx | — |
| AC-VIEW-001-1 | FE | FE-F6, FE-S3-1 | M | features/room/room.test.tsx | — |
| AC-VIEW-001-2 | BE+FE | FE-S3-1 | M | features/balances/balances-section.test.tsx | — |
| AC-VIEW-003-4 | BE+FE | FE-S3-2, FE-S3-3 | M | features/transactions/s3-integration.test.tsx<br>features/transactions/transactions-section.test.tsx | — |
| AC-VIEW-004-3 | BE+FE | FE-S3-2 | M | features/transactions/transactions-section.test.tsx | — |
| AC-VIEW-004-5 | FE | FE-S3-2 | M | features/transactions/transactions-section.test.tsx | — |
| AC-VIEW-004-8 | BE+FE | FE-S3-2, FE-S3-3 | M | features/transactions/s3-integration.test.tsx<br>features/transactions/transactions-section.test.tsx | — |
| AC-VIEW-005-1 | BE+FE | FE-S5-2, FE-S5-5 | R | features/realtime/coordinator.test.ts<br>features/realtime/s5-two-clients.test.tsx<br>features/realtime/use-room-connection.test.tsx | integration/integration.test.tsx |
| AC-VIEW-005-2 | BE+FE | FE-S5-2, FE-S5-5 | R | features/realtime/coordinator.test.ts<br>features/realtime/s5-two-clients.test.tsx<br>features/realtime/use-room-connection.test.tsx | integration/integration.test.tsx |
| AC-VIEW-005-3 | BE+FE | FE-S5-5, FE-S2-2 | R | features/realtime/s5-two-clients.test.tsx | integration/integration.test.tsx |
| AC-VIEW-005-4 | BE+FE | FE-S5-5, FE-S4-4 | R | features/realtime/s5-two-clients.test.tsx<br>features/settlement/ended-room.test.tsx | — |
| AC-VIEW-005-5 | BE+FE | FE-S5-5, FE-S4-2 | R | features/realtime/s5-two-clients.test.tsx<br>features/settlement/settlement-integration.test.tsx | integration/integration.test.tsx |
| AC-VIEW-005-6 | FE | FE-S5-5 | M | features/realtime/s5-ui.test.tsx | — |
| AC-VIEW-005-7 | FE | FE-S5-2, FE-S3-3 | M | features/realtime/snapshot.test.ts<br>features/transactions/s3-integration.test.tsx | — |
| AC-VIEW-005-8 | BE+FE | FE-S5-6 | R | — | latency/latency.test.tsx |
| AC-SYS-001-1 | FE | FE-S5-4 | M | features/realtime/connection-banner.test.tsx<br>features/realtime/s5-ui.test.tsx | — |
| AC-SYS-001-2 | FE | FE-S5-4 | M | features/realtime/connection.test.ts<br>features/realtime/s5-ui.test.tsx<br>features/realtime/use-room-connection.test.tsx | — |
| AC-SYS-001-3 | FE | FE-S5-4 | M | features/realtime/s5-ui.test.tsx | — |
| AC-SYS-001-4 | FE | FE-S5-4 | M | features/realtime/connection-banner.test.tsx<br>features/realtime/s5-ui.test.tsx | — |
| AC-SYS-001-5 | FE | FE-S5-4 | M | features/participants/participants-section.test.tsx<br>features/realtime/s5-ui.test.tsx<br>features/transactions/transaction-actions.test.tsx<br>features/transactions/transaction-form.test.tsx | — |
| AC-SYS-002-1 | BE+FE | FE-S5-3, FE-S5-5 | R | features/realtime/s5-ui.test.tsx<br>features/realtime/use-room-connection.test.tsx | integration/integration.test.tsx |
| AC-SYS-002-2 | FE | FE-S5-5 | M | features/realtime/s5-two-clients.test.tsx<br>features/realtime/s5-ui.test.tsx<br>features/transactions/transaction-form.test.tsx | — |
| AC-SYS-002-3 | BE+FE | FE-S5-5 | R | features/realtime/s5-two-clients.test.tsx | integration/integration.test.tsx |
| AC-SYS-002-4 | FE | FE-S5-5, FE-S1-1 | M | features/realtime/s5-two-clients.test.tsx<br>features/room/create-room-form.test.tsx<br>lib/mutation/manager.test.ts | — |
| AC-SYS-002-5 | BE+FE | FE-S5-5, FE-S2-1 | R | features/realtime/s5-two-clients.test.tsx<br>features/transactions/transaction-form.test.tsx | integration/integration.test.tsx |
| AC-SET-001-1 | FE | FE-S4-1 | M | features/settlement/end-game.test.tsx | — |
| AC-SET-004-3 | FE | FE-S4-2, FE-S4-3 | M | features/settlement/settlement-section.test.tsx<br>lib/settlement-text.test.ts | — |
| AC-SET-005-2 | FE | FE-S4-3 | M | features/settlement/settlement-section.test.tsx | — |
| AC-SET-005-3 | FE | FE-S4-3 | M | features/settlement/settlement-section.test.tsx<br>lib/settlement-text.test.ts | — |
| AC-SET-005-4 | FE | FE-S4-3 | M | lib/settlement-text.test.ts | — |
| AC-SET-005-5 | FE | FE-S4-3 | M | features/settlement/settlement-section.test.tsx | — |
| AC-SET-005-6 | FE | FE-S4-3, FE-S4-2 | M | features/settlement/settlement-section.test.tsx | — |
| AC-SET-006-1 | BE+FE | FE-S4-2 | M | features/settlement/settlement-section.test.tsx | — |
| AC-SET-006-2 | FE | FE-S4-3 | M | features/settlement/settlement-section.test.tsx | — |
| AC-SET-006-3 | FE | FE-S4-2 | M | features/settlement/settlement-section.test.tsx | — |
| AC-SET-007-1 | BE+FE | FE-S4-2, FE-S4-1 | R | features/realtime/s5-two-clients.test.tsx<br>features/settlement/settlement-integration.test.tsx | integration/integration.test.tsx |
| AC-SET-007-2 | BE+FE | FE-S4-4 | M | features/settlement/ended-room.test.tsx | — |
| AC-SET-008-1 | BE+FE | FE-S4-2 | M | features/settlement/settlement-integration.test.tsx<br>features/settlement/settlement-section.test.tsx | — |
| AC-SET-008-2 | BE+FE | FE-S4-2, FE-S5-5 | R | features/settlement/settlement-integration.test.tsx | integration/integration.test.tsx |
| AC-SET-008-3 | BE+FE | FE-S4-2 | M | features/realtime/s5-two-clients.test.tsx<br>features/settlement/settlement-integration.test.tsx | — |
| AC-SET-008-5 | FE | FE-S4-2 | M | features/settlement/settlement-section.test.tsx | — |
| AC-SET-008-6 | BE+FE | FE-S4-2 | M | features/settlement/settlement-integration.test.tsx<br>features/settlement/settlement-section.test.tsx | — |
| AC-SET-008-7 | FE | FE-S4-3 | M | features/settlement/settlement-section.test.tsx | — |

## 3. 횡단 시험 이관표(`tasks.md` §I) 확인과 R 15행의 증거

| R AC | 증거(FE) | 상태 |
| --- | --- | --- |
| AC-ROOM-001-14, AC-ROOM-003-3 (방 단위 표시·복사) | 모의 시험 + 실서버 통합 시험 1(방 단위 "달러"가 손익·예상 정산에 표시되고 복사 텍스트 `참0 → 참1 1,234 달러`에 쓰임) | 확인함 |
| AC-ROOM-006-11 (같은 브라우저 두 탭 첫 입장) | 모의 시험(가짜 잠금) + **실브라우저 수동 1회**(§6.4): 두 탭 거의 동시 입장 → 신원 키 1개, DB 멤버 1명 | 확인함(1회, 두 클릭의 완전 동시성은 보장 못 함) |
| AC-TXN-008-5 (저장 응답 유실) | 통합 시험 3: 서버 반영, 화면은 결과 불명·입력 유지, 끊김·복구 뒤 재조회로 목록 확인돼도 결과 불명 유지, POST 1회(자동 재전송 없음), 같은 키 수동 재시도는 `Idempotent-Replayed: true`·중복 없음 | 확인함 |
| AC-SYS-002-5 | 같은 통합 시험 3 | 확인함 |
| AC-SYS-002-3 (끊김 중 종료가 복구 뒤 반영) | 통합 시험 2: 끊김 중 종료 → 차단 해제 후 약 1.3초에 `최종 정산` 반영 | 확인함 |
| AC-SYS-002-1 (복구 후 손익·목록·참여자·상태·정산 재조회 표시) | 통합 시험 2: 끊기기 전 데이터 표시 → 끊김 즉시 서버 데이터 숨김 → 복구 뒤 거래 목록(끊김 중 생긴 거래)·상태·최종 정산 표시 | **부분**: 복구 뒤 **손익·참여자 표시는 실서버 시험이 단언하지 않는다**(모의 시험은 있음) |
| AC-VIEW-005-1 (A의 거래 등록 → B의 누적 손익·거래 목록 갱신) | 통합 시험 1: 방장 화면 폼으로 거래 저장 → 다른 화면의 거래 목록(사유)·누적 손익(`1,234 달러`) 반영 | 확인함 |
| AC-VIEW-005-2 (수정·삭제도 B에 반영) | 통합 시험은 수정·삭제를 하지 않는다. **지연 측정(§4)이 실서버에서 API로 수정·삭제를 일으키고 실제 화면 10개의 사유 표시·행 부재 반영을 잰 것이 증거**(폼 조작이 아님) | 확인함(API 구동 근거) |
| AC-VIEW-005-3 (참여자 등록·상태 변경 → 참여자 표시·거래 입력 선택지) | 통합 시험 1: 등록 → 참여자·선택지에 나타남, 비활성화 → 비활성 배지·선택지에서 빠짐 | 확인함 |
| AC-VIEW-005-4 (종료 → B의 입력·수정·삭제 UI 잠김, 최종 정산) | 모의 두 접속자 시험·종료 후 잠금 시험. 실서버 통합 시험 1은 종료 뒤 다른 화면의 `최종 정산`과 **거래 입력 부재만** 확인(005-4 태그 없음) | **부분**: 수정·삭제 UI 잠금의 실서버 확인 없음(모의 시험만) |
| AC-VIEW-005-5 (거래 변경으로 예상 정산이 바뀌면 B의 예상 정산 갱신) | 통합 시험 1: **거래 생성** 뒤 다른 화면의 예상 정산에 `1,234 달러` | **부분**: 수정·삭제 뒤 예상 정산 갱신은 실서버 미확인(지연 측정은 사유·행 부재만 검사, 모의 시험은 있음) |
| AC-SET-008-2 (다른 접속자의 거래 생성·수정·삭제, 참여자 변경 뒤 예상 정산 갱신) | 위 005-5와 같은 증거(생성만) | **부분**: 수정·삭제·참여자 변경 뒤 예상 정산 갱신은 실서버 미확인(해당 단언이 예상 정산 값을 보지 않는다) |
| AC-SET-007-1 (종료 직후 별도 조작 없이 `FINAL` 조회) | 통합 시험 1: 종료 직후 두 화면 모두 `최종 정산` 표시 | 확인함 |
| AC-VIEW-005-8 (화면 반영 지연) | §4 FE 측정 통과. **백엔드 BE-S5-4·BE-S4-7 측정은 이 문서가 확인하지 않았다** | **FE 몫만 통과, AC 완료로 세지 않음**(plan §8: 백엔드 측정과 **모두** 통과해야 완료) |

**R 15행 집계**: 확인함 10(AC-ROOM-001-14, ROOM-003-3, ROOM-006-11, TXN-008-5, SYS-002-3, SYS-002-5, VIEW-005-1, 005-2, 005-3, SET-007-1), 부분 4(SYS-002-1, VIEW-005-4, VIEW-005-5, SET-008-2), 미완료 1(VIEW-005-8). "확인함"은 AC의 FE 몫 서술을 실서버 근거가 모두 덮는다는 뜻이며, 근거의 한계(1회 시도, API 구동, 클라이언트 쪽 장애 재현)는 §5·§9에 있다.

### 3.1 횡단 시험 이관표(`tasks.md` §I) 9행별 확인

| # | 이관표 행(AC) | 소유 Task | 기본 시험(모의 서버, `pnpm test`) | 실서버·실브라우저 | 상태·한계 |
| --- | --- | --- | --- | --- | --- |
| 1 | 참여자 변경이 거래 입력 선택지에 반영(AC-VIEW-005-3), 재활성화 뒤 선택지(AC-PART-002-4) | FE-S2-2, FE-S5-5 | `s5-two-clients.test.tsx` "[AC-VIEW-005-3][AC-PART-002-4] A가 참여자를 등록·비활성화하면 B의 참여자 표시와 거래 입력 선택지에 반영", `transaction-form.test.tsx` "[AC-PART-002-4] 참여자가 재활성화되어 새 스냅샷이 반영되면 선택지에 들어온다" | 통합 시험 1: 등록 → 선택지에 나타남, 비활성화 → 비활성 배지·선택지에서 빠짐 | 등록·비활성화는 실서버 확인. **재활성화 뒤 선택지는 모의 시험만**(실서버 미확인) |
| 2 | 종료 시 거래 입력·수정·삭제·참여자 컨트롤 잠금(AC-VIEW-005-4, AC-TXN-009-3, AC-PART-004-3) | FE-S4-4 | `ended-room.test.tsx`(방장·비방장·종료 후 입장자의 컨트롤 부재, 확정·재개 UI·API 부재 소스 스캔), 컨트롤별 단위 시험(`participants-section`, `transaction-actions`, `transaction-form`), `s5-two-clients.test.tsx`(종료를 받은 다른 화면) | 통합 시험 1: 종료 뒤 두 화면 모두 `최종 정산`, 다른 접속자 화면에 거래 입력 없음 | **실서버에서는 종료 후 방장 화면의 수정·삭제·참여자 컨트롤 잠금을 따로 확인하지 않았다**(모의 시험은 확인) |
| 3 | 거래 변경 시 예상 정산 갱신(AC-VIEW-005-5, AC-SET-008-2) | FE-S5-5, FE-S4-2 | `s5-two-clients.test.tsx`, `settlement-integration.test.tsx` | 통합 시험 1: 거래 **생성** 뒤 다른 화면의 예상 정산에 `1,234 달러` | **부분**: 수정·삭제·참여자 변경 뒤 예상 정산 갱신은 실서버 미확인(모의 시험만) |
| 4 | 저장 응답 유실 뒤 재조회(AC-SYS-002-5, AC-TXN-008-5) | FE-S2-1, FE-S5-5 | `s5-two-clients.test.tsx`, `transaction-form.test.tsx` | 통합 시험 3(§3 표 참조) | 확인함(클라이언트 fetch 래퍼로 유실을 재현) |
| 5 | 끊김 중 종료가 복구 뒤 반영(AC-SYS-002-3) | FE-S5-5 | `s5-two-clients.test.tsx` | 통합 시험 2 | 확인함 |
| 6 | 단위 표시·복사 반영(AC-ROOM-001-14, AC-ROOM-003-3) | FE-S3-1, S3-2, S4-2, S4-3 | `balances-section`·`settlement-section`·`transactions-section` 시험 | 통합 시험 1: 방 단위 "달러"가 손익·예상 정산·복사 텍스트에 쓰임 | 확인함 |
| 7 | 화면 반영 지연(AC-VIEW-005-8) | FE-S5-6 (+BE-S5-4, BE-S4-7) | — | §4 FE 측정 통과 | **FE 몫만 통과. 백엔드 측정은 이 문서가 확인하지 않아 AC 완료로 세지 않음** |
| 8 | 같은 브라우저 두 탭 첫 입장(AC-ROOM-006-11) | FE-S1-6(모의), FE-I1·FE-Z1(실브라우저) | `two-tabs.test.tsx`, `identity.test.ts`(가짜 잠금) | 실브라우저 수동 1회(§6.4) | 확인함(1회, 두 클릭의 완전 동시성은 보장 못 함) |
| 9 | 실서버 확인이 필요한 R 15행 | FE-I1 | — | §3 표(R 15행 전체)와 §5 | 15행 중 확인함 10, 부분 4(AC-SYS-002-1, VIEW-005-4, VIEW-005-5, SET-008-2), 미완료 1(AC-VIEW-005-8, 위 7). 집계는 §3 |

## 4. 화면 반영 지연 측정 결과 (FE-S5-6, PR #34)

- 방법: Vitest 별도 설정(`pnpm test:latency`)으로 **실제 `InviteScreen` 클라이언트 10개**를 방마다 실서버(로컬 백엔드 `node dist/main.js`, 별도 PostgreSQL DB, 같은 기기)에 연결. T0는 요청 송신 직전 시각(보수 기준). 변경은 한 번에 하나. 조건 사전 점검(변경 전에 이미 참이면 측정 무효)과 연결·스냅샷 정상 확인을 둔다. 정식 규모만 합격으로 센다(`full: true`).
- 재측정(정식 규모, 342초, 7개 시험 통과, 시간 초과 0건): 화면 반영 p95 / 최댓값(ms)

| 변경 | 표본 | p95 | 최댓값 |
| --- | --- | --- | --- |
| 거래 생성(900→1,000건) | 1,000 | 74 | 87 |
| 거래 수정 | 1,000 | 72 | 81 |
| 거래 삭제 | 1,000 | 73 | 87 |
| 참여자 상태 변경 | 1,000 | 70 | 83 |
| 참여자 등록(방 10개) | 100 | 48 | 53 |
| 게임 종료(방 10개) | 100 | 44 | 47 |
| **전체** | **4,200** | **72** | **87** |
| 알림 유실 수렴(하트비트 경로, 재연결 0회 확인) | 10 | 14,916 | 14,916 |

- 목표: 화면 반영 p95 3,000ms·최댓값 5,000ms, 수렴 20,000ms. 모두 만족.
- **한계**: jsdom DOM 변경 시각까지이며 브라우저 페인트 시간은 포함하지 않음. 서버·클라이언트가 같은 기기라 망 지연(왕복 150ms 이하 조건)을 재현하지 않음. 10개 클라이언트가 한 jsdom에서 실행됨. 유실은 서버가 아니라 클라이언트 fetch 래퍼가 변경 알림을 버려 재현. 이벤트 전달 지연(1초/3초 목표)은 FE-S5-6 범위 밖(백엔드 BE-S5-4).
- 첫 실측(수정 전 하네스)은 같은 규모에서 전체 p95 75ms·최댓값 117ms였다(하네스 결함 수정 뒤 재측정한 위 표가 기준).

## 5. 실서버 연동 점검 결과 (FE-I1, PR #35)

환경: 로컬 백엔드·별도 DB, 같은 기기, 수정 후 연속 2회 5개 모두 통과. **5개 시험은 jsdom에서 실제 화면 컴포넌트를 렌더링해 실서버와 통신하며 실브라우저 점검이 아니다**(실브라우저 점검은 §6).

1. 두 접속자(실제 화면 2개): 참여자 등록·비활성화·거래 저장·게임 종료가 다른 화면에 반영, 방 단위 표시·복사 텍스트 일치.
2. 끊김 복구: 끊기기 전 표시 확인 후 끊김 즉시 구역 안 서버 데이터 숨김, 복구 뒤 종료·거래 반영.
3. 응답 유실: 위 §3의 AC-TXN-008-5·AC-SYS-002-5.
4. 오류 코드·헤더 계약: INVITE_NOT_FOUND 404·UNAUTHENTICATED 401·NICKNAME_TAKEN 409·VALIDATION_FAILED 422·HOST_ONLY 403·GAME_ENDED 409 모두 `{error:{code,message,details[]}}` 형식·FE가 아는 코드, `Date` 헤더, `Idempotent-Replayed`(재생 응답에만 `true`), 같은 접속자 연결 1~5번째 200·6번째 429 CONNECTION_LIMIT_EXCEEDED + `Retry-After: 30`. **차이 없음.**
5. 모의 fixture vs 실서버 응답 모양(방·참여자·손익·거래·정산): fixture에만 있는 필드 0개, 실서버에만 있는 필드 0개.
- 한계: 끊김·응답 유실은 클라이언트 fetch 래퍼로 흉내 냈다(서버·망 장애 아님). CORS 외 배포 환경·다중 인스턴스 합산 연결 한도·실제 망은 대상 아님. 시험 도구 결함 3건(가짜 저장소 전역 되돌림, 응답 도착 전 읽기 경합, 잘못된 구역 부재 단언)은 시험 쪽 수정이며 FE 결함 아님.

## 6. 접근성

### 6.1 자동 검사
- `vitest-axe`(`expectNoA11yViolations`)를 화면·기능 시험 13개 파일(balances-section, participants-section, connection-banner, create-room-form, invite-screen, room-info, room, end-game, ended-room, settlement-section, transaction-actions, transaction-form, transactions-section)에서 파일당 1회, 공통 UI·진입 차단(`ui/ui.test.tsx` 3회, `ui/feature-gate.test.tsx` 2회), 도우미 자체 시험(`test/helpers.test.ts` 2회) 등 시험 코드에서 20회 호출하며 모두 통과(`pnpm test`에 포함). 화면별 검사는 각 화면의 대표 상태 하나씩이며 모든 상태를 덮지는 않는다.
- 색 대비: 토큰 쌍 단위 시험(`ui/tokens.test.ts`, `test/contrast.ts`)이 4.5:1 미만이면 실패한다. 통과.

### 6.2 방 화면 수동 점검 (Orca 내장 브라우저, Chromium 150.0.7871.250 계열, 390×844 모바일 에뮬레이션, 개발 서버, 방장 화면)
방 구성: 12자 닉네임 참여자, 거래 1,000건(금액 999,999,999 반복) → 누적 손익 `+995,123,455,794 원` 수준(약 10¹²).

| 항목 | 결과 |
| --- | --- |
| 가로 넘침 | 없음(`scrollWidth` 390 = 뷰포트), 뷰포트 밖으로 나간 요소 0개 |
| 터치 목표 44px | 상호작용 요소 55개 모두 가로·세로 44px 이상 |
| 큰 금액 레이아웃 | `+995,123,455,794 원`·`−995,123,455,794 원`·정산 금액이 모두 한 줄, `white-space: nowrap` |
| 키보드 순서 | 실제 Tab 키로 초대 링크 → 복사 → 게임 종료 → 지급자 → 수취자 → 금액 → 사유 → 라운드 → 저장 → 참여자 필터 → 거래 행 컨트롤…(화면 순서와 일치) |
| 포커스 표시 | Tab으로 간 모든 요소(입력·선택·버튼)에서 `:focus-visible` 일치, 3px 실선 윤곽선 |
| 확인 대화상자 | Enter로 열면 기본 포커스 `취소`, Tab이 대화상자 안에서만 순환(취소 → 게임 종료 → 취소), Esc로 닫히고 포커스가 `게임 종료` 버튼으로 복귀(종료는 확정하지 않음) |
| 폼 라벨 | Tab으로 지난 입력·선택 7개(초대 링크, 지급자, 수취자, 금액, 사유, 라운드, 참여자 필터)가 모두 라벨 이름을 가짐 |

미점검: 스크린 리더 실사용(VoiceOver 등) 안내 청취, 데스크톱 폭 레이아웃, 고대비·확대(200%) 설정, 모바일 실기기 터치. 자동 검사가 `aria-live` 안내 영역 존재는 확인하나 실제 낭독은 확인하지 않았다.

### 6.3 화면별 수동 체크리스트 (`tasks.md` FE-Z1: 키보드·포커스·대비·큰 금액 레이아웃)

공통 조건: Orca 내장 Chromium 150 계열, 390×844 모바일 에뮬레이션, 개발 서버(`next dev`)+로컬 백엔드, 방장 키로 입장. **"미점검"은 실행하지 않았다는 뜻이다.** 포커스 표시는 전역 규칙(`:focus-visible { outline: 3px solid <focus 토큰>; outline-offset: 2px }`, 모든 화면에 적용됨을 확인함)이다. 방 화면 외 화면에서 포커스 링이 실제로 그려지는지는, 점검 중 내장 브라우저 창이 포커스를 받지 못해(`document.hasFocus() === false`, 이때 `:focus-visible`이 일치하지 않음) **직접 측정하지 못했다.** 대비는 모든 화면에서 토큰 쌍 자동 시험(4.5:1)만이며 화면에서 눈으로 확인한 결과는 없다.

| 화면 | 키보드 순서 | 포커스 표시 | 대비 | 넘침·터치 목표 44px·큰 금액 | 비고 |
| --- | --- | --- | --- | --- | --- |
| 진입 차단 화면(필수 기능 없음) | 미점검 | 미점검 | 자동만 | 미점검 | 자동 시험(`ui/feature-gate.test.tsx`, axe)만 있다. 실브라우저에서 기능을 빼서 차단 화면을 만들어 보지 못했다 |
| 방 생성(`/`) | 확인함: 방 이름 → 정산 단위 → 내 닉네임 → 방 만들기(4개, 라벨 이름 있음) | 전역 규칙 존재 확인, **이 화면 렌더링은 미측정** | 자동만 | 가로 넘침 0, 대상 4개 모두 44px 이상 | 큰 금액 해당 없음 |
| 초대·닉네임 입력(`/invite/…`, 키 없음) | 확인함: 닉네임 → 입장 | 전역 규칙 존재 확인, 이 화면 렌더링은 미측정 | 자동만 | 넘침 0, 대상 2개 44px 이상 | 큰 금액 해당 없음 |
| 방 화면(방장, 진행 중) | 확인함(§6.2): 초대 링크 → … → 거래 행 컨트롤 | **확인함**(Tab으로 간 모든 입력·선택·버튼에서 3px 실선 윤곽선) | 자동만 | 넘침 0, 55개 모두 44px 이상, 금액 `+995,123,455,794 원` 한 줄 | 누적 손익 약 10¹², 12자 닉네임, 거래 1,000건 |
| 확인 대화상자(거래 삭제) | 확인함: Enter로 열면 기본 포커스 `취소`, Tab이 대화상자 안에서만 순환(취소 ↔ 삭제), Esc로 닫으면 포커스가 삭제 버튼으로 복귀 | 대화상자 안에서의 렌더링은 미측정 | 자동만 | — | 삭제는 확정하지 않음 |
| 확인 대화상자(게임 종료) | 확인함(§6.2): 같은 동작 | 미측정 | 자동만 | — | 종료는 확정하지 않음 |
| 종료 후 화면(최종 정산, 방장) | 부분 확인: 남은 컨트롤(더 보기·초대 링크 복사 등)에 Tab 이동, 입력·참여자·종료 컨트롤 없음 | 미측정 | 자동만 | 넘침 0, 대상 5개 44px 이상, `994,999,999,005 원` 등 금액 한 줄(`nowrap`), 제목 `최종 정산` | 종료는 API로 일으킴 |
| 연결 끊김 배너 화면(백엔드 중지) | 해당 없음(상호작용 요소 0개, 서버 데이터 숨김 `li` 0개) | 해당 없음 | 자동만 | 넘침 0 | 배너 `연결 끊김 · 다시 연결 중 …` 표시(`role="status"`·`"alert"` 영역 안) |
| 비방장(참여자로 입장) 방 화면 | 미점검 | 미점검 | 자동만 | 미점검 | 모의 시험에는 있음 |
| 데스크톱 폭·200% 확대·고대비 설정 | 미점검 | 미점검 | 미점검 | 미점검 | — |
| 스크린 리더 실사용(VoiceOver 등) | 미점검 | — | — | — | `aria-live` 영역 존재와 axe 통과만 자동 확인 |

### 6.4 같은 브라우저 두 탭 첫 입장 (AC-ROOM-006-11, 실브라우저 수동 1회)

Orca 내장 브라우저에서 같은 프로필의 두 탭으로 같은 초대 코드를 열고(둘 다 닉네임 입력 단계), 같은 닉네임 "동시"를 입력한 뒤 두 입장 버튼을 거의 동시에 눌렀다(두 클릭을 백그라운드로 거의 동시에 보냈으며 완전 동시는 보장하지 못한다). 결과: 두 탭 모두 "내 닉네임: 동시"로 입장, 그 초대 코드의 localStorage 신원 키 1개(43자), DB의 해당 방 멤버 "동시" 1명. 1회 시도이며 반복 시험은 아니다.

## 7. 브라우저 호환 수동 점검 표 (OQ-033 G)

대상: Chrome·Edge·Firefox·Safari(모바일 포함)의 최신·직전 주요 버전. **점검하지 못한 칸은 비워 두었다.** 이 세션은 Orca 내장 브라우저(Chromium 150 계열) 한 가지만 쓸 수 있었다.

| 브라우저 | 최신 | 직전 주요 버전 |
| --- | --- | --- |
| Chrome(데스크톱) | 미점검(Orca 내장 Chromium 150 계열로 §6.2·§6.3·§6.4의 수동 점검만 했고 Chrome 정식 앱은 아니다. §5의 실서버 시험은 jsdom에서 실행되어 브라우저 점검이 아니다) | 미점검 |
| Edge | 미점검 | 미점검 |
| Firefox | 미점검 | 미점검 |
| Safari(macOS) | 미점검 | 미점검 |
| 모바일 Safari(iOS) | 미점검 | 미점검 |
| 모바일 Chrome(Android) | 미점검 | 미점검 |

점검할 때 확인할 항목(사용자 몫): 진입 차단 화면 없이 입장 → 방 생성 → 두 탭 첫 입장 → 거래 저장 → 다른 기기에서 실시간 반영 → 끊김(비행기 모드) 후 복구 → 게임 종료·정산 복사. `navigator.locks`·`localStorage`·fetch 스트리밍이 필수 기능이라 구형 브라우저는 차단 화면이 나오는 것이 정상이다(앱은 폴백·폴리필을 쓰지 않는다).

## 8. 검수 이력 (PR 본문 기록 요약)

| PR | 묶음 | 검수 |
| --- | --- | --- |
| #26 | 공통 기반 F1~F8 | Claude 독립 검수 2회(REVISE → PASS). Codex 아님 |
| #27 | S1 방 생성·초대 링크 | Claude 독립 검수 2회(REVISE → Major 없음). 반영분 재검수 없음. Codex 아님 |
| #28 | S5 코어 SSE·코디네이터·연결 제어 | Claude 독립 검수 2회(REVISE → PASS). 병합 뒤 Codex 2회(REVISE → PASS)가 #29에서 수정 |
| #29 | S1 방 화면 + S5 코어 Codex 수정 | S5 코어 수정분 Codex 2/3(REVISE → PASS). **S1 방 화면(S1-3~S1-6)은 Claude 검수 1회(Minor 7건 반영, 재검수 없음)만 받았고 Codex 검수는 받지 않았다** |
| #30 | S3 손익·거래 내역 | Codex 1/3 PASS(Minor 3, 시험 빈틈 반영, 재검수 없음) |
| #31 | S2 거래 저장·입력·수정·삭제 | **Codex 3/3 모두 REVISE**(지적은 모두 실제 재현된 결함, 전부 반영). **3회차 반영분은 Codex 재검수를 받지 못함.** Claude 검수 1회 PASS(Minor 5 반영, 재검수 없음). Codex PASS는 한 번도 받지 못함 |
| #32 | 연결 배너·정산 영역·정산 복사 | Codex 3/3(REVISE → REVISE → PASS). 3회차는 마지막 시험 수정 1건만 좁게 검토 — 전체 diff에 대한 단독 PASS는 아님 |
| #33 | C2 종료·잠금·두 접속자 통합 시험 | Codex 2/3(REVISE → PASS) |
| #34 | FE-S5-6 지연 측정 | Codex 2/3(REVISE → PASS) |
| #35 | FE-I1 연동 점검 | Codex 2/3(REVISE → PASS), 추론 강도 medium |

Codex 검수는 모두 읽기 전용이다. 대부분 시험·측정을 재실행하지 않고 구현자 기록을 읽었으며(#29의 S5 코어 검수는 관련 시험을 일부 실행했고 typecheck·lint·build·전체 시험은 재실행하지 않음), 검수 방식별 한계는 각 PR 본문에 있다. Codex·Claude PASS는 사용자 승인이 아니다.

## 9. 남은 위험·미실행 검증 목록

1. **AC-VIEW-005-8은 완료가 아니다.** FE 측정만 통과했고 백엔드 측정(BE-S5-4, BE-S4-7)은 이 문서에서 확인하지 않았다(plan §8).
2. 브라우저 호환 표(§7)는 전부 미점검이다. 실브라우저 한 종류(내장 Chromium)의 부분 점검만 있다. 실기기 모바일·Safari·Firefox·Edge는 사용자 몫.
3. 화면 반영 지연은 jsdom DOM 변경까지이며 브라우저 페인트·실제 망 지연을 포함하지 않는다.
4. 접근성: 화면별 수동 체크리스트(§6.3)에서 진입 차단 화면·비방장 화면·데스크톱 폭·200% 확대·스크린 리더 실사용·실기기 터치는 미점검이고, 방 화면 외 화면의 포커스 링 실제 렌더링은 창 포커스 부재로 측정하지 못했다. 색 대비는 화면에서 눈으로 확인하지 않았고 토큰 쌍 자동 시험뿐이다.
5. 지연 측정은 PR #35의 공유 도우미 변경 뒤 재실행하지 않았다(§1). 두 탭 첫 입장의 실브라우저 점검은 1회이며 두 클릭의 완전 동시성은 보장하지 못한다.
6. 검수 공백: #29의 S1 방 화면은 Codex 검수를 받지 못했고, #31(S2)은 Codex 3회 모두 REVISE에 마지막 반영분이 Codex 재검수 없이 병합됐으며, #30·#32 일부 반영분도 재검수가 없다. 필요하면 이 범위에 별도 검수를 하는 것이 합리적이다(사용자 결정).
7. 끊김·응답 유실은 클라이언트 fetch 래퍼로 재현했다. 서버·프록시·실제 망 장애, CORS 외 배포 환경, 다중 인스턴스 합산 연결 한도(탭 6개째 429)는 실제 환경에서 보지 않았다.
8. 열린 결정(이전 세션 기록): 손상된 신원 키 덮어쓰기(F06)는 Spec에 없다. 백엔드 저장소 위치(iCloud 동기화되는 `~/Documents`)는 사용자가 보류했다.
9. 실서버 시험(`pnpm test:latency`·`pnpm test:integration`)은 기본 시험에 포함되지 않아 CI 게이트가 아니라 릴리스 전 수동 실행이다. 실행에는 백엔드·PostgreSQL이 필요하다.
10. R 15행 중 **부분 4행**(AC-SYS-002-1: 복구 뒤 손익·참여자 표시 미단언, AC-VIEW-005-4: 종료 뒤 수정·삭제 UI 잠금 실서버 미확인, AC-VIEW-005-5·AC-SET-008-2: 수정·삭제·참여자 변경 뒤 예상 정산 갱신 실서버 미확인)은 모의 시험까지만 근거가 있다. 이관표(§3.1)의 재활성화 뒤 선택지(AC-PART-002-4)와 종료 후 방장 화면의 수정·삭제·참여자 컨트롤 잠금(AC-TXN-009-3·AC-PART-004-3)도 모의 시험만 있다.
11. `check:ac`는 태그 **존재** 검사다. AC 완료의 증거는 §2의 시험 통과와 §3~§6이다.

## 10. 승인 필요

G4 판정(프론트엔드 구현 완료 인정)과 이 증거 묶음의 `main` 병합은 사용자 승인이 필요하다. §9의 1~7을 받아들일지, 추가 검수·점검을 할지는 사용자가 결정한다.
