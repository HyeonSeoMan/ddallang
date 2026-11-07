# 딸랑 MVP PRD v0.2.1 — Codex 독립 검수 기록 (사이클 2/3)

- 대상: `prd.md` v0.2.1 (초안, 미승인). v0.2.0 검수 1/3회(`prd-review-v0.2.0.md`)의 지적 5건을 Claude가 반영한 수정본이다.
- 검수 사이클: v0.2.x 사이클 **2/3회.** 1/3회는 v0.2.0 대상(REVISE). 이번이 끝나면 남은 횟수는 1회다.
- 게이트: G1 PRD (`.agents/governance.md` §3)
- 판정: **REVISE** (새 지적 2건, 모두 MEDIUM. BLOCKER 0, HIGH 0)
- 이후 조치: 검수 직후에는 PRD를 수정하지 않았다. 사용자 지시에 따라 지적 2건을 PRD **v0.2.2**에 반영했고(9절) 3/3회 검수를 실행했다(`prd-review-v0.2.2.md`).

## 1. 실행 조건

| 항목 | 내용 |
| --- | --- |
| 검수자 | 새 Codex Worker. 읽기 전용 터미널(`codex --sandbox read-only --ask-for-approval never`). 검수자가 세션 헤더에서 `sandbox_mode=read-only`를 확인했다고 보고했다 |
| 검토 파일 | `prd.md`, 두 정책 파일, `policy-traceability.md`, `open-questions.md`, `policy-verification.md`. 회귀 확인용으로 `prd-review-v0.2.0.md`는 읽어도 된다고 허용했다 |
| 제외 파일 | `prd-self-review.md`(작성자 자체 리뷰), `prd-review.md`(v0.1.0 기록) |
| 독립성 | 1/3회 지적을 믿지 말고 두 정책 파일에서 다시 도출하도록 지시했다 |
| 별도 판단 요청 | Claude가 수정하며 택한 두 해석(a: 한도에 모든 개체 포함, b: 연결 끊김 시 조회 차단만 허용)이 통합 정책 문장으로 뒷받침되는지 |
| 근거 구분 | 모든 지적에 `[CONSOLIDATED C§x.y]` / `[OLD POL-xxx]` / `[PRD-DERIVED]` / `[NOTION-UNVERIFIED]` 중 하나를 붙이게 했다 |
| 정책 문서 | 수정하지 않았다 |

### 1.1 시작 실패와 복구 (투명성 기록)

처음 시작은 `agent_readiness` 단계에서 실패했다(`Agent startup blocked: agent-update-prompt`). Codex 0.167.0 업데이트 안내 화면이 떠 있었다.
- 업데이트(`brew upgrade --cask codex`)는 전역 설치를 바꾸는 작업이라 **실행하지 않았다.** 설치된 버전은 계속 0.166.0이고 `brew` 프로세스도 없음을 확인했다.
- 제가 만든 터미널에서 `esc`(건너뛰기)를 보내 화면을 넘겼다. 이 과정에서 "2"와 Enter도 한 번 입력했는데 화면이 변하지 않아 처리 여부가 불확실했고, 업데이트가 실행되지 않은 것은 위 두 사실로 확인했다.
- 같은 Task에 대해 `--retry-of`로 한 번 재시작했다. 재시작 때도 지시문과 읽기 전용 설정은 같았다.
- 첫 실패한 시작에서는 검토가 진행되지 않았다. 따라서 이번 검수는 재시작된 Worker의 1회 실행이고, 횟수는 1회로 센다.

## 2. 검증하지 못한 사항 (검수자 보고)

- Notion 원문은 접근할 수 없어 대조하지 못했다. 이번 지적 중 Notion 확인이 필요한 것은 없었다(`[NOTION-UNVERIFIED]` 분류 0건).
- 런타임·UI 테스트, 파일 변경은 하지 않았다.
- 검수자가 직접 센 집계: 통합 정책 앵커 32개 = FR 26 / NFR 1 / 열린 질문 5, 기존 POL 34개 모두 연결, FR 37개, AC 206개(중복 없음). **추적표의 집계와 일치한다.**
- 열린 질문 정합성: 통합 정책이 이미 결정했는데 열린 질문으로 둔 항목, 또는 정책 근거 없이 해결로 표시한 항목은 **발견하지 못했다.** 열린 질문 15개, Spec 전 필수 9개, OQ-028 철회와 위험 R-01 기록을 확인했다고 보고했다.

## 3. 1/3회 지적의 회귀 확인 (검수자 보고)

| ID | 결과 |
| --- | --- |
| V2-001 | 해결됨 |
| V2-002 | **해결되지 않음** — 같은 키 재전송 규칙과 충돌하는 AC가 남아 있다(아래 V3-001, V3-002) |
| V2-003 | 해결됨 |
| V2-004 | 해결됨 |
| V2-005 | 해결됨 |

## 4. Claude의 두 해석에 대한 검수자 판단

| 해석 | 판단 | 검수자 근거 |
| --- | --- | --- |
| (a) 한도는 상태와 무관하게 모든 개체를 센다 | **통합 정책으로 뒷받침됨** | C§2.5는 상태 예외 없이 개체 수를 제한한다 |
| (b) 연결 끊김 시 조회 차단만 허용하고 "최신 아님" 표시 값 노출은 허용하지 않는다 | **통합 정책으로 뒷받침됨** | C§4.5는 조회 차단을 요구하므로 오래된 값의 라벨 표시만으로는 대체할 수 없다 |

두 해석을 새로운 열린 질문으로 되돌릴 필요가 없다는 뜻이다. 1/3회 반영 때 제가 "확인이 필요하다"고 남긴 두 점은 이번 검수에서 해소됐다.

## 5. 새 지적 사항

검수자가 보고한 영어 원문을 그대로 싣는다. 요약이나 번역으로 바꾸지 않았다.

### V3-001 | MEDIUM
- Basis: [CONSOLIDATED C§3.4]
- Location: `docs/prd/mvp/prd.md:319`, AC-TXN-009-2; AC-TXN-007-8/9
- Evidence: A successful request's same-key replay starts before termination and is processed afterward. AC-009-2 requires rejection; AC-007-8/9 requires returning the original success.
- User impact: Lost-response recovery can report false failure; acceptance criteria conflict.
- Suggested fix: Limit AC-009-2 to new mutations and explicitly preserve replay exceptions.

### V3-002 | MEDIUM
- Basis: [CONSOLIDATED C§5.1]
- Location: `docs/prd/mvp/prd.md:397`, AC-SET-001-8; AC-SET-001-6
- Evidence: After termination, a new key receives "already ended." Replaying that key must reuse this rejection, but AC-001-8 says retries are not treated as errors.
- User impact: Contradictory response expectations can misreport failure as success.
- Suggested fix: Limit the no-error guarantee to originally successful requests.

### 검수자의 추가 보고
- 잔여 위험: 등록된 정책 결정 사항과 Spec 세부 사항이 아직 열려 있다.

## 6. Claude의 평가 (참고용, PRD에 적용하지 않음)

두 지적 모두 통합 정책 원문과 PRD 문장을 대조해 보니 타당합니다. 그리고 둘 다 **1/3회 지적 V2-002를 제가 고치면서 만든 잔여 불일치**입니다. 같은 키 재전송 규칙을 새로 넣고, 그 규칙과 충돌하는 문장을 일부만 찾아 고쳤습니다.

| ID | 판단 | 이유 |
| --- | --- | --- |
| V3-001 | **타당** | AC-TXN-009-2는 "종료 직전에 시작된 요청이 종료 이후에 처리되면 거부된다"고만 쓰고 있다. 성공했던 요청의 같은 키 재전송은 같은 상황에 놓이는데 AC-TXN-007-8·9는 성공 반환을 요구하므로 문장끼리 충돌한다. AC-TXN-009-2와 같은 범주에서 `AC-TXN-009-5`(동시 도착 시 처리 시점 판정)도 같은 한정이 필요한지 점검해야 한다 |
| V3-002 | **타당** | AC-SET-001-8은 "오류로 취급되지 않는다"를 모든 재전송에 적용하지만, 최초 결과가 `이미 종료된 게임입니다` 거부였던 키의 재전송은 같은 거부를 돌려줘야 한다(C§3.4의 "최초 결과 재사용"). "성공했던 요청의 재전송은 성공"이라는 뒷문장만 맞고 앞문장이 과하다 |

두 건 모두 새 정책 결정이 필요하지 않고 PRD 문장 정리로 해소되는 것으로 보입니다. 다만 이 판단은 제 의견이며 독립 확인은 아닙니다.

같은 유형의 불일치가 더 있는지는 확인하지 못했습니다. 재전송 규칙이 닿는 AC가 많아서(`AC-TXN-005-8`, `AC-TXN-006-4`, `AC-PART-*` 등) 고치기 전에 해당 AC를 한 번에 점검해 두는 편이 3/3회를 낭비하지 않는 길입니다.

## 7. 수집 한계

- 읽기 전용 Worker는 Orca에 접근할 수 없고 Orca transcript는 한 메시지를 약 1,500자에서 자른다. 그래서 첫 보고를 받은 뒤 같은 Worker에게 터미널로 follow-up을 두 번 보내 상세와 (d)·(e) 항목을 받았다.
- 검수자의 "Checks performed" 한 줄은 `Read governance, both policies and requested artifacts; compared policies/FRs/ACs, OQs, exclusions and prior fixes; counted IDs.`로만 수집됐다. 검토한 항목의 세부 목록은 받지 못했다.
- 지적 2건의 상세 필드는 모두 수집됐다. 원본 전문은 Orca transcript에 있다(`orca orchestration worker-read --dispatch ctx_169cbf937758`).
- 재시작 전의 실패한 시작은 `ctx_cc58fe9a2f7d`이며 검토 내용이 없다.

## 8. 증거 묶음 (`.agents/governance.md` §8)

| 항목 | 값 |
| --- | --- |
| 게이트 | G1 PRD |
| 산출물 | `docs/prd/mvp/prd.md` v0.2.1 |
| 상위 문서 | 통합 정책(버전 미부여, v1.0.0으로 정리 예정), 기존 정책 v1.0.0 |
| 검수 횟수 | v0.2.x 사이클 2/3 (남은 횟수 1회) |
| 최신 판정 | REVISE (V3-001, V3-002, 모두 MEDIUM) |
| 지적과 처리 | V3-001, V3-002를 PRD v0.2.2에 반영(9절). 반영 결과는 3/3회 검수로 확인 |
| 실행한 점검 | Codex 독립 검수 1회(읽기 전용). 이 파일 작성 외 문서 변경 없음 |
| 미검증 | Notion 원문, 런타임·UI |
| 열린 질문 | 15개 (Spec 전 필수 9개) |
| 사용자 승인 | 없음 (PRD 확정 미승인) |
| 브랜치·PR | `HyeonSeoMan/mvp-prd`. 이번 작업의 변경은 모두 커밋하지 않았고 PR #3은 v0.1.0 상태 그대로다 |
| 다음 허용 행동 | 3/3회 검수 결과(`prd-review-v0.2.2.md`) 참조 |

## 9. 지적 반영 결과 (PRD v0.2.2, 2026-11-07)

사용자 지시로 지적 2건을 반영했다. 아래는 Claude의 수정이며 **이 시점에는 독립 확인 전**이다.

| ID | 반영 내용 | 변경 위치 |
| --- | --- | --- |
| V3-001 | AC-TXN-009-2를 "처음 도착한 새 요청"으로 한정하고 같은 키 재전송은 AC-TXN-007-8·9를 따른다고 명시 | `prd.md` FR-TXN-009 |
| V3-002 | AC-SET-001-8을 "성공했던 요청의 재전송은 성공, `이미 종료된 게임입니다` 거부였던 요청의 재전송은 같은 거부"로 재작성 | `prd.md` FR-SET-001 |

검수자가 지적하지 않았지만 같은 유형이라 함께 고친 것(Claude 판단, 사용자 지시 범위의 확장이므로 명시한다):
- AC-TXN-009-5: "서로 다른 거래 저장 요청과 종료 요청", "새 거래 요청"으로 한정
- AC-TXN-006-4: "서로 다른 키의 수정과 삭제", "새 수정 요청"으로 한정
- AC-ROOM-008-3: "새 생성 요청"으로 한정, **AC-ROOM-008-10 추가**(마지막 슬롯을 채운 생성의 재전송은 한도 초과로 거부되지 않음)
- **AC-TXN-007-10 추가**: 영구적 상태 거부(`이미 삭제된 거래입니다`, 종료 후 거부)의 같은 키 재전송은 같은 거부를 반환. 일시적 거부(한도 초과 등)와 검증 실패 뒤의 키 재사용은 OQ-026에 남김(OQ-026 문구에도 반영)
