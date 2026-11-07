# 딸랑 MVP PRD v0.4.1 — Codex 독립 검수 기록 (v0.4.x 사이클 2/3)

- 대상: `prd.md` v0.4.1 (초안, 미승인). v0.4.0 검수 1/3회(`prd-review-v0.4.0.md`)의 지적 6건과 사용자 결정 OQ-040(만료된 키의 재시도 거부)을 반영한 수정본이다.
- 검수 사이클: **v0.4.x 사이클 2/3회.** 이번이 끝나면 남은 횟수는 1회다.
- 게이트: G1 PRD (`.agents/governance.md` §3)
- 판정: **NEEDS_DECISION** (새 지적 3건: MEDIUM 1, LOW 2. BLOCKER 0, HIGH 0)
- 이후 조치: 검수 직후에는 문서를 수정하지 않았다. 사용자가 24시간 시계를 (a) 클라이언트의 최초 시도 시각으로 정하고 나머지 반영을 지시해 지적 3건을 PRD **v0.4.2**에 반영했고(8절) 3/3회 검수를 실행했다(`prd-review-v0.4.2.md`).

## 1. 실행 조건

| 항목 | 내용 |
| --- | --- |
| 검수자 | 새 Codex Worker. 읽기 전용 터미널(`codex --sandbox read-only --ask-for-approval never`). 검수자가 세션 헤더에서 `sandbox_mode=read-only`를 확인했다고 보고했다 |
| 검토 파일 | `prd.md`, 두 정책 파일, `policy-traceability.md`, `open-questions.md`(2.1절 포함), `policy-verification.md`. 회귀 확인용으로 이전 검수 기록은 읽어도 된다고 허용했다 |
| 제외 파일 | `prd-self-review.md`(작성자 자체 리뷰), `prd-review.md`(v0.1.0 기록) |
| 존중하도록 지시한 사용자 결정 | (1) 현행 통합 정책 파일 + 규칙 7건 = v1.0.0, 파일 헤더 미수정. (2) 2026-11-07의 결정 9건(OQ-004, 008, 009, 026 부분, 027, 029, 035, 037, 040)은 `open-questions.md` 2.1절에만 기록되어 있으며 권위 있는 결정으로 취급할 것 |
| 중점 지시 | (1) V8-001~006 해소, (2) Claude의 재분류(한도 초과 거부는 영구적 거부)의 정책 근거, (3) 만료 계약의 일관성, (4) 의미 기준 전수 점검, (5) 그 밖의 전면 재검토 |
| 근거 구분 | 모든 지적에 `[CONSOLIDATED C§x.y]` / `[OLD POL-xxx]` / `[USER-DECISION 2.1]` / `[PRD-DERIVED]` / `[NOTION-UNVERIFIED]` 중 하나를 붙이게 했다 |
| 정책 문서 | 수정하지 않았다 |
| 시작 | Codex 업데이트 안내(0.167.0)가 다시 떠서 `esc`로 건너뛰었다. 업데이트는 실행하지 않았고 설치 버전은 0.166.0 그대로다 |

## 2. 검수자 판정 요약

| 항목 | 결과 |
| --- | --- |
| 전체 판정 | **NEEDS_DECISION** |
| V8-001 ~ V8-006 | **모두 해소됨.** 새 만료 시계 모호함이 남았다(V9-001) |
| 2.1절이 결정 9건을 모두 담고 OQ-040이 반영되었는가 | **예** |
| 한도 초과 거부의 영구적 거부 재분류 | **뒷받침됨.** 단 만료 계약의 시계 기준은 명확히 해야 한다 |
| 집계 | POL 34, FR 37, 고유 AC 222, 앵커 32. 추적표의 매핑 수와 일치 |
| NEEDS_DECISION 사유 | 24시간 시계를 어디서부터 재는지(클라이언트의 최초 시도 / 서버의 최초 수신·처리)를 사용자가 정하지 않았다(V9-001) |

## 3. 검증하지 못한 사항 (검수자 보고)

- 정적 검토만 했다. Notion 원문과의 대조, 런타임·UI 테스트는 하지 않았다. 파일 수정과 Orca 명령도 실행하지 않았다.
- 수행했다고 보고한 점검: 두 정책, 결정 9건, AC 222개 전수, 권한·동시성·한도·재전송·만료, 추적표, 열린 질문 개수, V8 회귀.
- 잔여 위험(검수자 보고): 등록된 열린 질문 10개(Spec 전 필수 2개 포함), 슬롯 영구 고갈, 만료·삭제 뒤 복구는 Spec에서 검증 필요.

## 4. 지적 사항

검수자가 보고한 영어 원문을 그대로 싣는다. 요약이나 번역으로 바꾸지 않았다. (첫 요약은 한국어 한 줄씩이었고 2절에 요지를 옮겼다.) 파일 경로는 `docs/prd/mvp/` 기준이다.

### V9-001 | MEDIUM
- Basis: [USER-DECISION 2.1], OQ-026/040.
- Location: `prd.md:305,308,317–318,583`
- Evidence: First arrival at t+23h implies server retention until t+47h, but first-attempt expiry occurs at t+24h.
- User impact: Retry expectations conflict.
- Suggested fix: Decide one clock origin; align retention, replay and expiry.

### V9-002 | LOW
- Basis: [PRD-DERIVED].
- Location: `prd.md:6,576`; `policy-verification.md:23`
- Evidence: Source summaries still describe eight decisions; section 2.1 contains nine, including OQ-040.
- User impact: Readers receive an incomplete decision inventory.
- Suggested fix: Update current summaries to nine and include OQ-040.

### V9-003 | LOW
- Basis: [PRD-DERIVED].
- Location: `policy-traceability.md:7,42–43`
- Evidence: Five anchors are labelled open-question coverage, although OQ-008 is resolved; the OQ-009 link omits residual OQ-039.
- User impact: Traceability misstates remaining decisions.
- Suggested fix: Distinguish resolved-decision links from open questions and link OQ-039.

### 검수자의 NEEDS_DECISION 질문 (원문)
> Decision needed: When does the 24-hour clock start?
> (a) Client's first attempt: a never-seen key first arriving after 24h expires.
> (b) Server's first receipt/processing: that arrival is new. If choosing (b), specify receipt or processing.

## 5. Claude의 평가 (참고용, PRD에 적용하지 않음)

세 지적 모두 직접 확인해 보니 타당합니다.
- **V9-001**: `prd.md`의 AC-TXN-007-11·12는 "최초 시도 후 24시간"(클라이언트 기준)으로 쓰고, 같은 문서의 보관 규정은 "서버가 24시간 보관"(저장 시점 기준)이라 시계의 기준점이 둘입니다. 이 혼선은 제가 OQ-040의 (a) 결정을 AC로 옮기면서 시계의 출발점을 정하지 않은 데서 나옵니다.
- **V9-002**: `prd.md:6`과 `policy-verification.md:23`이 아직 "8건"이라고 적고 있습니다(`open-questions.md`는 9건으로 맞음). 직접 확인했습니다.
- **V9-003**: 추적표의 `C§7.4`(OQ-008), `C§7.5`(OQ-009) 행이 이미 결정된 질문을 "열린 질문 대응"으로 보이게 하고, OQ-009의 잔여인 OQ-039를 연결하지 않습니다.

**결정이 필요한 질문**: 24시간을 어디서부터 재는가?

| 선택지 | 의미 | 결과 |
| --- | --- | --- |
| (a) **클라이언트의 최초 시도 시각** | 키 자체가 최초 시도 시각을 담거나, 요청이 그 시각을 함께 보낸다. 서버는 기록이 없는 키라도 시각으로 만료 여부를 안다 | 24시간이 지난 재시도는 서버 기록 유무와 상관없이 거부된다. 서버는 최소한 그때까지 기록을 보관하면 충분하다 |
| (b) 서버의 최초 수신 또는 처리 시각 | 서버가 키를 처음 본 시점부터 24시간 | 서버 기록이 없는 키는 "처음 보는 키"로 구분할 수 없다. 25시간 전에 처리돼 기록이 사라진 키와 아직 한 번도 오지 않은 키가 똑같아 보인다. **만료 거부(OQ-040)와 양립하지 않는다** |

**권장은 (a)입니다.** 이유는 (b)로는 사용자가 이미 결정한 OQ-040(만료된 키는 거부)을 지킬 수 없기 때문입니다. 서버가 기록을 지운 뒤에는 만료된 키와 처음 오는 키를 구분할 방법이 없고, 구분하지 못하면 만료 키를 새 요청으로 처리해 거래가 중복됩니다. 따라서 OQ-040을 유지하는 한 (a)가 사실상 함의입니다. 다만 결정은 사용자에게 있습니다. (a)를 택하면 다음과 같이 정리할 수 있습니다.
- 유효 기간: 클라이언트의 최초 시도 시각부터 24시간.
- 서버 보관: 최소 그 시점까지. 더 오래 보관해도 무방하나 24시간 뒤의 재시도는 항상 만료로 거부.
- 24시간 이내 처음 도착한 모르는 키는 새 요청(AC-TXN-007-11), 24시간 뒤 도착은 만료 거부(AC-TXN-007-12).
- 최초 시도 시각의 전달·식별 방법은 Spec에서 정함(이미 Spec 이관으로 적었음).

사용자 결정 없이 고칠 수 있는 것은 V9-002(숫자 갱신), V9-003(추적표 표기)입니다.

## 6. 수집 한계

- 읽기 전용 Worker는 Orca에 접근할 수 없고 Orca transcript는 한 메시지를 약 1,500자에서 자른다. 첫 보고는 판정 요약이었고, 지적 3건의 상세와 결정 질문은 같은 Worker에게 터미널로 follow-up 1회를 보내 받았다.
- 지적 3건의 상세 필드와 NEEDS_DECISION 질문은 모두 수집됐다. 첫 요약 마지막 문장은 짧아서 잘리지 않았다.
- 원본 전문은 Orca transcript에 있다(`orca orchestration worker-read --dispatch ctx_55a4c1342ec8`).

## 7. 증거 묶음 (`.agents/governance.md` §8)

| 항목 | 값 |
| --- | --- |
| 게이트 | G1 PRD |
| 산출물 | `docs/prd/mvp/prd.md` v0.4.1 |
| 상위 문서 | 통합 정책 v1.0.0(현행 통합 파일 + 규칙 7건, 사용자 결정 2026-11-07, 파일 헤더 미수정), 기존 정책 v1.0.0, 사용자 결정 9건(`open-questions.md` 2.1절) |
| 검수 횟수 | v0.4.x 사이클 2/3 (남은 횟수 1회) |
| 최신 판정 | NEEDS_DECISION (V9-001 MEDIUM, V9-002·V9-003 LOW) |
| 지적과 처리 | V9-001~003을 PRD v0.4.2에 반영(8절). 반영 결과는 3/3회 검수로 확인 |
| 실행한 점검 | Codex 독립 검수 1회(읽기 전용). 이 파일 작성 외 문서 변경 없음 |
| 미검증 | Notion 원문, 런타임·UI |
| 열린 질문 | 10개 (Spec 전 필수 2개). 위 시계 결정은 질문이 아니라 OQ-040의 구체화이므로 신규 번호를 부여하지 않고 2.1절 OQ-040 행에 합친다 |
| 사용자 승인 | 없음 (PRD 확정 미승인) |
| 브랜치·PR | `HyeonSeoMan/mvp-prd`. 이번 작업의 변경은 모두 커밋하지 않았고 PR #3은 v0.1.0 상태 그대로다 |
| 다음 허용 행동 | 3/3회 검수 결과(`prd-review-v0.4.2.md`) 참조 |

## 8. 사용자 결정과 지적 반영 결과 (PRD v0.4.2, 2026-11-07)

사용자가 **(a) 클라이언트의 최초 시도 시각**을 24시간의 기준점으로 정했다. 신규 OQ 번호는 만들지 않고 `open-questions.md` 2.1절의 **OQ-040 행을 구체화**했다. 아래는 Claude의 수정이며 **이 시점에는 독립 확인 전**이다.

| ID | 반영 내용 | 변경 위치 |
| --- | --- | --- |
| V9-001 | 용어를 **"키 유효 기간(24시간, 최초 시도 시각 기준)"** 하나로 통일하고 "보관 기간" 표현을 모두 없앴다. 서버는 최소 그 시점까지 보관하며, 유효 기간이 지난 재시도는 서버 기록의 유무와 상관없이 만료로 거부한다. 23시간에 처음 도착한 요청의 예를 AC-TXN-007-12에 넣었다 | `prd.md` FR-TXN-007, AC-TXN-007-2·5·8~12, AC-SET-001-8, FR-SET-001, NFR-003, 부록 A |
| V9-002 | `prd.md`와 `policy-verification.md`의 "8건"을 9건으로 정정 | 두 문서 |
| V9-003 | 추적표의 `C§7.x`, `C§6.1` 행에 "결정 완료 / 부분 결정 / 열림"을 구분해 표시하고 OQ-009 행에 잔여 OQ-039를 연결. 머리말의 집계도 이에 맞춤 | `policy-traceability.md`(생성기 수정) |

수정 중 확인한 사실: 이 용어 혼선은 제가 OQ-040을 AC로 옮기면서 "보관"(서버 저장)과 "최초 시도 후"(클라이언트)를 섞어 쓴 데서 나왔다. 같은 단어를 한 곳에서만 정의하고 모든 AC가 그것을 가리키게 했다.
