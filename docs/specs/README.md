# 딸랑 MVP 기능별 Spec

## 분할안 승인 기록

| 항목 | 내용 |
| --- | --- |
| 승인 대상 | Spec 분할안 5개와 작성 순서 (개별 Spec 본문은 대상이 아니다) |
| 승인자 | 사용자 (제품 책임자, GitHub `HyeonSeoMan`) |
| 승인일 | 2026-11-07 |
| 기준 PRD | v0.5.0 (확정, `main`) |

| Spec | 범위 | 담당 FR | 작성 순서 |
| --- | --- | --- | --- |
| S1 | 방·신원·참여자 | FR-ROOM-001~008, FR-PART-001~004 | 1 |
| S2 | 거래 CRUD | FR-TXN-001~009 | 2 |
| S3 | 조회·손익 | FR-VIEW-001~004, FR-SET-002 | 3 |
| S5 | 실시간·연결 | FR-VIEW-005, FR-SYS-001~003 | 4 |
| S4 | 정산·종료 | FR-SET-001, FR-SET-003~008 | 5 |

작성 순서: S1 → S2 → S3 → S5 → S4. 이 순서는 **작성 순서**이며 실제 구현 순서와 구분한다. 구현 순서는 각 Spec 승인 뒤 Plan/Tasks에서 정한다.

## 운영 원칙

- 개별 Spec 본문은 아직 승인되지 않았다. 각 Spec은 작성 → Codex 독립 검수 → 사용자 승인(G2)을 거친다.
- 모든 Spec은 프론트엔드·백엔드 공통 계약이며 `ddallang`이 원본을 관리한다. 양쪽용 Spec을 따로 만들지 않는다.
- `ddallang-server`는 승인된 Spec을 참조하고 Spec 버전 또는 `ddallang` 커밋을 명시한다 (`.agents/governance.md` §11).
- PRD v0.5.0의 FR·AC와 확정 정책은 이 문서로 바꾸지 않는다.
- Spec 파일 위치: `docs/specs/<id>-<name>/spec.md`.

## Spec 승인 현황

| Spec | 버전 | 상태 | 승인일 | 위치 |
| --- | --- | --- | --- | --- |
| S1 방·신원·참여자 | 0.2.3 | **확정 (G2 승인)** | 2026-11-07 | `docs/specs/S1-room-identity-participant/spec.md` |
| S2 거래 CRUD | 0.2.2 | **확정 (G2 승인)** | 2026-11-08 | `docs/specs/S2-transaction-crud/spec.md` |
| S3 조회·손익 | 0.2.4 | **확정 (G2 승인)** | 2026-11-08 | `docs/specs/S3-view-balance/spec.md` |
| S5 실시간·연결 | 0.2.2 | 초안 (Codex 2/3 REVISE 반영, 재검수 전) | — | `docs/specs/S5-realtime-connection/spec.md` |
| S4 | — | 미작성 | — | — |

기준 PRD는 v0.5.1(`main` `ca2104d`)이다. S1 이후 Spec의 기준 PRD도 승인 시점의 확정 버전을 명시한다.
