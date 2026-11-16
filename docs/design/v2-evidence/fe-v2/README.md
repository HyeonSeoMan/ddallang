# FE-V2 브라우저 측정 증거 (375px, RK-F14·RK-F20)

- 대상 리비전: `003c778`(FE-V2 구현 + Claude 검수 반영). 측정 2026-11-16, Google Chrome 157.0.8103.51(헤드리스 `--headless=new`), macOS.
- 측정한 사람: 구현자(Claude). 독립 검수자(Codex)는 read-only 샌드박스라 Chrome을 띄울 수 없어 직접 재현하지 못했다. 이 폴더는 그 대신 방법·원자료·캡처를 남긴다.

## 방법

1. **렌더링**: 앱의 시험 도우미(`renderApp`, `seedRoom`)로 시드 상태의 방 화면(`RoomShell` + 페이지)을 그려 HTML 조각으로 저장한다. 스크립트는 `render.test.tsx.txt`다. Vite가 저장소 밖 파일을 불러오지 못해 실행할 때만 `apps/web/src/zz-v2render.test.tsx`로 복사해 `pnpm exec vitest run src/zz-v2render.test.tsx`로 돌리고 바로 지웠다(커밋에 없음).
   - 화면 9개: 현황·기록·정산·방·종료(최종 정산)·끊김, 최대 경우 3종(현황·정산·방).
   - 최대 경우: 단위 `가나다라마바사아자차카타`(12자), 금액 `±999,999,999,999`(N = 29), 이름 `Abcdefghijkl`·`Mnopqrstuvwx`(12자 영문)·12자 한글, 사유 50자, 라운드 12자, 방 이름 14자.
2. **CSS·글꼴**: `pnpm panda cssgen`의 생성 CSS 전체와 `src/fonts/PretendardVariable.woff2`를 붙인다(`wrap.py`).
3. **폭 375px**: 헤드리스 Chrome의 최소 창 폭이 500px이라 `width: 375px; overflow: auto`인 스크롤 컨테이너(`#vp`)를 화면으로 쓴다. 앱 CSS는 `vw`·미디어 쿼리를 쓰지 않고 `max-width: 28rem`(448px)이라 컨테이너 폭이 곧 레이아웃 폭이다.
4. **측정 스크립트**(`wrap.py` 안): 글꼴 로딩 뒤 (a) 컨테이너 `scrollWidth`와 `clientWidth`, (b) `overflow-x`가 visible이 아닌 요소 중 넘친 것, (c) 줄바꿈 금지(`white-space: nowrap`) 금액 요소마다 글자 크기·폭과, 가장 가까운 흰 카드 안쪽(좌우 20px) 안에 드는지(`fits`)를 JSON으로 낸다.

## 결과 (`measure-375.jsonl`, 화면당 한 줄)

| 화면 | scrollWidth / clientWidth | 넘친 요소 | 금액 |
| --- | --- | --- | --- |
| 9개 모두 | 375 / 375 | 0 | 모두 `fits: true` |
| 최대 경우 현황 | 375 / 375 | 0 | N = 29 → 13px, 폭 259.5px(카드 안 303px 이내), 이름 칸 120px와 한 줄에 들지 않아 이름 아래 줄 오른쪽 |
| 최대 경우 정산 | 375 / 375 | 0 | N = 28 → 13px, 251.0px |

## 헤더 경계 (RK-F20, `rkf20-header-boundary.png`)

현황 화면을 175px 스크롤해 흰 카드가 헤더 아래를 지나게 하고, 왼쪽은 헤더 아래 구분선을 지운 것(`border-bottom-color: transparent`), 오른쪽은 구현 그대로(`divider` 1px)다. 구분선이 없으면 흰 헤더와 흰 카드가 이어져 경계가 사라진다. 그래서 RK-F20의 대체안대로 장식 구분선 `divider` 1px를 둔다.

## 캡처

- `screens-a.png`: 현황·기록·정산, `screens-b.png`: 방·끊김·최대 경우 현황(각 375×812).
- 캡처 맨 위의 `연결 중` 띠는 시드가 연결 단계 원자(`connectionPhaseAtom`)를 `connected`로 바꾸지 않아 보이는 것이다. 실제 앱은 연결되면 띠가 없다. 측정 결과에는 영향이 없다(띠가 있어도 넘침 0).

## 하지 못한 것

실기기, Safari, Firefox, VoiceOver, 실서버 연결 화면. FE-V4에서 다시 기록한다.
