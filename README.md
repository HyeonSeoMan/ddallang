# DDALLANG (딸랑)

고스톱 같은 오프라인 게임에서 참여자 사이의 거래를 기록하고, 실시간 누적 손익과 최종 정산을 계산해 주는 모바일 중심 웹 서비스다.

실제 송금이나 결제는 처리하지 않고 송금 완료 여부도 관리하지 않는다. 게임 점수를 자동으로 산출하지도 않는다. 범위는 방 생성과 초대 링크 입장, 익명 접속자, 참여자 관리, 단건 거래 기록, 실시간 손익과 예상 정산, 게임 종료와 최종 정산 복사다. 제외 범위는 PRD의 "MVP 제외 범위"를 따른다.

## 배포 현황

| 구성 | 위치 |
| --- | --- |
| 프론트엔드 | Vercel Hobby — https://ddallang.vercel.app (`main` 병합 시 자동 배포) |
| 백엔드 API | Render 무료 플랜(Docker, 싱가포르) — https://ddallang-api.onrender.com (`GET /health`) |
| 데이터베이스 | Supabase 무료 PostgreSQL |

개인·비상업 용도로 운영한다(Vercel Hobby의 약관 조건). 무료 플랜의 특성과 한계는 아래 [알려진 한계](#알려진-한계)를 본다.

## 화면 구성

방에 들어가면 위에 떠 있는 헤더(방 이름·진행 상태)와 탭으로 4개 페이지를 오간다. 주소는 모두 초대 링크 아래다.

| 페이지 | 경로 | 내용 |
| --- | --- | --- |
| 현황 | `/invite/{코드}` | 참여자별 누적 손익, 거래 내역(필터·수정·삭제), 거래 기록하기 |
| 기록 | `/invite/{코드}/record` | 거래 입력. 저장한 뒤에도 이 페이지에 머물러 연속으로 입력할 수 있다 |
| 정산 | `/invite/{코드}/settlement` | 진행 중에는 예상 정산, 종료 뒤에는 최종 정산과 복사. 방장은 여기서 게임을 종료한다 |
| 방 | `/invite/{코드}/room` | 방 정보와 초대 링크, 참여자 관리 |

게임이 끝나면 `기록` 탭이 사라지고 정산에서 시작한다. `/`는 방 만들기 화면이다.

## 기술 스택

| 영역 | 구성 |
| --- | --- |
| 프론트엔드 (`apps/web`) | Next.js 16(App Router), React 19, TypeScript, Panda CSS, TanStack Query(서버 상태), Jotai(클라이언트 상태), Pretendard(자체 호스팅 글꼴) |
| 백엔드 ([`ddallang-server`](https://github.com/HyeonSeoMan/ddallang-server)) | NestJS, TypeScript, PostgreSQL 16, Prisma, REST + Server-Sent Events |
| 테스트 | Vitest, Testing Library, MSW(모의 서버), `vitest-axe`(접근성), `fast-check`(속성 시험) |
| 모노레포 | pnpm Workspace + Turborepo |

- 브라우저의 `EventSource`는 인증 헤더를 보낼 수 없어서, 실시간 알림은 `fetch` 스트리밍으로 연결하고 REST와 같은 `Authorization: Bearer` 신원 키를 쓴다.
- 지원 목표는 Chrome, Edge, Firefox, Safari(모바일 포함)의 최신 안정 버전과 직전 주요 버전이다. 실행 시 필수 기능(Web Locks, 암호학적 난수, 브라우저 저장소, `fetch` 스트리밍)을 검사하고 없으면 진입을 막는다. 구형 브라우저용 폴백은 없다.
- 데이터는 온라인에서만 조회·변경한다. 연결이 끊기면 오래된 값을 보여 주지 않고, 복구되면 서버 상태를 다시 조회한다.

## 저장소 구성

| 저장소 | 역할 |
| --- | --- |
| [`ddallang`](https://github.com/HyeonSeoMan/ddallang) (이 저장소) | 프론트엔드, 제품 정책·PRD·공통 Spec 원본 |
| [`ddallang-server`](https://github.com/HyeonSeoMan/ddallang-server) | 백엔드 API (별도 저장소, 브랜치·PR·배포를 따로 관리) |

기능별 Spec은 이 저장소에서만 관리한다. 백엔드는 승인된 Spec을 버전 또는 커밋으로 참조한다.

```
apps/web                프론트엔드 (src/lib API·신원·변경 요청, src/ui 공통 UI, src/features 기능별 화면, src/test 시험 기반)
packages/typescript-config  공통 tsconfig
docs/policies           제품 정책
docs/prd                PRD와 열린 질문(사용자 결정 기록)
docs/specs              기능별 공통 Spec (방·신원·참여자, 거래, 조회·손익, 실시간·연결, 정산·종료)
docs/plans              프론트엔드·백엔드 Plan, Tasks, AC 매핑표, 검수 기록, 검증 증거
docs/deploy             배포 절차
docs/design             디자인 시안
```

## 로컬에서 실행

필요한 것: Node.js 22.13 이상(`.nvmrc`), pnpm 12(`packageManager`로 고정).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # 백엔드 주소 설정
pnpm dev          # http://localhost:3000
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

### 백엔드 연결

브라우저가 백엔드를 직접 호출한다(Next.js 서버 프록시 없음). `NEXT_PUBLIC_API_BASE_URL`은 **필수**이며 없으면 빌드·기동이 실패한다. 이 값은 **빌드 때 번들에 고정**되므로 바꾸면 다시 빌드한다.

| 상황 | `NEXT_PUBLIC_API_BASE_URL` |
| --- | --- |
| 로컬 백엔드(기본, `ddallang-server`와 PostgreSQL 16) | `http://localhost:3001` |
| 배포된 백엔드 | `https://ddallang-api.onrender.com` |

- 백엔드는 `CORS_ORIGINS`에 적힌 출처에서 오는 요청만 허용한다. 배포 백엔드는 `http://localhost:3000`과 `https://ddallang.vercel.app`을 허용한다. 다른 주소(미리보기 배포 등)에서는 API 호출이 실패하는 것이 정상이다.
- 자동 시험(`pnpm test`)은 MSW 모의 서버를 쓰므로 백엔드가 필요 없다.

### 추가 스크립트

`pnpm --filter web <이름>`으로 실행한다.

| 스크립트 | 용도 |
| --- | --- |
| `check:ac` | `docs/plans/web/ac-matrix.md`의 모든 AC에 `[AC-…]` 태그 시험이 있는지 대조한다 |
| `smoke` | 빌드 산출물을 `next start`로 띄워 `/invite/{코드}`와 하위 경로가 앱에 연결되는지 확인한다(`pnpm build` 선행) |
| `test:integration` | 실서버가 필요한 연동 점검. `INTEGRATION_API_BASE_URL`로 **점검용 백엔드**를 지정한다 |
| `test:latency` | 화면 반영 지연 측정(실서버 필요) |

실제 브라우저 점검 스크립트는 `apps/web/scripts/`에 있고 Chrome DevTools 프로토콜을 직접 쓴다(새 의존성 없음): `qa-room-pages.mjs`(로컬 서버, 30개 확인), `qa-prod.mjs`(**배포 DB에 시험 방이 남으므로 승인 없이 실행하지 않는다**).

## 배포

프론트엔드는 GitHub `main`에 병합되면 Vercel이 자동으로 Production을 배포한다. 모노레포라서 `apps/web`이나 그 의존성이 바뀐 커밋만 빌드된다(문서만 바뀌면 건너뜀). 배포가 실패하면 이전 Production이 유지된다. 설정(Root Directory `apps/web`, Node 22.x, 환경 변수, 함수 리전 서울)과 백엔드 CORS 허용 절차는 [`docs/deploy/vercel.md`](docs/deploy/vercel.md)에 있다. 환경 변수를 바꾸면 자동 재배포되지 않으므로 Vercel에서 직접 Redeploy한다.

## 프로젝트 상태

**MVP 범위의 구현과 배포를 마쳤다**(2026-11-13 기준).

| 항목 | 상태 |
| --- | --- |
| 정책·PRD·Spec·Plan/Tasks | 모두 확정(사용자 승인) |
| 프론트엔드 | 방 생성·입장, 참여자, 거래 CRUD, 손익·내역, 실시간 반영, 정산·종료·복사, 디자인 적용, 페이지 분리, 배포 백엔드 연동 구현·병합 |
| 자동 검증 | 타입 검사·린트·빌드·시험·`check:ac`(모든 AC에 태그 시험)·`smoke` 통과 |
| 실서버 검증 | 로컬 서버 기준 통합 시험, 실제 Chrome × 실서버 점검, **배포본(Vercel×Render×Supabase) 실사용 흐름 점검 15개 통과** |
| 증거 | [`docs/plans/web/g4-evidence.md`](docs/plans/web/g4-evidence.md): 실행한 것과 하지 못한 것을 구분해 기록 |

검수는 Codex 독립 검수를 기본으로 했으나, 일부 묶음(공통 기반, S1 REST 화면 등)은 Codex 한도 문제로 Claude 독립 검수(정적 검수 위주)만 받았다. 이는 Codex 검수가 아니며 사용자 승인도 아니다. 배포 준비 문서와 설정(`docs/deploy/vercel.md`, `apps/web/vercel.json`)처럼 코드가 아닌 변경 일부는 독립 검수를 받지 않았다. 묶음별 검수 이력은 각 `review.md`와 증거 문서에 있다.

### 알려진 한계

- **무료 플랜**: 백엔드는 15분 넘게 요청이 없으면 잠들고 첫 요청이 50초 넘게 걸린다. 읽기 요청의 시간 제한은 Spec의 10초라서, 앱은 화면이 열릴 때 `GET /health`를 한 번 보내 미리 깨운다(`apps/web/src/lib/wake-api.ts`). 깨우기가 끝나기 전의 첫 요청은 여전히 시간 초과가 날 수 있고, 콜드 스타트 중 동작은 측정하지 못했다. Supabase 무료 프로젝트도 오래 쓰지 않으면 일시 정지될 수 있다.
- **저장 지연**: 배포본에서 거래 저장에서 다른 접속자 화면 반영까지 약 3~3.6초가 걸렸다(요청 송신 기준). 대부분 저장 요청 자체의 처리 시간이며, 백엔드(싱가포르)와 DB(시드니)의 지역 차이가 의심된다(확정 아님). 개인 용도라 그대로 둔다. 개선하려면 DB를 백엔드와 같은 지역으로 옮긴다.
- **확인하지 못한 것**: Safari·Firefox·실기기·스크린리더, 눌림·호버 상태의 시각 확인, 서로 다른 신원 여러 명이 동시에 쓰는 경우.
- **최종 UI 승인은 사용자 몫**이다(구현된 화면을 직접 보고 판단).
- Vercel Hobby는 약관상 개인·비상업 용도만 허용한다. 상업적으로 쓰게 되면 호스팅을 다시 정한다.

## 문서 체계

문서는 아래 순서로 이어지며 아래 단계가 위 단계를 조용히 바꾸지 않는다.

**정책 → PRD → Spec → Plan → Tasks → 구현**

| 단계 | 위치 | 내용 |
| --- | --- | --- |
| 정책 | [`docs/policies/ddallang-mvp-policy-consolidated.md`](docs/policies/ddallang-mvp-policy-consolidated.md) (1순위), `docs/policies/ddallang-mvp-policy.md` (보조) | 제품 범위와 비즈니스 규칙 |
| PRD | [`docs/prd/mvp/prd.md`](docs/prd/mvp/prd.md) | 기능 요구사항(FR), 수용 기준(AC), 비기능 요구사항(NFR) |
| 열린 질문 | [`docs/prd/mvp/open-questions.md`](docs/prd/mvp/open-questions.md) | 사용자 결정 기록 |
| Spec | [`docs/specs/`](docs/specs/README.md) | 프론트엔드·백엔드가 함께 준수하는 동작 계약 |
| Plan / Tasks | [`docs/plans/web`](docs/plans/web/plan.md), `docs/plans/server` | 기술 계획과 작업 단위(저장소별) |

PRD와 각 Spec은 사용자 승인 후 확정되며, 확정 뒤 의미 있는 변경은 재검수와 재승인을 거친다. 처음 읽는다면 정책 → PRD → [`docs/specs/README.md`](docs/specs/README.md) → [`docs/plans/web/plan.md`](docs/plans/web/plan.md) 순서를 권한다.

## 핵심 설계 원칙

기능 Spec이 공통으로 따르는 원칙이다. 상세는 각 Spec을 본다.

- **서버 권위**: 권한, 방·참여자 상태, 한도, 금액 규칙은 서버가 최종 판정하고 클라이언트 값은 신뢰하지 않는다.
- **브라우저 기반 익명 신원**: 클라이언트가 만든 신원 키를 서버는 해시로만 보관한다. 키를 잃으면 서버도 복구하지 못한다.
- **Idempotency Key**: 거래 생성·수정·삭제와 종료 요청은 Idempotency Key로 중복을 막고, 키 유효 기간은 클라이언트가 처음 시도한 시각부터 24시간이다.
- **방 단위 직렬화**: 한 방의 변경은 하나의 순서로 처리하며, 다중 서버 인스턴스에서도 성립해야 한다.
- **알림과 조회의 분리**: 실시간 이벤트는 변경이 있었다는 알림이고, 화면의 값은 REST 조회로만 갱신한다.
- **삭제된 거래의 보존**: 삭제해도 행과 원본·작성자 기록은 남기며 거래 한도에 포함된다.

## AI 하네스

Claude Code가 작성·구현하고 Codex가 독립적으로 검수하는 방식으로 개발했다. 역할, 권한, 품질 게이트(G1~G5)는 아래 문서를 따른다.

- [`CLAUDE.md`](CLAUDE.md) — Claude Code 작성·구현·조율 규칙
- [`AGENTS.md`](AGENTS.md) — Codex 독립 리뷰 규칙(읽기 전용)
- [`.agents/governance.md`](.agents/governance.md) — 두 에이전트가 공통으로 참조하는 거버넌스와 게이트
- `.claude/skills/token-audit` — `scripts/tokstat.py`로 한 작업 구간의 토큰 사용량을 집계한다.
- `.claude/settings.json` — 위험 명령(`git reset --hard`, `git clean -f`, `gh repo create/delete`, `sudo`)과 비밀 파일(`.env*`, 키) 읽기를 거부하는 권한 목록. `main` 병합 등 승인 게이트는 `CLAUDE.md`의 규칙(사용자의 명시적 승인)으로 지킨다.

Codex 검수 통과는 사용자 승인이 아니다. PRD 확정, 각 Spec 확정, `main` 병합은 사용자가 승인한다.

## 라이선스와 출처

- 이 저장소에는 별도의 라이선스 파일이 없다(저작권자의 모든 권리 보유가 기본이다).
- 글꼴 Pretendard는 SIL Open Font License 1.1이며 원문은 [`apps/web/src/fonts/Pretendard-LICENSE.txt`](apps/web/src/fonts/Pretendard-LICENSE.txt)에 있다.
