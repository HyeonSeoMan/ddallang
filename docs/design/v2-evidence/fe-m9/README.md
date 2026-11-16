# FE-M9 2.0.0 새 상태 화면 점검 (375px, 모의 서버·시드)

- 대상 리비전: 앱 코드 `232c567`. 2026-11-16, Google Chrome 157.0.8103.51 헤드리스, macOS.
- 방법은 `../fe-v4/README.md`와 같다. 시드 렌더와 생성 CSS, Pretendard를 375px 스크롤 컨테이너에 넣고 `../fe-v4/wrap.py`로 감싼다. 이번에 달라진 점은 다음과 같다.
  - 확인 대화상자가 포털이라 `document.body` 전체를 저장했다. 그래서 측정 결과에 알림 영역(`aria-live`)의 빈 span 2개가 `fits: false`로 잡힌다. 이 span은 너비 0이고 측정 대상이 아니다.
  - 창 크기를 375×812로 직접 찍었다. 잘라 내지 않는다.
  - 초대 화면은 모의 서버(MSW) 응답으로 각 단계까지 진행시켰다. 방 화면은 시드 상태다.
- 명령(앱은 `apps/web`, 출력 폴더 `$OUT`):
  - 렌더: `cp render.test.tsx.txt apps/web/src/zz-m9render.test.tsx && M9_OUT=$OUT pnpm exec vitest run src/zz-m9render.test.tsx; rm apps/web/src/zz-m9render.test.tsx`
  - CSS·감싸기: `pnpm panda cssgen --outfile $OUT/app.css`, 글꼴 복사, `python3 ../fe-v4/wrap.py $OUT`
  - 측정: `chrome --headless=new --allow-file-access-from-files --virtual-time-budget=5000 --window-size=500,900 --dump-dom file://$OUT/<이름>-375.html`
  - 캡처: `--window-size=375,812 --hide-scrollbars --screenshot=<이름>.png`
- 배포 DB와 실서버에는 요청하지 않았다.

## 결과

`measure-375.jsonl`: 화면 14개 모두 `scrollWidth = clientWidth = 375`, 넘친 요소 0.

| 캡처 | 상태 | 확인한 것 |
| --- | --- | --- |
| `choose.png` | 신원 없음, 진행 중 | `새로 입장하기`·`기존 참여자 이어받기`가 같은 크기다(FE-C1). 이어받기 안내가 있다. 후보 닉네임은 보이지 않는다 |
| `choose-ended.png` | 신원 없음, 종료된 방 | `게임이 종료되어 새로 입장할 수 없습니다.`와 이어받기만 있다 |
| `nickname-taken.png` | 입장 거부 `NICKNAME_TAKEN` | 서버 안내(error 띠), `기존 참여자라면 이어받기를 요청하세요.`, `이어받기로 가기`가 있고 닉네임이 유지된다. 신원 키 안내는 2.0.0 문구다 |
| `candidates.png` | 후보 선택 | 방장을 뺀 후보(나래·다온), 신원 키 안내, `뒤로` |
| `claim-confirm.png` | 이어받기 확인(아래 시트) | 제목 `다온으로 이어받을까요?`, 본문, `취소`·`요청` |
| `waiting.png` | 승인 대기 | 제목과 본문(`나래로 이어받기를 요청했습니다…`), `요청 취소`가 있다. 방 정보는 없다(AC-ROOM-009-1) |
| `result-rejected.png` | 결과 안내 `TARGET_CLAIMED` | info 띠의 사유 문구, 선택 화면 |
| `access-lost.png` | 접근 상실(진행 중) | warning 띠(진행 중 문구), 신원 없음 선택 |
| `unconfirmed.png` | 이어받기 요청 결과 불명 + 재조회 실패 | `결과를 확인하지 못했습니다.`, `다시 확인` |
| `host-room-claims.png` | 방장 방 페이지, 대기 3건 | 방 탭 숫자 배지 `3`, `이어받기 요청` 구역이 참여자 구역 위에 있다. 같은 참여자 2건 안내, 행마다 `승인`·`거절` |
| `host-room-claims-ended.png` | 종료된 방의 방장 | 이어받기 컨트롤이 남는다 |
| `inactive-record.png` | 비활성 본인의 기록 | info 띠 `비활성 참여자라 조회만 할 수 있습니다…`, 입력과 저장이 비활성화된다 |
| `inactive-status.png` | 비활성 본인의 현황 | 수정·삭제와 `거래 기록하기`가 없다. 시드 값 때문에 누적 손익에 비활성 배지가 반영되지 않았다(시드 한계) |
| `status-authors.png` | 현황 | 거래 행 메타에 `작성자 가온`이 있다. 하단 고정 버튼은 스크롤 컨테이너 안이라 위치가 어긋나 보인다(FE-V4와 같은 한계) |

## 하지 않은 것

- 실서버에 연결된 화면. 상태 전환 애니메이션·포커스 이동은 컴포넌트 시험으로만 확인했다.
- 실기기, Safari, Firefox, VoiceOver.
- 하위 상태: 취소 중, 취소 확인 중, 요청 중의 대화상자 비활성, 방장 구역의 처리 결과 안내와 `안내 닫기`.
