# 딸랑 MVP PRD v0.3.2 — Codex 독립 검수 기록 (새 사이클 3/3, 마지막 회차)

- 대상: `prd.md` v0.3.2 (초안, 미승인). v0.3.1 검수 2/3회(`prd-review-v0.3.1.md`)의 지적 3건을 반영하고 §5 서두에 "AC 해석 규약"을 둔 수정본이다.
- 검수 사이클: 새 사이클 **3/3회.** 이번 회차로 v0.3.x 사이클에 **허용된 3회를 모두 사용했다.** (1/3 v0.3.0 REVISE → 2/3 v0.3.1 REVISE → 3/3 v0.3.2 REVISE)
- 게이트: G1 PRD (`.agents/governance.md` §3)
- 판정: **REVISE** (새 지적 2건: MEDIUM 1, LOW 1. BLOCKER 0, HIGH 0)
- 거버넌스 상태: `.agents/governance.md` §4에 따라 횟수가 소진되었으므로 **자동 진행을 중단한다.** PRD를 수정하지 않았고 추가 검수도 실행하지 않았다. PASS를 받지 못한 상태다.

## 1. 실행 조건

| 항목 | 내용 |
| --- | --- |
| 검수자 | 새 Codex Worker. 읽기 전용 터미널(`codex --sandbox read-only --ask-for-approval never`). 검수자가 세션 헤더에서 `sandbox_mode=read-only`를 확인했다고 보고했다 |
| 검토 파일 | `prd.md`, 두 정책 파일, `policy-traceability.md`, `open-questions.md`, `policy-verification.md`. 회귀 확인용으로 이전 검수 기록 5개는 읽어도 된다고 허용했다 |
| 제외 파일 | `prd-self-review.md`(작성자 자체 리뷰), `prd-review.md`(v0.1.0 기록) |
| 존중하도록 지시한 사용자 결정 | 현행 통합 정책 파일 + 기존 정책에만 있던 규칙 7건 = 통합 정책 v1.0.0. 파일 헤더는 미수정 |
| 중점 지시 | (1) V6-001~003 해소와 V5 회귀 없음, (2) 신설 "AC 해석 규약"이 정책·모든 AC(특히 거부 AC)와 일치하는지와 AC-ROOM-008-11의 정책 근거, (3) 키워드가 아닌 의미 기준의 전수 점검, (4) 그 밖의 전면 재검토 |
| 지시 | 마지막 회차이므로 입증 가능한 모든 결함을 낮은 심각도까지 빠짐없이 보고하고 판정을 누그러뜨리지 말 것 |
| 근거 구분 | 모든 지적에 `[CONSOLIDATED C§x.y]` / `[OLD POL-xxx]` / `[PRD-DERIVED]` / `[NOTION-UNVERIFIED]` 중 하나를 붙이게 했다 |
| 정책 문서 | 수정하지 않았다 |
| 시작 | Codex 업데이트 안내(0.167.0)가 다시 떠서 `esc`로 건너뛰었다. 업데이트는 실행하지 않았고 설치 버전은 0.166.0 그대로다 |

## 2. 검수자 판정 요약

검수자는 이번 회차에 한국어로 요약을 보고했다. 아래는 그 요약이다.

| 항목 | 결과 |
| --- | --- |
| 전체 판정 | **REVISE** |
| V6-001 / V6-002 / V6-003 | **해소됨.** V5-001·V5-002 회귀 없음 |
| AC 해석 규약과 AC-ROOM-008-11 | **규약 1·2항과 복원 AC(AC-ROOM-008-11)는 타당.** 규약 3항의 "신원 제한"에 문제가 있다(V7-001) |
| 의미 기준 전수 점검 | **틈 있음:** 동일 방장 신원의 동시 요청 검증, 입장 한도 거부 시 입력 보존 AC (V7-001, V7-002) |
| 새 지적 | V7-001, V7-002 |

## 3. 검증하지 못한 사항 (검수자 보고)

- Notion 원문은 접근할 수 없어 대조하지 못했다. 이번 지적 중 Notion 확인이 필요한 것은 없었다(`[NOTION-UNVERIFIED]` 분류 0건).
- 런타임·UI 테스트는 하지 않았다. 읽기 전용으로 검토했고 파일 수정·Orca 명령은 실행하지 않았다.
- 검수자가 직접 센 정적 집계: 기존 POL 34개, FR 37개, AC 211개, 통합 정책 앵커 32개. 열린 질문 16개, Spec 전 필수 9개, OQ-028 철회와 위험 R-01. **추적표·열린 질문 문서의 집계와 일치한다.**
- 두 정책 파일을 v1.0.0 출처로 취급했다(사용자 결정에 따름).
- 잔여 위험(검수자 보고): 열린 질문과 슬롯 고갈 위험 R-01이 남아 있다.
- 검수자의 "수행한 점검" 세부 문장은 응답이 잘려 앞부분만 받았다(`Fresh comparison of both policies, all 211 ACs, traceability/counts, OQs, Appendix A and V5/V6 regressi…`).

## 4. 지적 사항

검수자가 보고한 영어 원문을 그대로 싣는다. 요약이나 번역으로 바꾸지 않았다. (검수자가 한국어로 보고한 1차 요약은 2절에 있다.)

### V7-001 | MEDIUM
- Basis: [PRD-DERIVED], PRD v0.3.2.
- Location: `docs/prd/mvp/prd.md:76,192,409`; AC-PART-001-5, AC-SET-001-9
- Evidence: Rule 3 defaults concurrent requests to different identities. Only one host exists, and participant registration provisionally requires that host. Two authorized requests therefore share an identity, excluding the normal concurrency cases from these ACs.
- User impact: Acceptance testing misses races from one host's tabs.
- Suggested fix: Include same-identity requests with distinct keys or inputs; preserve replay/restoration exceptions.

### V7-002 | LOW
- Basis: [CONSOLIDATED C§2.5], policy v1.0.0.
- Location: `docs/prd/mvp/prd.md:167,169`; AC-ROOM-008-1
- Evidence: Policy and FR require input preservation on capacity rejection. This AC checks refusal and the RoomMember-limit notice, but omits nickname preservation; the adjacent participant/transaction ACs explicitly check it.
- User impact: An implementation that clears the rejected entrant's nickname can pass the ACs.
- Suggested fix: Require the entered nickname to remain after capacity rejection.

## 5. Claude의 평가 (참고용, PRD에 적용하지 않음)

두 지적 모두 PRD 문장을 직접 확인해 보니 타당합니다.
- **V7-001** (`prd.md:76`): 규약 3항은 "동시 도착 AC는 서로 다른 신원·키일 때를 기본으로 한다"고 씁니다. 그런데 종료(AC-SET-001-9)와 참여자 등록(AC-PART-001-5)은 방장만 할 수 있어서, 이 AC들의 동시 요청은 **같은 신원(방장)**이 보내는 것이 정상입니다. 제가 규약 3항에서 신원 조건을 넣은 것이 오히려 이 AC들을 규약 밖으로 밀어냈습니다. 신원 조건은 입장(AC-ROOM-006-11)에만 필요한 구분이었는데 일반 규약으로 넓혔습니다.
- **V7-002** (`prd.md:169`): AC-ROOM-008-1은 입장 거부와 한도 초과 안내만 확인하고, 바로 아래 AC-ROOM-008-2·008-3이 확인하는 입력 보존을 빠뜨렸습니다. C§2.5는 "입력 보존"을 정한 만큼 단순 누락입니다.

**수정 방향** (적용하지 않음)
- 규약 3항에서 신원 조건을 빼고 "서로 다른 키 또는 서로 다른 입력의 요청"으로 바꿉니다. 같은 신원이라도 서로 다른 새 요청이면 포함하고, 같은 키의 중복은 부록 A, 같은 브라우저의 중복 입장은 AC-ROOM-005-1을 따른다고 남깁니다.
- AC-ROOM-008-1에 "입력한 닉네임이 화면에 유지된다"를 추가합니다.
- 새 정책 결정은 필요하지 않아 보입니다. 이 판단은 제 의견입니다.

**관찰**
- 세 회차의 지적 수와 심각도가 줄어드는 추세입니다(1/3: MEDIUM 2, 2/3: MEDIUM 2 + LOW 1, 3/3: MEDIUM 1 + LOW 1). HIGH·BLOCKER는 이 사이클에서 한 번도 나오지 않았습니다.
- 그러나 판정은 세 번 모두 REVISE였습니다. 같은 규칙(재전송, 한도, 동시 요청)을 AC마다 손으로 정합시키는 방식이라 고칠 때마다 인접 문장이 다시 걸립니다. 이번 지적도 제가 규약을 넣다가 새로 만든 틈입니다.
- 규약 3항의 신원 조건은 제가 만든 오류이고, 이 사이클의 다른 지적들과 달리 정책 근거 없이 제가 넣은 제한이었습니다.

## 6. 수집 한계

- 읽기 전용 Worker는 Orca에 접근할 수 없고 Orca transcript는 한 메시지를 약 1,500자에서 자른다. 첫 보고(판정과 지적 요약)는 잘리지 않았고, 상세는 같은 Worker에게 터미널로 follow-up 1회를 보내 받았다.
- 지적 2건의 상세 필드는 모두 수집됐다. 검수자의 "수행한 점검" 문장은 앞부분만 받았다.
- 원본 전문은 Orca transcript에 있다(`orca orchestration worker-read --dispatch ctx_fb4089e605d4`).

## 7. 증거 묶음 (`.agents/governance.md` §8)

| 항목 | 값 |
| --- | --- |
| 게이트 | G1 PRD |
| 산출물 | `docs/prd/mvp/prd.md` v0.3.2 |
| 상위 문서 | 통합 정책 v1.0.0(현행 통합 파일 + 기존에만 있던 규칙 7건, 사용자 결정 2026-11-07, 파일 헤더 미수정), 기존 정책 v1.0.0 |
| 검수 횟수 | 새 사이클 3/3 — **소진** |
| 최신 판정 | REVISE (V7-001 MEDIUM, V7-002 LOW). PASS 없음 |
| 지적과 처리 | 두 건 모두 미처리 |
| 실행한 점검 | Codex 독립 검수 1회(읽기 전용). 이 파일 작성 외 문서 변경 없음 |
| 미검증 | Notion 원문, 런타임·UI |
| 열린 질문 | 16개 (Spec 전 필수 9개) |
| 사용자 승인 | 없음 (PRD 확정 미승인) |
| 브랜치·PR | `HyeonSeoMan/mvp-prd`. 이번 작업의 변경은 모두 커밋하지 않았고 PR #3은 v0.1.0 상태 그대로다 |
| 다음 허용 행동 | **자동 진행 중단.** 아래 사용자 결정이 필요하다 |

## 8. 사용자 결정이 필요한 사항

`.agents/governance.md` §4는 횟수가 소진되면 중단하고 보고하도록 정한다. Claude는 아래를 임의로 선택하지 않았다.

| 선택지 | 내용 | 비고 |
| --- | --- | --- |
| A | V7-001·V7-002를 수정하고 추가 Codex 검수 없이 사용자가 직접 확인 | 수정은 문장 두 곳으로 작다. 판정은 REVISE로 남고 PASS 기록이 없다. 이 사이클에서 수정마다 인접 문장에 새 틈이 생긴 전력이 있다 |
| B | 이 사이클의 한도(3회)를 사용자가 명시적으로 예외 승인해 수정 후 4/4회 검수를 실행 | 거버넌스 규칙의 예외이므로 사용자 결정이 있어야 한다 |
| C | Spec 전 필수 열린 질문 9개(OQ-004, 008, 009, 026, 027, 029, 035, 036, 037)를 결정한 뒤 PRD v0.4.0으로 한 번에 개정하고 새 사이클 1/3을 연다. V7-001·V7-002와 나머지를 함께 수정 | 열린 질문 결정이 PRD 본문을 다시 바꾸므로 지금 다듬는 것이 일부 헛수고가 될 수 있다 |

Claude의 권장은 **C**입니다. 남은 지적이 MEDIUM 1·LOW 1로 작고 HIGH가 없으며, 필수 질문 9개의 결정이 AC 본문(닉네임 정규화, 사유·라운드 형식, 멱등 키 보관, 정산 동률 기준 등)을 다시 바꿉니다. 그 개정 때 V7-001·002를 같이 고치고 새 사이클로 검수하면 같은 문장을 두 번 손보지 않습니다. 다만 이는 권장일 뿐 결정이 아닙니다.

### 8.1 사용자 결정 (2026-11-07): 선택지 C

사용자가 선택지 **C**를 택했다.
- 필수 열린 질문 9개 중 8개를 "권장대로" 결정했다(OQ-004, 008, 009, 026 부분, 027, 029, 035, 037). OQ-036은 권장안이 없어 미결정으로 남았다. 결정은 `open-questions.md` 2.1절에 기록했다(정책 파일에는 기록하지 않음).
- PRD를 **v0.4.0**으로 한 번에 개정했고 V7-001·V7-002도 함께 수정했다. 새 검수 사이클 1/3은 `prd-review-v0.4.0.md`에 기록한다.
