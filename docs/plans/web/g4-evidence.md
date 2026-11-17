# 프론트엔드 G4 증거 묶음 (`apps/web`, FE-Z1)

- 작성 시점: 2026-11-12. 기준 커밋: `main` 1b3d157(PR #35 병합) 위의 FE-Z1 브랜치.
- 상위 문서: Web Plan·Tasks·AC 매핑표 v1.0.0(`plan.md` §8, `tasks.md` FE-Z1·§I, `ac-matrix.md`), S1 v0.2.x~S5 v0.2.3 Spec. 이 문서는 새로 만든 증거 기록이며 승인된 상위 문서를 고치지 않는다.
- **이 문서는 사용자 승인을 대신하지 않는다.** G4 판정과 병합은 사용자 승인 사항이다. Codex·Claude 검수 PASS도 승인이 아니다.
- **2.0.0 개정(Spec v0.3.0 접속자·참여자 통합, FE-M1~M9)의 증거는 §16이다.** 동작은 §16이 최신이다.
- **디자인 v2 적용(Plan v1.3.0, FE-V1~V4)의 최종 증거는 §15다.** 화면 모양은 §15가 최신이다.
- **디자인 적용(Plan v1.1.0, FE-D1~D3)의 증거는 §11이다.** §1~§10은 디자인 적용 전 코드(FE-Z1 시점)의 증거이며 §11이 다시 실행·재점검한 항목만 최신이다.
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
| `pnpm test:integration` | 통과(7개) — AC 보강 뒤 연속 2회 실행, §5 | 실서버 필요, 기본 시험 제외 |

**연동 점검(`pnpm test:integration`)은 AC 보강 브랜치의 최종 코드로 7개를 연속 2회 실행했다**(§5, 별도 DB의 로컬 백엔드). **지연 측정(`pnpm test:latency`)은 PR #34 시점 이후 다시 돌리지 않았다.** 지연 측정 하네스의 공유 도우미는 이후 PR #35에서 공유 도우미(`src/latency/client.tsx`·`server.ts`: `unit` 인자, `store` 노출, 마운트 실패 메시지)가 바뀌었다.** AC 보강에서 `createTransaction`·`updateTransaction`에 선택 인자가 더 붙었다. 기본 인자는 유지됐고 Codex가 정적으로 확인했지만 지연 측정을 그 뒤에 다시 돌리지는 않았다. 명령 출력 원본은 작성 세션의 임시 파일에만 있고 저장소에는 두지 않았다.

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
| AC-PART-004-3 | FE | FE-S1-4 | M | features/participants/participants-section.test.tsx<br>features/settlement/ended-room.test.tsx | integration/integration.test.tsx |
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
| AC-TXN-009-3 | FE | FE-S2-2, FE-S2-3, FE-S4-4 | M | features/settlement/ended-room.test.tsx<br>features/transactions/transaction-actions.test.tsx<br>features/transactions/transaction-form.test.tsx | integration/integration.test.tsx |
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
| AC-VIEW-005-4 | BE+FE | FE-S5-5, FE-S4-4 | R | features/realtime/s5-two-clients.test.tsx<br>features/settlement/ended-room.test.tsx | integration/integration.test.tsx |
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
| AC-SYS-002-1 (복구 후 손익·목록·참여자·상태·정산 재조회 표시) | 통합 시험 2: 끊기기 전 데이터 표시(손익 `100 원`) → 끊김 즉시 서버 데이터 숨김 → 복구 뒤 거래 목록(끊김 중 생긴 거래)·누적 손익(`200 원`으로 갱신)·참여자(참0·참1)·상태·최종 정산(`200 원`) 표시 | 확인함(보강). 손익을 0으로 만드는 앱 변이는 시험이 잡았으나 끊기기 전 사전 단언에서 먼저 실패했다(복구 뒤 단언만 따로 변이로 확인하지는 않음) |
| AC-VIEW-005-1 (A의 거래 등록 → B의 누적 손익·거래 목록 갱신) | 통합 시험 1: 방장 화면 폼으로 거래 저장 → 다른 화면의 거래 목록(사유)·누적 손익(`1,234 달러`) 반영 | 확인함 |
| AC-VIEW-005-2 (수정·삭제도 B에 반영) | 통합 시험 1은 수정·삭제를 하지 않는다(통합 시험 6은 수정·삭제 뒤 **예상 정산**을 검증할 뿐 거래 목록 반영의 근거는 아니다). **지연 측정(§4)이 실서버에서 API로 수정·삭제를 일으키고 실제 화면 10개의 사유 표시·행 부재 반영을 잰 것이 증거**(폼 조작이 아님) | 확인함(API 구동 근거) |
| AC-VIEW-005-3 (참여자 등록·상태 변경 → 참여자 표시·거래 입력 선택지) | 통합 시험 1: 등록 → 참여자·선택지에 나타남, 비활성화 → 비활성 배지·선택지에서 빠짐 | 확인함 |
| AC-VIEW-005-4 (종료 → B의 입력·수정·삭제 UI 잠김, 최종 정산) | 모의 두 접속자 시험·종료 후 잠금 시험 + 실서버 통합 시험 7: 방장 화면과 **거래 작성자(비방장) 화면** 모두에서 종료 전에는 수정·삭제 컨트롤·거래 입력이 있고(방장은 참여자 등록·비활성화·게임 종료도), 종료 뒤 `최종 정산`과 함께 **모두 사라짐** | 확인함(보강). 종료 뒤에도 수정·삭제를 보이는 앱 변이를 시험이 잡았다 |
| AC-VIEW-005-5 (거래 변경으로 예상 정산이 바뀌면 B의 예상 정산 갱신) | 통합 시험 1(생성) + 실서버 통합 시험 6: 다른 접속자의 거래 **생성·수정·삭제**마다 이 화면의 예상 정산 행이 서버 정산 응답과 **정확히 같고**(지급자 → 수취자 방향·금액·항목 수·서버 순서; 부분 문자열 포함이 아니라 행 전체 동일 비교이며 `settlement-match.test.ts`가 방향 뒤집힘·`300`/`1,300` 혼동·항목 초과·순서 바뀜을 거절함을 확인) 직전 화면과 달라짐 | 확인함(보강). 정산 항목을 비우는 변이와 금액에 1,000을 더하는 변이(예전 부분 포함 비교로는 통과했을 것)를 시험이 잡았다 |
| AC-SET-008-2 (다른 접속자의 거래 생성·수정·삭제, 참여자 변경 뒤 예상 정산 갱신) | 위 005-5와 같은 증거 + 통합 시험 6의 참여자 변경: 등록·상태 변경(비활성화)마다, 직전 갱신이 가라앉은 뒤(800ms 무변동·진행 중 요청 없음) 기준을 잡고 **그 변경 뒤 성공한(200) 정산 조회가 새로 생기며** 실패한 정산 조회는 없고 화면은 서버 정산과 같음 | 확인함(보강). 정산은 비활성 참여자를 포함하므로(S4 §6.1) 참여자 변경만으로는 정산 금액이 바뀌지 않아 "그 변경 뒤 성공한 재조회 + 서버 값과 일치"까지 확인했다. 재조회가 참여자 이벤트 때문임은 로그 시점으로 귀속한 것이며 이벤트 종류별 격리 변이(참여자 이벤트만 재조회를 끄는 변이)는 하지 않았다 |
| AC-SET-007-1 (종료 직후 별도 조작 없이 `FINAL` 조회) | 통합 시험 1: 종료 직후 두 화면 모두 `최종 정산` 표시 | 확인함 |
| AC-VIEW-005-8 (화면 반영 지연) | §4 FE 측정 통과. **백엔드 BE-S5-4·BE-S4-7 측정은 이 문서가 확인하지 않았다** | **FE 몫만 통과, AC 완료로 세지 않음**(plan §8: 백엔드 측정과 **모두** 통과해야 완료) |

**R 15행 집계**: 확인함 14(AC-ROOM-001-14, ROOM-003-3, ROOM-006-11, TXN-008-5, SYS-002-1, SYS-002-3, SYS-002-5, VIEW-005-1, 005-2, 005-3, 005-4, 005-5, SET-007-1, SET-008-2), 부분 0, 미완료 1(VIEW-005-8). 처음 증거 묶음(PR #36)에서 부분이던 4행(SYS-002-1, VIEW-005-4, VIEW-005-5, SET-008-2)은 실서버 시험 6·7 추가와 시험 2 보강으로 올렸다. "확인함"은 AC의 FE 몫 서술을 실서버 근거가 모두 덮는다는 뜻이며, 근거의 한계(1회 시도, API 구동, 클라이언트 쪽 장애 재현)는 §5·§9에 있다.

### 3.1 횡단 시험 이관표(`tasks.md` §I) 9행별 확인

| # | 이관표 행(AC) | 소유 Task | 기본 시험(모의 서버, `pnpm test`) | 실서버·실브라우저 | 상태·한계 |
| --- | --- | --- | --- | --- | --- |
| 1 | 참여자 변경이 거래 입력 선택지에 반영(AC-VIEW-005-3), 재활성화 뒤 선택지(AC-PART-002-4) | FE-S2-2, FE-S5-5 | `s5-two-clients.test.tsx` "[AC-VIEW-005-3][AC-PART-002-4] A가 참여자를 등록·비활성화하면 B의 참여자 표시와 거래 입력 선택지에 반영", `transaction-form.test.tsx` "[AC-PART-002-4] 참여자가 재활성화되어 새 스냅샷이 반영되면 선택지에 들어온다" | 통합 시험 1: 등록 → 선택지에 나타남, 비활성화 → 비활성 배지·선택지에서 빠짐 | 등록·비활성화는 실서버 확인. **재활성화 뒤 선택지는 모의 시험만**(실서버 미확인) |
| 2 | 종료 시 거래 입력·수정·삭제·참여자 컨트롤 잠금(AC-VIEW-005-4, AC-TXN-009-3, AC-PART-004-3) | FE-S4-4 | `ended-room.test.tsx`(방장·비방장·종료 후 입장자의 컨트롤 부재, 확정·재개 UI·API 부재 소스 스캔), 컨트롤별 단위 시험(`participants-section`, `transaction-actions`, `transaction-form`), `s5-two-clients.test.tsx`(종료를 받은 다른 화면) | 통합 시험 7: 종료 전 컨트롤 존재 확인 후 종료 뒤 방장·작성자 화면의 거래 입력·수정·삭제·참여자 등록·상태 변경·게임 종료 컨트롤이 모두 없음 | 확인함(보강) |
| 3 | 거래 변경 시 예상 정산 갱신(AC-VIEW-005-5, AC-SET-008-2) | FE-S5-5, FE-S4-2 | `s5-two-clients.test.tsx`, `settlement-integration.test.tsx` | 통합 시험 1(생성), 통합 시험 6(생성·수정·삭제·참여자 변경) | 확인함(보강). 참여자 변경은 값이 아니라 재조회·서버 일치를 확인 |
| 4 | 저장 응답 유실 뒤 재조회(AC-SYS-002-5, AC-TXN-008-5) | FE-S2-1, FE-S5-5 | `s5-two-clients.test.tsx`, `transaction-form.test.tsx` | 통합 시험 3(§3 표 참조) | 확인함(클라이언트 fetch 래퍼로 유실을 재현) |
| 5 | 끊김 중 종료가 복구 뒤 반영(AC-SYS-002-3) | FE-S5-5 | `s5-two-clients.test.tsx` | 통합 시험 2 | 확인함 |
| 6 | 단위 표시·복사 반영(AC-ROOM-001-14, AC-ROOM-003-3) | FE-S3-1, S3-2, S4-2, S4-3 | `balances-section`·`settlement-section`·`transactions-section` 시험 | 통합 시험 1: 방 단위 "달러"가 손익·예상 정산·복사 텍스트에 쓰임 | 확인함 |
| 7 | 화면 반영 지연(AC-VIEW-005-8) | FE-S5-6 (+BE-S5-4, BE-S4-7) | — | §4 FE 측정 통과 | **FE 몫만 통과. 백엔드 측정은 이 문서가 확인하지 않아 AC 완료로 세지 않음** |
| 8 | 같은 브라우저 두 탭 첫 입장(AC-ROOM-006-11) | FE-S1-6(모의), FE-I1·FE-Z1(실브라우저) | `two-tabs.test.tsx`, `identity.test.ts`(가짜 잠금) | 실브라우저 수동 1회(§6.4) | 확인함(1회, 두 클릭의 완전 동시성은 보장 못 함) |
| 9 | 실서버 확인이 필요한 R 15행 | FE-I1 | — | §3 표(R 15행 전체)와 §5 | 15행 중 확인함 14, 부분 0, 미완료 1(AC-VIEW-005-8, 위 7). 집계는 §3 |

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

환경: 로컬 백엔드·별도 DB, 같은 기기, AC 보강 뒤 연속 2회 7개 모두 통과(PR #35 시점에는 1~5번 5개). **7개 시험은 jsdom에서 실제 화면 컴포넌트를 렌더링해 실서버와 통신하며 실브라우저 점검이 아니다**(실브라우저 점검은 §6).

1. 두 접속자(실제 화면 2개): 참여자 등록·비활성화·거래 저장·게임 종료가 다른 화면에 반영, 방 단위 표시·복사 텍스트 일치.
2. 끊김 복구: 끊기기 전 표시 확인 후 끊김 즉시 구역 안 서버 데이터 숨김, 복구 뒤 종료·거래 반영.
3. 응답 유실: 위 §3의 AC-TXN-008-5·AC-SYS-002-5.
4. 오류 코드·헤더 계약: INVITE_NOT_FOUND 404·UNAUTHENTICATED 401·NICKNAME_TAKEN 409·VALIDATION_FAILED 422·HOST_ONLY 403·GAME_ENDED 409 모두 `{error:{code,message,details[]}}` 형식·FE가 아는 코드, `Date` 헤더, `Idempotent-Replayed`(재생 응답에만 `true`), 같은 접속자 연결 1~5번째 200·6번째 429 CONNECTION_LIMIT_EXCEEDED + `Retry-After: 30`. **차이 없음.**
5. 모의 fixture vs 실서버 응답 모양(방·참여자·손익·거래·정산): fixture에만 있는 필드 0개, 실서버에만 있는 필드 0개.
6. (AC 보강) 예상 정산 갱신: 다른 접속자의 거래 생성·수정·삭제마다 화면 정산이 서버 정산과 일치하고 바뀜, 참여자 등록·비활성화마다 정산 재조회·서버 일치.
7. (AC 보강) 종료 뒤 잠금: 방장·거래 작성자(비방장) 화면에서 종료 전 존재하던 입력·수정·삭제·참여자·종료 컨트롤이 종료 뒤 모두 사라짐.
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
| #37 | AC 4건 실서버 보강·R 15행 재판정 | Codex 2/3(REVISE → PASS), 마지막 Minor 2건 반영분은 재검수 없음 |
| 검수 공백 후속 PR | S1 방 화면(#29)·S2(#31) 사후 Codex 검수와 수정 | **S1 방 화면: Codex 2/3(REVISE → PASS, 지적 없음)**. **S2: Codex 3/3 모두 REVISE**(1회차 Major 0·Minor 2, 2회차 Minor 1, 3회차 Minor 2 — 모두 Minor이며 앞선 3회의 Major 지적이 해소됐음을 확인한 뒤의 후속 지적) → 전부 반영, **3회차 반영분은 Codex 재검수를 받지 못해** 사용자 결정으로 Claude 독립 검수(새 세션, 읽기 전용, 정적)로 대체 — **PASS(Minor 4: 원자 전체 구독·고아 주석은 반영, 마운트 시에만 정리되어 범위당 1건 잔존 가능·로컬 오류 우선 표시는 코드 주석에 한계로 기록, 이 Minor 반영분은 재검수 없음)**. Codex PASS는 S2에서 한 번도 받지 못함 |

Codex 검수는 모두 읽기 전용이다. 대부분 시험·측정을 재실행하지 않고 구현자 기록을 읽었으며(#29의 S5 코어 검수는 관련 시험을 일부 실행했고 typecheck·lint·build·전체 시험은 재실행하지 않음), 검수 방식별 한계는 각 PR 본문에 있다. Codex·Claude PASS는 사용자 승인이 아니다.

## 9. 남은 위험·미실행 검증 목록

1. **AC-VIEW-005-8은 완료가 아니다.** FE 측정만 통과했고 백엔드 측정(BE-S5-4, BE-S4-7)은 이 문서에서 확인하지 않았다(plan §8).
2. 브라우저 호환 표(§7)는 전부 미점검이다. 실브라우저 한 종류(내장 Chromium)의 부분 점검만 있다. 실기기 모바일·Safari·Firefox·Edge는 사용자 몫.
3. 화면 반영 지연은 jsdom DOM 변경까지이며 브라우저 페인트·실제 망 지연을 포함하지 않는다.
4. 접근성: 화면별 수동 체크리스트(§6.3)에서 진입 차단 화면·비방장 화면·데스크톱 폭·200% 확대·스크린 리더 실사용·실기기 터치는 미점검이고, 방 화면 외 화면의 포커스 링 실제 렌더링은 창 포커스 부재로 측정하지 못했다. 색 대비는 화면에서 눈으로 확인하지 않았고 토큰 쌍 자동 시험뿐이다.
5. 지연 측정은 PR #35의 공유 도우미 변경 뒤 재실행하지 않았다(§1). 두 탭 첫 입장의 실브라우저 점검은 1회이며 두 클릭의 완전 동시성은 보장하지 못한다.
6. 검수 공백: S1 방 화면(#29)은 사후 Codex 검수 2/3에서 PASS를 받았다(§8). **S2(#31)는 Codex PASS를 받지 못했다**(사후 3/3까지 모두 REVISE, 지적은 Minor였고 모두 반영했으나 마지막 반영분은 Codex가 아니라 Claude 독립 검수로만 확인). #30·#32 일부 반영분도 재검수가 없다. 필요하면 이 범위에 별도 검수를 하는 것이 합리적이다(사용자 결정).
7. 끊김·응답 유실은 클라이언트 fetch 래퍼로 재현했다. 서버·프록시·실제 망 장애, CORS 외 배포 환경, 다중 인스턴스 합산 연결 한도(탭 6개째 429)는 실제 환경에서 보지 않았다.
8. 열린 결정(이전 세션 기록): 손상된 신원 키 덮어쓰기(F06)는 Spec에 없다. 백엔드 저장소 위치(iCloud 동기화되는 `~/Documents`)는 사용자가 보류했다.
9. 실서버 시험(`pnpm test:latency`·`pnpm test:integration`)은 기본 시험에 포함되지 않아 CI 게이트가 아니라 릴리스 전 수동 실행이다. 실행에는 백엔드·PostgreSQL이 필요하다.
10. 위 R 15행의 "확인함"은 로컬 백엔드·같은 기기·jsdom 렌더링·클라이언트 쪽 장애 재현이라는 한계 안의 확인이다(§4·§5). 이관표(§3.1)의 재활성화 뒤 선택지(AC-PART-002-4)는 모의 시험만 있고 실서버 확인이 없다.
11. `check:ac`는 태그 **존재** 검사다. AC 완료의 증거는 §2의 시험 통과와 §3~§6이다.

## 10. 승인 필요

G4 판정(프론트엔드 구현 완료 인정)과 이 증거 묶음의 `main` 병합은 사용자 승인이 필요하다. §9의 1~7을 받아들일지, 추가 검수·점검을 할지는 사용자가 결정한다.

## 11. FE-D3 디자인 적용 점검 (Plan/Tasks v1.1.0, 사용자 승인 2026-11-12)

- 기준 리비전: 브랜치 `HyeonSeoMan/design`의 `26b61c6`(코드 기준). 구성 커밋은 `a29dd19`(FE-D1), `fc314c8`(FE-D2), `26b61c6`(고정 버튼 높이 수정). 기반은 `main` `94d7bf9`(PR #38 병합). 이 절을 쓰는 커밋은 문서만 바꾼다.
- 범위: 시안 v1(`docs/design/mockup-v1.html`)의 시각 스타일 적용. 동작 변경은 고정 `거래 기록하기` 버튼 하나(FD-18 (4)). AC·`ac-matrix.md`는 바뀌지 않았다.
- **이 절은 구현된 화면의 최종 UI 승인이 아니다**(U-5). 사용자가 화면을 직접 검토해야 한다.

### 11.1 최종본 기본 게이트 (`26b61c6`에서 새로 실행, `apps/web`)

| 명령 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm typecheck` | 통과(exit 0) | 구현 중 한 번 실패했다: Panda에 `_notFirst`가 없었다(`_first`로 수정). 시험은 타입을 검사하지 않아 통과했었다 |
| `pnpm lint` | 통과(exit 0) | |
| `pnpm build` | 통과(exit 0) | 라우트 `/`, `/_not-found`, `/invite/[inviteCode]` |
| `pnpm test` | 49파일 612개 통과(exit 0) | 디자인 적용 전 기준선은 **47파일 576개**(`main` `94d7bf9`). 증가분 **36개** = 신규 파일 22개(`design.test.tsx` 14, `record-button.test.tsx` 8) + 토큰 쌍 매개변수 시험 14개(`tokens.test.ts`의 `it.each`가 글자 쌍 14→26, 경계 쌍 2→4로 늘었다). 기존 `*.test.*` 파일은 수정하지 않았다(`git diff 94d7bf9..HEAD`로 확인, 추가만 있음). 기존 576개는 그대로 통과 |
| `pnpm check:ac` | 통과(exit 0) | 모든 AC(79개)에 태그 시험이 있다 |
| `pnpm smoke` | 통과(exit 0) | `/invite/<코드>` 200, 그 밖의 경로 404 기대와 일치 |

### 11.1.1 검수 정정 기록

- G4 검수 1/3(Codex, REVISE)이 지적한 D1-01(시험 증가 수치가 틀림: 590은 토큰 파일을 바꾼 뒤에 센 값이라 매개변수 시험 14개가 이미 포함됐다)과 D1-02(외부 요청 부재 검증 범위가 정적 검사임)를 위 표와 §11.2에서 바로잡았다.
- 같은 검수에서 검수자 샌드박스의 Vitest 1개가 임시 디렉터리 생성 차단으로 실패했다고 보고했다. 같은 시험은 작성자 환경에서 통과했고(612개), 샌드박스 제약에 따른 환경 문제로 본다. 검수자가 build·smoke 재실행과 Chrome 측정 재현은 하지 못했다.

### 11.2 FE-D1 완료 기준

| 기준 | 증거 |
| --- | --- |
| 기존 시험 전부 통과 | §11.1 (기준선 576개 그대로 통과, 기존 시험 파일 수정 없음) |
| 글자 4.5:1·비텍스트 3:1 | `tokens.test.ts`가 글자 쌍 26개·비텍스트 쌍 4개를 계산해 통과. **시안의 보조 글자색 `#6b7570`은 회색 바탕에서 4.5:1에 못 미쳐 `#55615a`로 조정했다**(RK-F15). 시안의 초록 `#12804f` 흰 글자는 4.97:1 |
| `vitest-axe` 통과 | `ui.test.tsx`·`design.test.tsx`·`record-button.test.tsx`와 기존 화면 시험이 통과 |
| 터치 목표 44px | 토큰 시험(44) + 실제 Chrome 측정 `Button` 높이 44px, 고정 버튼 56px |
| 외부 도메인 요청 없음 | **범위: 문자열 기반 정적 검사이며 실제 네트워크 요청을 기록해 확인한 것은 아니다**(실제 Chrome 측정 때도 요청 로그는 남기지 않았다). 소스·설정에 외부 글꼴 주소가 없음을 `design.test.tsx`가 검사. 빌드 산출물(`.next/static`, `.next/server`)에 `fonts.googleapis`·`fonts.gstatic`·`typekit`·`jsdelivr`·`unpkg` 문자열 없음을 grep으로 확인. `@font-face`는 `../media/PretendardVariable-*.woff2`(자체 호스팅) |
| 글꼴 파일 크기 보고 | `PretendardVariable.woff2` **2,057,688바이트(약 2.0MB)**, 서브셋 없음. 사용자가 입력하는 닉네임이 임의의 한글 음절이라 서브셋은 글리프 누락 위험이 있어 쓰지 않았다(RK-F16 결정). `font-display: swap`. Next는 이 글꼴에 `<link rel="preload">`를 기본으로 넣는다 |
| 라이선스 | SIL OFL 1.1 원문(`src/fonts/Pretendard-LICENSE.txt`, 공식 저장소 v1.3.9) |

### 11.3 실제 브라우저 점검 (Chrome headless, 390px 폭, `next start`)

실제 컴포넌트(`RoomLayout`과 방 정보·손익·정산·거래 입력·거래 내역·참여자·고정 버튼)를 임시 미리보기 페이지에 조립해 같은 출처 iframe(폭 390px)에서 측정했다. 임시 페이지는 측정 뒤 **삭제했고 커밋하지 않았다**. 서버는 기록해 둔 프로세스 ID로만 종료했다.

| 측정 | 기본 데이터 | 큰 금액(±999,999,999,999) + 긴 닉네임(12자) |
| --- | --- | --- |
| 뷰포트 | 390 | 390 |
| 가로 넘침 | 없음(`scrollWidth` 390) | 없음 |
| Pretendard 적용 | 적용(`document.fonts.check` loaded, body 글꼴 pretendard) | 적용 |
| 금액 줄바꿈으로 쪼개짐 | 0건 | 0건(금액은 한 덩어리로 다음 줄로 내려간다) |
| 마지막 구역 아래 ~ 문서 끝 | 121px(고정 버튼 영역 72px보다 큼) | 121px |
| 여백 요소 높이 | 104px | 104px |
| 고정 버튼 높이 | 56px(수정 전 44px였다) | 56px |

- 이 측정에서 **고정 버튼 높이가 의도(56px)와 달리 44px**였음을 발견해 `26b61c6`에서 고쳤다.
- 한계: 연결·서버가 없는 조립 화면이다. 실제 방 화면의 전체 흐름(입장·SSE·종료)과 스크롤 중 상호작용은 이 측정에 없다.

### 11.4 화면별 접근성 체크리스트 재점검 (시각 변경 영향분)

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 대비 | 통과 | 토큰 쌍 계산(§11.2). 렌더된 픽셀을 측정하지는 않았다 |
| 큰 금액 레이아웃 | 통과 | §11.3 (10¹² 규모, 가로 넘침·쪼개짐 없음) |
| 폰 폭 | 통과(390px 한 폭) | §11.3. 그 밖의 폭(320px 등)은 측정하지 않았다 |
| 고정 버튼이 마지막 구역을 가리지 않음 | 통과 | §11.3의 여백 104px·문서 끝 121px, `record-button.test.tsx`(DOM 순서·여백) |
| 키보드·포커스 | 부분 | `Enter`로 이동·첫 입력 포커스를 시험. 새 포커스 링의 시각 모양은 캡처해 확인하지 않았다(전역 3px 윤곽선, 초록 4.97:1) |
| 색에만 의존하지 않음 | 통과 | 손익은 색과 함께 `+`·`−` 글자를 쓴다(기존 시험이 부호를 확인) |
| 아이콘 | 통과 | 5종 모두 `aria-hidden`·`focusable=false`(시험). 제목 이름에 섞이지 않음 |

### 11.5 재사용한 과거 증거 (디자인 적용 전 코드에서 얻었고 **다시 실행하지 않았다**)

- §4 화면 반영 지연 측정(`FE-S5-6`), §5 실서버 연동 점검(`FE-I1`), §6.2의 Orca 내장 브라우저 수동 점검, §6.4 두 탭 첫 입장, §7 브라우저 호환 점검 표의 기존 칸. 데이터·통신 계층을 바꾸지 않았고 시각 변경의 영향은 작다고 보지만 **재검증한 것은 아니다**.
- 일부 기존 화면 시험 `getByText`류는 아이콘 추가에도 통과했다(아이콘은 텍스트가 없다).

### 11.6 하지 못한 점검과 남은 위험

- Safari(iOS 포함)·Firefox·실기기 점검, 스크린리더 점검.
- 글꼴 로딩 시간(느린 네트워크). 2MB 글꼴 preload가 초기 로딩에 주는 영향을 측정하지 못했다(RK-F16).
- 320px 등 더 좁은 폭, 가로 회전, 시스템 글꼴 크기 확대.
- 새 포커스 링·눌림(`_active`)·비활성 상태의 시각 확인, 렌더 픽셀 기반 대비 측정.
- 다크 모드는 범위 밖이다(FD-18, 시안에는 있었으나 적용하지 않았다).
- 시안과 의도적으로 다른 점: 보조 글자색 조정(대비), 하단 탭·바로가기 아이콘 행·`내 누적 손익`·`(나)`·시안 문구·`실시간` 칩 미적용(FD-18).
- 이 모든 점검 뒤에도 **최종 UI 승인은 사용자 몫**이다. 화면을 열어 보고 판단해야 한다.

### 11.7 G4 검수 이력 (FE-D1~D3, Codex 읽기 전용·추론 강도 medium)

| 회차 | 판정 | 지적과 처리 |
| --- | --- | --- |
| 1/3 | REVISE | D1-01(LOW) 시험 기준선 590은 토큰 파일 변경 뒤 값, 실제 576·증가 36 → §11.1·§11.2 정정. D1-02(LOW) 외부 요청 부재는 정적 검사 범위 → §11.2에 한정 명시. 코드 확정 결함 없음 |
| 2/3 | **PASS** | D1-01·D1-02 정정 확인(576 + 신규 22 + 매개변수 14 = 612), 정정으로 인한 모순 없음, `Button`·`Banner`·`Badge` 계약 유지. 확정 결함·새 사용자 결정 없음 |

- 검수자 샌드박스에서 `src/test/check-ac.test.ts:41`이 임시 디렉터리 생성 EPERM으로 1개 실패했다(612개 중 611). 작성자 환경에서는 612개 모두 통과했고 샌드박스 제약에 따른 환경 문제다. 두 회차 모두 build·smoke·Chrome 측정·네트워크 기록은 재현하지 못했다.
- 검수자 인정 한계: 좁은 폭·보조기기·글꼴 로딩 시간 미확인(§11.6과 같음).
- **PASS는 코드 품질 판정이며 사용자 승인도, 최종 UI 승인도 아니다.** `main` 병합은 사용자의 명시 승인이 있어야 한다.

### 11.8 브라우저 QA와 후속 수정 (병합 `8d379f5` 뒤, 수정 커밋 `86ef756`)

사용자 요청("브라우저 QA 진행, 이상한 부분·선택 아이콘이 오른쪽으로 쏠린 부분 수정")으로 실제 Chrome(headless, 폭 390px iframe, `next start`)에서 상태별 화면을 렌더링해 점검했다. 점검 상태: 기본(진행 중·연결됨), 종료, 끊김(다시 연결 중), 거래 입력 검증 오류, 게임 종료 확인 대화상자, 홈(방 만들기), 입장 화면의 네트워크 오류. 렌더링에 쓴 임시 페이지는 점검 뒤 **삭제했고 커밋하지 않았다**. 서버는 기록해 둔 프로세스 ID로만 종료했다.

| # | 발견한 문제 | 원인 | 수정 |
| --- | --- | --- | --- |
| 1 | **select 화살표가 오른쪽 끝에 쏠림**(거래 입력 지급자·수취자, 거래 내역 필터, 방 만들기 단위) | 네이티브 화살표는 `padding`을 무시하고 가장자리에 붙는다 | `src/ui/select-style.ts`의 공통 `selectClass`: `appearance: none` + 안쪽 여백(오른쪽 16px)에 맞춘 단색 SVG 화살표(코드 안 데이터 주소, 외부 요청 없음). 4곳 적용 |
| 2 | 홈(방 만들기)·입장 화면이 카드·브랜드 없이 평평함 | FE-D2가 방 화면 구역만 카드화했다 | `BrandHeader`(방울 아이콘 + `DDALLANG`, 제목 이름은 그대로)와 `cardClass`를 홈·입장 화면에 적용 |
| 3 | 끊김 중 구역 6개가 제목만 있는 큰 카드로 무거움 | 제목 아래 여백이 본문 없이 남음 | 데이터가 가려진 동안 제목 아래 여백 제거(컴팩트) |
| 4 | 종료된 방에서 본문 없는 `거래 입력` 카드가 무겁게 보임 | 종료 후 폼이 없는데 구역 카드(제목 아래 여백 포함)만 남음 | **구역은 유지**하고(FD-12) 끊김 중과 같은 제목만 있는 **컴팩트 카드**로 보이게 한다(`data-compact`). 처음에는 구역을 지웠으나 승인된 Plan 위반이라 되돌렸다(§11.9 Q1-01) |
| 5 | 배너 등에서 한글이 단어 중간에서 줄바꿈("표/시할") | 기본 `word-break` | 전역 `word-break: keep-all`, `overflow-wrap: break-word` |

- 회귀 시험 6개 추가(`design.test.tsx` 4: `<select>` **요소마다**(3개) `selectClass`를 쓰는지 소스 정적 검사·클래스 구성·브랜드 헤더 이름·전역 줄바꿈 설정, `record-button.test.tsx` 2: 종료 시 구역 유지·컴팩트·폼 없음, 끊김 시 제목만). 시험 기준선은 `main` `8d379f5`에서 **621개**(다른 PR의 시험 포함)이고 수정 뒤 **50파일 627개** 통과.
- 게이트: `pnpm typecheck`·`lint`·`build`·`check:ac`(AC 79개)·`smoke` exit 0, `pnpm test` 627개 통과. 구현 중 시험 1개가 실패했다(내 시험이 Panda 클래스 이름 `ap_none`을 `appearance_none`으로 잘못 기대했다. 코드가 아니라 시험을 고쳤다). 임시 QA 페이지가 있던 동안에는 "화면 라우트는 둘뿐" 시험이 실패했고 삭제 뒤 통과했다.
- 한계: 이 점검은 Chrome headless 390px 한 폭의 정지 화면 캡처다. 포커스 링·눌림·호버 상태, 실제 스크롤 중 고정 버튼 동작, 320px 이하, Safari·Firefox·실기기, 스크린리더는 점검하지 못했다. 화면 확인은 사람이 보고 판단한 것이라 놓친 부분이 있을 수 있다. 입장 화면의 닉네임 단계와 방 만들기 오류 상태는 서버가 없어 렌더링하지 못했다.

### 11.9 브라우저 QA 후속 수정의 G4 검수 (Codex 읽기 전용·추론 강도 medium)

| 회차 | 판정 | 지적과 처리 |
| --- | --- | --- |
| 1 | NEEDS_DECISION | **Q1-01(HIGH)**: 종료 시 거래 입력 구역을 통째로 지운 것은 Plan FD-18의 "구역 유지·구조 변경은 FD-12 개정" 범위를 벗어난다 → **사용자 결정을 기다리지 않고 승인된 Plan에 맞춰 되돌렸다**(구역 유지 + 컴팩트 카드). 이로써 결정이 필요한 상황이 사라졌다. **Q1-02(LOW)**: select 회귀 검사가 파일에 문자열만 있으면 통과해 select 하나에서 클래스를 빼도 못 잡는다 → `<select>`~`</select>` 요소마다 `className={selectClass}`를 확인하고 요소 수(3)를 고정하도록 강화 |
| 2 | **PASS** | 확정 결함·새 사용자 결정 없음. 구역·제목·순서 유지(`room-layout.tsx`), select 선언 3개와 `ParticipantSelect` 공유 확인, 각 선언에서 클래스를 메모리상 제거해 시험이 모두 검출함을 확인, 증거 기록이 diff와 일치하고 종료 컴팩트의 브라우저 재확인 누락도 명시됨. 잔여 위험: 시험이 실제 여백·픽셀 모양을 직접 검증하지 않음, select 검사는 정적 문자열 방식. 검수자는 관련 4파일 51시험만 실행했고 전체 627시험·build·브라우저 QA는 재실행하지 않아 작성자 실행 기록을 독립 확인하지 못했다 |

- 검수자 확인: 모든 select에 공통 클래스 적용, 화살표는 외부 요청 없는 데이터 URI이며 흰 배경 대비 약 6.47:1, 라벨·오류 연결·disabled·포커스 유지, 입장 래퍼 태그·`RoomScreen` 위치·`h1` 이름 정상, 숨김 조건은 끊김·epoch 불일치 때 구역을 남김. 검수자 샌드박스에서 `check-ac.test.ts:41`이 임시 디렉터리 EPERM으로 1개 실패(환경 문제, 작성자 환경 627개 통과).
- 검수자 잔여 위험: 긴 문자열·좁은 폭의 실제 넘침, 브라우저별 포커스·키보드·보조기기 미검증. `overflow-wrap: break-word`가 flex 최소 폭이나 금액 `nowrap`까지 해결하지는 않는다(금액은 기존대로 한 덩어리로 다음 줄로 내려간다, §11.3 측정).
- 되돌린 뒤 **종료 상태의 컴팩트 카드는 다시 렌더링해 보지 않았다**(DOM 시험 `data-compact`로만 확인). 같은 코드 경로의 끊김 상태 컴팩트는 §11.8에서 Chrome으로 확인했다.
- 되돌림·시험 강화 뒤 게이트: `typecheck`·`lint`·`build`·`check:ac`·`smoke` exit 0, `test` 50파일 627개 통과.

## 12. 방 화면 페이지 분리 (Plan/Tasks v1.2.0 초안, `FE-P1`~`FE-P3`)

- 코드 기준 커밋 `eddf030`(브랜치 `HyeonSeoMan/design`, `main` `8b80e18` 위). Plan/Tasks v1.2.0은 Codex 묶음 검수 1/3 PASS와 사용자 승인(2026-11-13)을 받았다(`plan.md` "1.2.0 승인 기록", `review.md`). 사용자가 "문서는 나중에"라고 해 **구현이 개정보다 먼저 이루어졌다.**
- 사용자 결정: U-8(4개 페이지, 초대 링크 아래 경로)·U-9(플로팅 헤더 탭)·U-10(저장 뒤 기록 페이지에 머묾). U-6·U-7을 대체한다(`open-questions.md` 2.13절). **구현된 화면의 최종 UI 승인이 아니다.**

### 12.1 게이트 (`eddf030`에서 새로 실행, `apps/web`)

| 명령 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm typecheck` | 통과(exit 0) | |
| `pnpm lint` | 통과(exit 0) | |
| `pnpm build` | 통과(exit 0) | 라우트 `/`, `/invite/[inviteCode]`, `/invite/[inviteCode]/record`·`/room`·`/settlement` |
| `pnpm test` | 51파일 643개 통과(exit 0) | 직전 `main` 기준 50파일 627개 → 순증 16개(신규 `room-pages.test.tsx` 16개 + 저장 후 머물기 시험 1개 − 다시 쓴 `record-button.test.tsx`의 순감 1개: 10개 → 9개) |
| `pnpm check:ac` | 통과(exit 0) | 모든 AC(79개)에 태그 시험이 있다 |
| `pnpm smoke` | 통과(exit 0) | 초대 링크와 새 경로 3개가 200이고 `/rooms`·`/join`·`/invite`·`/invite/abc/extra`는 404 |

### 12.2 시험을 바꾼 목록과 이유 (단언을 약하게 하지 않았다는 근거)

기존 시험은 `<InviteScreen>`만 렌더링하면 방의 모든 구역이 한 화면에 나온다고 가정했다. 페이지 분리로 구역이 페이지에 흩어지므로 다음과 같이 바꿨다. **단언은 그대로이고 렌더링 입구와 기대하는 요구만 바꿨다.** 요구가 바뀐 시험(2건)은 새 요구를 검증하도록 다시 썼다.

| 파일 | 변경 | 단언 변화 |
| --- | --- | --- |
| `s5-two-clients`·`s5-ui`·`invite-screen`·`two-tabs`·`ended-room`·`settlement-integration`·`not-provided`(렌더링) | `<InviteScreen …/>` → `<InviteScreen …><AllPages /></InviteScreen>` (`src/test/all-pages.tsx`가 페이지 4개를 합쳐 렌더링). `two-tabs`·`not-provided`는 `next/navigation` 모의에 `usePathname: () => null` 추가 | **없음** (단언 그대로) |
| `latency/client.tsx` | 같은 렌더링 변경 | 없음 |
| `not-provided` (라우트 시험) | 허용 라우트 집합을 `/`+`/invite/[code]` 둘 → `/`+초대 링크 아래 4개 페이지로 | **요구 변경**(FD-2 하위 경로 추가) |
| `record-button.test.tsx` | 제목이 바뀐 시험 5개(보임, 종료 시 없음, 끊김 시 없음, 접근성, `RoomLayout` 구역 순서)는 대상이 버튼에서 링크로(`role=link`·`href`)만 달라졌다. 종료·끊김 때 구역(compact)·여백·제목 아이콘 시험은 그대로 유지 | **요구 변경**(`거래 기록하기`가 스크롤 이동 → 기록 페이지 링크). **단언이 사라진 것은 3가지**: 클릭 시 거래 입력 구역으로 스크롤·첫 입력 포커스, 모션 줄이기 설정에서 부드러운 스크롤 끄기, 접근성 시험 안의 Enter 키 동작(링크는 브라우저 기본 동작이라 앱이 처리하지 않는다). 새 요구에는 해당 동작이 없다 |
| `transaction-form.test.tsx` | 저장 뒤 머물기 시험 1개 추가 | 추가만 |
| `room-pages.test.tsx`(신규) | 경로→페이지, 헤더 탭, 페이지별 구성, 종료 방 이동 | 추가만 |

- 삭제된 단언은 `RecordTransactionButton`의 스크롤·첫 입력 포커스·모션 줄이기·Enter 키뿐이며 FD-18 (4)가 기록 페이지 링크로 수정되면서 요구 자체가 바뀌었다(`git diff eddf030~1 eddf030 -- …/record-button.test.tsx`로 확인).
- `src/integration/integration.test.tsx`(실서버)는 `InviteScreen`을 `latency/client.tsx` 경유로 쓴다. 타입 검사는 통과했지만 **실서버가 없어 이 시험은 실행하지 못했다**(`pnpm test:integration`, FE-I1과 같은 이유).

### 12.3 실제 Chrome 점검 (headless, 390px, `next start`)

실제 `RoomShell`·`RoomHeader`·`Link`·페이지 컴포넌트를 시드 데이터와 같은 경로 구조(`/invite/<코드>/…`)의 임시 레이아웃으로 렌더링했다. 임시 파일은 점검 뒤 **삭제했고 커밋하지 않았다**. 서버는 기록해 둔 프로세스 ID로만 종료했다.

| 측정 | 결과 |
| --- | --- |
| 스크롤해도 헤더가 화면 위에 떠 있음 | 헤더 위쪽 12px, 스크롤 373px 뒤에도 12px |
| 탭 클릭이 클라이언트 이동이고 레이아웃이 유지됨 | 경로가 `…/record`로 바뀌고 헤더 DOM 요소가 그대로(`sameHeaderElement=true`) |
| 기록 입력 초안이 탭을 옮겨도 남음 | `금액`에 입력한 값이 `방` 탭에 다녀온 뒤에도 그대로 |
| 상태별 화면 | 현황·기록·정산·방(진행 중), 종료(정산에서 시작·기록 탭 없음·`최종 정산`), 끊김(`DDALLANG` 헤더·연결 배너·컴팩트 카드)을 캡처로 확인 |

- 점검 중 발견해 고친 것: 정산 페이지에서 `게임 종료` 버튼이 정산 목록에 간격 없이 붙어 있었다(구분선·여백 추가, `end-game.tsx`).
- 한계: 연결·서버가 없는 시드 화면이다. **실시간 연결이 탭 이동에도 하나만 유지되는지는 실제 스트림으로 확인하지 못했다**(레이아웃·헤더 DOM이 유지됨과 연결 훅이 레이아웃에 있음에서 추론). 새로고침·직접 주소 입력·브라우저 뒤로 가기, 입장 단계(닉네임 입력 등)의 새 경로 동작은 실서버 없이 확인하지 못했다.

### 12.4 하지 못한 점검과 남은 위험

- 실서버 연동(`FE-I1`)과 두 접속자 통합(`s5-two-clients`는 `AllPages`로 jsdom 통과, 실서버 시험은 미실행), 실제 SSE에서 탭을 옮길 때 연결 수.
- Safari·Firefox·실기기·스크린리더, 320px 이하, 포커스 링·눌림 상태의 시각 확인.
- 종료된 방에서 `기록` 경로로 직접 들어갔을 때 정산으로 이동하는 동작은 jsdom 시험(라우터 모의)으로만 확인했다. 실제 브라우저에서는 종료 상태를 시드해 현황 경로가 정산으로 이동하는 것만 확인했다.
- 헤더의 방 이름이 매우 길 때의 줄임표 표시는 확인하지 않았다.

### 12.5 검수 이력 (G3+G4 묶음, Codex 읽기 전용·추론 강도 medium)

| 회차 | 판정 | 지적과 처리 |
| --- | --- | --- |
| 1/3 | **PASS** | P1-01(LOW): Plan 실행 순서 도식에 섹션 K(`FE-P1`~`FE-P3`)와 `FE-Z1` 선행 제외 누락 → Plan에 추가. 확정 결함·새 사용자 결정 없음 |

- 검수자 샌드박스에서 `check-ac.test.ts:41`이 임시 폴더 생성 EPERM으로 1개 실패(642/643). 작성자 환경에서는 643개 통과(환경 문제).
- 검수자는 build·smoke·Chrome 측정을 재현하지 못했다. 측정에 쓴 임시 파일을 삭제했기 때문에 독립 확인이 어렵다는 점은 §12.3에 이미 적었다.

### 12.6 병합 뒤 실서버 통합 시험 (`main` `cf76c53`, 2026-11-13)

페이지 분리를 `main`에 병합한 뒤, 12.4가 미확인으로 남긴 실서버 통합 시험을 실행했다. 이전 FE-I1(§5)과 같은 방식이다.

- 환경: 같은 기기, `ddallang-server`(`main` `dd912db`, 기존에 빌드된 `dist`)를 **별도 포트 3101과 별도 DB**(`ddallang_fe_integration`, 기존 Postgres 16 컨테이너에 새로 만듦)로 띄웠다. 사용자의 개발용 서버(3001)와 개발 DB는 건드리지 않았다. 마이그레이션 6개는 `prisma/migrations/*/migration.sql`을 순서대로 적용했다(`prisma migrate deploy`가 아니다, 서버 README가 `migrate deploy` 경로는 미검증이라고 적었다).
- 명령: `INTEGRATION_API_BASE_URL=http://localhost:3101 pnpm test:integration` → **1파일 7개 통과(exit 0)**, 약 9.8초.
- 결과(시험 보고): 끊김 복구 후 최종 정산 표시까지 1,620ms, 응답 유실 재시도는 같은 Idempotency Key로 재생(`Idempotent-Replayed`) 서버 거래 1건, 예상 정산이 거래 생성·수정·삭제와 참여자 등록·상태 변경마다 서버 정산과 일치, 오류 코드·헤더 계약 차이 없음, 모의 fixture와 실서버 응답의 필드 차이 없음(방·참여자·손익·거래·정산).
- **이 시험이 확인한 것**: 페이지 분리 뒤에도 `InviteScreen`(`AllPages` 입구)이 실서버와 통신하는 데이터 흐름(두 접속자 실시간 반영, 끊김 복구, 응답 유실, 계약)이 §5와 같게 동작한다.
- **이 시험이 확인하지 못한 것(여전히 미확인)**: 시험은 jsdom에서 `AllPages`를 렌더링하므로 **실제 라우트 이동·헤더 탭·종료 방 이동·탭 이동 시 연결 유지는 이 시험의 대상이 아니다.** 실제 브라우저에서 실서버 SSE가 탭을 옮겨도 하나만 유지되는지, 새로고침·직접 주소 입력·뒤로 가기는 확인하지 못했다.
- 정리: 시험용 서버는 기록한 프로세스 ID로만 종료했다. 새로 만든 DB `ddallang_fe_integration`은 **삭제하지 않고 남겼다**(이 시험이 만든 시험 방이 들어 있다. 삭제는 별도 승인 사항).

### 12.7 실제 브라우저 × 실서버 점검 (`main` `03f0647`, 2026-11-13)

12.3·12.6이 미확인으로 남긴 부분(실서버 스트림이 탭 이동에도 하나만 유지되는지, 새로고침·직접 주소 입력·뒤로 가기, 종료 방 이동)을 **실제 Chrome(headless, 390px 모바일 에뮬레이션)과 실서버**로 확인했다. 도구는 Chrome DevTools 프로토콜을 Node 22 내장 WebSocket으로 직접 부르는 스크립트(`apps/web/scripts/qa-room-pages.mjs`, 새 의존성 없음)다.

- 환경: `ddallang-server`(`main` `dd912db`)를 별도 포트 3101·별도 DB(`ddallang_fe_integration`)로, 이 저장소 `main`의 프로덕션 빌드(`NEXT_PUBLIC_API_BASE_URL=http://localhost:3101`)를 3055로 띄웠다. 개발용 서버(3001)와 개발 DB는 건드리지 않았다. 점검이 끝난 뒤 Chrome·앱·서버를 기록한 프로세스 ID로만 종료했고 포트가 모두 비었음을 확인했다.
- 방법: 앱 코드보다 먼저 `window.fetch`를 감싸 `/events` 호출 횟수를 세었다(문서가 새로 로드될 때마다 0부터).
- 결과: **30개 확인 모두 통과**(2회 실행: 첫 실행은 29/30, 아래 스크립트 결함 2건을 고친 뒤 30/30).

| 영역 | 확인 | 결과 |
| --- | --- | --- |
| 방 만들기 → 방 화면 | 초대 링크 경로의 현황으로 이동, 헤더에 방 이름·진행 상태, 탭 4개, 현황에 `누적 손익|거래 내역` | 통과 |
| 연결 유지 | 방 만들기 → 탭 클릭 여러 번(방·기록·정산·현황) → 뒤로 가기까지 **`/events` 호출 1회**, 헤더 DOM 요소가 그대로 | 통과 |
| 참여자 등록 | 방 페이지에서 2명 등록, 등록 뒤에도 스트림 1회 | 통과 |
| 기록 | 기록 페이지에 거래 입력만, 저장하면 눈에 보이는 안내, **저장 뒤 기록 경로에 머묾**, 폼이 비워짐, 다른 탭에 다녀와도 입력 초안 유지 | 통과 |
| 반영 | 저장한 거래가 현황의 누적 손익(`+1,000`/`−1,000`)과 거래 내역에 보임 | 통과 |
| 뒤로 가기 | 이전 페이지(기록)로 이동, 같은 헤더·스트림 1회, 탭 강조가 기록 | 통과 |
| 새로고침·직접 주소 | 기록 페이지에서 새로고침해도 입장을 복원해 같은 페이지, 닉네임을 다시 묻지 않음, 새 문서에서도 스트림 1회, 하위 경로(`/room`)를 직접 입력해도 복원 | 통과 |
| 게임 종료 | 정산 페이지의 `예상 정산`과 `게임 종료`, 확인 대화상자, 종료하면 같은 페이지가 `최종 정산`, 헤더에서 기록 탭 사라지고 `게임 종료` | 통과 |
| 종료 방 이동 | 종료된 방의 기록 주소 → 정산, 처음 들어온 현황 → 정산, 그 뒤 현황 탭을 누르면 막지 않음 | 통과 |

- 첫 실행의 2건 실패는 **스크립트 결함이었다**(앱 결함 아님): 방 화면이 막 열린 직후(데이터 도착 전) 헤더를 검사해 설계대로 `DDALLANG`만 보였고, DOM 요소를 값으로 되돌려 CDP 직렬화 오류가 났다. 데이터가 도착할 때까지 기다리고 요소 대신 불리언을 반환하도록 고쳤다.
- 이로써 12.3의 "실제 스트림으로 확인하지 못했다"와 12.4의 새로고침·직접 주소·뒤로 가기·종료 방 이동 미확인이 **해소**되었다.
- **여전히 하지 못한 것**: Safari·Firefox·실기기·스크린리더, 320px 이하, 실제 화면 캡처 육안 확인(이 점검은 DOM·경로·호출 횟수 기반이다), 두 접속자가 동시에 탭을 옮길 때의 서버 연결 수(한 접속자당 5개 한도는 §5에서 확인), 느린 네트워크.
- 정리: 시험 DB `ddallang_fe_integration`에는 이 점검이 만든 시험 방이 들어 있다(삭제하지 않았다).

### 12.8 실서버 데이터로 채운 실제 화면의 육안 점검과 수정 (2026-11-13)

12.7이 "화면 캡처 육안 확인은 하지 못했다"고 남긴 부분을 같은 환경(실서버 3101·별도 DB, 프로덕션 빌드 3055, 원격 디버깅 Chrome)에서 `Page.captureScreenshot`으로 확인했다. 방(방 이름 12자 최대 길이, 참여자 3명, 거래 3건, 최대 999,999,999원)을 실서버에 만들고 4개 페이지를 390px·320px로 캡처했다.

- **가로 넘침**: 8개 조합(4페이지 × 2폭) 모두 없음(`scrollWidth` = 뷰포트 폭).
- **320px**: 헤더의 긴 방 이름은 줄임표로 처리되고 탭 4개가 모두 보인다. 큰 금액(`+999,987,499 원` 등)은 줄이 바뀌지 않고 한 덩어리로 보인다.
- **키보드 포커스**: `Tab` 키로 옮긴 탭에 초록 포커스 링이 또렷하게 보인다(전역 3px 윤곽선).
- **발견해 고친 문제 1건**: 스크롤하면 **헤더 위쪽 12px 틈으로 지나가는 카드 내용이 비쳤다**(떠 있는 헤더의 위쪽이 투명했다). 고정 래퍼(`room-header-sticky`)가 안전 영역을 포함한 위쪽 틈을 캔버스 색으로 덮고 헤더 아래는 그라데이션으로 사라지게 했다(`room-header.tsx`). 고친 뒤 같은 시나리오를 다시 캡처해 틈이 깨끗함을 확인했다. 회귀 시험 1개 추가(`room-pages.test.tsx`).
- 점검 중 스크립트 문제 2건(방 이름 길이를 규칙 12자 초과로 넣음, 평가 식의 `const` 중복 선언)은 앱 결함이 아니다.
- 게이트(수정 후, `apps/web`): `typecheck`·`lint`·`build`·`check:ac`·`smoke` exit 0, `test` 51파일 644개 통과(직전 643 + 1).
- 정리: Chrome·앱·서버를 기록한 프로세스 ID로만 종료했고 포트(3101·3055·9223)가 비었으며 개발용 서버(3001)와 개발 DB는 건드리지 않았다.
- **여전히 하지 못한 것**: Safari·Firefox·실기기·스크린리더, 눌림·호버 상태의 시각 확인, 느린 네트워크, 두 접속자가 동시에 탭을 옮길 때의 서버 연결 수. 캡처는 사람이 눈으로 본 것이라 놓친 부분이 있을 수 있다.

## 13. 배포된 백엔드 연동 (2026-11-13)

백엔드가 Render 무료 플랜(`https://ddallang-api.onrender.com`)에 배포되어 인계 문서(`ddallang-server` `docs/frontend-handoff.md`, `origin/main`)를 읽고 연동했다.

### 13.1 배포본 읽기 전용 점검 (데이터를 쓰지 않았다)

| 확인 | 결과 |
| --- | --- |
| `GET /health` | 200 `{"status":"ok"}`, 0.45초(점검 시점에 서버는 깨어 있었다. 콜드 스타트 시간은 **측정하지 못했다**) |
| CORS 사전 요청(`Origin: http://localhost:3000`, `POST /rooms`) | 204, 허용 헤더 `Authorization,Content-Type,Idempotency-Key,Idempotency-First-Attempt-At`, 허용 메서드·노출 헤더 `Date,Idempotent-Replayed,Retry-After`가 인계 문서와 일치 |
| 허용되지 않은 출처(`http://localhost:3055`) | 204이지만 `Access-Control-Allow-Origin` 없음 → 브라우저가 차단(문서대로 `localhost:3000`만 허용) |
| 오류 형식(없는 경로) | `{"error":{"code":"ROUTE_NOT_FOUND","message":…,"details":[]}}` |

### 13.2 프론트엔드 쪽 변경

- **코드 변경 없이 연결된다**: `parseApiBaseUrl`이 `https` 주소를 받는다(FD-1). 값은 빌드 때 번들에 고정된다. 문서(`.env.example`, README)에 배포 주소와 CORS·재빌드 주의를 적었다.
- **미리 깨우기(FD-19, 새 동작)**: 무료 호스팅의 첫 요청은 50초 넘게 걸리는데 읽기 요청 시간 제한은 Spec의 10초라 처음 연 사용자가 시간 초과를 본다. 백엔드 인계 문서도 깨워 두기를 권한다. Spec 계약(시간 제한·재시도)은 바꾸지 않고 문서가 열릴 때 `GET /health`를 한 번 보낸다(`src/lib/wake-api.ts`, `src/providers/api-wake-up.tsx`, 시험 4개 + 검수 반영 후 §13.5).
- 확인: 배포 주소로 빌드한 앱을 실제 Chrome(headless)으로 열어 **네트워크 요청을 기록**했다. 배포 API로 나간 요청은 인증 없는 `GET /health` 1건뿐이고 그 밖의 외부 요청은 없었다.
- 게이트(변경 후): 아래 §13.4.

### 13.3 하지 못한 것(중요)

- **실제 사용 흐름(방 만들기·거래·실시간)을 배포본에서 실행하지 않았다.** 배포 DB에 시험 데이터가 남는 쓰기 작업이라 사용자 승인 없이 하지 않았다. 앱 출처 `http://localhost:3055`는 배포 CORS에 허용되지 않아 브라우저 점검도 불가했다(사용자의 개발 서버가 `localhost:3000`을 쓰고 있다). 로컬 서버로는 §5·§12.6·§12.7에서 같은 흐름이 통과했다.
- **SSE가 Render 프록시를 거쳐 지연 없이 오는지는 확인하지 못했다**(백엔드 인계 문서도 미확인이라고 적었다).
- 콜드 스타트 중 실제 동작(깨우기가 효과가 있는지, 첫 사용자가 보는 화면)은 측정하지 못했다. 서버가 깨어 있는 상태에서 점검했다.
- 프론트엔드 호스팅은 정해지지 않았다(FD-17). 정해지면 백엔드 `CORS_ORIGINS`에 출처를 넣고 재배포해야 한다.

### 13.4 게이트 (`apps/web`, 이 변경 후)

`pnpm typecheck`·`lint`·`build`·`check:ac`(AC 79개)·`smoke` exit 0, `pnpm test` 52파일 648개 통과(직전 644 + 미리 깨우기 시험 4개). 구현 중 시험 1개가 실패했다: 내 시험이 "주소 설정 없음" 상황을 만들지 못했다(시험 환경에 주소 환경 변수가 이미 있어서). 환경 변수를 비우도록 시험을 고쳤고 코드는 바뀌지 않았다. 점검용 Chrome·앱은 기록한 프로세스 ID로만 종료했고 포트(3055·9223)가 비었음을 확인했다.

### 13.5 검수 이력 (Codex 읽기 전용·추론 강도 medium)

| 회차 | 판정 | 지적과 처리 |
| --- | --- | --- |
| 1/3 | REVISE | **W1-01(MEDIUM)** 개발 모드(React StrictMode)에서 효과가 두 번 실행되어 문서당 `/health` 요청이 2회(FD-19의 1회 계약 위반, 검수자가 재현) → 컴포넌트가 아니라 **모듈 상태**로 문서당 1회를 보장(`wakeApiOnce`), StrictMode 시험 추가. **W1-02(MEDIUM)** `FeatureGate` 바깥에서 실행되는데 `AbortController`가 없으면 `TypeError`(S5 §3.1·§9 안내 방해, 검수자가 재현) → `AbortController`·`fetch` 부재와 동기 예외를 모두 삼키고 생략하도록 수정, 시험 추가 |

- 검수자 확인: 인증 없는 GET·실패 무시·설정 누락·90초 중단 검증, 신원 키 전송이나 10초·재시도 계약 변경 없음, Spec 우선 적용 타당, 새 제품 결정 없음, 환경변수·CORS 설명과 FD-19 승인 대기 표시 적절. 검수자는 전체 시험·빌드·배포 CORS·콜드 스타트·SSE·실사용은 재현하지 못했다.

| 2/3 | **PASS** | 지적 없음. W1-01·W1-02 수정과 StrictMode·기능 부재 시험을 직접 확인, 인증·사용자 데이터 없는 GET이고 SSR에서는 효과가 실행되지 않음, 기존 10초·재시도 계약 유지, 새 제품 결정 없음. 검수자 직접 실행: 추가 시험 10개·전체 653개 통과(나머지 1개는 읽기 전용 샌드박스의 임시 디렉터리 차단), 타입 검사·AC 79개 통과. **검수자가 남긴 잔여 위험**: 깨우기가 끝나기 전에 들어온 첫 요청은 여전히 시간 초과가 날 수 있다(깨우기는 완화책이지 계약 변경이 아니다) |

### 13.6 검수 반영 뒤 게이트 (`apps/web`)

`pnpm typecheck`·`lint`·`build`·`check:ac`(AC 79개)·`smoke` exit 0, `pnpm test` 53파일 654개 통과(§13.4의 648 + 6: `wake-api.test.ts` 3개 추가, `api-wake-up.test.tsx` 3개 신규). 개발 모드에서만 일어나는 StrictMode 중복은 시험(`<StrictMode><ApiWakeUp/></StrictMode>`)으로 확인했고 실제 `next dev` 화면에서는 확인하지 못했다.

- **승인 근거와 한계**: FD-19는 새 동작이므로 Plan 변경이다. 사용자는 이 항목을 개별로 승인하지 않았고 "위험한 판단만 물어보세요. 병합은 승인합니다"(2026-11-13)라는 포괄 지시가 있어 병합했다. 위 잔여 위험(깨우기 완료 전 첫 요청의 시간 초과)과 §13.3의 미확인(배포본 실제 흐름·SSE 프록시·콜드 스타트)은 그대로 남아 있다.


## 14. 배포본 실사용 흐름 점검 (Vercel × Render × Supabase, 2026-11-13)

사용자 승인("실제로 네가 테스트하고 와도 돼")을 받아 배포된 앱(`https://ddallang.vercel.app`)을 실제 Chrome(headless, 390px)으로 열어 점검했다. 도구는 `apps/web/scripts/qa-prod.mjs`(CDP)이고 **배포 DB에 시험 방 `점검용`(참여자 2명, 거래 3건, 종료됨)이 남았다**(삭제하지 않았다). 같은 신원의 탭 두 개로 실시간 반영을 측정했다.

- 선행 사건: 첫 배포 직후 DB를 쓰는 요청이 모두 500이었다. 원인은 Prisma 어댑터(pg)가 Supabase 풀러 인증서를 Node 기본 CA로 검증해 `SELF_SIGNED_CERT_IN_CHAIN`이 난 것이며(Render 로그로 확정, Supabase Root 2021 CA를 신뢰시키면 통과함을 직접 시험으로 확인), 백엔드 쪽이 고쳤다. 고친 뒤 `GET /invites/test`가 404 `INVITE_NOT_FOUND`로 바뀐 것을 읽기 전용으로 확인했다.
- **결과: 15개 확인 모두 통과.**

| 확인 | 결과 |
| --- | --- |
| 배포 앱 홈, 방 만들기(배포 백엔드) | 홈 0.5초, 방 만들기 5.8초(서버가 깨어 있었다) 후 방 화면(현황), 헤더 방 이름·진행 상태, 탭 4개 |
| 실시간 스트림 | 탭마다 `/events` 1회, Render 프록시를 거쳐 정상 연결 |
| 참여자 등록, 탭 B 복원 | 2명 등록. 탭 B가 같은 신원으로 방을 복원(닉네임 재질문 없음) |
| **실시간 반영(탭 A 저장 → 탭 B 손익 갱신)** | 3회 측정 **2,976 / 3,282 / 3,632ms**(요청 송신 기준). 아래 해석 참조 |
| 서버 계산 일치 | 탭 B 손익 가온 −6,000·나래 +6,000, 최종 정산 가온 → 나래 6,000원 |
| 새로고침 복원, 종료 방 이동 | 기록 페이지에서 새로고침해도 복원, 종료 뒤 기록 주소는 정산으로 이동 |
| 게임 종료 실시간 반영 | 탭 A 3,100ms·탭 B 3,101ms에 `게임 종료` 표시·기록 탭 제거 |
| 오류 | 점검 중 배포 API 4xx/5xx·네트워크 실패·JS 예외 **없음**. 요청 호스트는 `ddallang.vercel.app`과 `ddallang-api.onrender.com`뿐 |

**실시간 지연 해석(정직하게)**: Spec S5 §6.7은 화면 반영 지연의 목표를 p95 3초·최대 5초로 정한다. 측정한 3.0~3.6초는 **최대 5초 이내**이나, 표본이 3개뿐이라 p95를 판정할 수 없고 값이 p95 목표(3초)를 약간 넘는다. 또 **탭 B의 반영 시각이 탭 A의 저장 응답 수신 시각과 거의 같았다**(차이 1ms 이내). 즉 지연의 대부분은 SSE 전달이 아니라 **저장 요청 자체의 처리 시간(약 3초)**이다. 이벤트 전달과 갱신은 커밋 직후 빠르게 이루어진 것으로 보이나 이 측정만으로 커밋 시각을 분리하지는 못했다(Spec이 응답 수신 시각을 T0로 쓰지 말라고 하므로 이 값은 요청 송신 기준 그대로 둔다). 저장이 3초 걸리는 원인은 확정하지 못했고, **배포 구성이 의심된다**: Render 서버(싱가포르)와 Supabase DB(시드니, 풀러 호스트 `aws-0-ap-southeast-2`)의 지역이 다르고, Render 로그의 `GET /invites/*`(DB 질의 1회)가 약 290ms였다. 쓰기 하나는 여러 번의 DB 왕복이 필요해 이 값이 누적되었을 가능성이 크다. 이는 프론트엔드가 아니라 **백엔드·DB 배치의 문제**이며 프론트엔드 코드는 바꾸지 않았다.

**하지 못한 것**
- 서버가 잠들었다 깨는 **콜드 스타트**(점검 시점에 서버는 깨어 있었다), 미리 깨우기의 실제 효과.
- 두 접속자(서로 다른 신원)의 동시 사용, 방당 많은 접속자, 느린 모바일 망.
- Safari·Firefox·실기기·스크린리더, 눌림·호버 상태의 시각 확인. **구현된 화면의 최종 UI 승인은 사용자 몫이다.**
- 점검 스크립트 라벨 오류 1건: 정산 방향 확인 항목의 라벨이 "나래 → 가온"이라고 적혀 있었으나 실제 화면은 "가온 → 나래"(채무자가 채권자에게 보냄, 올바름)이다. 항목은 금액(6,000)만 확인했고 앱 결함이 아니다.

## 15. 디자인 v2 적용 최종 점검 (Plan/Tasks v1.3.0, `FE-V4`, 2026-11-16)

근거: `plan.md` FD-18(1.3.0)·§8, `tasks.md` 섹션 L, 최종 UI 확정본 `docs/design/direction-v2-banksalad.md` 1.0.0(사용자 위임 U-15). Task별 검수 기록은 `docs/design/review-v2.md` 3단계, 측정 원자료·캡처는 `docs/design/v2-evidence/`(fe-v2·fe-v3·fe-v4)다. 병합: FE-V1 PR #54, FE-V2 PR #55, FE-V3 PR #56.

### 15.1 기본 게이트 6종 (최종 리비전 `9005b6b`, `apps/web`)

| 명령 | 종료 코드 | 결과 |
| --- | --- | --- |
| `pnpm typecheck` | 0 | `next typegen` + `tsc --noEmit` |
| `pnpm lint` | 0 | 오류 0, 경고 0 |
| `pnpm test` | 0 | 53파일 **717시험** 통과 |
| `pnpm check:ac` | 0 | 모든 AC **79개**에 태그 시험 |
| `pnpm build`(`NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`) | 0 | 경로 6개(정적 `/`·`/_not-found`, 동적 `/invite/[inviteCode]` 외 3) |
| `pnpm smoke` | 0 | 10개 경로 기대 상태 |

### 15.2 상태별 화면 점검 (실제 Chrome 157 헤드리스, 375px)

방법은 FE-V2와 같다(`docs/design/v2-evidence/fe-v2/README.md`): 앱 시험 도우미로 시드 상태를 렌더한 HTML + 생성 CSS + Pretendard를 375px 컨테이너에서 측정했다. 입장 화면은 모의 서버(MSW) 응답으로 닉네임 단계까지, 방 만들기 오류·잠금은 모의 서버의 `unit` 거부·네트워크 오류로 만들었다. **배포 DB·실서버에는 요청하지 않았다**(§14의 실사용 점검 승인은 그때에 한한다). 스크립트·원자료·캡처: `docs/design/v2-evidence/fe-v4/`.

| 화면 | 확정본 대조 | 375px 넘침 |
| --- | --- | --- |
| 현황(진행 중) | 흰 헤더·글자 탭·info 배지, 카드 밖 구역 제목, 목록 행·아바타, 거래 행(코인 원·메타 줄·알약), 하단 고정 `거래 기록하기`(전폭, 마지막 카드 안 가림) | 0 |
| 기록 | 지급자 → 수취자 구분선, 금액 24/700·바깥 단위, 저장 전폭 | 0 |
| 정산(예상) | 배지 → 안내 info 띠 → 정산 행, 카드 밖 `게임 종료` 테두리 버튼 | 0 |
| 방 | 방 정보(지금 문구, info 배지, readOnly 초대 링크 + 알약 복사), 참여자 행·방장 알약 | 0 |
| 종료(정산·현황·기록) | `기록` 탭 없음, `게임 종료` neutral, 최종 정산·`정산 복사` 전폭 회색, 거래 행 컨트롤 없음, 거래 입력은 제목만(실제 앱은 종료 방의 `/record`를 정산으로 보내므로 이 화면은 이동 전 상태다. 렌더에서는 라우터를 모의해 이동하지 않았다. 모양 확인용) | 0 |
| 끊김 | 헤더 `DDALLANG`만, warning 띠(끊김 아이콘·제목·상세 다음 줄), 구역 제목만 | 0 |
| 입장(진행 중·종료) | 카드 제목 없음, 미리보기 20/700·16·배지·종료 안내 14/500 | 0 |
| 방 만들기(오류·잠금) | 오류: 선택 타일 `danger` 2px + 타일 아래 오류 문구. 잠금: 비활성 색 + 선택 타일 `inkMuted` 2px, `다시 시도`·`취소` 같은 폭·높이 | 0 |
| 최대 경우(현황·정산·방) | `±999,999,999,999` + 12자 단위(N = 29) 13px·259.5px, 이름 아래 줄 오른쪽 | 0 |

- 점검 중 고친 것: 방 만들기 결과 불명의 `다시 시도`(52px)·`취소`(44px 알약)가 높이·모양이 달라 같은 폭·높이 두 버튼(확인 대화상자와 같은 모양)으로 맞췄다(`9005b6b`). 동작·이름은 그대로다.
- 측정 보정: 렌더한 HTML에는 라디오 `checked` 속성이 남지 않아(속성 값이 아니라 DOM 속성) 저장 전에 옮겼다. 앱 동작과 무관하다.
- **RV-2 판단(카드 경계)**: 바탕 `#F6F7F9` 위 흰 카드의 경계는 모든 캡처에서 구분된다. 바탕을 `#F2F4F6`으로 내리는 대체안은 **적용하지 않는다**. 실기기(밝기·화면 품질)에서 약하게 보이면 다시 판단한다(실기기 미확인).
- RK-F20(헤더 경계): 구분선이 없으면 경계가 사라져 `divider` 1px를 두었다(`fe-v2/rkf20-header-boundary.png`). 확정본 §5.1과 다른 유일한 점이다.
- 정산 단위 타일 좁은 폭: 375px(묶음 303px) 4칸, 300px(묶음 228px) 2×2(`fe-v3/create-room-375-and-300.png`, 빌드본 `next start`).

### 15.3 바꾼 시험과 지운 대비 쌍 (RK-F21)

Task별 표는 `docs/design/review-v2.md`의 FE-V1·FE-V2·FE-V3 "바꾼 시험 단언"이다. 요약:

- **모양 단언을 새 값으로**: 토큰 값(색·모서리·그림자), 아이콘 5 → 12종, 헤더 래퍼 그라데이션 → 흰 단색·구분선, 버튼 `accent` 변형 → 6변형, "large가 기본보다 높다" → 변형별 높이(주 버튼 기본이 52px가 되어 성립하지 않음).
- **조회 방법 이전(RK-F19)**: 방 만들기 정산 단위 `combobox`/옵션 → `group`/`radio`. 요청 본문 `unit`, 계산된 오류 설명, `toBeInvalid`, 잠금 비활성 단언은 그대로 옮겼다.
- **개수 변경**: 공통 모양 선택 상자 3 → 2개(방 만들기 select가 라디오로 바뀜). 허용 클래스는 `selectClass`·`selectCompactClass`(필터 44px).
- **지운 대비 쌍**: 글자 `["ink","accentSoft"]`·`["secondaryText","secondary"]`·`["accentText","accent"]`(토큰과 함께 지움, 쓰임이 사라짐), 비텍스트 `["line","canvas"]`(`line`을 흰 바탕에서만 씀). **옮긴 쌍**: `["primary","paper"/"canvas"]` → `["brandText",…]`(`primary`를 글자로 쓰지 않음). 더한 쌍은 FD-18 (1) 목록 그대로. 결과 글자 28쌍·비텍스트 5쌍, 최솟값 4.5521·3.2160(Codex 직접 계산).
- 동작·문구·접근성 단언을 약하게 바꾼 것은 없다(Claude·Codex 검수가 각 Task에서 확인).

### 15.4 하지 못한 점검 (숨기지 않는다)

- **실기기**(iPhone·Android), **Safari**, **Firefox**, **VoiceOver**(정산 단위 `fieldset`의 설명 낭독, RV-6 포함)·TalkBack. 특히 `:has()`(Safari 15.4+, Firefox 121+), 컨테이너 쿼리, iOS 홈 화면 아이콘(180 불투명)의 실제 표시.
- **실서버 연결 화면**: 이번 점검은 시드·모의 서버다. 실시간 반영·연결 상태 전환의 실제 화면은 다시 보지 않았다(§12.7·§14 이후 동작 코드 변경 없음).
- **하위 상태의 Chrome 캡처 없음**: 확인 대화상자(아래 시트), 저장 안내 success 띠, 거래 수정 폼 펼침, 참여자 행 오류·`다시 시도`, 복사 결과 상태 문단, 연결 배너 info·success 톤, 종료·끊김 때 고정 버튼 숨김. 이들은 컴포넌트 시험(역할·이름·클래스·DOM 위치)으로만 확인했다.
- 고대비 모드(`forced-colors`)의 실제 표시, 눌림·호버 상태, 다크 모드(범위 밖).
- 헤드리스 Chrome의 최소 창 폭(500px) 때문에 375px는 스크롤 컨테이너·iframe으로 흉내 냈다(뷰포트 고정 요소는 iframe으로 따로 확인).
- **구현된 화면의 최종 UI 승인은 사용자 위임(U-15)에 따라 Claude가 확정본 대조로 판단했다.** 사용자가 다르게 고르면 다시 개정한다.

## 16. 2.0.0 개정 — Spec v0.3.0 접속자·참여자 통합 (`FE-M1`~`FE-M9`, 2026-11-16)

- 상위 문서: Spec S1~S5 v0.3.0(`5c6d4c0`), Web Plan·Tasks·AC 매핑표 2.0.0(`main` `c52ec81`, PR #61, 사용자 승인 2026-11-16).
- 브랜치: `HyeonSeoMan/fe-m1-m3` → 그 위의 `HyeonSeoMan/fe-m4-m9`(하나의 PR로 묶는다). 커밋은 Task 순서다(`814dd24` M1, `904c129` M2, `6c85fa0` M3, `6594254` M4, `72d99ef` M5, `7c9bac8` M6, `bee9629` M7, `a254b13` M8 측정·연동 코드, `a90d153`·`c2baaea`·`ff36667` M8·M9 점검과 증거). 검수 반영은 `a6a498f`·`bee9629`·`a254b13`·`5bde459`·`232c567`과 [M8, M9] 1/3 반영 커밋이다.
- **이 절은 사용자 승인을 대신하지 않는다.** 병합은 사용자 지시("검수 결과나오면 병합하세요", 2026-11-16)에 따랐다. FE-M8의 미완료 항목(§16.5·§16.6)은 그대로 남는다. AC-ROOM-006-11의 현재 상태는 §5 표(1.x)가 아니라 §16.6을 기준으로 한다.
- 실서버는 배포된 백엔드 v2.0.0(`https://ddallang-api.onrender.com`, 2026-11-16 22:32 KST 배포, BE-M8 완료, 서버 싱가포르 ↔ DB 시드니)이다. FE-M8을 배포본으로 하라는 사용자 전달에 따라 배포 DB에 시험 방을 만들었다(§16.5).

### 16.1 게이트 (FE-M8·M9 반영 최종본, `apps/web`)

| 명령 | 결과 |
| --- | --- |
| `pnpm typecheck` | 통과(오류 0) |
| `pnpm lint` | 통과 |
| `pnpm test` ×2 | 852개 통과, 두 번 모두 exit 0, 미처리 오류 0 |
| `pnpm check:ac` | "모든 AC(91개)에 태그 시험이 있습니다" |
| `pnpm build` · `pnpm smoke` | 통과(최종본에서 다시 실행, smoke 10경로 OK) |
| `pnpm test:integration`(배포 백엔드) | 3회 실행. ① 전체 8개 중 7개 통과, 1개 실패(수동 재시도 응답을 1초만 기다린 시험, 배포본 쓰기 약 2초) → 대기를 15초로 고침. ② 그 시험만 다시 실행해 통과. ③ 전체 다시 실행해 **8개 모두 통과**(`c2baaea`) |
| `pnpm test:latency` | **정식 측정 안 함**(§16.5) |

### 16.2 바꾸거나 지운 1.x 시험과 이유 (RK-F26)

단언을 약하게 한 것은 없다. 검수자가 묶음마다 `git diff`로 비교했고, 약해졌다고 지적된 1건(R2)은 되돌렸다.

| 시험 | 바꾼 것 | 이유 |
| --- | --- | --- |
| 모든 fixture 사용 시험 | `hostMember`·`guestMember` → `hostParticipant`(가온, p-1)·`guestParticipant`(나래, p-2). 기대 닉네임 `방장`→`가온`, `손님`→`나래` | `RoomMember`가 없어지고 요청자도 참여자다(S1 §2.1) |
| `room.test.tsx` "초대 화면 단계 상태기계" 5개 | 지우고 `invite-stage.test.ts`(전이 전수 38개)로 대체 | 상태기계가 FD-22로 바뀜 |
| `invite-screen.test.tsx` | 닉네임 입력 전에 `새로 입장하기`를 누른다. "종료된 방도 입장할 수 있다" → "종료된 방은 새로 입장할 수 없고 이어받기만"(AC-ROOM-002-5). `MEMBER_LIMIT_EXCEEDED` → `PARTICIPANT_LIMIT_EXCEEDED`. 이어받기 안내 단언 추가 | 신원 없음 화면이 선택 단계부터 시작(FD-22), OQ-043, P-3 |
| `two-tabs.test.tsx` | `새로 입장하기`를 누른 뒤 닉네임. 가짜 서버 등록 순서 분리(덮어쓰는 처리기가 앞서게) | 같음. 가짜 서버에 초대 경로가 생김 |
| `not-provided.test.tsx` | 버튼 목록에서 `가온 비활성화` 빠짐. "RoomMember와 Participant 연결·해제 컨트롤 없음"(AC-ROOM-004-5) → 방장 화면 전체의 신원 이동 컨트롤 없음(AC-ROOM-004-4)으로 넓힘 | 방장 행에 비활성화 컨트롤 없음(P-4). RoomMember 없음 |
| `participants-section.test.tsx` | 상태 변경 대상 `가온`(p-1) → `나래`(p-2)·`다온`(p-3) | 가온이 방장 참여자가 되어 컨트롤이 없다 |
| `use-room-connection.test.tsx` | 조회 수 단언을 엔드포인트별 객체 비교로(`claims: 0` 포함) | 가짜 서버에 대기 목록 조회 추가. 더 엄격해짐 |
| `snapshot.test.ts` · `coordinator.test.ts` · `room.test.tsx` | 스냅샷 리터럴에 `claims: []`, 요청에 `isHost` | 갱신 대상 6개(FD-25) |
| `access.test.ts` | `IDENTITY_REVOKED`는 접근 불가가 아니다 | FD-21 |

### 16.3 검수 이력 (Claude 독립 검수, 읽기 전용 서브에이전트)

Codex 5시간 한도가 소진되어 첫 묶음은 인계 규칙으로 Claude가 맡았고, 이후 사용자 지시(2026-11-16 "검수는 클로드 독립검수로 진행")로 모든 묶음을 Claude 독립 검수로 한다. 검수자는 작성자가 계속 작업하는 트리를 피하려고 커밋을 고정해(`git show <commit>:<path>`) 읽었다. PASS는 승인이 아니다.

| 묶음 | 시도 | 판정 | 지적과 처리 |
| --- | --- | --- | --- |
| [M1~M3] `6c85fa0` | 1/3 | PASS | LOW 6. L3(취소는 결과 불명·이미 처리됨만 확인 조회), L4(이어받기 요청의 5xx·본문 해석 실패 = 결과 불명), L5(후보가 비어 있어도 이어받기 안내, 누르면 다시 불러옴), L6(401 화면 시험) 반영 `a6a498f`. **L1·L2는 기록만**(아래) |
| [M4] `6594254` + `a6a498f` | 1/3 | PASS | LOW 5. F1(취소 확인 중 주기 조회의 PENDING 무시), F3(후보 재조회도 비면 안내), F4(시험 빈틈) 반영 `bee9629`. **F2·F5는 기록만** |
| [M5~M7] `72d99ef`·`7c9bac8`·`bee9629` | 1/3 | REVISE | MEDIUM 1(R1 끊김 중 배지 단언이 항상 통과), LOW 4(R2~R5). 모두 반영 `a254b13` |
| [M5~M7] `a254b13` | 2/3 | REVISE | MEDIUM 1(N1: R4 반영이 `REQUESTER_INACTIVE` 직후 갱신 전에 서버 message를 지우는 회귀), LOW 3(N2 시험이 타이밍에 기대, N3 안내 닫기 뒤 포커스 유실, N4 해석 기록), INFO 1(N5 닿지 않는 조건). 반영: 조회 전용 → 해제 전이에서만 지움, 갱신을 붙잡아 두는 확정적 시험(옛 동작에서 실패함을 확인), 닫은 뒤 다음 구역 제목으로 포커스, 아래 해석 기록, 조건 삭제 |
| [M5~M7] `5bde459` | 3/3 | PASS | LOW 1(P1: 끊긴 사이 또는 다른 페이지에 있는 사이 재활성화되면 비활성 거부 안내가 남음), INFO 2(P2 100ms 대기, P3 참여자 제목에 `tabIndex=-1`을 남김 — 탭 순서 영향 없음, 기록만). P1은 "조회 전용을 봤음" 표시를 작업 범위별 전역 상태로 옮겨 반영(시험 추가). **3회를 다 써서 이 반영은 [M8, M9] 검수에서 함께 확인받는다** |
| [M8, M9] + P1 `ff36667` | 1/3 | REVISE | HIGH 1(F1 접근 상실 유실 수렴이 하트비트 경로를 재지 못함), MEDIUM 1(F2 AC-VIEW-005-9 R 과장), LOW 5(F3 005-3 R 과장, F4 B 401 거르기 느슨, F5 오류 수집이 API 주소에 묶임·console.error 없음, F6 P1 반영이 폼 미마운트 경우를 놓침, F7 접근 상실 판정에 데이터 영역 닫힘 없음·요청 반영 전 승인), INFO 3(F8 Spec 기준 차이, F9 커밋 목록·실행 횟수, F10 범위). 모두 반영: 재연결 시 무효 처리와 서버 측정 위임 기록, AC 부분 확인으로 고침, 스크립트 오류 수집 정밀화(다시 실행 13/14), 조회 전용 관측을 스토어 구독으로 기록(시험 추가), 판정·순서 수정, 기록 정정 |
| [M8, M9] `e915622` | 2/3 | REVISE | MEDIUM 1(F11: F6 반영이 만든 회귀 — 거부 시점에 이미 조회 전용이면 기록을 못 남김), LOW 2(F12 조회 전용이 오지 않으면 구독이 남아 다른 범위에 기록할 수 있음, F13 앱 출처 오류 미수집), INFO 2(F14 유실 수렴 측정을 BE-M8로 넘긴 것은 Task 범위 변경, F15 그 행은 Spec 서버에서 항상 무효로 실패). 반영: 감시를 거부 반영 뒤 시작하고 이미 조회 전용이면 즉시 기록, 이 거부가 아니게 되거나 방이 바뀌면 구독 종료(시험 2개 추가, 옛 코드에서 실패), 모든 출처 수집(다시 실행 13/14), F14·F15 기록 |
| [M8, M9] `37998cc` | 3/3 | PASS | INFO 4(G1 이미 조회 전용 경로가 방을 다시 보지 않음, G2 같은 방에서 신원이 바뀌면 이전 범위 감시가 남음 — 범위마다 1개·세션이 비면 끝남, G3 수정·삭제·종료 범위의 기록은 읽는 곳이 없음, G4 §5 표의 AC-ROOM-006-11 "확인함"은 1.x 기준이며 v0.3.0은 §16.6이 기준). 모두 실해 없음으로 기록만 한다 |

**기록만 한 지적과 이유**
- L1: 초대 조회의 `identity = REVOKED`는 공통 처리기를 거치지 않고 조회 effect에서 키를 조건부로 지운다. 조회 단계에는 세션·연결이 없어 처리기의 연결 중단·세션 비우기가 필요 없고 결과(조건부 삭제, 접근 상실 배너, 신원 없음)는 같다.
- L2·F5: 처리기는 `usedKey`가 지금 쓰는 키인지 보지 않고 방 화면을 닫는다. 키를 바꿔 다시 들어온 뒤 이전 키의 401이 늦게 오면 새 화면이 한 번 닫혔다가 재조회로 복원된다(키는 조건부 삭제라 지워지지 않는다). `usedKey !== 저장 키`면 무시하는 방법은 "다른 탭이 새 키를 만든 뒤 이 탭이 이전 키로 방에 남아 있는" 경우(두 탭 시험)를 닫지 못하게 만들어 택하지 않았다. 시간 창이 좁고 스스로 회복한다.
- N4(Plan 해석): plan §7 "(2.0.0) 방장의 이어받기 요청 구역 … 요청이 없으면 구역을 숨긴다"를 "대기 요청도 처리 결과 안내도 없으면 숨긴다"로 읽었다. `CLAIM_ALREADY_RESOLVED`·결과 불명 뒤의 현재 상태 안내(S1 §6.5, §9)는 대기 요청이 0건이 된 뒤에도 보여야 하므로 사용자가 `안내 닫기`로 닫을 때까지 구역을 남긴다. 다르게 정하려면 사용자 결정이 필요하다.
- F2: 저장 키가 사라진 대기 화면은 401·404를 2초마다 무기한 다시 조회하며 안내가 없다. S5 §6.8은 "실패하면 다음 간격에 다시"만 정한다. 바꾸려면 Spec 보완이 필요하다(열린 질문으로 남김).

### 16.4 실서버 점검 (FE-M8·FE-M9, 배포 백엔드 v2)

**연동 점검(`pnpm test:integration`, 8개 통과)**: 기존 7개(두 접속자 반영·끊김 복구·응답 유실 재시도·예상 정산 갱신·종료 잠금·오류 계약·응답 모양)에 v0.3.0 흐름 1개를 더했다. 생성 → 입장 → 직접 추가(목록·`isHost`) → 초대 조회(NONE 후보·PARTICIPANT) → 이어받기 요청(PENDING, 대기 키 입장 `CLAIM_PENDING`) → 승인 → 이전 브라우저 화면의 접근 상실 안내 → 이전 키 `401 IDENTITY_REVOKED`·초대 조회 `REVOKED` → 요청 키 복원(같은 참여자) → 종료 → 새 입장 `GAME_ENDED`, 종료 뒤 이어받기 요청·거절·취소. 응답 모양 비교에 초대 조회·이어받기 요청(MyClaim)·대기 목록(Claim)을 더했고 fixture와 실서버의 필드 차이는 없다. 요청자용 응답에 `participantId`·`resolvedById`가 없음을 확인했다.

**실제 Chrome 흐름(`apps/web/scripts/qa-claims.mjs`)**: Chrome 157 헤드리스 3개(서로 다른 사용자 폴더 = 다른 저장소)로 A 방장·B 이전 브라우저·C 요청자를 흉내 냈다. 앱은 `next start`(배포 API로 빌드), 390px 모바일. 서버가 한가할 때(읽기 약 0.8초) **13/14 통과**(세 번 같음. 검수 F4·F5·F13 반영 뒤: 앱·API 모든 출처의 4xx/5xx와 `console.error`·JS 예외를 수집하고, B의 예상 401을 "승인 뒤·`/rooms`·`/invites` 경로"로 좁힘), 캡처는 `docs/design/v2-evidence/fe-m9/prod/`.

| 확인 | 결과 |
| --- | --- |
| A 방 만들기, B 선택 화면(후보 없으면 이어받기 숨김) → 새로 입장 | 통과 |
| C 후보(방장 제외 `이전B`)·확인 시트·대기(방 정보 없음) | 통과 |
| A 방 탭 배지(`방 대기 중인 이어받기 요청 1건`)가 새로고침 없이 붙음, 요청 구역이 참여자 위 | 통과(요청 뒤 1.6초 안에 관측) |
| 승인 뒤 C가 주기 조회로 방 화면에 들어감 | 통과(승인 클릭부터 5.3~6.3초, 실행 3회) |
| 승인 뒤 B가 접근 상실 안내, 방 화면 닫힘, 다시 선택 가능 | 통과(2.5초) |
| A 요청 구역이 처리 뒤 사라짐 | 통과 |
| A가 C(이어받은 참여자)를 비활성화 → C 기록 탭 조회 전용 안내·입력 비활성 | 통과(3.0초) |
| 예상 밖 4xx/5xx·JS 예외 없음 | 통과 |
| (참고값) 화면 반영 5초 이내 | **불합격 1건**: C 5.6초. 승인 요청 자체(쓰기 약 2초) + 주기 조회 간격(최대 2초) + 복원 입장(쓰기 약 2초) + 첫 조회의 합이다. 배포 환경은 S5 §6.7 측정 조건(왕복 150ms 이하) 밖이고 T0를 승인 클릭으로 잡은 보수 기준이라 합격 판정의 근거가 아니다 |

- 첫 실행(13·10 실패)은 같은 시간에 돌던 지연 측정이 무료 서버를 눌러 읽기가 2~3.4초였고(C 15.4초), 13번은 `fieldset`으로 비활성화된 입력을 `input.disabled`로 본 검사 오류였다(`:disabled`로 고침).

### 16.5 지연 측정(S5 §6.7)을 정식으로 하지 않은 이유

- 배포 환경은 측정 조건 밖이다(서버 싱가포르 ↔ DB 시드니, 쓰기 약 2초). 정식 측정은 방 수십 개에 거래 1,000건씩을 채워 배포 DB에 큰 데이터를 남기고 무료 서버를 눌러 다른 점검을 왜곡한다(실제로 위 첫 실행).
- 이어받기 행만 축소 실행하던 것을 판단해 중단했다(사용자 위임 "괜찮다 생각하면 멈춰도 돼"). 그 실행이 결과를 남기기 전에 끊었으므로 **수치는 없다**. 거래를 채우던 방이 배포 DB에 남았을 수 있다.
- **접근 상실 유실 수렴 행은 클라이언트로 잴 수 없다(검수 F1)**: 서버는 `access.revoked`를 보낸 뒤 스트림을 닫는다(S5 §4.2). 클라이언트에서 그 프레임만 버려도 스트림 종료 → 약 1초 뒤 재연결 → `401 IDENTITY_REVOKED`로 안내되어 하트비트 경로가 아니다. 측정 코드는 재연결이 일어나면 표본을 무효로 실패시키도록 고쳤다. 이 행(하트비트 신원 재확인으로 20초 이하)은 서버 쪽 측정(BE-M8)에 맡긴다.
- §6.7 표의 접근 상실 행은 "`access.revoked` 수신까지를 이벤트 전달 지연(1초/3초)"으로 재라고 한다. FE 코드는 Plan §11.5대로 "이전 클라이언트의 안내 표시(와 데이터 영역 닫힘)까지"를 화면 반영 기준(3초/5초)으로 잰다. 이벤트 전달 지연은 서버 쪽 측정 대상이다(검수 F8, 기록).
- **범위 변경(검수 F14·F15)**: FE-M8 Task는 "접근 상실 유실 수렴을 실서버에서 측정"이라 적었지만 위 이유로 FE에서는 측정할 수 없어 BE-M8(서버 Plan RK-18·BE-M6·BE-M8의 하트비트 재확인 측정)에 넘긴다. **BE-M8이 이 측정을 실행했다는 결과는 이 문서가 인용하지 않았다**(백엔드 증거 확인 필요). `revokedlost` 행은 Spec대로 동작하는 서버에서 항상 "무효"로 실패하므로 정식 측정 묶음(`LATENCY_ONLY` 없이 실행)에서는 실패로 남는다. 이 행을 묶음에서 뺄지는 정식 측정 때 정한다. 사용자 보고에 범위 변경으로 적는다.
- 측정 코드는 v0.3.0 표대로 고쳤다(`src/latency`: 참여자 생성 입장·직접 추가 분리, 이어받기 요청 생성·취소(방장 화면), 승인·거절(요청자 화면), 접근 상실 안내, 접근 상실 유실 수렴). **실행해 합격을 확인하지 않았다.** 정식 측정은 조건을 맞춘 환경(로컬 서버+DB, 로컬 DB 초기화 승인 필요)에서 해야 한다. AC-VIEW-005-8은 1.x와 같이 **미완료**다.

**배포 DB에 남은 시험 데이터(지우지 않음)**: 연동 점검 실행 3회의 방(전체 실행 2회는 실행마다 9개 안팎, 한 시험만 다시 돌린 실행은 1개), 타이밍 점검 방 `타이밍점검` 1개, Chrome 점검 방 `이어받기점검…` 3개, 중단한 지연 측정이 만들던 방(거래 채움 중). 백엔드 점검 방 `SmokeV2`는 백엔드 쪽이다.

### 16.6 하지 못한 점검 (숨기지 않는다)

- **정식 지연 측정(AC-VIEW-005-8)**: §16.5. **미완료**. 그래서 FE-M8의 완료 기준은 다 채우지 못했다.
- **AC-VIEW-005-9의 R은 부분 확인**(검수 F2): 실서버 화면에서 본 것은 요청 생성 → 방장 배지·요청 구역, 승인 → 요청자 입장·이전 브라우저 접근 상실 안내, 처리 뒤 요청 구역 사라짐이다. 요청 취소 뒤 방장 목록 갱신과 거절 결과의 요청자 화면 표시는 실서버 화면에서 보지 않았다(모의 시험과 연동 점검의 API 단언만). 지연 기준은 AC-VIEW-005-8을 따르며 참고값이 넘었다(C 5.3~6.3초).
- **AC-VIEW-005-3의 R도 부분 확인**(검수 F3): 실서버에서 본 것은 직접 추가·상태 변경이 다른 접속자 화면에 반영되는 것(연동 점검)과 비활성화된 본인의 잠금(실제 Chrome)이다. 입장으로 생긴 참여자가 다른 화면에 반영되는 것과 재활성화 뒤 본인 컨트롤이 돌아오는 것은 실서버 화면에서 보지 않았다(모의 시험만).
- AC-SET-008-2의 R은 연동 점검(참여자 등록·상태 변경 뒤 예상 정산 재조회)으로 확인했다. AC-ROOM-006-11의 R(실서버 두 탭)은 실제 Chrome에서 다시 보지 않았다(모의 두 탭 시험만).
- **FE-M9 실제 Chrome(모의 서버·시드)**: 실서버 흐름은 §16.4. 그 밖의 새 상태 14개를 Chrome 157 헤드리스 375px로 렌더해 확인했다(넘침 0, plan §7 문구·배치 대조). 증거는 `docs/design/v2-evidence/fe-m9/`에 있다. 하위 상태(취소 중·요청 중·방장 처리 결과 안내)는 컴포넌트 시험으로만 확인했다.
- 실기기·Safari·Firefox·VoiceOver는 1.x와 같이 미점검.


## 17. 2.1.0 개정 — 초대 링크 QR·스켈레톤·깨워 두기 (`FE-Q1`~`FE-Q3`, 2026-11-17)

- 근거: `open-questions.md` 2.18절 U-20~U-23·Q-C1~Q-C6, 방향 문서 1.2.0 DV-22·DV-23, `plan.md` §12(FD-28~FD-30). 진행 규칙 U-22(위임 진행).
- 브랜치 `HyeonSeoMan/invite-qr-skeleton`(기준 `main` `ee51a33`).

### 17.1 실행한 점검 (`apps/web`, 최종본)

| 명령 | 결과 |
| --- | --- |
| `pnpm typecheck` | 종료 0 |
| `pnpm lint` | 종료 0 |
| `pnpm test` | 종료 0, 60개 파일 858개 시험 통과 |
| `pnpm check:ac` | 종료 0, "모든 AC(91개)에 태그 시험이 있습니다." |
| `pnpm build`(`NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`) | 종료 0. 빌드 CSS에 `@media (prefers-reduced-motion:reduce){.motionReduce\:anim_none{animation:none}}`가 들어 있음 |
| `pnpm smoke` | 종료 0 |
| 워크플로 YAML 파싱(Ruby `YAML.load_file`) | 키 `name`·`on`·`permissions`·`concurrency`·`jobs` |
| 워크플로와 같은 `curl` 명령을 로컬에서 실행 | `status=200`(서버가 깨어 있을 때 0.24초) |

### 17.2 시험 변경

- 새 시험: `room-info.test.tsx` "초대 링크 QR" 3개(진행 중 표시·값 일치·순서·axe, 종료 방 숨김, 이미지 요청 없음). `record-button.test.tsx` 3개(첫 로딩 스켈레톤 모양·행 수 고정·axe, 동작 줄이기 클래스, 연결 시 스켈레톤·`aria-busy` 없음).
- **바꾼 시험 1개**: `record-button.test.tsx` "끊김 중에는 모든 구역이 바탕 위 제목만 남고 카드가 없다" → "제목과 값 없는 스켈레톤 카드만 남는다". 이유: U-21이 방향 문서 1.1.0 §5.1(카드·스켈레톤 없음)을 대체했다. 카드 안에 스켈레톤 하나만 있고, 글자 내용이 빈 문자열이고, `aria-hidden`·`aria-busy`인지를 단언한다. 서버 값이 없다는 뜻은 유지된다.
- QR 값 확인 방법: SVG를 해독하지 않고, 같은 설정으로 그린 기준 QR의 모듈 path와 같은지(초대 링크), 다른 링크와는 다른지를 비교한다. 실제 카메라 스캔은 하지 않았다.

### 17.3 실제 Chrome 확인 (375px)

시험 렌더 결과(시드 방, `RoomPage`와 끊김 상태의 `RoomLayout`)를 빌드 CSS와 합쳐 헤드리스 Chrome에서 375px iframe으로 찍었다. 배포 DB는 쓰지 않았다.

- `docs/design/v2-evidence/fe-q/qr-375.png`: 초대 링크 → 복사 → QR(160px) → 안내 문단, 가로 넘침 없음.
- `docs/design/v2-evidence/fe-q/skeleton-375.png`: 구역마다 제목 + 스켈레톤 카드(방 정보 막대, 목록 3행, 거래 입력 폼).

### 17.4 하지 못한 점검

- 휴대폰 카메라로 실제 QR 스캔, 실기기·Safari·Firefox·VoiceOver.
- 실제 앱에서 콜드 스타트 중 첫 로딩 스켈레톤(서버가 깨어 있어 재현하지 못했다).
- GitHub 예약 실행: `main` 병합 뒤에만 동작하므로 병합 전에는 확인할 수 없다. 병합 뒤 `workflow_dispatch`로 한 번 실행해 확인한다.
- 콜드 스타트 시간 자체는 이번에도 측정하지 못했다.
