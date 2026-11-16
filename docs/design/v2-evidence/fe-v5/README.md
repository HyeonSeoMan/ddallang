# FE-V5 증거 (지급자·수취자·참여자 필터 칩, 375px)

- 2026-11-16, Google Chrome 157.0.8103.51 헤드리스, macOS. 방법은 `../fe-v4/README.md`와 같다(시드 렌더 + 생성 CSS + Pretendard, 375px 스크롤 컨테이너, 배포 DB 미사용).
- 더한 화면: 기록(기본 참여자 2명), 기록 최대 경우(12자 영문 이름·12자 한글 단위), 참여자 10명(12~13자 영문·한글 이름)의 기록·현황(필터 칩).
- 결과(`measure-375.jsonl`): 화면 18개 모두 `scrollWidth = clientWidth = 375`, 넘친 요소 0, 금액 `fits: true`. 칩 묶음은 줄을 바꿔 감싸며 가로 스크롤이 없다(`chips-375.png`: 기록·최대 경우 기록·10명 기록·10명 현황 필터).
- 하지 못한 것: 실기기, Safari·Firefox(`:has()`), VoiceOver의 칩 묶음(`fieldset`) 낭독.
