# 딸랑 MVP PRD v0.3.0 — Codex 독립 검수 기록 (새 사이클 1/3)

- 대상: `prd.md` v0.3.0 (초안, 미승인). 부록 A(재전송 정리표) 포함.
- 검수 사이클: **새 사이클 1/3회.** 이전 v0.2.x 사이클(3회 소진)과 분리했다. 사용자 결정(2026-11-07, 선택지 C)에 따라 통합 정책이 v1.0.0으로 정리된 뒤 시작했다.
- 게이트: G1 PRD (`.agents/governance.md` §3)
- 판정: **REVISE** (새 지적 2건, 모두 MEDIUM. BLOCKER 0, HIGH 0)
- 이후 조치: 검수 직후에는 PRD를 수정하지 않았다. 사용자 지시에 따라 지적 2건을 PRD **v0.3.1**에 반영했고(8절) 2/3회 검수를 실행했다(`prd-review-v0.3.1.md`).

## 1. 실행 조건

| 항목 | 내용 |
| --- | --- |
| 검수자 | 새 Codex Worker. 읽기 전용 터미널(`codex --sandbox read-only --ask-for-approval never`). 검수자가 세션 헤더에서 `sandbox_mode=read-only`를 확인했다고 보고했다 |
| 검토 파일 | `prd.md`, 두 정책 파일, `policy-traceability.md`, `open-questions.md`, `policy-verification.md`(0절 먼저). 회귀 확인용으로 이전 사이클 기록 3개는 읽어도 된다고 허용했다 |
| 제외 파일 | `prd-self-review.md`(작성자 자체 리뷰), `prd-review.md`(v0.1.0 기록) |
| 존중하도록 지시한 사용자 결정 | 현행 통합 정책 파일 + 기존 정책에만 있던 규칙 7건 = 통합 정책 v1.0.0. 정책 파일 헤더는 "초안"으로 남겨 두었고 수정하지 않았다. 이를 결함으로 지적하지 말 것 |
| 중점 지시 | (1) V4-001 해소, (2) 부록 A 정리표와 인용 AC들의 일관성 및 AC-TXN-007-11·OQ-026 유보의 정책 근거, (3) 신규 AC-PART-001-6·OQ-038이 실제 정책 공백인지, (4) 그 밖의 전면 재검토 |
| 지시 | 입증 가능한 모든 결함을 낮은 심각도까지 빠짐없이 보고할 것 |
| 근거 구분 | 모든 지적에 `[CONSOLIDATED C§x.y]` / `[OLD POL-xxx]` / `[PRD-DERIVED]` / `[NOTION-UNVERIFIED]` 중 하나를 붙이게 했다 |
| 정책 문서 | 수정하지 않았다 |
| 시작 | Codex 업데이트 안내(0.167.0)가 다시 떠서 `esc`로 건너뛰었다. 업데이트는 실행하지 않았고 설치 버전은 0.166.0 그대로다 |

## 2. 검수자 판정 요약

| 항목 | 결과 |
| --- | --- |
| 전체 판정 | **REVISE** |
| V4-001 | **해소됨.** FR-TXN-007, NFR-003, AC-TXN-007-10이 일시적 거부를 일관되게 유보한다 |
| 부록 A 정리표 | **틈 있음.** 거부 행이 AC-TXN-007-2와 충돌한다(V5-001). 그 밖의 칸은 정리되었거나 유보되어 있다 |
| AC-TXN-007-11, AC-PART-001-6, OQ-038 | **뒷받침됨.** OQ-026 유보도 뒷받침된다고 판정했다 |
| 새 지적 | V5-001, V5-002 |

## 3. 검증하지 못한 사항 (검수자 보고)

- Notion 원문은 접근할 수 없어 대조하지 못했다. 이번 지적 중 Notion 확인이 필요한 것은 없었다(`[NOTION-UNVERIFIED]` 분류 0건).
- 런타임·UI 테스트, 파일 변경, Orca 명령은 하지 않았다.
- 검수자가 직접 센 집계: 기존 POL 34개, FR 37개, 고유 AC 210개, 통합 정책 앵커 32개. 열린 질문 16개, Spec 전 필수 9개, OQ-028 철회와 위험 R-01 기록. **추적표·열린 질문 문서의 집계와 일치한다.**
- 두 정책 파일을 모두 v1.0.0 출처로 취급했다(사용자 결정에 따름).
- 잔여 위험: 등록된 열린 질문이 해결되지 않았다. 검수자의 잔여 위험 문장은 그 뒤가 잘려 수집되지 않았다.

## 4. 지적 사항

검수자가 보고한 영어 원문을 그대로 싣는다. 요약이나 번역으로 바꾸지 않았다.

### V5-001 | MEDIUM
- Basis: [PRD-DERIVED], PRD v0.3.0.
- Location: `docs/prd/mvp/prd.md:295`, AC-TXN-007-2
- Evidence: "Exactly 1" creation explicitly includes permanent rejection. Replaying a creation rejected after game end must instead preserve zero creations under AC-TXN-007-10 and Appendix A.
- User impact: Acceptance criteria demand incompatible transaction counts.
- Suggested fix: Require exactly one creation after success and zero after rejection.

### V5-002 | MEDIUM
- Basis: [CONSOLIDATED C§3.4], v1.0.0.
- Location: `docs/prd/mvp/prd.md:168`, AC-ROOM-008-5
- Evidence: At 999 transactions, concurrent identical-key creates must share the original success under AC-TXN-007-2. AC-ROOM-008-5 instead permits exactly one successful request.
- User impact: Correct replay handling can fail acceptance.
- Suggested fix: Restrict the criterion to distinct new requests, or require one slot consumption while permitting successful replay responses.

## 5. Claude의 평가 (참고용, PRD에 적용하지 않음)

두 지적 모두 PRD 문장을 직접 확인해 보니 타당합니다.
- `AC-TXN-007-2`(`prd.md:295`): "같은 키·같은 내용으로 생성 요청이 두 번 이상 도달해도 거래는 **정확히 1건만 생성**되고"라고 쓰여 있습니다. 뒤 괄호에서 "최초 결과가 성공 또는 영구적 거부인 경우"를 포함시켰으니, 영구적 거부의 재전송에서도 "1건 생성"을 요구하는 꼴입니다. 부록 A와 AC-TXN-007-10은 "데이터 변경 없음"이라 충돌합니다. 제가 v0.3.0에서 괄호를 덧붙이면서 앞 문장을 고치지 않은 것이 원인입니다.
- `AC-ROOM-008-5`(`prd.md:168`): "정확히 한 건만 성공"은 서로 다른 키 두 요청에는 맞지만, 같은 키의 동시 재전송 두 건은 같은 성공 결과를 공유해야 하므로 "성공이 한 건"이라는 문장과 어긋납니다. 이번에 추가한 AC-ROOM-008-10이 바로 이 재전송을 다루는데 -5를 같이 한정하지 않았습니다.

**수정 방향** (적용하지 않음): 두 문장 모두 "슬롯 또는 거래를 소비하는 요청"과 "성공 응답을 받는 요청"을 구분합니다. AC-TXN-007-2는 "성공했다면 정확히 1건, 영구적 거부였다면 0건", AC-ROOM-008-5는 "서로 다른 키의 요청 두 건이 마지막 슬롯에 도착하면 슬롯을 소비하는 요청은 정확히 하나이고, 같은 키의 재전송은 그 결과를 공유한다"로 쓰면 됩니다. 새 정책 결정은 필요하지 않아 보입니다. 이 판단은 제 의견입니다.

**같은 유형의 후보 (검수자가 지적하지 않은 것, 읽기만 한 사전 점검)**: "정확히 한/1" 표현을 PRD에서 검색했습니다.
- 수정이 필요한 후보는 위 두 곳뿐으로 보입니다. `AC-TXN-007-5`, `AC-TXN-007-8`("거래는 1건만 존재")과 `AC-SET-001-9`는 성공 경로 또는 상태 전이만 말해서 충돌하지 않습니다.
- `AC-ROOM-006-11`(같은 닉네임 동시 등록 시 정확히 한 건만 성공)은 참여자·입장 요청에 멱등 키가 없어 재전송 규칙과 닿지 않습니다. 다만 같은 브라우저의 중복 입장 시도는 신원 복원(AC-ROOM-005-1)과 맞물리는지 확인이 필요합니다. 근거가 약해 지적으로 올리지 않았고, 다음 검수 때 검수자가 판단하게 하는 편이 좋습니다.

**관찰**: 이전 사이클과 같은 패턴입니다. 재전송 규칙을 단계적으로 추가하면서 그 규칙과 맞닿는 기존 AC 문장을 전부 훑지 못했습니다. 이번에는 부록 A와 AC 번호 참조는 맞췄지만, "정확히 N건" 같은 수량 표현은 점검하지 않았습니다. 다음 수정에서는 수량·횟수 표현 전체를 grep으로 먼저 점검하겠습니다.

## 6. 수집 한계

- 읽기 전용 Worker는 Orca에 접근할 수 없고 Orca transcript는 한 메시지를 약 1,500자에서 자른다. 첫 보고(판정과 지적 요약)는 잘리지 않았고, 상세는 같은 Worker에게 터미널로 follow-up 1회를 보내 받았다.
- 지적 2건의 상세 필드는 모두 수집됐다. 검수자의 "Checks performed"와 잔여 위험은 한 문장 요약, 일부 잘린 문장만 받았다.
- 원본 전문은 Orca transcript에 있다(`orca orchestration worker-read --dispatch ctx_b4f56e9d8d4e`).

## 7. 증거 묶음 (`.agents/governance.md` §8)

| 항목 | 값 |
| --- | --- |
| 게이트 | G1 PRD |
| 산출물 | `docs/prd/mvp/prd.md` v0.3.0 |
| 상위 문서 | 통합 정책 v1.0.0(현행 통합 파일 + 기존에만 있던 규칙 7건, 사용자 결정 2026-11-07, 파일 헤더 미수정), 기존 정책 v1.0.0 |
| 검수 횟수 | 새 사이클 1/3 (남은 횟수 2회) |
| 최신 판정 | REVISE (V5-001, V5-002, 모두 MEDIUM) |
| 지적과 처리 | V5-001, V5-002를 PRD v0.3.1에 반영(8절). 반영 결과는 2/3회 검수로 확인 |
| 실행한 점검 | Codex 독립 검수 1회(읽기 전용). 이 파일 작성 외 문서 변경 없음 |
| 미검증 | Notion 원문, 런타임·UI |
| 열린 질문 | 16개 (Spec 전 필수 9개) |
| 사용자 승인 | 없음 (PRD 확정 미승인) |
| 브랜치·PR | `HyeonSeoMan/mvp-prd`. 이번 작업의 변경은 모두 커밋하지 않았고 PR #3은 v0.1.0 상태 그대로다 |
| 다음 허용 행동 | 2/3회 검수 결과(`prd-review-v0.3.1.md`) 참조 |

## 8. 지적 반영 결과 (PRD v0.3.1, 2026-11-07)

사용자 지시로 지적 2건을 반영했다. 아래는 Claude의 수정이며 **이 시점에는 독립 확인 전**이다.

| ID | 반영 내용 | 변경 위치 |
| --- | --- | --- |
| V5-001 | AC-TXN-007-2를 "거래 생성은 최대 한 번. 최초 결과가 성공이면 정확히 1건, 영구적 거부이면 0건"으로 다시 썼다. 부록 A와 AC-TXN-007-10의 "데이터 변경 없음"과 맞춘다 | `prd.md` FR-TXN-007 |
| V5-002 | AC-ROOM-008-5를 "서로 다른 요청은 슬롯을 소비하는 요청이 정확히 하나, 같은 키·같은 내용의 동시 요청은 슬롯을 한 번만 소비하고 같은 성공 결과를 공유"로 구분해 다시 썼다 | `prd.md` FR-ROOM-008 |

지시 범위를 넘어 함께 고친 것 (Claude 판단, 명시한다):
- 수량·횟수 표현("정확히", "한 번만", "1건", "둘 이상" 등)을 PRD 전체에서 검색해 점검했다. 성공 경로나 상태 전이만 말하는 `AC-TXN-007-5`, `AC-TXN-007-8`, `AC-SET-001-9`, FR-SET-001은 충돌하지 않아 그대로 두었다.
- `AC-ROOM-006-11`은 지적되지 않았지만 같은 종류의 모호함이 있어 고쳤다. "서로 다른 신원의 동시 등록은 정확히 하나만 성공", "같은 브라우저의 중복 입장은 AC-ROOM-005-1에 따라 같은 RoomMember로 복원"으로 구분했다. 새 규칙을 만든 것이 아니라 AC-ROOM-005-1을 적용한 문장이다.
