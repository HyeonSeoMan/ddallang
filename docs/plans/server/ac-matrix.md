# 백엔드 AC 매핑표 (`ddallang-server`)

- 문서 버전: 0.1.4 (**초안, Codex G3 검수 3/3 대기**). 짝 문서: `plan.md`(§8 검증 전략), `tasks.md`
- **기준은 각 Spec의 §11 추적표**다. 이 표는 그 표(AC, 담당 절, 검증 방법)에서 만든 파생물이며 AC 의미를 바꾸지 않는다. 표와 Spec이 다르면 Spec이 우선하고 이 표를 고친다.
- 대상: S1 82개, S2 53개, S3 25개, S5 26개, S4 39개 = 225개 행(PRD의 AC 225개와 일치, 각 AC는 담당 Spec의 §11에 한 번씩 있다)
- 구분: **BE** 서버가 자동 시험으로 증명, **BE+FE** 서버(API)와 화면(UI) 양쪽, **FE** 화면만(프론트엔드 Plan이 맡음, 이 표에서는 완전성을 위해 나열), **참조** 다른 Spec이 계약을 정의하거나 해당 없음
- 구분 합계: BE 146, BE+FE 42, FE 34, 참조 3
- 규칙: BE·BE+FE·참조 행의 AC는 `BE-F8` 검사 스크립트가 `[AC-…]` 태그가 달린 시험의 존재를 확인한다(참조 행은 계약을 정의한 Spec 쪽 시험으로 확인). 공통 AC(예: 동시성)는 해당 Spec의 동시성 시험 Task가 함께 맡는다.
- "검증" 열은 Spec §11의 서술을 줄여 옮긴 것이다(150자 초과는 생략 표시).

| AC | Spec | 구분 | 담당 Task | Spec §11 검증 |
| --- | --- | --- | --- | --- |
| AC-ROOM-001-1 | S1 | BE+FE | BE-S1-2 (+프론트엔드 Plan) | API: 유효 입력 → 201, `IN_PROGRESS`, 초대 코드, `me`. UI: 신원 키 저장 |
| AC-ROOM-001-2 | S1 | BE | BE-S1-2 | API: 빈 `name` → 422 `REQUIRED`, 방 없음 |
| AC-ROOM-001-3 | S1 | BE | BE-S1-2 | API: 길이 1·12 허용, 0·13 거부 |
| AC-ROOM-001-4 | S1 | BE | BE-S1-2 | API: "Friday 7" 허용. 앞뒤 공백·특수문자·이모지 거부, 공백 자동 제거 없음 |
| AC-ROOM-001-5 | S1 | BE | BE-S1-2 | API: 같은 이름 방 2개 생성 성공 |
| AC-ROOM-001-6 | S1 | BE | BE-S1-2 | API: `unit` 누락 → 422, 방 없음 |
| AC-ROOM-001-7 | S1 | BE | BE-S1-2 | API: 생성 직후 방장 1명, 생성자 RoomMember |
| AC-ROOM-001-8 | S1 | BE | BE-S1-2 | API: 클라이언트 검증 우회 요청 거부 (001-2~4, 10, 13 변형 전체) |
| AC-ROOM-001-9 | S1 | BE | BE-S1-2 | API: `nickname` 누락·규칙 위반 → 방 없음. 유효하면 방장 닉네임이 됨 |
| AC-ROOM-001-10 | S1 | BE | BE-S1-2 | API: "Friday  7" 거부 (`CONSECUTIVE_SPACES`) |
| AC-ROOM-001-11 | S1 | BE | BE-S1-2 | API: 조합형·분해형 한글 이름이 같은 길이로 판정 |
| AC-ROOM-001-12 | S1 | FE | 프론트엔드 Plan | UI: 정산 단위 목록(`원`,`점수`,`칩`) 선택 가능 |
| AC-ROOM-001-13 | S1 | BE+FE | BE-S1-2 (+프론트엔드 Plan) | UI: 정산 단위 직접 입력 필드 제공. API: "포인트", "Chip 10" 허용. 길이 0·13, 앞뒤·연속 공백, 특수문자, 이모지 거부. 우회 요청 포함 |
| AC-ROOM-001-14 | S1 | BE+FE | BE-S1-2 (+프론트엔드 Plan) | API: 저장된 `unit` 반환. 표시·복사 반영은 S3·S4와 함께 통합 확인 |
| AC-ROOM-002-1 | S1 | BE | BE-S1-3 | API: 유효 코드+닉네임 → 201, 가입·비밀번호 없음 |
| AC-ROOM-002-2 | S1 | BE+FE | BE-S1-3 (+프론트엔드 Plan) | API: 방 코드 입장 경로 없음. UI: 입력 화면 없음 |
| AC-ROOM-002-3 | S1 | FE | 프론트엔드 Plan | UI: 최근 방 목록 화면 없음 |
| AC-ROOM-002-4 | S1 | BE+FE | BE-S1-3 (+프론트엔드 Plan) | API: 없는·잘못된 코드 → 404 `INVITE_NOT_FOUND`. UI: 오류 표시 |
| AC-ROOM-002-5 | S1 | BE | BE-S1-3 | API: `ENDED` 방에서 조회·입장 성공, 참여자 변경 `GAME_ENDED`. 통합: 종료 후 입장자가 거래 변경 불가(S2) |
| AC-ROOM-003-1 | S1 | FE | 프론트엔드 Plan | UI: 변경 UI 없음 |
| AC-ROOM-003-2 | S1 | BE | BE-S1-6 | API: 방장·비방장, `IN_PROGRESS`·`ENDED` 모든 조합에서 `PATCH`/`PUT`/`DELETE /rooms/{id}` → 405 `NOT_SUPPORTED` |
| AC-ROOM-003-3 | S1 | BE+FE | BE-S1-2 (+프론트엔드 Plan: 표시) | 통합: 금액·정산이 방 단위로만 표시, 환산 없음 |
| AC-ROOM-004-1 | S1 | BE | BE-S2-2 | 통합: 참여자와 무관한 RoomMember가 거래 등록 |
| AC-ROOM-004-2 | S1 | BE | BE-S2-2 | 통합: 접속자 없는 참여자가 거래 당사자가 됨 |
| AC-ROOM-004-3 | S1 | BE | BE-S1-6 | API: 입장 후 참여자 수 불변 |
| AC-ROOM-004-4 | S1 | BE | BE-S1-6 | API: 참여자 등록 후 RoomMember 수 불변 |
| AC-ROOM-004-5 | S1 | BE+FE | BE-S1-6 (+프론트엔드 Plan) | API: 연결·해제 경로 없음. UI: 컨트롤 없음 |
| AC-ROOM-005-1 | S1 | BE+FE | BE-S1-3 (+프론트엔드 Plan) | API: `GET /invites`가 `isMember=true`, 같은 키 재입장 → 200 같은 `me.id`. UI: 닉네임 재입력 없음 |
| AC-ROOM-005-2 | S1 | BE | BE-S2-3, BE-S2-4 | 통합: 복원된 멤버가 이전 작성 거래를 수정·삭제 |
| AC-ROOM-005-3 | S1 | BE | BE-S1-3 | API: 새 키로 입장 → 새 RoomMember, 이전 거래 작성자 아님 |
| AC-ROOM-005-4 | S1 | BE | BE-S1-3 | API: 새 키 이전 방장 → `isHost = false` |
| AC-ROOM-005-5 | S1 | BE | BE-S1-3 | API: 다른 키 → 새 RoomMember |
| AC-ROOM-005-6 | S1 | BE | BE-S1-3 | API: 방장 키 재입장 → 같은 방장 |
| AC-ROOM-005-7 | S1 | BE | BE-S1-3 | API: 방장 키 소실 후 누구도 방장이 되지 않음. 종료 불가는 수용 |
| AC-ROOM-006-1 | S1 | BE | BE-F5, BE-S1-3, BE-S1-5 | API: 길이 1·12 허용, 0·13 거부 (두 유형). 코드 포인트 기준 |
| AC-ROOM-006-2 | S1 | BE | BE-F5, BE-S1-3, BE-S1-5 | API: 한글 음절·단독 자모("ㅋㅋ"), 영문, 숫자, "Kim Min" 허용 |
| AC-ROOM-006-3 | S1 | BE | BE-F5, BE-S1-3, BE-S1-5 | API: 앞뒤 공백 거부, 제거되지 않음 |
| AC-ROOM-006-4 | S1 | BE | BE-F5, BE-S1-3, BE-S1-5 | API: `!` `_` `-`, 이모지, U+3164, 미결합 조합용 자모 거부 |
| AC-ROOM-006-5 | S1 | BE | BE-F5, BE-S1-3, BE-S1-5 | API: "Kim" 사용 중 → "kim", "KIM" 거부 (유형별) |
| AC-ROOM-006-6 | S1 | BE | BE-F5, BE-S1-3, BE-S1-5 | API: RoomMember "Kim"과 Participant "Kim" 공존 |
| AC-ROOM-006-7 | S1 | BE | BE-F5, BE-S1-3, BE-S1-5 | API: 다른 방에서 같은 닉네임 허용 |
| AC-ROOM-006-8 | S1 | BE+FE | BE-S1-5, BE-S1-6 (+프론트엔드 Plan) | API: 닉네임 변경 시도(`PATCH` `nickname`, RoomMember 수정) 거부, UI 없음 |
| AC-ROOM-006-9 | S1 | BE | BE-F5, BE-S1-3, BE-S1-5 | API: 우회 요청 거부 |
| AC-ROOM-006-10 | S1 | BE | BE-F5, BE-S1-3, BE-S1-5 | API: 비활성 참여자와 대소문자 무시 같은 닉네임 → 409 |
| AC-ROOM-006-11 | S1 | BE+FE | BE-S1-7, BE-F5, BE-S1-3, BE-S1-5 (+프론트엔드 Plan) | 동시성: 같은 닉네임 N개 동시 → 성공 1. 같은 키 동시 입장 → 한 명(나머지 200 복원). UI: 같은 브라우저 두 탭 동시 첫 입장 → 키 하나, 한 명 |
| AC-ROOM-006-12 | S1 | BE | BE-F5, BE-S1-3, BE-S1-5 | API: "Kim  Min" 거부 |
| AC-ROOM-006-13 | S1 | BE | BE-F5, BE-S1-3, BE-S1-5 | API: 조합형·분해형 한글이 NFC 후 같은 값·같은 길이, 서로 중복. 호환 자모와 조합용 자모는 서로 다른 값 |
| AC-ROOM-007-1 | S1 | BE | BE-S1-6 | API: 새 입장자 `isHost = false`. 방장 복원은 005-6 |
| AC-ROOM-007-2 | S1 | BE | BE-S1-6 | API: 비방장의 참여자 추가·상태 변경 → 403 `HOST_ONLY`. 통합: 타인 거래 수정, 종료 |
| AC-ROOM-007-3 | S1 | BE | BE-S1-6 | API: 이전·퇴장·재발급 경로 없음 → 404 `ROUTE_NOT_FOUND` |
| AC-ROOM-008-1 | S1 | BE+FE | BE-S1-3, BE-S1-5 (+프론트엔드 Plan) | API: 10번째 성공, 11번째 409. UI: 닉네임 유지·초과 안내 |
| AC-ROOM-008-2 | S1 | BE+FE | BE-S1-3, BE-S1-5 (+프론트엔드 Plan) | API: 11번째 참여자 409. UI: 닉네임 유지 |
| AC-ROOM-008-3 | S1 | 참조 | BE-S2-6 (S2 계약, S1은 참조) | 거래 1,001번째 새 생성 요청 거부, 거래 한도 초과 안내, 입력값 유지(UI). S2 Spec이 계약·화면 동작을 정의 |
| AC-ROOM-008-4 | S1 | BE | BE-S1-3, BE-S1-5 | API: RoomMember·Participant 한도 거부 후 데이터 불변 |
| AC-ROOM-008-5 | S1 | BE | BE-S1-7, BE-S1-3, BE-S1-5 | 동시성: 마지막 슬롯에 입장 N개·등록 N개 → 슬롯 소비 1 |
| AC-ROOM-008-6 | S1 | BE | BE-S1-3, BE-S1-5 | API: 비활성·소실 신원이 한도에 포함 |
| AC-ROOM-008-7 | S1 | BE | BE-S1-3, BE-S1-5 | API: 10명 중 1명 비활성화 후 11번째 거부 |
| AC-ROOM-008-8 | S1 | BE | BE-S1-3, BE-S1-5 | API: 비접속 RoomMember도 한도에 포함 |
| AC-ROOM-008-9 | S1 | 참조 | BE-S2-6 (S2 계약, S1은 참조) | 삭제된 거래 포함 1,000건 |
| AC-ROOM-008-10 | S1 | 참조 | BE-S2-6 (S2 계약, S1은 참조) | 마지막 슬롯 성공 후 같은 키 재전송 |
| AC-ROOM-008-11 | S1 | BE | BE-S1-3, BE-S1-5 | API: 10명 방에서 기존 신원 재접속 성공 |
| AC-PART-001-1 | S1 | BE | BE-S1-5 | API: 방장 등록 → `ACTIVE` |
| AC-PART-001-2 | S1 | BE | BE-S1-5 | API: `IN_PROGRESS` 중 추가 성공 |
| AC-PART-001-3 | S1 | BE | BE-S1-5 | API: 비방장 → 403 `HOST_ONLY` |
| AC-PART-001-4 | S1 | BE | BE-S1-5 | API: `order` 부여, 이후 불변 |
| AC-PART-001-5 | S1 | BE | BE-S1-7, BE-S1-5 | 동시성: 서로 다른 닉네임 동시 등록 → `order` 모두 다르고, `order`가 서버 처리 순서(저장 순서)와 일치 |
| AC-PART-001-6 | S1 | BE+FE | BE-S1-5 (+프론트엔드 Plan) | API: 재등록 → 409 `NICKNAME_TAKEN`. UI: 목록 재조회 후 같은 닉네임(대소문자 무시)이 있으면 "이미 등록되어 있습니다"로 안내하되 유실된 요청의 성공을 단정하는 문구("등록되었습니다" 등)를 쓰지 않음 |
| AC-PART-002-1 | S1 | BE | BE-S1-5 | API: 비활성화·재활성화 |
| AC-PART-002-2 | S1 | BE | BE-S3-1 | API: 전후 과거 거래·손익 불변 (손익 산출은 S3) |
| AC-PART-002-3 | S1 | BE+FE | BE-S2-2 (+프론트엔드 Plan) | 통합: 비활성 참여자 지정 신규 거래 서버 거부. UI: 선택지 제외 |
| AC-PART-002-4 | S1 | BE+FE | BE-S2-2 (+프론트엔드 Plan) | 통합: 재활성화 후 거래 당사자 가능 |
| AC-PART-002-5 | S1 | BE | BE-S1-5 | API: 비방장 → 403 |
| AC-PART-002-6 | S1 | BE | BE-S3-1, BE-S4-2 | 통합: 비활성 참여자 손익이 목록·정산에 포함 |
| AC-PART-002-7 | S1 | BE | BE-S2-3 | 통합: 비활성 참여자 포함 거래 수정 가능 |
| AC-PART-002-8 | S1 | BE | BE-S2-6 | 동시성: 비활성화와 거래 생성 동시 도착 → 처리 시점 상태 |
| AC-PART-002-9 | S1 | BE | BE-S1-5 | API: 상태 변경 후 `order` 불변 |
| AC-PART-003-1 | S1 | BE+FE | BE-S1-6 (+프론트엔드 Plan) | API: 이름 변경 경로·필드 없음. UI: 없음 |
| AC-PART-003-2 | S1 | BE | BE-S1-6 | API: 거래 일괄 이전 경로 없음 |
| AC-PART-003-3 | S1 | BE | BE-S1-6 | API: 비활성화 후 다른 닉네임 새 참여자 등록 성공 |
| AC-PART-004-1 | S1 | BE | BE-S4-5 | API: `ENDED`에서 등록 → 409 `GAME_ENDED` |
| AC-PART-004-2 | S1 | BE | BE-S4-5 | API: `ENDED`에서 상태 변경 → 409 |
| AC-PART-004-3 | S1 | FE | 프론트엔드 Plan | UI: 종료 후 컨트롤 숨김/비활성 |
| AC-TXN-001-1 | S2 | BE | BE-S2-2 | API: 유효 입력 → 201 |
| AC-TXN-001-2 | S2 | BE | BE-S2-2 | API: 사유·라운드 없이 → 201, 둘 다 `null` |
| AC-TXN-001-3 | S2 | BE+FE | BE-S2-2 (+프론트엔드 Plan) | API: 지급자·수취자·금액 누락 → 422 `REQUIRED`, 거래 없음. UI: 입력 유지 |
| AC-TXN-001-4 | S2 | BE | BE-S2-2 | API: `authorId`가 요청자, `createdAt`이 서버 시각 |
| AC-TXN-001-5 | S2 | BE+FE | BE-S2-2 (+프론트엔드 Plan) | API: 일괄 경로 없음(404), 본문 배열 거부. UI: 일괄 입력 없음 |
| AC-TXN-001-6 | S2 | BE+FE | BE-S2-2 (+프론트엔드 Plan) | API: 사유 50·라운드 12 허용, 51·13 거부, 수정에도 동일. 줄바꿈·탭·제어·제로폭 문자, 앞뒤 공백 거부, 내부 공백·이모지·기호 허용, 서버 trim 없음. UI: 입력 유지 |
| AC-TXN-002-1 | S2 | BE | BE-S2-2, BE-S2-3 | API: 1, 999,999,999 허용 |
| AC-TXN-002-2 | S2 | BE | BE-S2-2, BE-S2-3 | API: 0, -1, 1.5, "abc", "100", 1,000,000,000 거부 |
| AC-TXN-002-3 | S2 | BE | BE-S2-2, BE-S2-3 | API: 지급자 = 수취자 → 422 `SAME_AS_PAYER` |
| AC-TXN-002-4 | S2 | BE | BE-S2-2, BE-S2-3 | API: 생성·수정 모두 거부 |
| AC-TXN-002-5 | S2 | BE | BE-S2-2, BE-S2-3 | API: 단위 `원`·`점수`·`칩`에서 같은 상한 |
| AC-TXN-003-1 | S2 | BE | BE-S2-2 | API: 비방장 멤버 생성 → 201 |
| AC-TXN-003-2 | S2 | BE | BE-S2-2 | API: 비멤버·키 없음 → 404/401, 거래 없음 |
| AC-TXN-003-3 | S2 | BE | BE-S2-2 | API: 본문 `authorId` → 422 `NOT_ALLOWED_FIELD`. 작성자는 요청자 |
| AC-TXN-004-1 | S2 | BE | BE-S2-3, BE-S2-4 | API: 작성자 수정·삭제 성공 |
| AC-TXN-004-2 | S2 | BE | BE-S2-3, BE-S2-4 | API: 방장이 타인 거래 수정·삭제 성공 |
| AC-TXN-004-3 | S2 | BE | BE-S2-3, BE-S2-4 | API: 제3의 멤버 → 403 `NOT_AUTHOR_OR_HOST`, 데이터 불변 |
| AC-TXN-004-4 | S2 | BE | BE-S2-3, BE-S2-4 | API: UI 우회 요청도 서버가 판정 |
| AC-TXN-005-1 | S2 | FE | 프론트엔드 Plan | UI: 확인 대화상자 없이 저장 |
| AC-TXN-005-2 | S2 | FE | 프론트엔드 Plan | UI: 삭제 확인 전 요청 없음, 취소 시 불변 |
| AC-TXN-005-3 | S2 | BE | BE-S3-1, BE-S3-2, BE-S4-2 | API: 삭제 후 목록·손익·정산에서 제외. 통합 |
| AC-TXN-005-4 | S2 | BE | BE-S2-3, BE-S2-4 | API/DB: 삭제 후 행·원본 값·작성자 보존, 조회 경로 없음 |
| AC-TXN-005-5 | S2 | BE | BE-S3-1, BE-S4-2 | 통합: 수정 후 손익·정산이 새 금액 기준. 반영 지연 수치는 OQ-019 |
| AC-TXN-005-6 | S2 | BE+FE | BE-S2-3, BE-S2-4 (+프론트엔드 Plan) | API: 수정 본문에 `payerId`·`payeeId`·`id`·`authorId`·`createdAt` → 422, 불변. UI: 입력 없음 |
| AC-TXN-005-7 | S2 | BE | BE-S2-3, BE-S2-4 | API: 삭제 후 올바른 당사자로 새 거래, 새 `id`·`createdAt` |
| AC-TXN-005-8 | S2 | BE | BE-S2-3, BE-S2-4 | API: 새 키의 반복 삭제 → 409 `TRANSACTION_DELETED`, 손익 불변 |
| AC-TXN-006-1 | S2 | BE | BE-S2-6, BE-S2-3, BE-S2-6 | 동시성: 동시 수정 → 나중에 성공한 값이 최종값 |
| AC-TXN-006-2 | S2 | BE | BE-S2-3, BE-S2-6 | API: 삭제된 거래 수정(새 키) → 409 `TRANSACTION_DELETED` |
| AC-TXN-006-3 | S2 | BE | BE-S3-1 | 속성 기반: 동시 수정 후 손익 합 0 |
| AC-TXN-006-4 | S2 | BE | BE-S2-6, BE-S2-3, BE-S2-6 | 동시성: 수정·삭제 동시 → 일관된 하나의 결과 |
| AC-TXN-007-1 | S2 | FE | 프론트엔드 Plan | UI: 진행 중 저장 컨트롤 비활성 |
| AC-TXN-007-2 | S2 | BE | BE-S2-6, BE-F6, BE-S2-5 | API/동시성: 같은 키·내용 N회 → 거래 1건, 같은 결과. 영구 거부는 같은 거부 결과. 수정·삭제도 1회 부작용 |
| AC-TXN-007-3 | S2 | BE | BE-F6, BE-S2-5 | API: 내용 같고 키 다른 두 요청 → 2건 |
| AC-TXN-007-4 | S2 | BE | BE-F6, BE-S2-5 | API: 기록된 키로 다른 내용 → 409 `IDEMPOTENCY_CONFLICT`, 불변. 만료 후엔 만료 우선 |
| AC-TXN-007-5 | S2 | BE+FE | BE-F6, BE-S2-5 (+프론트엔드 Plan) | API: 응답 유실 후 같은 키 재시도 → 1건. UI: 같은 키·`firstAttemptAt` 재사용 |
| AC-TXN-007-6 | S2 | FE | 프론트엔드 Plan | UI: 입력 변경 후 새 키 |
| AC-TXN-007-7 | S2 | BE | BE-F6, BE-S2-5 | API: 다른 방·다른 멤버의 같은 키 값은 별개 |
| AC-TXN-007-8 | S2 | BE | BE-F6, BE-S2-5 | API: 성공 후 종료, 같은 키 재전송 → 최초 결과, 1건. 새 키는 거부 |
| AC-TXN-007-9 | S2 | BE | BE-F6, BE-S2-5 | API: 수정·삭제 성공 후 삭제됨·종료됨 상태에서 같은 키 재전송 → 최초 결과, 추가 변경 없음 |
| AC-TXN-007-10 | S2 | BE | BE-F6, BE-S2-5 | API: 영구 거부(삭제됨, 종료, 한도) 후 같은 키 재전송 → 같은 거부, 불변 |
| AC-TXN-007-11 | S2 | BE | BE-F6, BE-S2-5 | API: 기록 없는 키가 종료 뒤 처음 도착 → 거부. 기록 없이 유효 기간 이내면 새 요청 |
| AC-TXN-007-12 | S2 | BE+FE | BE-F6, BE-S2-5 (+프론트엔드 Plan) | API: 24시간 경과 → 409 `IDEMPOTENCY_KEY_EXPIRED`(기록 있을 때와 없을 때, 같은/다른 내용). 23시간에 처리된 요청의 24시간 후 재시도도 만료. 응답에 `serverTime` 포함. 시계 시나리오: 1시간 느림(재시도 23시간)… |
| AC-TXN-007-13 | S2 | BE | BE-F6, BE-S2-5 | API: 비활성 참여자·검증 실패 거부는 기록 없음 → 재활성화 후 같은 키 재전송 성공, 거래 최대 1건 |
| AC-TXN-008-1 | S2 | FE | 프론트엔드 Plan | UI: 서버·네트워크 오류 시 실패 표시, 성공 표시 없음 |
| AC-TXN-008-2 | S2 | FE | 프론트엔드 Plan | UI: 실패 후 입력 유지 |
| AC-TXN-008-3 | S2 | FE | 프론트엔드 Plan | UI: 자동 재전송 없음 |
| AC-TXN-008-4 | S2 | BE | BE-S2-5 | API: 확정 거부는 목록·손익에 반영 안 됨 |
| AC-TXN-008-5 | S2 | BE+FE | BE-S2-5 (+프론트엔드 Plan) | UI/통합: 응답 유실 → 성공 표시 없음, 재조회로 확인, 없으면 확정 불가 유지 |
| AC-TXN-009-1 | S2 | BE | BE-S2-7 | API: 종료 뒤 생성·수정·삭제(새 키) 거부: 권한 있는 요청자·방장은 `GAME_ENDED`, 권한 없는 멤버의 수정·삭제는 `NOT_AUTHOR_OR_HOST`. 어느 경우도 거래 불변 |
| AC-TXN-009-2 | S2 | BE | BE-S2-6, BE-S2-7 | 동시성: 종료 직전 시작 요청이 종료 후 처리되면 거부 |
| AC-TXN-009-3 | S2 | FE | 프론트엔드 Plan | UI: 종료 후 컨트롤 숨김·비활성 |
| AC-TXN-009-4 | S2 | BE+FE | BE-S2-7 (+프론트엔드 Plan) | API: 정정 경로 없음. UI: 없음 |
| AC-TXN-009-5 | S2 | BE | BE-S4-4 | 동시성: 저장·종료 동시 → 직렬 순서대로 판정(앞선 거래는 최종 정산에 포함, 뒤의 거래는 거부). 같은 DB에 서버 인스턴스 2개 이상을 붙여 검증 |
| AC-VIEW-001-1 | S3 | FE | 프론트엔드 Plan | UI: 누적 손익 영역과 거래 내역 영역이 한 화면에서 구분 |
| AC-VIEW-001-2 | S3 | BE+FE | BE-S3-1 (+프론트엔드 Plan) | API: `balances`에 거래 항목 없음, 참여자별 값만. UI: 손익 영역에 거래 항목 없음 |
| AC-VIEW-002-1 | S3 | BE | BE-S3-1 | API: +300, +100, −400 순서 |
| AC-VIEW-002-2 | S3 | BE | BE-S3-1 | API: 같은 순손익은 `order`가 앞선 참여자가 먼저 |
| AC-VIEW-002-3 | S3 | BE | BE-S3-1 | API: 거래 없는 참여자(0)가 포함되고 정렬 위치가 규칙대로 |
| AC-VIEW-003-1 | S3 | BE | BE-S3-2 | API: 나중에 만든 거래가 위 |
| AC-VIEW-003-2 | S3 | BE | BE-S3-3, BE-S3-2 | API/동시성: 같은 `createdAt` 거래는 `seq`가 큰 쪽이 위. 동시 생성에서도 순서가 결정적 |
| AC-VIEW-003-3 | S3 | BE | BE-S3-2 | API: 수정 후 목록 순서 불변 |
| AC-VIEW-003-4 | S3 | BE | BE-S3-2, BE-S3-3 | API/동시성 (a) 기존 거래 순회: 45건 중 첫 20건 조회 뒤 다른 요청이 거래를 생성·수정·삭제해도, 순회 시작 시점의 거래가 중복·누락 없이 한 번씩 나옴(삭제분 제외). 동시 생성 중 낮은 `seq`가 이미 지난 경계 위에 뒤늦게 나타나지 않음. (b… |
| AC-VIEW-003-5 | S3 | BE | BE-S3-2 | API: 삭제된 거래가 목록에 없음 |
| AC-VIEW-003-6 | S3 | BE | BE-S3-3, BE-S3-2 | API/동시성: 방 안 `seq`가 고유·증가하고 수정·삭제·재전송으로 바뀌지 않음, `createdAt`이 감소하지 않음, 서버 인스턴스 2개 이상을 같은 DB에 붙여 동시 생성해도 성립. 응답(재전송 본문 포함)에 `seq`·키·해시가 없고, 커서를 디코딩해도… |
| AC-VIEW-004-1 | S3 | BE | BE-S3-2, BE-S3-3 | API: 유효 거래 45건 → 20, 20, 5건. 삭제 거래는 계산에서 제외 |
| AC-VIEW-004-2 | S3 | BE | BE-S3-2, BE-S3-3 | API: A 필터 → A가 지급자 또는 수취자인 거래만 |
| AC-VIEW-004-3 | S3 | BE+FE | BE-S3-2, BE-S3-3 (+프론트엔드 Plan) | API: `participantId` 2개 → §3.3 표의 `participantId` / `INVALID_VALUE`. UI: 1명만 선택 |
| AC-VIEW-004-4 | S3 | BE | BE-S3-2, BE-S3-3 | API: 필터 적용 상태에서도 20건 단위 |
| AC-VIEW-004-5 | S3 | FE | 프론트엔드 Plan | UI: 해제하면 새 순회로 전체 목록 |
| AC-VIEW-004-6 | S3 | BE | BE-S3-2, BE-S3-3 | API: 비활성 참여자 필터 허용 |
| AC-VIEW-004-7 | S3 | BE | BE-S3-2, BE-S3-3 | API: 필터 요청 전후 `balances`가 같음, `balances`에 쿼리 매개변수는 §3.3 표의 `NOT_ALLOWED_FIELD`. 통합: 예상 정산도 필터와 무관(S4) |
| AC-VIEW-004-8 | S3 | BE+FE | BE-S3-2, BE-S3-3 (+프론트엔드 Plan) | API: 다른 필터의 커서 사용 → §3.3 표의 `cursor` / `INVALID_VALUE`. UI: 필터 변경 시 페이지 폐기 후 새 첫 페이지(새 순회) |
| AC-VIEW-004-9 | S3 | BE | BE-S3-2, BE-S3-3 | API: 삭제 거래가 섞여도 마지막 페이지를 제외하고 모든 페이지가 20건 |
| AC-SET-002-1 | S3 | BE | BE-S3-1 | API: A→B 100 → A −100, B +100 |
| AC-SET-002-2 | S3 | BE | BE-S3-1 | 속성: 무작위 거래 뒤 합 0 |
| AC-SET-002-3 | S3 | BE | BE-S3-1 | API: 삭제 거래 제외 |
| AC-SET-002-4 | S3 | BE | BE-S3-1 | API: 수정 후 값으로 계산 |
| AC-SET-002-5 | S3 | BE | BE-S3-1 | API: 비활성 참여자 포함, 합 0 기여 |
| AC-VIEW-005-1 | S5 | BE+FE | BE-S5-3 (+프론트엔드 Plan) | 통합: A가 거래 등록 → 접속 중 B의 누적 손익·거래 목록이 새로고침 없이 갱신 |
| AC-VIEW-005-2 | S5 | BE+FE | BE-S5-3 (+프론트엔드 Plan) | 통합: 수정·삭제도 B에 반영 |
| AC-VIEW-005-3 | S5 | BE+FE | BE-S5-3 (+프론트엔드 Plan) | 통합: 참여자 등록·상태 변경이 B의 참여자 표시와 거래 입력 선택지에 반영 |
| AC-VIEW-005-4 | S5 | BE+FE | BE-S5-3, BE-S4-3 (+프론트엔드 Plan) | 통합: 종료 → B의 입력·수정·삭제 UI 잠김, 최종 정산 표시. API: 종료 시 `room.ended` 정확히 1회 |
| AC-VIEW-005-5 | S5 | BE+FE | BE-S5-3 (+프론트엔드 Plan) | 통합: 거래 변경으로 예상 정산이 바뀌면 B의 예상 정산 갱신 |
| AC-VIEW-005-6 | S5 | FE | 프론트엔드 Plan | UI: 토스트 없이도 통과 |
| AC-VIEW-005-7 | S5 | FE | 프론트엔드 Plan | UI: 필터 선택 유지, 새 순회로 정렬 규칙대로 교체 |
| AC-VIEW-005-8 | S5 | BE | BE-S5-4, BE-S4-7 | 통합 측정: 이벤트 전달·화면 반영·유실 시 수렴 지연의 95백분위·최댓값 보고 |
| AC-SYS-001-1 | S5 | FE | 프론트엔드 Plan | UI: 네트워크 차단 시 연결 끊김 상태와 오류 안내 |
| AC-SYS-001-2 | S5 | FE | 프론트엔드 Plan | UI: 끊김 중 손익·목록·정산 영역 미표시(이전 값, "최신 아님" 표시 포함 불가) |
| AC-SYS-001-3 | S5 | FE | 프론트엔드 Plan | UI: 끊김 중 거래 등록·수정·삭제·종료 조작 불가, 큐잉 없음 |
| AC-SYS-001-4 | S5 | FE | 프론트엔드 Plan | UI: 차단 영역에 캐시 대체 표시 없음 |
| AC-SYS-001-5 | S5 | FE | 프론트엔드 Plan | UI: 끊김 중 작성하던 입력 유지 |
| AC-SYS-002-1 | S5 | BE+FE | BE-S5-5 (+프론트엔드 Plan) | 통합: 복구 후 손익·목록·참여자·상태·정산 재조회 표시 |
| AC-SYS-002-2 | S5 | FE | 프론트엔드 Plan | UI: 끊김 중 미제출 거래가 복구 시 자동 제출 안 됨 |
| AC-SYS-002-3 | S5 | BE+FE | BE-S5-5 (+프론트엔드 Plan) | 통합: 끊김 중 종료 → 복구 후 종료 상태 반영 |
| AC-SYS-002-4 | S5 | FE | 프론트엔드 Plan | UI: 새로고침·재방문 시 입력 초안 복원 없음 |
| AC-SYS-002-5 | S5 | BE+FE | BE-S5-5 (+프론트엔드 Plan) | 통합: 저장 응답 유실 후 복구 → 재조회로 목록 확인 가능, 자동 재전송 없음, 확인 못 하면 저장 여부 확정 불가 표시, 단정 안 함 |
| AC-SYS-003-1 | S5 | BE | BE-F4, BE-S1-6, BE-S2-7, BE-S3-3, BE-S5-2 | API: 신원 키 없는 SSE 연결 → 401, 거부 |
| AC-SYS-003-2 | S5 | BE | BE-S1-5, BE-S2-7, BE-S4-5, BE-S5-2 | 해당 없음(연결은 상태 변경이 아님). 종료 후에도 연결 가능 |
| AC-SYS-003-3 | S5 | BE | BE-S2-2 | 해당 없음 |
| AC-SYS-003-4 | S5 | BE | BE-S2-2, BE-S2-3, BE-S2-4 | 해당 없음 |
| AC-SYS-003-5 | S5 | BE | BE-F3, BE-S1-6, BE-S2-7, BE-S3-3, BE-S5-2 | API: SSE 연결 거부는 구분 가능한 `code`(401, 404, 405, 422), 데이터 불변 |
| AC-SYS-003-6 | S5 | BE | BE-F4, BE-S1-6, BE-S2-7, BE-S3-3, BE-S5-2 | API: 다른 방 RoomMember가 이 방 SSE에 연결 → 404 `ROOM_NOT_FOUND`, 이벤트 수신 없음 |
| AC-SYS-003-7 | S5 | BE | BE-F4, BE-S1-6, BE-S5-2 | API: 다른 방의 방장 키는 이 방에서 권한 없음(연결 불가) |
| AC-SYS-003-8 | S5 | BE | BE-S2-2, BE-S2-3, BE-S2-4, BE-S3-3 | 해당 없음(쿼리 매개변수는 받지 않음) |
| AC-SET-001-1 | S4 | FE | 프론트엔드 Plan | UI: 방장이 종료를 누르면 확인 절차가 표시되고 확인 뒤에만 요청과 `ENDED`. 취소하면 요청 없음·상태 불변 |
| AC-SET-001-2 | S4 | BE | BE-S4-3 | API: 비방장 종료 → 403 `HOST_ONLY`, 상태·`revision` 불변, 이벤트 없음. 종료된 방에서도 `HOST_ONLY` |
| AC-SET-001-3 | S4 | BE | BE-S4-5 | 통합: 종료 뒤 거래 생성·수정·삭제 → `GAME_ENDED`, 참여자 등록·상태 변경 → `GAME_ENDED` |
| AC-SET-001-4 | S4 | BE | BE-S4-5 | 정적·API: 자동 종료 경로·스케줄러 없음. 시간 경과·무활동 뒤 상태 `IN_PROGRESS` 유지(시간 가속 테스트) |
| AC-SET-001-5 | S4 | BE | BE-S4-5 | API: 재개 경로는 404, 종료 요청 반복으로 상태가 돌아가지 않음 |
| AC-SET-001-6 | S4 | BE | BE-S4-3 | API: 종료된 방에 새 키 종료 → 409 `GAME_ENDED`(`이미 종료된 게임입니다`), 상태·정산·`revision`·이벤트 불변 |
| AC-SET-001-7 | S4 | BE | BE-S4-5 | 정적: 만료·삭제 경로 없음. 보관은 OQ-034 |
| AC-SET-001-8 | S4 | BE | BE-S4-3 | API: 성공 키 재전송 → 같은 성공+`Idempotent-Replayed`, 동시 도착 포함, `room.ended` 1회. `GAME_ENDED` 거부 키 재전송 → 같은 거부. 24시간 경과 → `IDEMPOTENCY_KEY_EXPIRED`·상태 불변 |
| AC-SET-001-9 | S4 | BE | BE-S4-4, BE-S4-3 | 동시성: 같은 방에 종료 N개(같은 키 포함, 다른 키) 동시 → 전이 정확히 1회, `revision` +1, 이벤트 1회, 성공은 전이 요청과 그 같은 키 재전송뿐, 나머지 `GAME_ENDED`. 인스턴스 2개 이상 |
| AC-SET-003-1 | S4 | BE | BE-S4-1 | 단위: A(−300), B(−100), C(+250), D(+150) → A→C 250, B→D 100, A→D 50 |
| AC-SET-003-2 | S4 | BE | BE-S4-1 | 단위: A(−300), B(−200), C(+250), D(+150), E(+100), A 먼저 등록 → A→C 250, B→D 150, A→E 50, B→E 50. 재정렬 없는 방식의 결과(A→C 250, A→D 50, B→D 100, B→E 100)와 다름 |
| AC-SET-003-3 | S4 | BE | BE-S4-1 | 단위: 잔액 동률이면 등록 순서가 빠른 참여자가 먼저(채무자·채권자 양쪽) |
| AC-SET-003-4 | S4 | BE | BE-S4-1 | 속성: 무작위 거래 집합에서 항목 이행 뒤 모든 순손익이 0 |
| AC-SET-003-5 | S4 | BE | BE-S4-1 | 단위·API: 순손익 0인 참여자(거래 없음, 상쇄)가 항목에 없음 |
| AC-SET-003-6 | S4 | BE | BE-S4-1 | 정적: 최소 송금 횟수 검사·보장 없음. 최소가 아닌 사례(순손익 −6, −4, +4, +3, +3은 이 알고리즘이 4건, 최소는 3건)가 결함이 아님을 단위 테스트로 확인 |
| AC-SET-003-7 | S4 | BE | BE-S4-1 | 속성·API: 같은 거래 집합 반복 조회 동일. 거래 생성 순서·ID·시각이 달라도 순손익과 `order`가 같으면 같은 결과 |
| AC-SET-004-1 | S4 | BE | BE-S4-1 | 단위: 250, 100, 50 순서 |
| AC-SET-004-2 | S4 | BE | BE-S4-1 | 단위: 금액 동률은 지급자 `order`, 같으면 수취자 `order` 순 |
| AC-SET-004-3 | S4 | FE | 프론트엔드 Plan | UI: 화면 순서 = 응답 `items` 순서 = 복사 텍스트 순서. 클라이언트 재정렬 없음 |
| AC-SET-004-4 | S4 | BE | BE-S4-1 | 단위: A→E 50·B→E 50 → A→E, B→E. A→D 50·A→E 50(D 먼저 등록) → A→D, A→E |
| AC-SET-005-1 | S4 | BE | BE-S4-2 | API: 종료된 방에서 모든 RoomMember(종료 후 입장자 포함)가 `FINAL` 조회. 비멤버는 404 |
| AC-SET-005-2 | S4 | FE | 프론트엔드 Plan | UI: 복사 버튼 → 클립보드에 일반 텍스트 |
| AC-SET-005-3 | S4 | FE | 프론트엔드 Plan | UI·단위: 방 이름, `게임 종료`, 각 항목의 지급자→수취자·금액, 정산 단위 포함. 형식은 §6.5와 정확히 일치 |
| AC-SET-005-4 | S4 | FE | 프론트엔드 Plan | UI·단위: 사유·라운드·작성자·확정 상태·버전·`kind` 표기 없음 |
| AC-SET-005-5 | S4 | FE | 프론트엔드 Plan | UI: 클립보드 실패(권한·미지원) 모의 → 실패 안내, 성공 미표시 |
| AC-SET-005-6 | S4 | FE | 프론트엔드 Plan | UI: `IN_PROGRESS`에서 복사 버튼 없음·비동작, `게임 종료` 텍스트 생성 불가 |
| AC-SET-006-1 | S4 | BE+FE | BE-S4-2 (+프론트엔드 Plan) | UI·API: 거래 0건, 상쇄로 모든 순손익 0 → `items: []`, 정확히 `정산할 내역이 없습니다.` |
| AC-SET-006-2 | S4 | FE | 프론트엔드 Plan | UI: 종료된 방의 빈 최종 정산에서 복사 버튼 비활성·클릭해도 복사 없음. 진행 중 예상 정산엔 복사 기능 없음 |
| AC-SET-006-3 | S4 | FE | 프론트엔드 Plan | UI: 항목 1건 이상이면 문구 없음 |
| AC-SET-007-1 | S4 | BE+FE | BE-S4-2 (+프론트엔드 Plan) | API·UI: 종료 직후 별도 조작 없이 `FINAL` 조회 |
| AC-SET-007-2 | S4 | BE+FE | BE-S4-5 (+프론트엔드 Plan) | API·정적: 확정·확정 취소·버전 조회 경로 404, UI 없음 |
| AC-SET-007-3 | S4 | BE | BE-S4-2 | API: 종료 뒤 반복·다른 인스턴스 조회가 동일(바이트 수준 `items` 동일) |
| AC-SET-008-1 | S4 | BE+FE | BE-S4-2 (+프론트엔드 Plan) | API·UI: 진행 중 접속자가 `EXPECTED` 조회 |
| AC-SET-008-2 | S4 | BE+FE | BE-S4-2, BE-S5-3 (+프론트엔드 Plan) | 통합: 다른 접속자의 거래 생성·수정·삭제, 참여자 변경 뒤 새로고침 없이 예상 정산 갱신(지연 측정은 S5 §6.7) |
| AC-SET-008-3 | S4 | BE+FE | BE-S4-2 (+프론트엔드 Plan) | 통합: 종료 시 같은 영역이 `최종 정산`으로 바뀜 |
| AC-SET-008-4 | S4 | BE | BE-S4-2 | 속성: 같은 거래 집합에서 종료 전 `EXPECTED.items` = 종료 후 `FINAL.items` |
| AC-SET-008-5 | S4 | FE | 프론트엔드 Plan | UI: 예상 정산이 진행 중임을 구분해 표시하고 최종 결과로 오인되지 않음 |
| AC-SET-008-6 | S4 | BE+FE | BE-S4-2 (+프론트엔드 Plan) | API·UI: 필터 선택 전후 정산 동일, 정산 API는 쿼리 거부(`NOT_ALLOWED_FIELD`) |
| AC-SET-008-7 | S4 | FE | 프론트엔드 Plan | UI·API: 예상 정산 복사 불가 |

## 비기능 요구(NFR)의 백엔드 대응

AC가 아니라 PRD §6의 NFR이다. 백엔드가 증명할 수 있는 부분의 담당 Task를 적는다.

| NFR | 백엔드 대응 | 담당 Task |
| --- | --- | --- |
| NFR-001 데이터 정합성 | 순손익 합 0, 중복·동시 수정·삭제 뒤에도 유지 | BE-S3-1(속성 시험), BE-S2-6 |
| NFR-002 서버 권위 | 권한·상태·유효성을 서버가 최종 판정, API 직접 호출 시험 | BE-F4, 각 계약 시험 |
| NFR-003 멱등성 | 재전송·만료·충돌 | BE-F6, BE-S2-5, BE-S4-3 |
| NFR-004 최신성 표시 | 서버 측은 하트비트의 DB `revision`(뒤처짐 감지 수단) | BE-S5-2, BE-S5-5 (표시는 프론트엔드) |
| NFR-005 익명성 | 닉네임과 신원 키 해시 외 개인정보를 받지 않는다 | BE-S1-2, BE-S1-3, BE-F4 |
| NFR-006 실시간성 | AC-VIEW-005-8 기준의 지연 측정 | BE-S5-4 |
| NFR-007 규모 한도 | RoomMember·Participant 10, 거래 1,000 | BE-S1-7, BE-S2-6 |
| NFR-008 지원 환경 | 서버 측은 CORS·SSE 헤더 (브라우저 호환은 프론트엔드) | BE-F3, BE-S5-2 |
| NFR-009 금액 정확성 | 최대 금액에서 순손익·정산 정확 | BE-S4-6, BE-S3-1 |

AC에 직접 대응하지 않는 Task(`BE-F1`·`F2`·`F7`·`F8`, `BE-S1-1`·`S1-4`, `BE-S2-1`, `BE-S3-4`, `BE-S5-1`, `BE-S5-6`, `BE-Z1`)는 다른 Task의 기반·성능·증거 작업이며 완료 기준이 `tasks.md`에 있다.
