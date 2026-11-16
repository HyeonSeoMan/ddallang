# FE-V5 증거 (지급자·수취자·참여자 필터 칩, 375px)

- 2026-11-16, Google Chrome 157.0.8103.51 헤드리스, macOS. 방법은 `../fe-v4/README.md`와 같다(시드 렌더 + 생성 CSS + Pretendard, 375px 스크롤 컨테이너, 배포 DB 미사용).
- 더한 화면: 기록(기본 참여자 2명), 기록 최대 경우(12자 영문 이름·12자 한글 단위), 참여자 10명(12~13자 영문·한글 이름)의 기록·현황(필터 칩).
- 결과(`measure-375.jsonl`): 화면 18개 모두 `scrollWidth = clientWidth = 375`, 넘친 요소 0, 금액 `fits: true`. 칩 묶음은 줄을 바꿔 감싸며 가로 스크롤이 없다(`chips-375.png`: 기록·최대 경우 기록·10명 기록·10명 현황 필터).
- 하지 못한 것: 실기기, Safari·Firefox(`:has()`), VoiceOver의 칩 묶음(`fieldset`) 낭독.

## 실서버 연동 시험 (사용자 승인: "배포 db 써도됩니다", 2026-11-16)

- 명령: `INTEGRATION_API_BASE_URL=https://ddallang-api.onrender.com pnpm test:integration`(앱 코드 `234c3a9`). 배포 백엔드는 잠들어 있어 먼저 깨웠다(첫 응답 약 65초).
- 결과: **1파일 7개 통과(exit 0)**, 192초. 칩으로 바꾼 지급자·수취자를 실제 화면 클라이언트(jsdom `InviteScreen`)에서 고르고 저장했고, 다른 접속자의 거래 입력 칩에 새 참여자가 나타나고 비활성화하면 빠지는 것(`selectableNames`, Codex Y19-01로 칩 조회로 고침)을 실서버에서 확인했다.
- **배포 DB에 시험 방·참여자·거래가 남았다**(시험이 만든 것, 삭제하지 않았다).
