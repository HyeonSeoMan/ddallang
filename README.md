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
- REST API (데이터 변경), Server-Sent Events (서버에서 클라이언트로의 변경 알림)

확정된 스택은 사용자 승인 없이 바꾸지 않는다. 미확정 항목(백엔드 테스트 도구, 배포 환경, API 문서화 등)은 백엔드 Plan에서 제안한다.

### 모노레포

pnpm Workspace + Turborepo

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
- `docs/specs` — 기능별 공통 Spec
- `.agents` — 에이전트 공통 거버넌스

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

PRD와 각 Spec은 사용자 승인 후 확정되며, 확정 뒤 의미 있는 변경은 재검수와 재승인을 거친다.

## AI 하네스

Claude Code가 작성·구현하고 Codex가 독립적으로 검수한다. 역할, 권한, 품질 게이트(G1~G5)는 아래 문서를 따른다.

- `CLAUDE.md` — Claude Code 작성·구현·조율 규칙
- `AGENTS.md` — Codex 독립 리뷰 규칙 (읽기 전용)
- `.agents/governance.md` — 두 에이전트가 공통으로 참조하는 거버넌스와 게이트

Codex 검수 통과는 사용자 승인이 아니다. PRD 확정, 각 Spec 확정, `main` 병합은 사용자가 승인한다.
