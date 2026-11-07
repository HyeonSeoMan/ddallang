# 딸랑 MVP PRD v0.2.0 — Codex 독립 검수 기록 (사이클 1/3)

- 대상: `prd.md` v0.2.0 (초안, 미승인)
- 검수 사이클: **PRD v0.2.0 기준 새 사이클.** v0.1.0의 3회 사이클(`prd-review.md`)과 분리해 이번이 **1/3회**다. (사용자 지시, 2026-11-07)
- 게이트: G1 PRD (`.agents/governance.md` §3)
- 판정: **REVISE** (BLOCKER 0, HIGH 2, MEDIUM 2, LOW 1, 총 5건)
- 이후 조치: 검수 직후에는 PRD를 수정하지 않았다. 사용자 지시에 따라 지적 5건을 PRD **v0.2.1**에 반영했다(7절). 반영본은 재검수하지 않았고 다음 검수(2/3회)도 실행하지 않았다.

## 1. 실행 조건

| 항목 | 내용 |
| --- | --- |
| 검수자 | 새 Codex Worker 1개. 읽기 전용 터미널(`codex --sandbox read-only --ask-for-approval never`). 검수자가 세션 헤더에서 `sandbox_mode=read-only`를 확인했다고 직접 보고했다 |
| 함께 검토한 파일 | `prd.md`, `ddallang-mvp-policy.md`(기존 POL), `ddallang-mvp-policy-consolidated.md`(통합), `policy-traceability.md`, `open-questions.md`, `policy-verification.md` |
| 제외한 파일 | `prd-self-review.md`(작성자 자체 리뷰), `prd-review.md`(v0.1.0 기록). 독립성을 위해 검수자에게 읽지 말라고 지시했다 |
| 중점 확인 | 정책 누락, 요구사항 모순, MVP 범위 초과, AC 검증 가능성, 정책 추적의 의미적 정확성, 예외·동시성, OQ 일관성 |
| 근거 구분 | 모든 지적에 `[CONSOLIDATED C§x.y]` / `[OLD POL-xxx]` / `[PRD-DERIVED]` / `[NOTION-UNVERIFIED]` 중 하나를 붙이게 했다 |
| 유지 대상 | 기존 정책에만 있는 규칙 7건은 최종 통합본에 반영할 대상이라고 알렸고, PRD가 이를 유지한 것을 결함으로 보지 말라고 지시했다 |
| 정책 문서 | 수정하지 않았다 |

## 2. 검증하지 못한 사항 (검수자 보고 + Claude 보충)

- **Notion 원문은 접근할 수 없어 대조하지 못했다.** 따라서 "Notion에서 이미 결정된 사항인가"는 통합 정책 파일의 문장만 근거로 판단했다. Notion 확인이 필요한 지적은 이번에 없었다(`[NOTION-UNVERIFIED]` 분류 0건).
- 런타임·UI 테스트는 해당 단계가 아니다.
- 검수자가 직접 확인했다고 보고한 항목: FR 37개와 AC 201개의 ID 중복 없음, 기존 POL 34개가 모두 PRD에 나타남, 정산 예시 2건의 계산 정확성.
- 검수자 보고 중 "Checks performed"는 요약 한 줄 분량으로만 수집됐다(아래 수집 한계).

## 3. 지적 사항

검수자가 보고한 영어 원문을 그대로 싣는다. 요약이나 번역으로 바꾸지 않았다.

### V2-001 | HIGH
- Basis: [CONSOLIDATED C§2.5]
- Location: `docs/prd/mvp/open-questions.md:57`; `docs/prd/mvp/prd.md:161–168`, AC-ROOM-008-6
- Evidence: Policy caps RoomMembers and Participants at 10 each without status exclusions. OQ-028 offers excluding inactive Participants or disconnected RoomMembers; the AC defers their inclusion.
- User impact: Those options could permit more than 10 existing entities.
- Suggested fix: Count all existing entities toward these caps; treat exclusions as proposed upstream policy changes.

### V2-002 | HIGH
- Basis: [CONSOLIDATED C§3.4]
- Location: `docs/prd/mvp/prd.md:280,290,313`; AC-TXN-006-2, AC-TXN-007-2, AC-TXN-009-1
- Evidence: Same-key retries must reuse the original result, but the other ACs require rejecting edits after deletion and transaction requests after game end without a replay exception.
- User impact: A successful request whose response was lost could be reported as rejected on retry.
- Suggested fix: Explicitly distinguish replay from a new mutation; test successful same-key replay after end/deletion, preserving the original result without another mutation.

### V2-003 | MEDIUM
- Basis: [PRD-DERIVED]
- Location: `docs/prd/mvp/prd.md:392–393`; AC-SET-001-8/9
- Evidence: AC-8 returns the original success for same-key retries. AC-9 requires exactly one successful concurrent request, yet permits the others to follow AC-8. Concurrent identical-key requests therefore have conflicting success criteria.
- User impact: Correct retry handling could fail acceptance testing.
- Suggested fix: Require exactly one end-state transition; distinguish successful replay responses from new requests rejected as already ended.

### V2-004 | MEDIUM
- Basis: [CONSOLIDATED C§4.5]
- Location: `docs/prd/mvp/prd.md:474–479`; FR-SYS-001, AC-SYS-001-2/4
- Evidence: Policy and the FR require blocking queries during connection failure. AC-2 instead permits "blocking OR clearly marking as not current," allowing labeling alone to satisfy acceptance; AC-4 also prohibits cached substitute display.
- User impact: An implementation could pass AC-2 without enforcing the required query block.
- Suggested fix: Require query blocking independently; clarify any permitted stale display consistently across the FR and ACs.

### V2-005 | LOW
- Basis: [PRD-DERIVED]
- Location: `docs/prd/mvp/policy-traceability.md:7,38–44`
- Evidence: Line 7 claims all 32 consolidated anchors link to FRs. Parsing the FR source fields found 26; six instead map to NFRs/OQs.
- User impact: Reviewers receive an inaccurate coverage metric, although this discrepancy alone establishes no missing behavior.
- Suggested fix: Report FR, NFR and OQ mappings separately, with counts matching the actual links.

### 검수자의 추가 보고
- 잔여 위험: 키 보관 기간, 정산 순서, 복사 범위 등 등록된 결정 사항이 아직 열려 있다.
- OQ 일관성: OQ-028이 C§2.5의 한도를 다시 연다(V2-001). **통합 정책이 이미 결정했는데 열린 질문으로 둔 항목과, 해결로 표시했지만 실제로는 결정되지 않은 항목은 그 외에 발견하지 못했다.**

## 4. Claude의 평가 (참고용, PRD에 적용하지 않음)

사용자 지시에 따라 PRD는 수정하지 않았다. 아래는 지적 사항을 통합 정책 원문과 대조해 본 Claude의 의견이며, 이 평가도 독립 검수가 아니다.

| ID | 판단 | 이유 |
| --- | --- | --- |
| V2-001 | **타당** | C§2.5는 "방별 RoomMember 최대 10명, Participant 최대 10명"이라고만 쓰고 상태별 예외가 없다. OQ-028의 선택지 (b)(c)는 한도를 넘는 인원을 허용하는 정책 변경이다. 남는 실질 질문은 "한도 초과 시 슬롯을 회수할 방법이 없다"는 운영 위험이며, 이는 정책 질문이 아니라 위험 기록으로 다루는 편이 맞아 보인다. 이 지적이 맞다면 필수 결정 10개 중 OQ-028의 성격이 바뀐다 |
| V2-002 | **타당** | AC-TXN-007-2(같은 키 재요청은 최초 결과 반환)와 AC-TXN-009-1, AC-TXN-006-2(종료·삭제 뒤 거부)는 같은 키 재전송 상황에서 충돌한다. 정책 C§3.4와 C§5.1은 "동일 키 재시도는 최초 결과 재사용"을 이미 정하므로 새 정책 결정이 필요하지 않고 PRD 정리 사항이다 |
| V2-003 | **타당** | AC-SET-001-8과 -9의 "정확히 하나만 성공"이 같은 키 재전송의 성공 응답과 어긋난다. 상태 전이 1회와 성공 응답을 구분해 쓰면 해소된다 |
| V2-004 | **타당** | AC-SYS-001-2의 "또는" 표현은 C§4.5의 "조회 차단"보다 약하다. 제가 쓴 문장이 정책보다 느슨했다 |
| V2-005 | **타당** | 추적표 5행의 "FR에 연결된 앵커 32개" 표기가 부정확하다. 실제로는 FR 26, NFR/OQ 6이다. 같은 오류가 `prd-self-review.md`에도 있다(FR 25로 적었음). 둘 다 정정 대상이다 |

다섯 건 모두 새 정책 결정이 필요하지 않고 PRD·문서 정리로 해소되는 것으로 보입니다. 다만 이 판단은 제 의견입니다.

## 5. 수집 한계

- 읽기 전용 Worker는 Orca에 접근할 수 없고 Orca transcript는 한 메시지를 약 1,500자에서 자른다. 그래서 요약 목록 → 나머지 목록 → 지적 상세 → 보충 보고 순서로 같은 Worker에게 터미널로 follow-up을 보내 받았다.
- follow-up은 검수 범위를 바꾸지 않는 재출력 요청이며 새로운 검토 지시가 아니었다. 같은 Worker의 한 번의 검수로 계산한다.
- 지적 5건의 상세 필드는 모두 수집됐다. 검수자의 "Checks performed"는 요약 한 단락만 수집됐고, 검토한 구체 항목의 전체 목록은 받지 못했다.
- 검수자가 재출력할 때 문장을 줄였을 수 있다. 원본 전문은 Orca transcript에 있다(`orca orchestration worker-read --dispatch ctx_b2f4d4becc46`).

## 6. 증거 묶음 (`.agents/governance.md` §8)

| 항목 | 값 |
| --- | --- |
| 게이트 | G1 PRD |
| 산출물 | `docs/prd/mvp/prd.md` v0.2.0 |
| 상위 문서 | 통합 정책(`ddallang-mvp-policy-consolidated.md`, 버전 미부여, v1.0.0으로 정리 예정), 기존 정책 v1.0.0 |
| 검수 횟수 | v0.2.0 사이클 1/3 |
| 최신 판정 | REVISE |
| 지적과 처리 | V2-001~005 전부 PRD v0.2.1에 반영(7절). 반영 결과는 **독립 확인 전** |
| 실행한 점검 | Codex 독립 검수 1회(읽기 전용). 이 파일 작성 외 문서 변경 없음 |
| 미검증 | Notion 원문, 런타임·UI |
| 열린 질문 | 16개(`open-questions.md`) |
| 사용자 승인 | 없음 (PRD 확정 미승인) |
| 브랜치·PR | `HyeonSeoMan/mvp-prd`. 이번 작업의 변경은 모두 커밋하지 않았고 PR #3은 v0.1.0 상태 그대로다 |
| 다음 허용 행동 | 사용자의 지시. 2/3회 검수 실행 여부는 사용자가 정한다 |

## 7. 지적 반영 결과 (PRD v0.2.1, 2026-11-07)

사용자 지시로 지적 5건을 반영했다. 아래는 Claude가 한 수정이며 **독립 검수를 거치지 않았다.**

| ID | 반영 내용 | 변경 위치 |
| --- | --- | --- |
| V2-001 | OQ-028을 철회하고 운영 위험 R-01로 이동. 한도는 상태와 무관하게 모든 RoomMember·Participant를 센다고 FR-ROOM-008과 NFR-007에 명시. AC-ROOM-008-6 교체, AC-ROOM-008-7~9 추가 | `prd.md` FR-ROOM-008, NFR-007, §9. `open-questions.md` 1·3·5절. `policy-verification.md` C-02 |
| V2-002 | 같은 멱등 키의 재전송(replay)은 새 변경이 아니므로 종료·삭제 이후에도 최초 결과를 반환한다고 FR-TXN-007에 명시. AC-TXN-007-8, -9 추가. 상태 검사로 거부하는 AC-TXN-006-2, AC-TXN-009-1, AC-SYS-003-2를 "새 요청(다른 키)"로 한정. NFR-003 보강 | `prd.md` FR-TXN-006·007·009, FR-SYS-003, NFR-003 |
| V2-003 | FR-SET-001을 "상태 전이 정확히 1회"와 "성공 응답(전이 요청과 같은 키 재전송)"으로 분리. AC-SET-001-8, -9 재작성 | `prd.md` FR-SET-001 |
| V2-004 | AC-SYS-001-2에서 "또는 최신 아님 표시" 대안을 제거하고 조회 차단과 오류 안내를 필수로 규정. AC-SYS-001-4를 일관되게 정리 | `prd.md` FR-SYS-001 |
| V2-005 | 추적표 머리말이 FR·NFR·열린 질문 연결 수를 따로 보고하도록 생성기 수정 후 재생성. 자체 리뷰의 "FR 25" 오기를 정정 | `policy-traceability.md`, `prd-self-review.md` 7절 |

수정에 대한 Claude의 판단 두 가지를 밝힌다.
- V2-001: "한도에 모두 포함"은 C§2.5 문장(예외 없음)의 문자 그대로의 적용이다. 이로써 필수 결정 10개 중 OQ-028이 빠져 9개가 되었다. 이 해석이 의도와 다르다면(예: 비활성 참여자를 한도에서 빼고 싶다면) 정책 개정이 필요하다.
- V2-004: 정책 C§4.5는 "조회 차단"을 요구하므로 "최신 아님 표시와 함께 오래된 값을 보여주는" 방식은 허용하지 않는 쪽으로 정리했다. 정책이 이 중간 방식을 명시적으로 금지하지는 않는다. 허용하고 싶다면 사용자 확인이 필요하다.
