# 딸랑 MVP PRD v0.3.1 — Codex 독립 검수 기록 (새 사이클 2/3)

- 대상: `prd.md` v0.3.1 (초안, 미승인). v0.3.0 검수 1/3회(`prd-review-v0.3.0.md`)의 지적 2건을 반영하고 수량·횟수 표현을 전수 점검해 정리한 수정본이다.
- 검수 사이클: **새 사이클 2/3회** (v0.3.x). 1/3은 v0.3.0 대상(REVISE). 이번이 끝나면 남은 횟수는 1회다.
- 게이트: G1 PRD (`.agents/governance.md` §3)
- 판정: **REVISE** (새 지적 3건: MEDIUM 2, LOW 1. BLOCKER 0, HIGH 0)
- 이후 조치: 검수 직후에는 PRD를 수정하지 않았다. 사용자 지시에 따라 지적 3건을 PRD **v0.3.2**에 반영했고(8절) 3/3회 검수를 실행했다(`prd-review-v0.3.2.md`).

## 1. 실행 조건

| 항목 | 내용 |
| --- | --- |
| 검수자 | 새 Codex Worker. 읽기 전용 터미널(`codex --sandbox read-only --ask-for-approval never`). 검수자가 세션 헤더에서 `sandbox_mode=read-only`를 확인했다고 보고했다 |
| 검토 파일 | `prd.md`, 두 정책 파일, `policy-traceability.md`, `open-questions.md`, `policy-verification.md`. 회귀 확인용으로 이전 검수 기록 4개(`prd-review-v0.2.0/v0.2.1/v0.2.2/v0.3.0.md`)는 읽어도 된다고 허용했다 |
| 제외 파일 | `prd-self-review.md`(작성자 자체 리뷰), `prd-review.md`(v0.1.0 기록) |
| 존중하도록 지시한 사용자 결정 | 현행 통합 정책 파일 + 기존 정책에만 있던 규칙 7건 = 통합 정책 v1.0.0. 파일 헤더는 미수정 |
| 중점 지시 | (1) V5-001·V5-002 해소, (2) PRD 전체 수량·횟수·유일성 표현 전수 점검과 AC-ROOM-006-11 수정의 정책 근거, (3) 부록 A와 재전송 규칙의 일관성, (4) 그 밖의 전면 재검토 |
| 근거 구분 | 모든 지적에 `[CONSOLIDATED C§x.y]` / `[OLD POL-xxx]` / `[PRD-DERIVED]` / `[NOTION-UNVERIFIED]` 중 하나를 붙이게 했다 |
| 정책 문서 | 수정하지 않았다 |
| 시작 | Codex 업데이트 안내(0.167.0)가 다시 떠서 `esc`로 건너뛰었다. 업데이트는 실행하지 않았고 설치 버전은 0.166.0 그대로다 |

## 2. 검수자 판정 요약

| 항목 | 결과 |
| --- | --- |
| 전체 판정 | **REVISE** |
| V5-001 / V5-002 | **해소됨** (보고된 거부 시 거래 수, 같은 키 동시 요청 사례) |
| 수량 표현 전수 점검과 부록 A | **틈 있음** (V6-001~003). 추적표 집계는 일치 |
| AC-ROOM-006-11 수정 | **뒷받침됨.** C§2.3이 이미 있는 브라우저 기반 신원을 복원한다고 정한다 |
| 새 지적 | V6-001, V6-002, V6-003 |
| 수량 점검에서 추가로 충돌하는 표현 | **그 밖에는 없음** |

## 3. 검증하지 못한 사항 (검수자 보고)

- Notion 원문은 접근할 수 없어 대조하지 못했다. 이번 지적 중 Notion 확인이 필요한 것은 없었다(`[NOTION-UNVERIFIED]` 분류 0건).
- 런타임·UI 테스트, 파일 변경, Orca 명령은 하지 않았다.
- 검수자가 직접 센 집계: 기존 POL 34개, FR 37개, 고유 AC 210개, 통합 정책 앵커 32개, 열린 질문 16개, Spec 전 필수 결정 9개. **추적표·열린 질문 문서의 집계와 일치한다.**
- 수행했다고 보고한 점검: 두 정책 전면 대조, 부록 A와 추적표·열린 질문·정책 검증 문서 점검, 이전 지적 회귀, 수량·동시성·재전송·권한·범위 점검.
- 잔여 위험(검수자 보고): V6-001~003, 해결되지 않은 열린 질문, 기록된 슬롯 고갈 위험 R-01. PRD는 미승인.

## 4. 지적 사항

검수자가 보고한 영어 원문을 그대로 싣는다. 요약이나 번역으로 바꾸지 않았다.

### V6-001 | MEDIUM
- Basis: [PRD-DERIVED], v0.3.1.
- Location: `docs/prd/mvp/prd.md:296`, AC-TXN-007-3
- Evidence: At 999 trades, two same-content requests with distinct keys require two creations here, but AC-ROOM-008-5 permits only one.
- User impact: Incompatible acceptance counts.
- Suggested fix: Require two otherwise valid requests with capacity for both; retain the no-content-deduplication guarantee.

### V6-002 | MEDIUM
- Basis: [PRD-DERIVED], v0.3.1.
- Location: `docs/prd/mvp/prd.md:168`, AC-ROOM-008-5
- Evidence: Its "remaining requests fail for capacity" includes successful historical replays, identity restoration, and nickname contenders governed by AC-ROOM-006-11.
- User impact: Correct replay/restoration or duplicate errors fail acceptance.
- Suggested fix: Limit this case to eligible fresh creations with unique nicknames.

### V6-003 | LOW
- Basis: [PRD-DERIVED], v0.3.1.
- Location: `docs/prd/mvp/prd.md:572`, Appendix A
- Evidence: The concurrency summary applies current-state checks without excluding recorded replays; the table and AC-TXN-007-8/9 preserve their original results after termination.
- User impact: Misleading implementation/test guidance.
- Suggested fix: Apply state checks to fresh requests and (이하 수집 안 됨: 응답이 잘렸다. 앞 문장으로 보아 "기록된 재전송은 표의 해당 행을 따른다"는 취지로 추정되나 검수자가 쓴 문장은 아니다)

## 5. Claude의 평가 (참고용, PRD에 적용하지 않음)

세 지적 모두 PRD 문장을 직접 확인해 보니 타당합니다.
- **V6-001** (`prd.md:296`): AC-TXN-007-3은 "키가 다른 두 생성 요청은 별개의 거래 2건으로 저장된다"고만 쓰고 있습니다. 거래가 999건이면 AC-ROOM-008-5와 맞지 않습니다. "두 요청 모두를 받을 수용 여력이 있고 그 밖의 검증을 통과한 경우"라는 조건이 빠졌습니다.
- **V6-002** (`prd.md:168`): AC-ROOM-008-5는 "슬롯을 소비하는 요청은 정확히 하나이고 **나머지는 한도 초과로 거부**"라고 합니다. 이미 성공했던 요청의 재전송, 같은 브라우저의 신원 복원, 닉네임 중복으로 거부되어야 할 요청도 "나머지"에 들어가 버립니다. 이 문장이 AC-ROOM-006-11이나 AC-TXN-007-8과 부딪칩니다.
- **V6-003** (`prd.md:572`): 부록 A의 "요청별로 처리 시점 상태로 판정한다"는 문장이 기록된 재전송을 제외하지 않았습니다. 같은 표의 위쪽 행과 어긋납니다.

**원인과 수정 방향 (적용하지 않음)**: 세 건 모두 AC가 "모든 요청"을 대상으로 쓰인 데서 나옵니다. 지금까지 이 사이클들은 이런 문장을 하나씩 조건을 달아 고쳤고, 그때마다 인접한 문장이 다시 걸렸습니다. 개별 수정보다 **일반 규약 한 줄**을 §5 서두에 두는 편이 더 근본적입니다.
> 별도 표기가 없으면 AC의 "요청"은 권한·유효성 검사를 통과한 **새 요청**을 뜻한다. 서버가 이미 처리해 결과를 기록한 요청의 재전송은 부록 A를 따른다.

그 위에서 AC-TXN-007-3과 AC-ROOM-008-5에 "수용 여력이 있는 경우" 조건만 명시하면 됩니다. 이 방식이면 이후 수량 표현이 늘어나도 재전송과 충돌하지 않습니다. 새 정책 결정은 필요하지 않아 보입니다. 다만 규약 문장 추가는 PRD 구조를 바꾸는 일이므로 **적용하기 전에 확인을 받겠습니다.**

수량 점검에서 검수자가 지적한 세 건 외에 충돌하는 표현은 없다고 보고했습니다. 제 점검(3곳 수정)과 합치면 이번 사이클에서 놓친 표현은 AC-TXN-007-3과 부록 A 문장이었습니다. 제 점검이 "정확히/한 번만/1건" 같은 어휘 위주여서 "두 생성 요청은 별개의 2건"처럼 어휘가 다른 수량 표현을 놓쳤습니다.

## 6. 수집 한계

- 읽기 전용 Worker는 Orca에 접근할 수 없고 Orca transcript는 한 메시지를 약 1,500자에서 자른다. 첫 보고(판정과 지적 요약)는 잘리지 않았고, 상세와 점검 범위는 같은 Worker에게 터미널로 follow-up 2회를 보내 받았다.
- 지적 3건의 상세 필드는 받았다. 단 **V6-003의 Suggested fix는 응답이 잘려 앞부분만 수집됐다**(4절에 표시).
- 원본 전문은 Orca transcript에 있다(`orca orchestration worker-read --dispatch ctx_48e5247c312a`).

## 7. 증거 묶음 (`.agents/governance.md` §8)

| 항목 | 값 |
| --- | --- |
| 게이트 | G1 PRD |
| 산출물 | `docs/prd/mvp/prd.md` v0.3.1 |
| 상위 문서 | 통합 정책 v1.0.0(현행 통합 파일 + 기존에만 있던 규칙 7건, 사용자 결정 2026-11-07, 파일 헤더 미수정), 기존 정책 v1.0.0 |
| 검수 횟수 | 새 사이클 2/3 (남은 횟수 1회) |
| 최신 판정 | REVISE (V6-001, V6-002 MEDIUM, V6-003 LOW) |
| 지적과 처리 | V6-001~003을 PRD v0.3.2에 반영(8절). 반영 결과는 3/3회 검수로 확인 |
| 실행한 점검 | Codex 독립 검수 1회(읽기 전용). 이 파일 작성 외 문서 변경 없음 |
| 미검증 | Notion 원문, 런타임·UI |
| 열린 질문 | 16개 (Spec 전 필수 9개) |
| 사용자 승인 | 없음 (PRD 확정 미승인) |
| 브랜치·PR | `HyeonSeoMan/mvp-prd`. 이번 작업의 변경은 모두 커밋하지 않았고 PR #3은 v0.1.0 상태 그대로다 |
| 다음 허용 행동 | 3/3회 검수 결과(`prd-review-v0.3.2.md`) 참조 |

## 8. 지적 반영 결과 (PRD v0.3.2, 2026-11-07)

사용자 지시로 "일반 규약을 넣어" 지적 3건을 반영했다. 아래는 Claude의 수정이며 **이 시점에는 독립 확인 전**이다.

| ID | 반영 내용 | 변경 위치 |
| --- | --- | --- |
| (규약) | §5 서두에 **AC 해석 규약** 3항 추가: (1) AC의 "요청"은 처음 도착한 새 요청이고 재전송은 부록 A, (2) "성공한다" 계열 AC는 권한·유효성·한도·상태 조건 충족을 전제, (3) 동시 도착 AC는 서로 다른 신원·키가 기본이고 같은 키·같은 신원의 중복은 부록 A·AC-ROOM-005-1 | `prd.md` §5 |
| V6-001 | AC-TXN-007-3에 "두 요청 모두 유효하고 두 건을 받을 여력이 있으면"을 명시하고 여력이 한 건이면 AC-ROOM-008-5를 따른다고 연결 | `prd.md` FR-TXN-007 |
| V6-002 | AC-ROOM-008-5를 "다른 검증을 통과한 서로 다른 새 요청" 대상으로 한정하고, 재전송·신원 복원·닉네임 중복 거부 요청은 대상이 아니라고 명시 | `prd.md` FR-ROOM-008 |
| V6-003 | 부록 A의 동시 도착 문장을 "처음 도착한 새 요청은 처리 시점 상태로 판정, 기록된 재전송은 표의 해당 행을 따른다"로 수정. 검수자의 제안문 끝이 잘려 있어 취지를 추정해 썼다 | `prd.md` 부록 A |

지시 범위를 넘어 함께 고친 것 (Claude 판단, 명시한다):
- 규약의 (2)가 "거부 AC와 충돌하지 않도록" 처음 초안의 "유효한 요청만 AC의 대상"이라는 문구를 쓰지 않았다. 그렇게 쓰면 권한 없는 요청을 거부하는 AC가 규약과 모순되기 때문이다. 정상 처리를 말하는 AC에만 전제를 둔다.
- **AC-ROOM-008-11 추가**: RoomMember가 가득 찬 방에서 기존 신원 복원은 한도로 거부되지 않는다. 수량 표현 점검 중 이 경우를 다루는 AC가 없어 추가했다. C§2.3(신원 복원)과 C§2.5(한도는 존재하는 개체 수)에서 도출했다.
- 수량·대상 범위 표현을 담은 AC를 어휘가 아니라 의미(두/둘/모든/최대/N번째/동시/나머지/별개/중복 등) 기준으로 다시 훑었다. 위 외에 규약과 충돌하는 곳은 찾지 못했다.
