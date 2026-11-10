# DDALLANG (딸랑)

고스톱 등 오프라인 게임에서 참여자 사이의 거래를 기록하고, 실시간 누적 손익과 최종 정산을 계산해 주는 웹 서비스다.

실제 송금이나 결제를 처리하지 않으며 송금 완료 여부도 관리하지 않는다. 게임 점수를 자동으로 산출하지도 않는다.

MVP 범위는 방 생성과 초대 링크 입장, 익명 접속자, 참여자 관리, 단건 거래 기록, 실시간 손익과 예상 정산, 게임 종료와 최종 정산 복사다. 제외 범위는 PRD의 "MVP 제외 범위"를 따른다.

## 저장소 구성

두 저장소는 독립적인 Git 저장소이며 브랜치, 커밋, PR, 배포를 각각 관리한다.

| 저장소 | 역할 |
| --- | --- |
| [`ddallang`](https://github.com/HyeonSeoMan/ddallang) (이 저장소) | 프론트엔드, 제품 정책·PRD·공통 Spec 원본 |
| `ddallang-server` | 백엔드 API (별도 저장소) |

프론트엔드와 백엔드가 함께 따르는 기능별 Spec은 이 저장소에서만 관리한다. `ddallang-server`는 승인된 Spec을 버전 또는 커밋으로 참조하며 공통 Spec을 따로 만들지 않는다.

## 기술 스택

### 프론트엔드 (`apps/web`)

- Next.js 16 (App Router), React 19, TypeScript
- 서버 상태: TanStack Query, 클라이언트 상태: Jotai
- 스타일: Panda CSS
- 테스트: Vitest, Testing Library
- 린트: ESLint

### 백엔드 (`ddallang-server`)

- TypeScript, Node.js LTS
- NestJS (초기에는 단일 애플리케이션, 기능 단위 모듈 구조)
- PostgreSQL, Prisma
- REST API (데이터 변경과 조회), Server-Sent Events (서버에서 클라이언트로의 변경 알림). 브라우저의 `EventSource`는 인증 헤더를 보낼 수 없어, 프론트엔드가 `fetch` 스트리밍으로 연결하고 REST와 같은 `Authorization: Bearer` 인증을 쓴다

확정된 스택은 사용자 승인 없이 바꾸지 않는다. 미확정 항목(백엔드 테스트 도구, 배포 환경, API 문서화 등)은 백엔드 Plan에서 제안한다.

### 모노레포

pnpm Workspace + Turborepo

### 지원 환경

- 지원 목표: Chrome, Edge, Firefox, Safari(모바일 브라우저 포함)의 최신 안정 버전과 직전 주요 버전. 모바일 중심 반응형 UI이며 한국어를 우선한다.
- 실행 시 필수 기능을 검사한다(Web Locks, 암호학적 난수, 브라우저 저장소, `fetch` 스트리밍 등). 하나라도 없으면 진입을 차단하고 안내하며 구형 브라우저용 폴백은 두지 않는다.
- 데이터는 온라인에서만 조회·변경한다. 연결이 끊기면 오래된 값을 보여 주지 않고, 복구되면 서버 상태를 다시 조회한다.

## 개발 환경

- Node.js >= 22.13 (`.nvmrc` 참고)
- pnpm 12 (`packageManager` 필드로 고정)

```bash
pnpm install
pnpm dev        # Panda 코드젠/watch + Next.js dev 서버
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

## 디렉터리

- `apps/web` — 프론트엔드 앱
- `packages/typescript-config` — 공통 tsconfig
- `docs/policies` — 제품 정책
- `docs/prd` — PRD와 열린 질문, 검수 기록
- `docs/specs` — 기능별 공통 Spec (방·신원·참여자, 거래 CRUD, 조회·손익, 실시간·연결, 정산·종료)
- `.agents` — 에이전트 공통 거버넌스
- `.claude` — Claude Code 프로젝트 설정(Hook, Skill, 토큰 최적화 가이드)

## 문서 체계

문서는 아래 순서로 이어지며 아래 단계가 위 단계를 조용히 바꾸지 않는다.

**정책 → PRD → Spec → Plan → Tasks → 구현**

| 단계 | 위치 | 내용 |
| --- | --- | --- |
| 정책 | `docs/policies/ddallang-mvp-policy-consolidated.md` (1순위), `docs/policies/ddallang-mvp-policy.md` (보조) | 제품 범위와 비즈니스 규칙 |
| PRD | `docs/prd/mvp/prd.md` | 기능 요구사항(FR), 수용 기준(AC), 비기능 요구사항(NFR) |
| 열린 질문 | `docs/prd/mvp/open-questions.md` | 미결정 질문과 사용자 결정 기록 |
| Spec | `docs/specs/` ([목차와 승인 현황](docs/specs/README.md)) | 프론트엔드·백엔드가 함께 준수하는 동작 계약 |
| Plan / Tasks | 각 저장소 | 승인된 Spec을 구현하기 위한 기술 계획과 작업 단위 (저장소별로 독립) |

PRD와 각 Spec은 사용자 승인 후 확정되며, 확정 뒤 의미 있는 변경은 재검수와 재승인을 거친다. 구현(Plan/Tasks 이후)은 모든 기능 Spec이 확정된 뒤에 시작한다.

## 핵심 설계 원칙

기능 Spec이 공통으로 따르는 원칙이다. 상세는 각 Spec을 본다.

- **서버 권위**: 권한, 방·참여자 상태, 한도, 금액 규칙은 서버가 최종 판정하고 클라이언트 값은 신뢰하지 않는다.
- **브라우저 기반 익명 신원**: 클라이언트가 만든 신원 키를 서버는 해시로만 보관한다. 키를 잃으면 서버도 복구하지 못한다.
- **Idempotency Key**: 거래 생성·수정·삭제와 종료 요청은 Idempotency Key로 중복을 막고, 키 유효 기간은 클라이언트가 처음 시도한 시각부터 24시간이다.
- **방 단위 직렬화**: 한 방의 변경은 하나의 순서로 처리하며, 다중 서버 인스턴스에서도 성립해야 한다.
- **알림과 조회의 분리**: 실시간 이벤트는 변경이 있었다는 알림이고, 화면의 값은 REST 조회로만 갱신한다.
- **삭제된 거래의 보존**: 삭제해도 행과 원본·작성자 기록은 남기며 거래 한도에 포함된다.

## AI 하네스

Claude Code가 작성·구현하고 Codex가 독립적으로 검수한다. 역할, 권한, 품질 게이트(G1~G5)는 아래 문서를 따른다.

- `CLAUDE.md` — Claude Code 작성·구현·조율 규칙
- `AGENTS.md` — Codex 독립 리뷰 규칙 (읽기 전용)
- `.agents/governance.md` — 두 에이전트가 공통으로 참조하는 거버넌스와 게이트

### Claude Code Hook·Skill (`.claude/`)

- `.claude/hooks/pretool_guard.py` — 실수 방지 장치다. `git push`, `git reset --hard`, main 브랜치 커밋·병합, `gh pr merge`, `sudo`, 명백히 파괴적인 `rm -r`, 민감 파일(`.env`, 키 등) 읽기·쓰기처럼 **명확하게 적힌 단순 명령**만 차단한다. **샌드박스나 보안 경계가 아니며**, 변수·`bash -c`·`env` 같은 wrapper·glob·스크립트 등으로 우회할 수 있다. 알려진 한계는 [`.claude/hooks/README.md`](.claude/hooks/README.md)에 정리되어 있다. 승인 게이트(push, 병합, 저장소 생성)는 hook 유무와 관계없이 사용자가 별도 터미널에서 실행한다.
- `.claude/hooks/posttool_track.py` — 수정한 파일의 저장소 상대 경로만 기록한다(내용·명령은 저장하지 않음).
- `.claude/skills/token-audit` — `scripts/tokstat.py`로 한 작업 구간의 토큰 사용량을 집계한다.
- 테스트: `python3 -B .claude/hooks/test_hooks.py`. 통과는 문서에 적힌 동작을 한다는 뜻이며 안전 보장이 아니다.
- 검수 기록: Codex 독립 검수 3회(REVISE → BLOCKED → REVISE) 후 한도에 도달했고, 이후 수정(R3-01, R3-02)은 자체 검증만 거쳤다. Codex PASS는 없다.

Codex 검수 통과는 사용자 승인이 아니다. PRD 확정, 각 Spec 확정, `main` 병합은 사용자가 승인한다.
