# 딸랑 MVP 기능별 Spec

## 분할안 승인 기록

| 항목 | 내용 |
| --- | --- |
| 승인 대상 | Spec 분할안 5개와 작성 순서 (개별 Spec 본문은 대상이 아니다) |
| 승인자 | 사용자 (제품 책임자, GitHub `HyeonSeoMan`) |
| 승인일 | 2026-11-07 |
| 기준 PRD | v0.5.2 (확정, 사용자 G1 재승인 2026-11-09, `main` 병합 커밋 `94b7914`). 각 Spec의 기준 PRD 표기는 승인 시점의 확정 버전(v0.5.1)이다 |

| Spec | 범위 | 담당 FR | 작성 순서 |
| --- | --- | --- | --- |
| S1 | 방·신원·참여자 | FR-ROOM-001~008, FR-PART-001~004 (v0.3.0부터 FR-ROOM-009 이어받기 포함) | 1 |
| S2 | 거래 CRUD | FR-TXN-001~009 | 2 |
| S3 | 조회·손익 | FR-VIEW-001~004, FR-SET-002 | 3 |
| S5 | 실시간·연결 | FR-VIEW-005, FR-SYS-001~003 | 4 |
| S4 | 정산·종료 | FR-SET-001, FR-SET-003~008 | 5 |

작성 순서: S1 → S2 → S3 → S5 → S4. 이 순서는 **작성 순서**이며 실제 구현 순서와 구분한다. 구현 순서는 각 Spec 승인 뒤 Plan/Tasks에서 정한다.

## 운영 원칙

- 각 Spec은 작성 → Codex 독립 검수 → 사용자 승인(G2)을 거쳐 확정된다. 확정 여부는 아래 "Spec 승인 현황"이 기준이다.
- 모든 Spec은 프론트엔드·백엔드 공통 계약이며 `ddallang`이 원본을 관리한다. 양쪽용 Spec을 따로 만들지 않는다.
- `ddallang-server`는 승인된 Spec을 참조하고 Spec 버전 또는 `ddallang` 커밋을 명시한다 (`.agents/governance.md` §11).
- 확정 PRD(현재 v0.6.0)의 FR·AC와 확정 정책은 이 문서로 바꾸지 않는다.
- Spec 파일 위치: `docs/specs/<id>-<name>/spec.md`.

## Spec 승인 현황

| Spec | 버전 | 상태 | 승인일 | 위치 |
| --- | --- | --- | --- | --- |
| S1 방·신원·참여자 | 0.2.3 | **확정 (G2 승인)** | 2026-11-07 | `docs/specs/S1-room-identity-participant/spec.md` |
| S2 거래 CRUD | 0.2.2 | **확정 (G2 승인)** | 2026-11-08 | `docs/specs/S2-transaction-crud/spec.md` |
| S3 조회·손익 | 0.2.4 | **확정 (G2 승인)** | 2026-11-08 | `docs/specs/S3-view-balance/spec.md` |
| S5 실시간·연결 | 0.2.3 | **확정 (G2 승인)** | 2026-11-08 | `docs/specs/S5-realtime-connection/spec.md` |
| S4 정산·종료 | 0.2.0 | **확정 (G2 승인)** | 2026-11-09 | `docs/specs/S4-settlement-end/spec.md` |

Spec 작성 당시의 기준 PRD는 v0.5.1(`main` `ca2104d`)이고, 이후 확정 PRD는 v0.5.2(`94b7914`), v0.6.0(PR #59, `f13826a`)이다. S1 이후 Spec의 기준 PRD도 승인 시점의 확정 버전을 명시한다.

### v0.3.0 개정 (PRD v0.6.0 접속자·참여자 통합, 작성·검수 완료, 사용자 승인 대기)

사용자 지시(2026-11-16, `open-questions.md` 2.17절)에 따라 S1~S5를 PRD v0.6.0에 맞춰 개정하고, 다섯 Spec이 모두 끝난 뒤 G2 승인을 한꺼번에 받는다. 승인 전에는 위 표의 확정본이 구현 기준이다. 각 Spec의 "Claude 임의 결정"(§12)은 사용자 승인 대기다.

| Spec | 초안 | Codex 검수(v0.3.0) | 상태 |
| --- | --- | --- | --- |
| S1 | 0.3.0 | 1/3 REVISE → 2/3 PASS | 사용자 G2 승인 대기 |
| S2 | 0.3.0 | 1/3 PASS (LOW 2건 반영) | 사용자 G2 승인 대기 |
| S3 | 0.3.0 | 1/3 PASS (LOW 1건 반영) | 사용자 G2 승인 대기 |
| S5 | 0.3.0 | 1/3 REVISE → 2/3 PASS | 사용자 G2 승인 대기 |
| S4 | 0.3.0 | 1/3 REVISE → 2/3 PASS | 사용자 G2 승인 대기 |
