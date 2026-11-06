# DDALLANG (딸랑)

pnpm Workspace + Turborepo 모노레포.

## 요구 사항

- Node.js >= 22.13 (`.nvmrc` 참고)
- pnpm 12 (`packageManager` 필드로 고정)

## 구조

- `apps/web` — Next.js (App Router) + TypeScript, TanStack Query, Jotai, Panda CSS
- `packages/typescript-config` — 공통 tsconfig

## 명령어

```bash
pnpm install
pnpm dev        # Panda 코드젠/watch + Next.js dev 서버
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

## AI 하네스

Claude Code와 Codex의 역할·권한·품질 게이트는 아래 문서를 따른다.

- `CLAUDE.md` — Claude Code 작성·구현·조율 규칙
- `AGENTS.md` — Codex 독립 리뷰 규칙 (읽기 전용)
- `.agents/governance.md` — 두 에이전트가 공통 참조하는 Governance·게이트(G1~G5)
- `docs/policies/ddallang-mvp-policy.md` — MVP 제품 정책 (v1.0.0)
