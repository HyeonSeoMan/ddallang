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
