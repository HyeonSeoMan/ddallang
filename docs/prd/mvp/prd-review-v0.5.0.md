# 딸랑 MVP PRD v0.5.0 — Codex 독립 검수 기록 (v0.5.x 새 사이클 1/3)

- 대상: `prd.md` v0.5.0 (초안, **미승인**). 사용자 위임에 따라 Claude가 결정한 OQ-026 잔여·OQ-036(`open-questions.md` 2.2절)을 반영한 개정본이다.
- 검수 사이클: **v0.5.x 새 사이클 1/3회.** 이전 v0.2.x, v0.3.x, v0.4.x 사이클(각 3회 소진)과 분리했다.
- 게이트: G1 PRD (`.agents/governance.md` §3)
- 판정: **PASS** — 새 지적 없음 (BLOCKER 0, HIGH 0, MEDIUM 0, LOW 0).
- **PASS는 품질 판정이며 사용자 승인이 아니다.** PRD 확정 승인은 아직 하지 않았다.
- 이후 조치: 지적이 없어 PRD를 수정하지 않았고 추가 검수도 실행하지 않았다.

## 1. 실행 조건

| 항목 | 내용 |
| --- | --- |
| 검수자 | 새 Codex Worker. 읽기 전용 터미널(`codex --sandbox read-only --ask-for-approval never`). 검수자가 세션 헤더에서 `sandbox_mode=read-only`를 확인했다고 보고했다 |
| 검토 파일 | `prd.md`, 두 정책 파일, `policy-traceability.md`, `open-questions.md`(2.1·2.2절 포함), `policy-verification.md`. 회귀 확인용으로 이전 검수 기록은 읽어도 된다고 허용했다 |
| 제외 파일 | `prd-self-review.md`(작성자 자체 리뷰), `prd-review.md`(v0.1.0 기록) |
| 지시한 결정 구분 | 사용자 결정 9건은 `[USER-DECISION 2.1]`, 사용자 위임으로 Claude가 정한 2건은 `[DELEGATED-DECISION 2.2]`로 구분했다. 후자는 정책도 사용자 결정도 아니므로 합리성·정책 문구 적합성·새 규칙 여부·정합성을 판단하게 했다 |
| 중점 지시 | (1) v0.4.3에서 고친 V10-001~003(재검수 없이 병합됐던 수정)의 해소, (2) 위임 결정 2건의 타당성과 일관성, (3) 결정들의 파급 효과, (4) 의미 기준 전수 점검, (5) 그 밖의 전면 재검토 |
| 지시 | 입증 가능한 모든 결함을 낮은 심각도까지 빠짐없이 보고하고 판정을 누그러뜨리지 말 것 |
| 정책 문서 | 수정하지 않았다 |
| 시작 | Codex 업데이트 안내(0.167.0)가 다시 떠서 `esc`로 건너뛰었다. 업데이트는 실행하지 않았고 설치 버전은 0.166.0 그대로다 |

## 2. 검수자 보고 (원문)

```text
Verdict: PASS
V10-001..V10-003: resolved; expiry takes precedence, unknown outcomes remain explicit, and §9 lists the decisions correctly.
Delegated OQ-026 residual and OQ-036: reasonable and consistent; rejection retries and custom units fit the delegated scope.
Semantic sweep and knock-on: consistent; independently reviewed all 225 ACs and verified 34 POL, 37 FR, 32 anchors and traceability counts.
No new findings
Phase: G1, PRD v0.5.0, new cycle attempt 1/3; upstream policy v1.0.0 and decisions in §2.1/§2.2.
Limits: static document review; Notion original and runtime behavior unverified. Read-only session confirmed; no files modified or Orca commands run.
Residual risks: eight registered OQs, none required before Spec; R-01 slot exhaustion remains. Spec must define and verify first-attempt timestamp identification, including unrecorded keys.
PASS is a quality verdict; PRD approval remains pending.
```

## 3. 요약

| 항목 | 결과 |
| --- | --- |
| V10-001 ~ V10-003 | **해소됨.** 만료 거부가 충돌 거부보다 우선하고, 확정할 수 없는 결과는 "알 수 없음"으로 남으며, §9가 결정을 올바르게 나열한다 |
| 위임 결정 OQ-026 잔여 | **합리적이고 일관됨.** 거부된 요청의 키를 기록하지 않고 새 요청으로 재처리하는 것은 위임 범위에 맞는다 |
| 위임 결정 OQ-036 | **합리적이고 일관됨.** 목록 + 직접 입력은 위임 범위에 맞는다 |
| 파급 효과·의미 기준 전수 점검 | **일관됨.** 225개 AC를 독립적으로 전수 검토 |
| 집계 | POL 34, FR 37, AC 225, 앵커 32. 추적표와 일치 |
| 새 지적 | **없음** |

## 4. 검증하지 못한 사항과 잔여 위험

검수자 보고에 따른다.
- 정적 문서 검토다. **Notion 원문과 런타임 동작은 검증하지 않았다.**
- 열린 질문 8개(OQ-019, 030~034, 038, 039)가 남아 있고 Spec 전 필수는 없다.
- R-01(슬롯 영구 고갈)이 남아 있다.
- **Spec은 최초 시도 시각의 식별 방법을, 기록이 없는 키의 경우까지 포함해 정의하고 검증해야 한다.**

## 5. Claude의 평가와 주의

PASS는 이 사이클의 독립 검수 결과로서 의미가 있습니다. 다만 아래를 같이 보셔야 합니다.

1. **PASS는 한 검수자의 한 번의 정적 검토입니다.** 이전 세 사이클은 검수마다 새 지적이 나왔고, 대부분 같은 규칙(재전송·한도·동시 요청)의 인접 문장 충돌이었습니다. 이번에 지적이 없다는 것은 그 계통의 결함을 이번 검수자가 찾지 못했다는 뜻이지, 없다는 증명은 아닙니다. 사이클이 달라졌을 뿐 검수 방식(새 Worker, 같은 지시 틀)은 같았습니다.
2. **위임 결정 2건은 사용자의 결정이 아닙니다.** 검수자는 합리적이라고 판단했지만, 제품 결정의 최종 권한은 사용자에게 있습니다. 특히 OQ-036(직접 입력 허용)은 "정책이 `등`이라 세 개로 고정하면 정책을 좁힌다"는 제 해석에 기댄 선택입니다.
3. **PRD 확정 승인은 아직 없습니다.** 거버넌스(G1)는 PRD 확정에 사용자 승인을 요구하고, Spec(G2)은 승인된 PRD를 입력으로 합니다.
4. **정책 문서 정리는 사용자 몫으로 남아 있습니다.** 결정 11건은 정책 파일이 아니라 `open-questions.md`(2.1·2.2절)에만 있고, 통합 정책 파일의 헤더는 여전히 "초안"입니다.
5. **이 변경은 아직 커밋되지 않았습니다.** `main`의 PRD는 v0.4.3입니다.

## 6. 수집 한계

- 읽기 전용 Worker는 Orca에 접근할 수 없고 Orca transcript는 한 메시지를 약 1,500자에서 자른다. 이번 보고는 잘리지 않고 한 번에 수집됐다.
- 검수자의 "수행한 점검" 세부 목록은 한 문장 요약만 있다(`independently reviewed all 225 ACs and verified 34 POL, 37 FR, 32 anchors and traceability counts`).
- 원본 전문은 Orca transcript에 있다(`orca orchestration worker-read --dispatch ctx_89e379d66580`).

## 7. 증거 묶음 (`.agents/governance.md` §8)

| 항목 | 값 |
| --- | --- |
| 게이트 | G1 PRD |
| 산출물 | `docs/prd/mvp/prd.md` v0.5.0 |
| 상위 문서 | 통합 정책 v1.0.0(현행 통합 파일 + 규칙 7건, 사용자 결정 2026-11-07, 파일 헤더 미수정), 기존 정책 v1.0.0, 사용자 결정 9건(2.1절), 사용자 위임 Claude 결정 2건(2.2절) |
| 검수 횟수 | v0.5.x 새 사이클 1/3 (남은 횟수 2회) |
| 최신 판정 | **PASS** (새 지적 없음) |
| 지적과 처리 | 없음 |
| 실행한 점검 | Codex 독립 검수 1회(읽기 전용) |
| 미검증 | Notion 원문, 런타임·UI |
| 열린 질문 | 8개 (Spec 전 필수 0개) |
| 사용자 승인 | **PRD 확정 미승인.** 위임은 두 질문의 결정까지였다 |
| 브랜치·PR | `HyeonSeoMan/prd-v0.5`(최신 `main` 기준). **커밋·PR 없음** |
| 다음 허용 행동 | 사용자의 지시. 커밋·PR·병합, PRD 확정 승인, Spec 착수는 모두 사용자 결정이다 |
