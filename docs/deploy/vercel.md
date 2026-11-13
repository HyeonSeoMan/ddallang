# 프론트엔드 Vercel 배포 (Hobby)

- 결정: 사용자가 2026-11-13에 Vercel로 시작하기로 했다(`open-questions.md` 2.14절 U-11, Plan FD-17). GitHub 계정과 `ddallang` 저장소는 사용자가 이미 연결했다.
- **Hobby 플랜은 약관상 "개인 또는 비상업적 용도"에만 쓸 수 있다**(https://vercel.com/legal/terms). 상업적 사용이 생기면 Pro로 옮기거나 다른 호스팅을 쓴다.
- 이 문서는 사람이나 브라우저 에이전트(Claude in Chrome 등)가 순서대로 따라 하도록 쓴 체크리스트다. 비밀 값은 어디에도 적지 않는다.

## 1. 확인된 사실 (2026-11-13, 깨끗한 복제본에서 시험)

| 항목 | 값 |
| --- | --- |
| 앱 위치 | 모노레포의 `apps/web` (Root Directory로 지정) |
| Next / Node / pnpm | Next 16.4, Node 22(`engines: >=22.13`), pnpm 12.18(`packageManager`) |
| 설치·빌드 | 기본 명령 그대로 된다. `pnpm install`이 `packageManager`를 보고 pnpm 12로 맞추고 `prepare`(Panda 코드젠)가 실행된다. `next build`가 통과한다(복제본 시험) |
| 필수 환경 변수 | `NEXT_PUBLIC_API_BASE_URL`. **없으면 빌드가 실패한다**(`next.config.ts`). 값은 빌드 때 번들에 고정된다 |
| 라우트 | `/`는 정적, `/invite/[inviteCode]`와 `/record`·`/settlement`·`/room`은 요청 때 렌더링(함수) |
| 함수 리전 | `apps/web/vercel.json`이 서울(`icn1`)로 지정한다. 기본값은 워싱턴(`iad1`)이라 지정하지 않으면 국내 접속이 느리다 |
| 백엔드 | `https://ddallang-api.onrender.com`(Render 무료, 첫 요청이 50초 넘게 걸릴 수 있어 앱이 미리 깨운다, FD-19) |

## 2. Vercel 프로젝트 설정 (대시보드)

| 설정 | 값 | 비고 |
| --- | --- | --- |
| Git 저장소 | `HyeonSeoMan/ddallang`, Production Branch `main` | |
| Framework Preset | Next.js | 자동 감지 |
| **Root Directory** | `apps/web` | 모노레포라 필수 |
| Include source files outside of the Root Directory in the Build Step | **켜기** | `packages/typescript-config`와 루트 락파일이 필요하다 |
| Install / Build / Output Command | **덮어쓰지 않는다**(기본값) | |
| Node.js Version | **22.x** | 기본값이 더 높은 버전이어도 22로 맞춘다(시험한 버전) |
| 환경 변수 `NEXT_PUBLIC_API_BASE_URL` | `https://ddallang-api.onrender.com` | Production과 Preview에 설정. 비밀이 아니다. **첫 배포 전에** 넣는다 |
| Deployment Protection | 기본(Standard) 유지 | 프로덕션 도메인이 로그인 없이 열려야 한다. 비밀번호 보호를 켜지 않는다 |

## 3. 브라우저 에이전트용 지침 (그대로 붙여 넣는다)

> 당신은 Vercel 대시보드에서 `ddallang` 프로젝트의 **설정만** 맞추는 에이전트다. 아래 순서대로만 하고, 막히면 멈추고 화면 내용과 함께 보고한다.
>
> **절대 하지 말 것**: 유료 플랜 업그레이드·결제 정보 입력, 프로젝트·도메인·팀·계정 삭제나 이름 변경, 팀 설정 변경, 환경 변수 값(특히 비밀로 보이는 것)을 읽어서 보고하거나 복사하는 일. 이 문서에 없는 설정은 바꾸지 않는다.
>
> 1. https://vercel.com/dashboard 에서 `ddallang` 프로젝트를 연다. 없으면 `Add New → Project`에서 GitHub 저장소 `HyeonSeoMan/ddallang`를 Import 한다(이때도 아래 2번 설정을 배포 **전에** 끝낸다).
> 2. `Settings → Build and Deployment`에서 확인·수정한다: Framework Preset = Next.js, **Root Directory = `apps/web`**, "Include source files outside of the Root Directory in the Build Step" = 켜짐, Install/Build/Output Command는 덮어쓰기(Override)를 **끈 상태**(기본값), **Node.js Version = 22.x**. Production Branch = `main`.
> 3. `Settings → Environment Variables`에서 `NEXT_PUBLIC_API_BASE_URL` = `https://ddallang-api.onrender.com` 을 **Production과 Preview** 환경에 추가한다(이미 있으면 값이 정확히 같은지만 확인). 끝에 슬래시를 붙이지 않는다.
> 4. `Settings → Deployment Protection`을 열어 기본(Standard) 상태인지만 확인한다. 바꾸지 않는다.
> 5. `Deployments`에서 최신 `main` 커밋의 배포 상태를 본다. 환경 변수가 없어서 **실패한 배포가 이미 있으면** 최신 `main` 배포의 `Redeploy`를 누른다. 배포가 없으면 `main`의 최신 커밋으로 새로 배포한다. `Ready`가 될 때까지 기다린다.
> 6. 실패하면 Build Logs의 **오류 줄 앞뒤 30줄**을 그대로 보고하고 멈춘다. 이 경우 한 번만 `Settings → Environment Variables`에 `ENABLE_EXPERIMENTAL_COREPACK` = `1`을 추가하고 다시 배포해 본다(pnpm 버전 문제일 때만 필요한 대비책이다). 그래도 실패하면 멈추고 보고한다.
> 7. 성공하면 **Production 도메인**(예: `https://ddallang.vercel.app`, 프로젝트 이름에 따라 다를 수 있음)을 정확히 적어 보고한다. 그 주소를 시크릿 창으로 열어 로그인 없이 `방 만들기` 화면이 보이는지 확인한다.
> 8. 확인용으로 `<도메인>/invite/test`도 열어 본다. **이 단계에서 방을 만들거나 거래를 입력하지 않는다.** 백엔드가 아직 이 도메인을 허용하지 않아 "네트워크 오류" 같은 안내가 나오는 것이 정상이다.
> 9. 보고: Production 도메인, 배포 상태(Ready/실패), 함수 리전이 Seoul(icn1)로 표시되는지(`Settings → Functions`), 위 설정 값들이 맞게 적용됐는지.

## 4. 백엔드 CORS 허용 (Vercel 도메인이 정해진 뒤, Render 대시보드)

백엔드는 `CORS_ORIGINS`에 **정확히 일치하는 출처**만 허용한다(현재 `http://localhost:3000`뿐). 이 단계는 배포된 백엔드의 환경 변수를 바꾸고 재배포하는 **운영 변경**이다.

> 당신은 Render 대시보드에서 `ddallang-api` 서비스의 환경 변수 **`CORS_ORIGINS` 한 개만** 바꾸는 에이전트다.
>
> **절대 하지 말 것**: `DATABASE_URL`, `CURSOR_KEY` 등 다른 환경 변수를 읽어서 보고하거나 복사하거나 수정하는 일, 서비스·데이터베이스 삭제, 플랜 변경, 결제 정보 입력.
>
> 1. Render 대시보드에서 `ddallang-api` 서비스 → `Environment`를 연다.
> 2. `CORS_ORIGINS`의 현재 값에 **Vercel Production 도메인**을 쉼표로 이어 붙인다. 형식은 `http://localhost:3000,https://<Vercel 도메인>` 이고 **스킴(https://)을 포함하며 끝에 슬래시가 없다**. 기존 값(`http://localhost:3000`)은 지우지 않는다.
> 3. 저장하고 서비스가 다시 배포(재시작)되기를 기다린다. 무료 플랜이라 1분 안팎 걸린다.
> 4. `https://ddallang-api.onrender.com/health`가 `{"status":"ok"}`인지 확인하고 보고한다.

백엔드가 맞게 반영됐는지는 아래 읽기 전용 명령으로 확인한다(`<도메인>`을 바꿔서 실행).

```bash
curl -s -i -X OPTIONS https://ddallang-api.onrender.com/rooms \
  -H "Origin: https://<도메인>" -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type,idempotency-key,idempotency-first-attempt-at" \
  | grep -i "^HTTP\|access-control-allow-origin"
# 기대: access-control-allow-origin: https://<도메인>
```

## 5. 배포 뒤 확인

1. (읽기 전용) 위 `curl` 사전 요청에서 허용 출처가 보이는지.
2. (읽기 전용) 도메인의 홈이 열리고, 브라우저 개발자 도구 네트워크에 배포 API로 가는 요청이 인증 없는 `GET /health` 한 건뿐인지.
3. **(쓰기, 사용자 승인 필요)** 실제 방 만들기 → 참여자 등록 → 거래 저장 → 정산·종료까지의 흐름. 배포 DB에 시험 방이 남는다. 이 흐름과 SSE가 Render 프록시를 거쳐 지연 없이 오는지는 지금까지 **한 번도 확인하지 못했다.**

## 6. 되돌리기·주의

- 잘못 배포되면 Vercel `Deployments`에서 이전 배포를 `Promote to Production`(롤백)한다. 환경 변수 값을 바꾸면 **다시 배포**해야 반영된다(빌드 때 고정).
- PR 미리보기 주소는 매번 달라 백엔드 CORS에 허용되지 않는다. 미리보기에서는 API 호출이 실패하는 것이 정상이다.
- Hobby는 한도를 넘으면 30일 동안 해당 기능을 쓸 수 없다(전송 100GB, 함수 호출 100만, CPU 4시간).
