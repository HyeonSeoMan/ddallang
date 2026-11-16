# FE-V4 상태별 화면 점검 증거 (375px)

- 대상 리비전: 앱 코드 `9005b6b`. 2026-11-16, Google Chrome 157.0.8103.51 헤드리스, macOS.
- 방법: `../fe-v2/README.md`와 같다(시드 렌더 + 생성 CSS + Pretendard, 375px 스크롤 컨테이너). 이번에 더한 것:
  - 입장 화면(진행 중·종료): 모의 서버(MSW) `GET /invites/:code` 응답으로 닉네임 단계까지 렌더.
  - 방 만들기 오류: 모의 서버가 `unit`을 `INVALID_CHARACTER`로 거부. 잠금: 네트워크 오류로 결과 불명(`칩` 선택 상태).
  - 종료된 방의 현황·기록, 끊김(`reconnecting`) 화면.
  - 라디오 `checked`는 DOM 속성이라 HTML 저장 전에 속성(attribute)으로 옮긴다(`render.test.tsx.txt`).
  - 하단 고정 `거래 기록하기`는 컨테이너가 아니라 뷰포트 기준이라 375×812 iframe으로 따로 캡처했다(`fixed-record-button-375.png`).
- 홈(방 만들기) 화면은 `app/page.tsx`를 그대로 렌더하지 않고 같은 구성(`max-width: 28rem`, 안쪽 16px, `BrandHeader`, 카드 제목 20/700·아래 16px, `CreateRoomForm`)을 인라인 스타일로 옮겨 렌더했다(`page.tsx`는 서버 컴포넌트·Panda 클래스라 시험 렌더에 그대로 쓰지 않았다). 값은 같다.
- 명령(스크래치 폴더 `$S`, 앱은 `apps/web`):
  - 렌더: `cp render.test.tsx.txt apps/web/src/zz-v4render.test.tsx && pnpm exec vitest run src/zz-v4render.test.tsx; rm apps/web/src/zz-v4render.test.tsx`(출력 경로는 스크립트의 `OUT`)
  - CSS: `pnpm panda cssgen --outfile $OUT/app.css`, 글꼴 복사, `python3 wrap.py $OUT`(화면마다 `<이름>-375.html`)
  - 측정: `chrome --headless=new --allow-file-access-from-files --virtual-time-budget=5000 --window-size=500,900 --dump-dom file://$OUT/<이름>-375.html`(결과는 `<pre id="result">` JSON)
  - 캡처: 같은 옵션에 `--hide-scrollbars --screenshot=…`, 왼쪽 위 375×812를 잘랐다.
  - 고정 버튼: `status-375.html`에서 375px 컨테이너를 뺀 사본을 `<iframe style="width:375px;height:812px">`로 감싸 맨 아래로 스크롤해 캡처했다.
- 배포 DB·실서버에는 요청하지 않았다.

## 결과

- `measure-375.jsonl`: 화면 15개 모두 `scrollWidth = clientWidth = 375`, 넘친 요소 0, 금액 `fits: true`.
- 캡처: `screens-progress.png`(현황·기록·정산·방), `screens-ended-offline.png`(종료 정산·종료 현황·종료 기록·끊김), `screens-entry.png`(입장·종료 방 입장·방 만들기 오류·잠금).
- 대조 결과와 RV-2 판단은 `docs/plans/web/g4-evidence.md` §15.2.
