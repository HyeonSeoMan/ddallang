# FE-V3 증거 (방 만들기 타일·파비콘)

측정 2026-11-16, Google Chrome 157.0.8103.51(헤드리스), macOS, 빌드본 `next start`(`NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`).

## 파비콘(FD-18 (6))

- 래스터화 명령: `rasterize-favicon.sh`(입력 `docs/design/favicon-v2/` SVG 3개, 출력 `apps/web/public/` PNG 4개).
- 결과(파일 머리·모서리 픽셀 확인):

| 파일 | 크기 | 색 형식 | 네 모서리 |
| --- | --- | --- | --- |
| `favicon-16.png` | 16×16 | RGBA | 투명(0,0,0,0) |
| `favicon-32.png` | 32×32 | RGBA | 투명 |
| `favicon-64.png` | 64×64 | RGBA | 투명 |
| `apple-touch-icon.png` | 180×180 | RGB(알파 없음) | 불투명 초록 `#00875A` |

- 빌드 HTML(`.next/server/app/index.html`)의 링크:
  ```html
  <link rel="icon" href="/favicon-16.png" sizes="16x16" type="image/png"/>
  <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png"/>
  <link rel="icon" href="/favicon-64.png" sizes="64x64" type="image/png"/>
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" type="image/png"/>
  ```
- `next start`에서 네 파일 모두 200 `image/png`(621·1321·2779·5905바이트). 홈 HTML에 외부(`http(s)://`) `src`·`href` 없음.
- `favicon-preview.png`: 16(8배)·32(4배)·64(2배)·180(1배) 확대 미리보기.

## 정산 단위 타일(DV-21)

- `create-room-375-and-300.png`: 빌드본 홈을 iframe 375px(타일 묶음 303px → 한 줄 4칸)과 300px(타일 묶음 228px → 280px 미만이라 2×2)으로 그린 것. 선택 `원`이 초록 2px·연초록 바탕.
- 오류·잠금 모양은 서버 응답이 필요해 브라우저로 보지 않았다. 조건(네 라디오 `aria-invalid`, `fieldset disabled`)은 단위 시험으로, 색 규칙은 생성 CSS(`:has(input:checked[aria-invalid=true])`, `:has(input:disabled:checked)`)로 확인했다. FE-V4에서 다시 본다.

## 하지 못한 것

실기기(iOS 홈 화면 아이콘), Safari·Firefox의 파비콘 선택, VoiceOver의 라디오 묶음 읽기.
