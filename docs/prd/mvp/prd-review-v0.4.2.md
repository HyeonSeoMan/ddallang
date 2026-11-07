# 딸랑 MVP PRD v0.4.2 — Codex 독립 검수 기록 (v0.4.x 사이클 3/3, 마지막 회차)

- 대상: `prd.md` v0.4.2 (초안, 미승인). v0.4.1 검수 2/3회(`prd-review-v0.4.1.md`)의 지적 3건과 사용자 결정(24시간 시계의 기준점 = 클라이언트의 최초 시도 시각)을 반영한 수정본이다.
- 검수 사이클: v0.4.x 사이클 **3/3회.** 이번 회차로 이 사이클에 허용된 3회를 모두 사용했다. (1/3 v0.4.0 NEEDS_DECISION → 2/3 v0.4.1 NEEDS_DECISION → 3/3 v0.4.2 REVISE)
- 게이트: G1 PRD (`.agents/governance.md` §3)
- 판정: **REVISE** (새 지적 3건: MEDIUM 2, LOW 1. BLOCKER 0, HIGH 0). **PASS를 받지 못했다.**
- 이후 조치: 사용자가 지시해 지적 3건을 PRD **v0.4.3**에 반영했다(7절). 사용자 지시로 **4회차 검수는 실행하지 않았다.** 따라서 v0.4.3은 독립 확인을 받지 못했다.

## 1. 실행 조건

| 항목 | 내용 |
| --- | --- |
| 검수자 | 새 Codex Worker. 읽기 전용 터미널(`codex --sandbox read-only --ask-for-approval never`). 검수자가 세션 헤더에서 `sandbox_mode=read-only`를 확인했다고 보고했다 |
| 검토 파일 | `prd.md`, 두 정책 파일, `policy-traceability.md`, `open-questions.md`(2.1절 포함), `policy-verification.md`. 회귀 확인용으로 이전 검수 기록은 읽어도 된다고 허용했다 |
| 제외 파일 | `prd-self-review.md`(작성자 자체 리뷰), `prd-review.md`(v0.1.0 기록) |
| 존중하도록 지시한 사용자 결정 | (1) 현행 통합 정책 파일 + 규칙 7건 = v1.0.0, 파일 헤더 미수정. (2) 2026-11-07의 결정 9건은 `open-questions.md` 2.1절에만 기록되어 있으며 권위 있는 결정으로 취급. OQ-040 = 만료 뒤 재시도는 거부, 24시간은 클라이언트 최초 시도 시각부터 |
| 중점 지시 | (1) V9-001~003 해소, (2) 만료 계약의 끝에서 끝까지의 일관성·검증 가능성, (3) 의미 기준 전수 점검, (4) 그 밖의 전면 재검토 |
| 지시 | 마지막 회차이므로 입증 가능한 모든 결함을 낮은 심각도까지 빠짐없이 보고하고 판정을 누그러뜨리지 말 것 |
| 근거 구분 | 모든 지적에 `[CONSOLIDATED C§x.y]` / `[OLD POL-xxx]` / `[USER-DECISION 2.1]` / `[PRD-DERIVED]` / `[NOTION-UNVERIFIED]` 중 하나를 붙이게 했다 |
| 정책 문서 | 수정하지 않았다 |
| 시작 | Codex 업데이트 안내(0.167.0)가 다시 떠서 `esc`로 건너뛰었다. 업데이트는 실행하지 않았고 설치 버전은 0.166.0 그대로다 |

## 2. 검수자 판정 요약

| 항목 | 결과 |
| --- | --- |
| 전체 판정 | **REVISE** |
| V9-001 ~ V9-003 | V9-001, V9-003은 해소. V9-002는 PRD §9에 OQ-040이 빠져 불완전(V10-003) |
| 만료 계약 끝에서 끝까지 | 같은 내용 재전송은 일관됨. **만료된 키 + 다른 내용**의 오류 규칙이 충돌(V10-001) |
| 의미 기준 전수 점검 | 복구 약속이 현재 상태 재조회가 보장하는 것을 넘어섬(V10-002) |
| 최초 시도 시각의 식별 방법 | **Spec 메커니즘으로 남겨도 된다**고 판단 |
| 집계 | POL 34, FR 37, 고유 AC 222, 앵커 32. 추적표의 매핑과 일치. V8 수정 사항은 유지됨 |
| 새 제품 결정이 필요한가 | **필요 없음.** 세 건 모두 새 제품 결정 없이 고칠 수 있다고 보고 |

## 3. 검증하지 못한 사항 (검수자 보고)

- 정적 검토만 했다. Notion 원문과의 대조, 런타임·UI 테스트는 하지 않았다. 파일 수정과 Orca 명령도 실행하지 않았다.
- 수행했다고 보고한 점검: 두 정책, 사용자 결정, AC 222개 전수, 규약, 부록 A, 추적표·집계, 열린 질문, V8·V9 수정.
- 잔여 위험(검수자 보고): 열린 질문 10개(Spec 전 필수 2개 포함), 슬롯 영구 고갈(R-01), 시각 식별과 복구 메커니즘은 Spec에서 검증 필요.

## 4. 지적 사항

검수자가 보고한 영어 원문을 그대로 싣는다. 요약이나 번역으로 바꾸지 않았다. 파일 경로는 `docs/prd/mvp/` 기준이다.

### V10-001 | MEDIUM
- Basis: [USER-DECISION 2.1], OQ-040.
- Location: `prd.md:310,540`; AC-TXN-007-4
- Evidence: Changed content with a retained key at t0+25h requires "conflict"; AC-TXN-007-12 requires "expired".
- User impact: Conflicting API/test expectations.
- Suggested fix: Apply conflict checks within validity; explicitly give expiry precedence.

### V10-002 | MEDIUM
- Basis: [PRD-DERIVED].
- Location: `prd.md:518`; AC-SYS-002-5
- Evidence: After overwrite/deletion and permitted expiry of request-result records, refreshed current state cannot always establish the lost write's original outcome.
- User impact: Recovery can imply certainty without evidence.
- Suggested fix: Preserve an explicit unknown outcome when confirmation is unavailable.

### V10-003 | LOW
- Basis: [PRD-DERIVED].
- Location: `prd.md:575–576`
- Evidence: The current user-decision inventory lists eight items, omitting decided OQ-040; section 2.1 contains nine.
- User impact: Readers receive an incomplete decision inventory.
- Suggested fix: Include OQ-040 in the current summary.

### 검수자의 추가 보고 (원문)
> All three findings can be fixed without new product decisions.

## 5. Claude의 평가

세 지적 모두 PRD 문장을 직접 확인해 보니 타당했습니다.
- **V10-001**: AC-TXN-007-4(내용이 다르면 충돌)와 AC-TXN-007-12(유효 기간 뒤에는 만료)가 둘 다 "기록된 키"에 대해 말하는데 우선순위가 없었습니다. t0+25h에 서버 기록이 남아 있고 내용이 다른 요청이 오면 두 AC가 서로 다른 오류를 요구합니다. 유효 기간 안에서만 충돌 거부를 적용하고 만료를 우선하도록 정리하면 해소됩니다.
- **V10-002**: AC-SYS-002-5와 AC-TXN-008-5가 "재조회로 저장 여부를 확인할 수 있다"고 약속했지만, 이후 다른 사용자가 수정·삭제했거나 유효 기간이 지난 경우 현재 상태만으로는 최초 결과를 증명하지 못합니다. 확인할 수 없으면 알 수 없음을 유지하도록 고쳐야 합니다.
- **V10-003**: PRD §9가 사용자 결정 8건만 나열하고 OQ-040이 빠져 있었습니다. 제가 이전 수정에서 §9의 번호 목록을 놓쳤습니다(머리말의 "8건 → 9건"만 고쳤음).

## 6. 수집 한계

- 읽기 전용 Worker는 Orca에 접근할 수 없고 Orca transcript는 한 메시지를 약 1,500자에서 자른다. 첫 보고(판정과 지적 요약)는 끝이 잘렸고, 지적 3건의 상세와 점검 범위는 같은 Worker에게 터미널로 follow-up 1회를 보내 받았다.
- 지적 3건의 상세 필드는 모두 수집됐다. 첫 보고 끝의 일부 문장(`Ten registered …`)은 잘렸으나 후속 보고의 잔여 위험으로 보완됐다.
- 원본 전문은 Orca transcript에 있다(`orca orchestration worker-read --dispatch ctx_7fd10a7757bd`).

## 7. 지적 반영 결과 (PRD v0.4.3, 2026-11-07)

사용자 지시로 지적 3건을 반영했고, **4회차 검수는 실행하지 않았다.** 아래는 Claude의 수정이며 **독립 확인을 받지 않았다.**

| ID | 반영 내용 | 변경 위치 |
| --- | --- | --- |
| V10-001 | AC-TXN-007-4와 NFR-003의 충돌 거부를 "키 유효 기간 이내"로 한정하고, AC-TXN-007-12와 부록 A에 "만료 거부가 충돌 거부보다 우선"을 명시 | `prd.md` FR-TXN-007, NFR-003, 부록 A |
| V10-002 | AC-SYS-002-5와 AC-TXN-008-5에서 "저장 여부를 확인할 수 있다" 약속을 풀었다. 재조회한 현재 상태는 최초 결과를 증명하지 못할 수 있으며, 확인할 수 없으면 저장되지 않았다고 단정하지 않고 "저장 여부를 확정할 수 없음"을 알린다 | `prd.md` FR-SYS-002, FR-TXN-008 |
| V10-003 | §9의 결정 목록·새로 발견 목록·OQ-026 잔여 설명을 현재 상태(결정 9건, OQ-040 포함)로 갱신 | `prd.md` §9 |

함께 한 정리 (명시한다): 검수 시작 직후 발견한 옛 용어 잔재 2곳(`open-questions.md` 해결 표의 OQ-040 행 "보관 기간", 부록 A 설명문의 중복 표현)을 표현만 바로잡았다. 검수가 끝난 뒤에 고쳤으므로 검수자는 이전 표현을 보았다.

## 8. 증거 묶음 (`.agents/governance.md` §8)

| 항목 | 값 |
| --- | --- |
| 게이트 | G1 PRD |
| 산출물 | `docs/prd/mvp/prd.md` v0.4.3 (검수 대상은 v0.4.2) |
| 상위 문서 | 통합 정책 v1.0.0(현행 통합 파일 + 규칙 7건, 사용자 결정 2026-11-07, 파일 헤더 미수정), 기존 정책 v1.0.0, 사용자 결정 9건(`open-questions.md` 2.1절) |
| 검수 횟수 | v0.4.x 사이클 3/3 — **소진.** 4회차는 사용자 지시로 실행하지 않음 |
| 최신 판정 | REVISE (V10-001·002 MEDIUM, V10-003 LOW). **PASS 없음** |
| 지적과 처리 | 세 건을 v0.4.3에 반영. 반영본은 독립 확인 전 |
| 실행한 점검 | Codex 독립 검수 1회(읽기 전용) |
| 미검증 | Notion 원문, 런타임·UI, v0.4.3 |
| 열린 질문 | 10개 (Spec 전 필수 2개: OQ-026 잔여, OQ-036) |
| 사용자 승인 | **PRD 확정은 승인하지 않았다.** `main` 병합만 사용자가 지시했다 |
| 브랜치·PR | `HyeonSeoMan/mvp-prd`, PR #3. 사용자 지시로 커밋·병합 |
| 다음 허용 행동 | Spec 작성은 PRD 확정 승인과 필수 열린 질문 결정 뒤에 가능하다 |
