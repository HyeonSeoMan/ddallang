# 딸랑 MVP PRD v0.4.0 — Codex 독립 검수 기록 (새 사이클 1/3)

- 대상: `prd.md` v0.4.0 (초안, 미승인). 사용자 결정 8건(`open-questions.md` 2.1절)을 반영하고 V7-001·V7-002를 함께 수정한 개정본이다.
- 검수 사이클: **v0.4.x 새 사이클 1/3회.** 이전 v0.2.x, v0.3.x 사이클(각 3회 소진)과 분리했다. 이번이 끝나면 남은 횟수는 2회다.
- 게이트: G1 PRD (`.agents/governance.md` §3)
- 판정: **NEEDS_DECISION** (지적 6건: HIGH 1, MEDIUM 3, LOW 2. BLOCKER 0)
- 이후 조치: 검수 직후에는 문서를 수정하지 않았다. 사용자가 OQ-040을 (a) 거부로 결정하고 나머지 반영을 지시해 지적 6건을 PRD **v0.4.1**에 반영했고(8절) 2/3회 검수를 실행했다(`prd-review-v0.4.1.md`).

## 1. 실행 조건

| 항목 | 내용 |
| --- | --- |
| 검수자 | 새 Codex Worker. 읽기 전용 터미널(`codex --sandbox read-only --ask-for-approval never`). 검수자가 세션 헤더에서 `sandbox_mode=read-only`를 확인했다고 보고했다 |
| 검토 파일 | `prd.md`, 두 정책 파일, `policy-traceability.md`, `open-questions.md`(2.1절 포함), `policy-verification.md`. 회귀 확인용으로 이전 검수 기록 6개는 읽어도 된다고 허용했다 |
| 제외 파일 | `prd-self-review.md`(작성자 자체 리뷰), `prd-review.md`(v0.1.0 기록) |
| 존중하도록 지시한 사용자 결정 | (1) 현행 통합 정책 파일 + 기존 정책에만 있던 규칙 7건 = 통합 정책 v1.0.0, 파일 헤더 미수정. (2) 2026-11-07의 결정 8건은 `open-questions.md` 2.1절에만 기록되어 있고 권위 있는 결정으로 취급할 것 |
| 중점 지시 | (1) 결정 8건이 PRD에 정확하고 과하지 않게 반영되었는지, (2) 결정의 파급 효과, (3) V7-001·V7-002 해소, (4) 의미 기준 전수 점검, (5) 그 밖의 전면 재검토 |
| 근거 구분 | 모든 지적에 `[CONSOLIDATED C§x.y]` / `[OLD POL-xxx]` / `[USER-DECISION 2.1]` / `[PRD-DERIVED]` / `[NOTION-UNVERIFIED]` 중 하나를 붙이게 했다 |
| 정책 문서 | 수정하지 않았다 |
| 시작 | Codex 업데이트 안내(0.167.0)가 다시 떠서 `esc`로 건너뛰었다. 업데이트는 실행하지 않았고 설치 버전은 0.166.0 그대로다 |

## 2. 검수자 판정 요약

| 항목 | 결과 |
| --- | --- |
| 전체 판정 | **NEEDS_DECISION** |
| 사용자 결정 8건 반영 | **반영됨.** 단 권위 있는 기록(2.1절)에 3건이 빠져 있다(V8-003) |
| V7-001 / V7-002 | **해소됨** |
| 파급 효과·의미 기준 점검 | **틈 있음** (V8-001, 002, 004, 005, 006) |
| 집계 | POL 34, FR 37, AC 221, 앵커 32 확인 |
| NEEDS_DECISION 사유 | 멱등 키가 만료(24시간)된 뒤의 재시도를 **거부할지, 새 요청으로 처리할지**는 사용자가 정하지 않았는데 PRD가 후자를 추가했다(V8-001). 나머지 지적은 새 결정 없이 고칠 수 있다 |

## 3. 검증하지 못한 사항 (검수자 보고)

- 정적 검토만 했다. Notion 원문과의 대조와 런타임·UI 테스트는 하지 않았다. 파일 수정과 Orca 명령도 실행하지 않았다.
- 검수자가 수행했다고 보고한 점검: 정책·결정과 FR/AC의 비교, 221개 AC 전수, 권한·동시성·재전송·한도, 부록 A, 추적표, 열린 질문 개수, V7 회귀.
- 잔여 위험(검수자 보고): 거래 슬롯의 영구 고갈, 보관 기간 이후의 재시도, 등록된 열린 질문 10개.

## 4. 지적 사항

검수자가 보고한 영어 원문을 그대로 싣는다. 요약이나 번역으로 바꾸지 않았다. (검수자가 한국어로 쓴 첫 요약은 2절의 표에 요지를 옮겼다.)

### V8-001 | HIGH
- Basis: [USER-DECISION 2.1], OQ-026.
- Location: `docs/prd/mvp/prd.md:305,318,590`
- Evidence: User decided 24h retention; PRD additionally treats expired keys as new requests.
- User impact: A successful create with a lost response can create another transaction on retry after 24h.
- Suggested fix: Obtain and record a decision on rejecting versus re-executing expired retries.

### V8-002 | MEDIUM
- Basis: [PRD-DERIVED].
- Location: `docs/prd/mvp/prd.md:308,311,415,539,590`
- Evidence: Transaction ACs, AC-SET-001-8 and NFR-003 promise replay without a time bound; the expiry row allows fresh processing.
- User impact: Tests require conflicting outcomes after 24h.
- Suggested fix: Align all replay ACs, NFR-003 and Appendix A with the approved expiry contract.

### V8-003 | MEDIUM
- Basis: [USER-DECISION 2.1].
- Location: `docs/prd/mvp/open-questions.md:53–66`
- Evidence: The designated authoritative table contains five decided items, omitting OQ-004, OQ-008 and OQ-035; summaries claim eight.
- User impact: Later reviewers cannot recover all approved rules from the cited record.
- Suggested fix: Add the three complete decisions, including normalized-string duplicate comparison.

### V8-004 | LOW
- Basis: [PRD-DERIVED].
- Location: `docs/prd/mvp/policy-verification.md:127–142`; `docs/prd/mvp/open-questions.md:26–44`
- Evidence: Resolved matters retain unresolved/provisional descriptions, including host-only participant addition.
- User impact: Later work may reopen settled decisions.
- Suggested fix: Label historical descriptions and link current decisions and remaining questions.

### V8-005 | MEDIUM
- Basis: [CONSOLIDATED C§3.3].
- Location: `docs/prd/mvp/prd.md:378`, AC-VIEW-004-1
- Evidence: It requires 20/20/5 results for 45 transactions. With 25 deleted, only 20 are listable; filtering can reduce this further.
- User impact: A correct implementation can fail the AC.
- Suggested fix: Specify 45 nondeleted transactions matching the current filter, with no concurrent changes.

### V8-006 | LOW
- Basis: [USER-DECISION 2.1], OQ-004.
- Location: `docs/prd/mvp/prd.md:173`; `docs/prd/mvp/open-questions.md:75,106`
- Evidence: R-01 covers only 10/10 identity limits; OQ-026 suggests capacity can reopen, although deletion never frees transaction slots.
- User impact: Lifetime transaction exhaustion is absent from the cited risk record.
- Suggested fix: Record that risk and correct the retry rationale.

### 검수자의 NEEDS_DECISION 질문 (원문)
- Verdict-triggering question: After 24h key expiry, should a retry be rejected pending reconciliation, or processed as new with possible duplicate effects? Existing pre-Spec decisions: OQ-026—omit temporary-rejection records and re-evaluate retries, or retain/replay rejection; OQ-036—fixed unit list, or list plus custom input with validation rules.
- 근거 한 줄(원문): NEEDS_DECISION because expired-key re-execution adds unapproved behavior affecting duplicate transactions; the other findings are fixable without new decisions.

## 5. Claude의 평가 (참고용, PRD에 적용하지 않음)

여섯 건 모두 PRD와 문서를 직접 확인해 보니 타당합니다. **그중 두 건은 제가 이번 개정에서 만든 오류입니다.**

| ID | 판단 | 이유 |
| --- | --- | --- |
| V8-001 | **타당. 제가 사용자 결정 밖의 동작을 추가했습니다** | 사용자가 결정한 것은 "키와 결과를 24시간 보관"뿐입니다. "24시간이 지난 키로 오는 요청은 새 요청으로 취급해 현재 상태를 검사한다"(`prd.md:305,318,590`)는 제가 덧붙인 문장이고, 결과적으로 응답이 유실된 성공 생성을 24시간 뒤에 재시도하면 거래가 중복 생성됩니다. 보관 기간 만료 뒤의 동작은 정책에 없는 제품 결정이므로 질문으로 올려야 했습니다 |
| V8-002 | **타당** | 재전송 AC와 NFR-003, AC-SET-001-8은 시간 제한 없이 "항상 최초 결과를 반환"한다고 써 있어 24시간 규칙과 충돌합니다 |
| V8-003 | **타당. 제 스크립트 실수입니다** | 열린 질문 표에서 결정된 행을 지우는 필터가 2.1절의 같은 접두어 행(OQ-004, OQ-008, OQ-035)까지 지웠습니다. 파일을 직접 확인했습니다. 2.1절에는 OQ-009, 026(부분), 027, 029, 037, 036 행만 있습니다 |
| V8-004 | **타당** | `policy-verification.md`의 C-02·C-17 등 옛 설명(예: 참여자 추가 "임시 적용")과 `open-questions.md`의 옛 행이 현재 결정을 가리키지 않아 혼동될 수 있습니다 |
| V8-005 | **타당** | AC-VIEW-004-1이 "거래가 45건이면 20/20/5"인데, 삭제된 거래를 포함해 45건이면 목록에 보이는 것은 그보다 적습니다. 결정 OQ-004로 삭제 거래가 한도에는 세지만 목록에는 보이지 않게 되어 생긴 파급입니다 |
| V8-006 | **타당** | OQ-004(a)로 삭제해도 거래 슬롯이 회복되지 않으므로 방의 평생 거래 수가 고갈될 수 있습니다. R-01은 10/10만 다룹니다 |

**추가로 확인한 점 (검수자가 짚지 않은 파급)**: OQ-004(a)와 R-01의 결정으로, 한도 초과 거부는 이제 **일시적 거부가 아니라 영구적 거부**입니다. 한도를 되돌릴 방법(삭제, 퇴장)이 없기 때문입니다. 따라서 "일시적 거부"에 한도 초과를 넣은 현재 AC-TXN-007-10·부록 A·OQ-026 잔여 설명은 틀렸고, 한도 초과 거부는 영구적 거부 행에 속하는 것이 맞습니다. OQ-026 잔여에 남는 것은 비활성 참여자 지정(재활성화될 수 있음)과 검증 실패(내용 변경)뿐입니다. V8-006의 "재시도 근거 정정"과 같은 지적입니다.

**결정이 필요한 질문 (신규 OQ-040 후보, 필수):**
24시간이 지난 키로 재시도가 오면 어떻게 하는가?
- (a) **거부한다.** 예: "요청이 만료되었습니다. 거래 목록을 새로고침해 저장 여부를 확인하세요." 중복 생성은 없고, 사용자가 목록에서 확인합니다.
- (b) 새 요청으로 처리한다. 응답이 유실된 성공 생성을 24시간 뒤에 재시도하면 같은 거래가 두 번 생기고, 이 재처리는 사용자가 의도한 "의도적 동일 거래 허용"(AC-TXN-007-3)과 구분되지 않습니다.
- 권장은 (a)입니다. 사용자가 이미 24시간 보관을 정했으니 그 안의 재시도만 안전하다는 계약이 일관됩니다. 다만 결정은 사용자에게 있습니다.

**사용자 결정 없이 고칠 수 있는 것:** V8-002(만료 계약에 맞춰 AC 정리, OQ-040 결정 후), V8-003(2.1절 행 3개 복원. 제 필터 오류 수정), V8-004(옛 설명에 "이력" 표시와 현재 결정 링크), V8-005(AC-VIEW-004-1을 삭제되지 않은 45건으로 한정), V8-006(R-01에 거래 슬롯 영구 고갈 추가, OQ-026 잔여 설명을 위 사실에 맞게 정정).

## 6. 수집 한계

- 읽기 전용 Worker는 Orca에 접근할 수 없고 Orca transcript는 한 메시지를 약 1,500자에서 자른다. 첫 보고는 판정 요약이 포함되어 있었으나 끝이 잘렸다(지적 목록 마지막 부분과 집계 문장). 그래서 같은 Worker에게 터미널로 follow-up 3회를 보내 지적 6건의 상세와 점검 범위를 받았다.
- 지적 6건의 상세 필드와 NEEDS_DECISION 질문은 모두 수집됐다. 첫 보고의 마지막 문장(`G1, v0.4.0 cycle 1/3; p…`)은 잘렸고 후속 보고로 보완됐다.
- 원본 전문은 Orca transcript에 있다(`orca orchestration worker-read --dispatch ctx_f841684851d6`).

## 7. 증거 묶음 (`.agents/governance.md` §8)

| 항목 | 값 |
| --- | --- |
| 게이트 | G1 PRD |
| 산출물 | `docs/prd/mvp/prd.md` v0.4.0 |
| 상위 문서 | 통합 정책 v1.0.0(현행 통합 파일 + 규칙 7건, 사용자 결정 2026-11-07, 파일 헤더 미수정), 기존 정책 v1.0.0, 사용자 결정 8건(`open-questions.md` 2.1절) |
| 검수 횟수 | v0.4.x 새 사이클 1/3 (남은 횟수 2회) |
| 최신 판정 | NEEDS_DECISION (V8-001 HIGH, V8-002·003·005 MEDIUM, V8-004·006 LOW) |
| 지적과 처리 | V8-001~006을 PRD v0.4.1에 반영(8절). 반영 결과는 2/3회 검수로 확인 |
| 실행한 점검 | Codex 독립 검수 1회(읽기 전용). 이 파일 작성 외 문서 변경 없음 |
| 미검증 | Notion 원문, 런타임·UI |
| 열린 질문 | 10개 (Spec 전 필수 2개). 위 신규 질문이 등록되면 필수가 3개가 된다 |
| 사용자 승인 | 없음 (PRD 확정 미승인) |
| 브랜치·PR | `HyeonSeoMan/mvp-prd`. 이번 작업의 변경은 모두 커밋하지 않았고 PR #3은 v0.1.0 상태 그대로다 |
| 다음 허용 행동 | 2/3회 검수 결과(`prd-review-v0.4.1.md`) 참조 |

## 8. 사용자 결정과 지적 반영 결과 (PRD v0.4.1, 2026-11-07)

사용자가 NEEDS_DECISION 질문에 **(a) 거부**를 택했다: 보관 기간(24시간)이 지난 뒤 같은 키로 재시도하면 새 요청으로 처리하지 않고 만료로 거부한다. 이 결정을 신규 **OQ-040**으로 등록해 `open-questions.md` 2.1절에 기록했다. 아래는 Claude의 수정이며 **이 시점에는 독립 확인 전**이다.

| ID | 반영 내용 | 변경 위치 |
| --- | --- | --- |
| V8-001 | "24시간이 지난 키는 새 요청으로 취급"을 삭제하고 "만료로 거부, 데이터 변경 없음, 목록 확인 안내"로 교체(AC-TXN-007-12). 안내 문구와 최초 시도 시각의 식별 방법은 Spec으로 둠 | `prd.md` FR-TXN-007, 부록 A |
| V8-002 | AC-TXN-007-2·5·8·9·10·11, AC-SET-001-8, FR-SET-001, NFR-003, 부록 A에 "보관 기간(24시간) 이내" 조건을 달고 24시간 경과는 AC-TXN-007-12를 따르도록 정리 | `prd.md` 여러 곳 |
| V8-003 | 2.1절에 빠졌던 OQ-004·OQ-008·OQ-035 행을 복원하고 OQ-040 행 추가. 요약 숫자 갱신(사용자 결정 9건) | `open-questions.md` |
| V8-004 | `policy-verification.md` 3절에 "이 표는 검증 시점의 기록" 안내와 행별 "→ 현재" 표시 추가. `open-questions.md` 2절의 옛 "잔여" 칸을 "해결됨(…)"으로 정정 | 두 문서 |
| V8-005 | AC-VIEW-004-1을 "삭제되지 않은 거래 45건, 필터 없음, 조회 중 변경 없음"으로 한정하고 삭제 거래는 페이지 계산에서 제외. AC-VIEW-004-9 추가 | `prd.md` FR-VIEW-004 |
| V8-006 | R-01에 거래 슬롯 영구 고갈을 추가하고 OQ-026 잔여 행을 정정 | `open-questions.md` |

지시 범위와 맞물려 함께 고친 것 (Claude 판단, 명시한다):
- **한도 초과를 영구적 거부로 재분류.** 슬롯을 회수할 수단이 없으므로(R-01) 한도 초과 거부는 일시적이 아니다. AC-TXN-007-10, FR-TXN-007, 부록 A, NFR-003, OQ-026 잔여 행에 반영했다. 사용자가 "나머지도 반영"하라고 한 범위(마지막 보고서 제안)에 포함된다고 판단했다.
- OQ-026 잔여는 이제 **비활성 참여자 지정과 검증 실패**만 다룬다.
- V8-003은 제 스크립트 실수로 생긴 결함이었고(결정된 행을 지우는 필터가 2.1절의 같은 접두어 행까지 삭제), V8-001은 사용자 결정 밖의 동작을 제가 추가한 결함이었다. 둘 다 바로잡았다.
