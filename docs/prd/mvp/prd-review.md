# 딸랑 MVP PRD — Codex 독립 검수 기록

- 대상: `prd.md` v0.1.0 (초안), `policy-traceability.md`, `open-questions.md`
- 상위 정책: `docs/policies/ddallang-mvp-policy.md` v1.0.0
- 게이트: G1 PRD. 리뷰 한도 3회.
- 검수자 실행 방식: `codex --sandbox read-only --ask-for-approval never` 터미널. 세션 헤더에서 `sandbox_mode=read-only`를 확인했다. (`.agents/governance.md` §10)
- 기록 원칙: Codex의 지적은 삭제·요약 없이 싣는다. 단, 아래 "수집 한계"를 따른다.

## 수집 한계

읽기 전용 Worker는 Orca에 접근할 수 없고, Orca의 transcript 읽기는 긴 메시지를 약 1,500자에서 자른다. 1회차의 첫 보고서는 잘려서, 같은 Worker에게 지적 사항을 항목별로 다시 출력하게 해 받았다. 아래 G1-F02~F07은 그 재출력의 전문이다. G1-D01과 G1-F01은 재출력 중 마지막 "압축 출력"에서 일부가 잘렸고, 첫 보고서에서 받은 부분(D01은 Evidence·Impact까지, F01은 압축 한 줄 전문)을 싣는다. 잘린 부분은 "(수집 안 됨)"으로 표시했다. 1회차의 "Checks performed" 일부와 "Residual risks"도 잘린 채 수집됐다.

## 1회차 (Review attempt 1/3)

- 판정: **NEEDS_DECISION**
- 확인된 사실(검수자 보고): 정책 ID 34개, FR 정의 35개, 고유 AC 146개를 독립적으로 셌다. 모든 정책 ID가 FR에 나타나고, 추적표의 AC 참조가 실제 AC로 해석되며, 24개 OQ가 모두 정의돼 있다. 정책 ID 전체 누락과 연기 기능 그룹 누락은 없었다.
- 미해결 질문(검수자 보고, 일부 수집 안 됨): OQ-001~024가 모두 열려 있고, G1-D01이 등록되지 않은 정산 순서 질문을 추가한다. OQ-019에는 지연 목표가 없다.

### 지적 사항과 Claude의 처리

| ID | 심각도 | 요약 | 처리 | 근거 |
| --- | --- | --- | --- | --- |
| G1-D01 | MEDIUM | AC-SET-003-1이 "처음 정렬한 순서" 해석을 OQ 없이 택함 | **OQ-025로 등록, 결정은 하지 않음.** AC-SET-003-1을 두 해석에서 결과가 같은 예시로 바꾸고 결정 전 기대값 정의를 보류 | POL-SET-003은 "잔액 큰 순서대로 탐욕 매칭"만 정한다. 두 해석이 다른 송금 지시를 낸다는 검수자의 반례(A −300, B −200, C +250, D +150, E +100)를 직접 계산해 확인했다. |
| G1-F01 | HIGH | 서버 저장 후 응답 유실 시 새 요청 ID로 수동 재시도하면 중복 거래가 생길 수 있음 | **수용.** AC-TXN-007-6·007-7, AC-TXN-008-5, AC-SYS-002-5 추가. 재시도가 같은 요청 ID를 쓰는지는 OQ-026으로 등록 | POL-TXN-007(동일 요청 ID 중복 생성 방지)과 POL-TXN-008(수동 재시도)이 만나는 지점이 정책에 비어 있다. 제품 결정 부분은 OQ로 남겼다. |
| G1-F02 | HIGH | 방 간 격리(다른 방의 접속자·방장·거래·참여자 ID) 음성 AC 없음 | **수용.** AC-SYS-003-6, 007, 008 추가 | POL-SYS-003의 서버 최종 검증과 POL-ROOM-003의 방 단위 개념에서 도출된다. |
| G1-F03 | MEDIUM | AC-TXN-001-1/001-2는 라운드 필수 여부를, AC-TXN-005-5는 당사자 수정 가능을 OQ-009·012 해결 전에 단정 | **수용.** 두 AC를 [결정 대기]로 표시하고 단정을 제거 | OQ-009, OQ-012가 미결인데 AC가 한쪽을 확정하고 있었다. |
| G1-F04 | MEDIUM | AC-ROOM-007-2가 참여자·거래 권한을 POL-ROOM-006에 잘못 귀속, AC-VIEW-002-4가 합계 0을 POL-VIEW-002에 잘못 귀속, §9 연기 항목의 출처 부재 | **수용.** FR-ROOM-007의 POL에 PART-001·002, TXN-004, SET-001 추가. AC-VIEW-002-4 삭제(AC-SET-002-2가 이미 합계 0을 검증). §9 연기 항목 7개에 대응하는 AC를 추가·정리하고 추적표에 매핑 표 추가 | 검수자 지적을 정책 원문과 대조해 확인했다. |
| G1-F05 | MEDIUM | OQ-010이 "활성 참여자 사이에서만 고유"를 해석으로 제시하나 정책에는 비활성 예외가 없음 | **수용.** FR-ROOM-006에 활성·비활성 포함 고유성을 명시하고 AC-ROOM-006-10 추가. OQ-010을 "허용하려면 정책 변경이 필요한가"로 재정의 | POL-ROOM-005는 "같은 방 내에서 고유"라고만 한다. 오입력은 다른 철자로 새로 등록하면 되므로(POL-PART-003) 예외가 필수가 아니다. |
| G1-F06 | MEDIUM | 확장 위험 제안이 "정책이 정산 결과 저장을 금지한다"고 주장 | **수용.** 주장 삭제, "Plan 단계의 기술 결정이며 정책 요구가 아님"으로 수정 | POL-SET-007은 확정·버전 관리 기능만 제외하고 저장을 금지하지 않는다. |
| G1-F07 | MEDIUM | AC-ROOM-007-1이 복원된 방장과 새 신원을 구분하지 않음, 복원 시 방장 권한 유지 AC 없음 | **수용.** AC-ROOM-007-1을 새 신원으로 한정, AC-ROOM-005-6 추가 | POL-ROOM-004는 식별자를 잃은 경우에만 권한 미복구를 정한다. |

### 검수자 원문 (수집된 범위)

```text
G1-D01 | MEDIUM | POL-SET-003, policy §11-3/§11-6 v1.0.0 | docs/prd/mvp/prd.md:320–329; docs/prd/mvp/open-questions.md:18–40 | AC-SET-003-1 silently chooses initial-balance sorting although the policy leaves initial versus repeatedly ranked remaining balances ambiguous, potentially changing settlement transfers. | Obtain upstream clarification, register the question, and align the requirement and a distinguishing AC example.
Evidence(전문 보고서 일부): For A −300, B −200, C +250, D +150, E +100: initial sorting produces A→C 250, A→D 50, B→D 100, B→E 100; ranking remaining balances each step produces A→C 250, B→D 150, A→E 50, B→E 50, assuming A precedes B in registration order.
Impact: Different implementations can produce different settlement instructions while claiming compliance with the policy.

G1-F01 | HIGH | POL-TXN-007, POL-TXN-008, POL-SYS-002 v1.0.0 | docs/prd/mvp/prd.md:224–241,375–382 | The ACs omit server commit followed by response loss, allowing manual retry with a new request ID to duplicate an intended obligation and confusing definite failure with unknown outcome. | Add response-loss ACs requiring server reconciliation and safe retry of the original operation while preserving intentional identical-content transactions and prohibiting automatic resubmission.

ID: G1-F02
Severity: HIGH
Source: POL-ROOM-003, POL-TXN-003, POL-TXN-004, POL-SYS-003 v1.0.0.
Location: docs/prd/mvp/prd.md:188–203,384–392.
Evidence: No negative AC checks target-room membership, room-scoped host authority, foreign transaction targets, or foreign/nonexistent participants.
Impact: Isolation defects could escape acceptance checks and expose or corrupt another room.
Required outcome: Add server-rejection ACs for these cases and verify all room data remains unchanged.

ID: G1-F03
Severity: MEDIUM
Source: POL-TXN-001, POL-TXN-005, policy §11-3 v1.0.0; OQ-009/OQ-012.
Location: docs/prd/mvp/prd.md:169–176,205–213; docs/prd/mvp/open-questions.md:25–28.
Evidence: AC-TXN-001-1 assumes no round is required; AC-TXN-005-5 assumes parties are editable, despite unresolved OQ-009/OQ-012.
Impact: Unapproved choices become acceptance obligations.
Required outcome: Mark both AC portions decision-dependent; reconcile them after upstream decisions.

ID: G1-F04
Severity: MEDIUM
Source: POL-ROOM-006, POL-PART-001, POL-PART-002, POL-TXN-004, POL-VIEW-002, POL-SET-002, policy §11-2 v1.0.0.
Location: docs/prd/mvp/prd.md:121–127,260–267; docs/prd/mvp/policy-traceability.md:16,31,56,71.
Evidence: AC-ROOM-007-2 misattributes participant/transaction authority to POL-ROOM-006; AC-VIEW-002-4 misattributes zero-sum totals to POL-VIEW-002; §9 provenance is missing.
Impact: Coverage counts overstate semantic traceability.
Required outcome: Add applicable sources or AC-level mappings, distinguish exclusions/pending decisions, and regenerate the table.

ID: G1-F05
Severity: MEDIUM
Source: POL-ROOM-005, POL-PART-003 v1.0.0.
Location: docs/prd/mvp/prd.md:107–119; docs/prd/mvp/open-questions.md:26.
Evidence: OQ-010 presents active-only nickname uniqueness as an interpretation, although policy has no inactive-participant exception; typo correction does not require one.
Impact: A decided invariant becomes apparent ambiguity, permitting policy-inconsistent duplicate names.
Required outcome: Preserve uniqueness across active/inactive participants, or explicitly propose and approve an upstream policy amendment.

ID: G1-F06
Severity: MEDIUM
Source: POL-SET-007, policy §11-1/§11-5 v1.0.0.
Location: docs/prd/mvp/open-questions.md:49.
Evidence: Extension notes claim policy prohibits storing settlement results, but POL-SET-007 excludes confirmation/version management without prohibiting persistence.
Impact: An unsupported storage decision constrains later Spec/Plan work.
Required outcome: Remove the claimed mandate or label non-storage as a technical proposal, preserving the exclusion of confirmation/version features.

ID: G1-F07
Severity: MEDIUM
Source: POL-ROOM-004, POL-ROOM-006 v1.0.0.
Location: docs/prd/mvp/prd.md:97–105,121–127.
Evidence: AC-ROOM-007-1 denies host status to invitation-link entrants without distinguishing new identities from returning hosts; recovery ACs omit retained host authority.
Impact: Returning hosts could lose authority under this wording, or restoration could remain untested.
Required outcome: Limit the assertion to new identities and test that recoverable hosts retain authority while new identities after identifier loss do not.
```

### 거버넌스 처리 메모

- 1회차 판정이 NEEDS_DECISION인 이유는 G1-D01(제품 결정)이다. Claude는 이를 결정하지 않고 OQ-025로 등록했다. 수정 가능한 결함(F01~F07)은 위와 같이 고쳤다.
- 수정한 PRD가 정말 결함을 해소했는지는 새 Worker의 2회차 검수로 확인한다. OQ-025는 사용자 결정 전까지 열려 있으며, 2회차가 PASS여도 PRD 확정에는 사용자 승인이 필요하다.

## 2회차 (Review attempt 2/3)

- 검수자: 새 Codex Worker(읽기 전용 터미널, `sandbox_mode=read-only`)
- 판정: **REVISE** (NEEDS_DECISION 아님: 1회차의 제품 결정 D01이 OQ-025로 등록된 상태를 결함으로 보지 않았다)
- 수집 범위: 최종 메시지가 1,400자 이하 요약 형식이라 아래 한 줄 요약이 전부다. 상세 필드(Source·Location 등)는 요약에 없다.

| ID | 심각도 | 검수자 요약 | 처리 | 근거 |
| --- | --- | --- | --- | --- |
| G1-F03 | MEDIUM | prd.md:175가 지급자·수취자·금액만으로 등록된다고 보증해 OQ-009(라운드 필수 여부)와 충돌, 1회차 수정이 불완전 | **수용.** AC-TXN-001-1에 [결정 대기] 표기 추가 | POL-TXN-001이 라운드의 필수 여부를 정하지 않으며 OQ-009가 미결이다. 1회차 수정이 001-2만 고쳤다. |
| G1-F04 | MEDIUM | policy-traceability.md:98이 접근 만료·자동 삭제 제외 근거로 AC-SET-001-4/5를 들지만 그 AC는 자동 종료·재개만 검증 | **수용.** AC-SET-001-7(접근 만료·자동 삭제 기능 없음) 추가, 매핑 표를 항목별로 정정 | POL §9 항목 6은 자동 종료·재개·접근 만료·자동 삭제를 모두 포함한다. |
| G1-F08 | LOW | open-questions.md:31이 "수정 재시도는 본래 결과가 같다"고 서술하나, 이전 수정을 지연 재전송하면 이후 성공한 저장을 덮어쓸 수 있음(POL-TXN-006) | **수용.** OQ-015 근거 문구를 정정하고, 권장 선택지를 "제안하지 않음"으로 바꾸고 우선순위를 높음으로 상향 | POL-TXN-006은 마지막 성공 저장을 최종값으로 한다. 지연 재전송 시나리오가 성립한다. |

### 거버넌스 처리 메모

- 1회차 지적 8건(D01, F01~F07) 중 2회차에서 재지적된 것은 F03(불완전 수정)뿐이다. 나머지는 해소된 것으로 보고되었으나, 검수자가 "해소됨"을 항목별로 확인했는지는 요약에서 알 수 없다.
- 3회차는 마지막 허용 회차다. 3회차가 PASS가 아니면 자동 진행을 중단하고 사용자에게 보고한다.

## 3회차 (Review attempt 3/3, 마지막 허용 회차)

- 검수자: 새 Codex Worker(읽기 전용 터미널, `sandbox_mode=read-only`)
- 판정: **PASS** — 지적 사항 없음. PASS는 품질 판정이며 사용자 승인이 아니다.
- 수행한 검증(검수자 보고): 정책 34개 ID, 범위 6개 그룹, 제외 7개 그룹을 요구사항·AC와 독립 비교. 권한·경계·실패·추가 기능·추적성·OQ 일관성·Claude의 처리 타당성 확인. 구조 점검 결과 FR 35개, 고유 AC 157개, OQ 26개이며 정의되지 않은 참조는 없음. 정산 예시를 독립적으로 재계산.
- 수행하지 않은 검증: 문서 검토만 했다. 구현·런타임·보안·애플리케이션 테스트는 해당 없음. 1·2회차 원본 transcript는 이 문서에 재현된 범위로만 볼 수 있었다(위 "수집 한계").
- 잔여 위험: OQ 26개가 모두 열려 있다. 결정에 의존하는 동작은 영향받는 구현 전에 해결되어야 한다. PASS는 OQ를 해결하지 않고 PRD 확정이나 다음 단계 진행을 승인하지 않는다.
- 이전 지적 해소 여부: 1회차 D01·F01~F07은 초안 검수 수준에서 해소됨(D01·F01의 제품 결정은 OQ-025·OQ-026으로 추적). 2회차 지적의 해소 여부는 검수자 답변이 잘려 수집되지 않았으나, 3회차에서 새 지적이 없었다.

## 종합

| 회차 | 판정 | 지적 | 비고 |
| --- | --- | --- | --- |
| 1/3 | NEEDS_DECISION | D01, F01~F07 (8건) | D01은 OQ-025로 등록, 나머지 수정 |
| 2/3 | REVISE | F03, F04, F08 (3건) | 모두 수정 |
| 3/3 | PASS | 없음 | 사용자 승인 대기 |
