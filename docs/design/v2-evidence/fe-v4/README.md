# FE-V4 상태별 화면 점검 증거 (375px)

- 대상 리비전: 앱 코드 `9005b6b`. 2026-11-16, Google Chrome 157.0.8103.51 헤드리스, macOS.
- 방법: `../fe-v2/README.md`와 같다(시드 렌더 + 생성 CSS + Pretendard, 375px 스크롤 컨테이너). 이번에 더한 것:
  - 입장 화면(진행 중·종료): 모의 서버(MSW) `GET /invites/:code` 응답으로 닉네임 단계까지 렌더.
  - 방 만들기 오류: 모의 서버가 `unit`을 `INVALID_CHARACTER`로 거부. 잠금: 네트워크 오류로 결과 불명(`칩` 선택 상태).
  - 종료된 방의 현황·기록, 끊김(`reconnecting`) 화면.
  - 라디오 `checked`는 DOM 속성이라 HTML 저장 전에 속성(attribute)으로 옮긴다(`render.test.tsx.txt`).
  - 하단 고정 `거래 기록하기`는 컨테이너가 아니라 뷰포트 기준이라 375×812 iframe으로 따로 캡처했다(`fixed-record-button-375.png`).
- 배포 DB·실서버에는 요청하지 않았다.

## 결과

- `measure-375.jsonl`: 화면 15개 모두 `scrollWidth = clientWidth = 375`, 넘친 요소 0, 금액 `fits: true`.
- 캡처: `screens-progress.png`(현황·기록·정산·방), `screens-ended-offline.png`(종료 정산·종료 현황·종료 기록·끊김), `screens-entry.png`(입장·종료 방 입장·방 만들기 오류·잠금).
- 대조 결과와 RV-2 판단은 `docs/plans/web/g4-evidence.md` §15.2.
