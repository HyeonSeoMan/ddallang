# S3 Spec — Codex 독립 검수 기록 (G2)

- 대상: `spec.md` (기준 PRD v0.5.1 = `main` `ca2104d`, 기준 Spec S1 v0.2.3, S2 v0.2.2)
- **PASS는 품질 판정이며 사용자 G2 승인이 아니다.** 승인 전에는 Spec을 확정하지 않는다.
- 모든 검수는 새 Codex Worker, 읽기 전용 터미널(`codex --sandbox read-only --ask-for-approval never`)에서 수행하고 검수자가 `sandbox_mode=read-only`를 확인한다. 업데이트 안내는 `esc`로 건너뛰고 업데이트하지 않는다.

| 시도 | 대상 버전 | 판정 | 요지 | 조치 |
| --- | --- | --- | --- | --- |
| 1/3 | v0.2.0 | REVISE | S3-01 MEDIUM base64url 커서 예시는 디코딩으로 `seq`를 복원할 수 있어 비노출 요구와 어긋남. S3-02 MEDIUM AC-VIEW-003-4 무누락을 커서 API만으로 입증할 수 없음(순회 중 생성한 신규분 vs 기존 거래 순회). S3-03 MEDIUM 커서 오류의 최상위 `code`는 `VALIDATION_FAILED`이고 `INVALID_VALUE`는 `details` 사유. S3-04 LOW `seq`와 정렬 키 비노출이 노출 필드 `createdAt`과 모순 | v0.2.1: 커서를 서버 비밀키 AEAD 토큰으로 정의, 변조 거부(S3-01). 003-4 검증을 기존 거래 순회와 신규분 재조회로 나눔(S3-02). 오류를 `VALIDATION_FAILED` + `details` 사유로 통일, 클라이언트 분기 정정(S3-03). 비노출 대상을 `seq`로 한정(S3-04) |
| 2/3 | v0.2.1 | REVISE | S3-03 MEDIUM 일부 위치에 `422 NOT_ALLOWED_FIELD`·`422 PARTICIPANT_NOT_FOUND`가 최상위 코드처럼 남아 오류 계약과 충돌. S3-05 MEDIUM 커서 오류 복구 시 기존 페이지 처리 규칙이 없어 [45…26]에 재조회 [46…27]을 이어 붙이면 [45…26, 46]이 됨 | v0.2.2: 남은 표기를 모두 `422 VALIDATION_FAILED` + `details[].field/code`로 통일(S3-03). 순회 개념을 정의하고 필터 변경·커서 복구·갱신은 기존 페이지를 폐기·교체하는 새 순회로 규정, 검증 추가(S3-05) |

검수 한계: 문서 정적 검수와 작은 알고리즘 모형. 구현·DB·UI 테스트는 실행하지 않았다.
