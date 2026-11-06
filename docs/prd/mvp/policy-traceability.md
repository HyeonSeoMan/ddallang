# 딸랑 MVP — 정책 추적표 (POL → FR → 수용 기준)

- 기준: `docs/policies/ddallang-mvp-policy.md` v1.0.0, `prd.md` v0.1.0 (초안)
- 이 표는 `prd.md`의 `- POL:` 항목에서 스크립트로 생성했으며, 정책의 모든 MVP 정책 ID를 포함한다.
- 정책 ID 34개 중 FR에 연결된 ID: 34개, 누락: 0개.

## 1. POL → FR → AC

| POL | 정책 요약 | FR | 수용 기준 |
| --- | --- | --- | --- |
| POL-ROOM-001 | 회원가입 없이 닉네임으로 초대 링크를 통해 입장한다. 방 코드와 최근 방 목록은 없다. | FR-ROOM-002 | AC-ROOM-002-1, AC-ROOM-002-2, AC-ROOM-002-3, AC-ROOM-002-4 |
| POL-ROOM-002 | 방 생성 시 정산 단위(원·점수·칩 등)를 정하며 이후 변경할 수 없다. 단위 간 환산은 없다. | FR-ROOM-001, FR-ROOM-003 | AC-ROOM-001-1, AC-ROOM-001-2, AC-ROOM-001-3, AC-ROOM-003-1, AC-ROOM-003-2, AC-ROOM-003-3 |
| POL-ROOM-003 | RoomMember(접속자)와 Participant(게임 참여자)는 서로 다른 개념이다. 접속자가 참여자가 … | FR-ROOM-004 | AC-ROOM-004-1, AC-ROOM-004-2, AC-ROOM-004-3, AC-ROOM-004-4 |
| POL-ROOM-004 | 익명 신원은 동일 브라우저 재접속 시 복원한다. 브라우저 식별자를 잃으면 새 RoomMember로 입장하며 … | FR-ROOM-005 | AC-ROOM-005-1, AC-ROOM-005-2, AC-ROOM-005-3, AC-ROOM-005-4, AC-ROOM-005-5, AC-ROOM-005-6 |
| POL-ROOM-005 | RoomMember 및 Participant 닉네임은 각각 같은 방 내에서 대소문자 구분 없이 고유하다. 1… | FR-ROOM-006 | AC-ROOM-006-1, AC-ROOM-006-2, AC-ROOM-006-3, AC-ROOM-006-4, AC-ROOM-006-5, AC-ROOM-006-6, AC-ROOM-006-10, AC-ROOM-006-7, AC-ROOM-006-8, AC-ROOM-006-9 |
| POL-ROOM-006 | 현재 방장은 게임을 종료할 수 있다. 방장 권한은 초대 링크 자체로 부여되지 않는다. | FR-ROOM-007 | AC-ROOM-007-1, AC-ROOM-005-6, AC-ROOM-007-2, AC-ROOM-007-3 |
| POL-PART-001 | 방장은 참여자를 미리 등록할 수 있고, 게임 진행 중 참여자를 추가할 수 있다. | FR-ROOM-007, FR-PART-001 | AC-ROOM-007-1, AC-ROOM-005-6, AC-ROOM-007-2, AC-ROOM-007-3, AC-PART-001-1, AC-PART-001-2, AC-PART-001-3, AC-PART-001-4 |
| POL-PART-002 | 방장은 진행 중 참여자를 비활성화·재활성화할 수 있다. 비활성 참여자의 과거 거래·손익은 보존하되 신규 일반… | FR-ROOM-007, FR-PART-002 | AC-ROOM-007-1, AC-ROOM-005-6, AC-ROOM-007-2, AC-ROOM-007-3, AC-PART-002-1, AC-PART-002-2, AC-PART-002-3, AC-PART-002-4, AC-PART-002-5, AC-PART-002-6 |
| POL-PART-003 | 참여자 이름을 잘못 입력했더라도 이름을 직접 변경하거나 기록을 다른 참여자에게 이전하지 않는다. 기존 참여자… | FR-PART-003 | AC-PART-003-1, AC-PART-003-2, AC-PART-003-3 |
| POL-PART-004 | 게임 종료 후에는 참여자 추가, 활성 상태 변경을 허용하지 않는다. | FR-PART-004 | AC-PART-004-1, AC-PART-004-2, AC-PART-004-3 |
| POL-TXN-001 | 거래 필드는 지급자, 수취자, 금액, 선택적 사유와 라운드다. | FR-TXN-001 | AC-TXN-001-1, AC-TXN-001-2, AC-TXN-001-5, AC-TXN-001-3, AC-TXN-001-4 |
| POL-TXN-002 | 금액은 0보다 큰 정수만 허용한다. 동일한 Participant ID 간 거래는 금지한다. | FR-TXN-002 | AC-TXN-002-1, AC-TXN-002-2, AC-TXN-002-3, AC-TXN-002-4, AC-TXN-002-5 |
| POL-TXN-003 | 방에 입장한 RoomMember는 게임 진행 중 단건 거래를 등록할 수 있다. | FR-TXN-003 | AC-TXN-003-1, AC-TXN-003-2, AC-TXN-003-3 |
| POL-TXN-004 | 거래 수정·삭제는 거래 작성자 또는 현재 방장만 할 수 있다. 서버에서 권한을 검증한다. | FR-ROOM-007, FR-TXN-004 | AC-ROOM-007-1, AC-ROOM-005-6, AC-ROOM-007-2, AC-ROOM-007-3, AC-TXN-004-1, AC-TXN-004-2, AC-TXN-004-3, AC-TXN-004-4 |
| POL-TXN-005 | 수정은 별도 확인 없이 저장한다. 삭제는 확인 절차를 거치며 손익 집계에서 제외하되 최소한의 원본·작성자 기… | FR-TXN-005 | AC-TXN-005-1, AC-TXN-005-2, AC-TXN-005-3, AC-TXN-005-4, AC-TXN-005-5 |
| POL-TXN-006 | 동일 거래에 대한 동시 수정은 서버에서 마지막으로 성공한 저장을 최종값으로 삼는다. 삭제된 거래에 대한 수정… | FR-TXN-006 | AC-TXN-006-1, AC-TXN-006-2, AC-TXN-006-3, AC-TXN-006-4 |
| POL-TXN-007 | 저장 중 중복 제출을 방지하고, 서버는 동일 요청 ID의 중복 생성을 막는다. 내용이 같은 서로 다른 거래는… | FR-TXN-007 | AC-TXN-007-1, AC-TXN-007-2, AC-TXN-007-3, AC-TXN-007-4, AC-TXN-007-5, AC-TXN-007-6, AC-TXN-007-7 |
| POL-TXN-008 | 저장 실패 시 성공한 것처럼 표시하지 않는다. 입력값은 현재 화면에서 유지하며 사용자가 수동 재시도한다. | FR-TXN-008 | AC-TXN-008-1, AC-TXN-008-2, AC-TXN-008-3, AC-TXN-008-4, AC-TXN-008-5 |
| POL-TXN-009 | 게임 종료 후에는 일반 거래 추가·수정·삭제가 불가능하다. 서버에서 처리 시점의 게임 상태를 검사한다. | FR-TXN-009 | AC-TXN-009-1, AC-TXN-009-2, AC-TXN-009-4, AC-TXN-009-3 |
| POL-VIEW-001 | '누적 손익'과 '거래 내역'을 구분한다. | FR-VIEW-001 | AC-VIEW-001-1, AC-VIEW-001-2 |
| POL-VIEW-002 | 순손익은 내림차순으로 표시하고 동률이면 참여자 등록 순서를 따른다. | FR-VIEW-002 | AC-VIEW-002-1, AC-VIEW-002-2, AC-VIEW-002-3 |
| POL-VIEW-003 | 거래 목록은 원본 생성 시각 내림차순이다. 수정으로 목록 위치를 변경하지 않는다. | FR-VIEW-003 | AC-VIEW-003-1, AC-VIEW-003-2, AC-VIEW-003-3 |
| POL-VIEW-004 | 거래 목록은 20건 단위로 불러오며, 참여자 1명 기준 필터를 제공한다. 해당 참여자가 지급자 또는 수취자인… | FR-VIEW-004 | AC-VIEW-004-1, AC-VIEW-004-2, AC-VIEW-004-3, AC-VIEW-004-4, AC-VIEW-004-5, AC-VIEW-004-6, AC-VIEW-004-7 |
| POL-VIEW-005 | 거래 변경은 다른 접속자의 손익과 목록에 실시간 반영한다. 변경 토스트는 필수가 아니다. | FR-VIEW-005 | AC-VIEW-005-1, AC-VIEW-005-2, AC-VIEW-005-3, AC-VIEW-005-4 |
| POL-SET-001 | 방장만 수동 종료할 수 있으며 종료 전 확인한다. 종료 후 일반 거래를 잠근다. | FR-ROOM-007, FR-SET-001 | AC-ROOM-007-1, AC-ROOM-005-6, AC-ROOM-007-2, AC-ROOM-007-3, AC-SET-001-1, AC-SET-001-2, AC-SET-001-3, AC-SET-001-4, AC-SET-001-5, AC-SET-001-7, AC-SET-001-6 |
| POL-SET-002 | 거래별 지급자 순손익을 차감하고 수취자 순손익을 가산한다. 모든 참여자의 순손익 합계는 0이어야 한다. | FR-SET-002 | AC-SET-002-1, AC-SET-002-2, AC-SET-002-3, AC-SET-002-4 |
| POL-SET-003 | 정산은 순채무자와 순채권자를 잔액 큰 순서대로 탐욕 매칭한다. 동률은 참여자 등록 순서를 따른다. 전역 최소… | FR-SET-003 | AC-SET-003-1, AC-SET-003-2, AC-SET-003-3, AC-SET-003-4, AC-SET-003-5, AC-SET-003-6 |
| POL-SET-004 | 정산 항목은 금액 내림차순, 동률은 참여자 등록 순서로 표시한다. | FR-SET-004 | AC-SET-004-1, AC-SET-004-2 |
| POL-SET-005 | 정산 결과는 조회하고 일반 텍스트로 복사할 수 있다. 방 이름·정산 상태·지급자·수취자·금액·단위를 포함하며… | FR-SET-005 | AC-SET-005-1, AC-SET-005-2, AC-SET-005-3, AC-SET-005-4, AC-SET-005-5 |
| POL-SET-006 | 정산할 송금 항목이 없으면 '정산할 내역이 없습니다.'를 표시하고 복사 버튼을 비활성화한다. | FR-SET-006 | AC-SET-006-1, AC-SET-006-2, AC-SET-006-3 |
| POL-SET-007 | MVP에는 정산 확정·버전 관리 기능이 없으므로 종료 후 정산은 별도 확정 단계 없이 계산 결과로 제공한다.… | FR-SET-007 | AC-SET-007-1, AC-SET-007-2, AC-SET-007-3 |
| POL-SYS-001 | 온라인 상태에서만 데이터를 조회·변경한다. 연결이 끊기면 최신 데이터로 오인할 수 있는 오래된 조회 결과를 … | FR-SYS-001 | AC-SYS-001-1, AC-SYS-001-2, AC-SYS-001-3, AC-SYS-001-4 |
| POL-SYS-002 | 연결 복구 시 최신 서버 상태를 다시 조회한다. 미완료 거래를 자동 제출하지 않는다. | FR-SYS-002 | AC-SYS-002-1, AC-SYS-002-2, AC-SYS-002-5, AC-SYS-002-3, AC-SYS-002-4 |
| POL-SYS-003 | 서버는 사용자 권한, 방 상태, 참여자 상태, 거래 유효성을 최종 검증한다. | FR-SYS-003 | AC-SYS-003-1, AC-SYS-003-2, AC-SYS-003-3, AC-SYS-003-4, AC-SYS-003-6, AC-SYS-003-7, AC-SYS-003-8, AC-SYS-003-5 |

## 2. FR → POL

| FR | 제목 | POL | 수용 기준 수 |
| --- | --- | --- | --- |
| FR-ROOM-001 | 방 생성 | POL-ROOM-002 | 3 |
| FR-ROOM-002 | 초대 링크 입장 | POL-ROOM-001 | 4 |
| FR-ROOM-003 | 정산 단위 불변 | POL-ROOM-002 | 3 |
| FR-ROOM-004 | RoomMember와 Participant 분리 | POL-ROOM-003 | 4 |
| FR-ROOM-005 | 브라우저 기반 신원 복원 | POL-ROOM-004 | 6 |
| FR-ROOM-006 | 닉네임 규칙 | POL-ROOM-005 | 10 |
| FR-ROOM-007 | 방장 권한 경계 | POL-ROOM-006, POL-PART-001, POL-PART-002, POL-TXN-004, POL-SET-001 | 4 |
| FR-PART-001 | 참여자 등록 | POL-PART-001 | 4 |
| FR-PART-002 | 참여자 비활성화·재활성화 | POL-PART-002 | 6 |
| FR-PART-003 | 참여자 이름 변경·기록 이전 금지 | POL-PART-003 | 3 |
| FR-PART-004 | 종료 후 참여자 변경 금지 | POL-PART-004 | 3 |
| FR-TXN-001 | 거래 데이터 | POL-TXN-001 | 5 |
| FR-TXN-002 | 거래 값 검증 | POL-TXN-002 | 5 |
| FR-TXN-003 | 거래 등록 권한 | POL-TXN-003 | 3 |
| FR-TXN-004 | 거래 수정·삭제 권한 | POL-TXN-004 | 4 |
| FR-TXN-005 | 수정·삭제 동작 | POL-TXN-005 | 5 |
| FR-TXN-006 | 동시 수정과 삭제된 거래 | POL-TXN-006 | 4 |
| FR-TXN-007 | 중복 제출 방지 | POL-TXN-007 | 7 |
| FR-TXN-008 | 저장 실패 처리 | POL-TXN-008 | 5 |
| FR-TXN-009 | 종료 후 일반 거래 잠금 | POL-TXN-009 | 4 |
| FR-VIEW-001 | 누적 손익과 거래 내역 구분 | POL-VIEW-001 | 2 |
| FR-VIEW-002 | 순손익 정렬 | POL-VIEW-002 | 3 |
| FR-VIEW-003 | 거래 목록 정렬 | POL-VIEW-003 | 3 |
| FR-VIEW-004 | 목록 페이지 단위와 참여자 필터 | POL-VIEW-004 | 7 |
| FR-VIEW-005 | 실시간 반영 | POL-VIEW-005 | 4 |
| FR-SET-001 | 게임 종료 | POL-SET-001 | 7 |
| FR-SET-002 | 순손익 계산 | POL-SET-002 | 4 |
| FR-SET-003 | 정산 매칭 | POL-SET-003 | 6 |
| FR-SET-004 | 정산 항목 정렬 | POL-SET-004 | 2 |
| FR-SET-005 | 정산 조회와 텍스트 복사 | POL-SET-005 | 5 |
| FR-SET-006 | 정산 항목 없음 | POL-SET-006 | 3 |
| FR-SET-007 | 정산 확정·버전 없음 | POL-SET-007 | 3 |
| FR-SYS-001 | 온라인 전용과 오래된 데이터 표시 금지 | POL-SYS-001 | 4 |
| FR-SYS-002 | 연결 복구 | POL-SYS-002 | 5 |
| FR-SYS-003 | 서버 최종 검증 | POL-SYS-003 | 8 |

## 3. 정책 §2·§9·§10과 PRD

- 범위 §2의 6개 항목: `prd.md` §1.3에 동일하게 기재했고 각 FR에 매핑된다.
- §9 연기 항목 7개: `prd.md` §7에 제외 범위로 기재했고 FR을 만들지 않았다. 부재를 검증하는 AC는 아래 표와 같다.

| §9 연기 항목 | 부재를 검증하는 AC |
| --- | --- |
| 1. 여러 거래 일괄 입력 | AC-TXN-001-5 |
| 2. 정산 확정·버전 관리 | AC-SET-007-1, AC-SET-007-2 |
| 3. 종료 후 정정 거래 | AC-TXN-009-4 |
| 4. 방장 이전·강제 퇴장·링크 재발급 | AC-ROOM-007-3 |
| 5. 상세 감사 이력·변경 이력 조회 | AC-TXN-005-4 |
| 6. 자동 종료·재개·접근 만료·자동 삭제 | AC-SET-001-4(자동 종료), AC-SET-001-5(재개), AC-SET-001-7(접근 만료·자동 삭제) |
| 7. 입력 초안 자동 복원 | AC-SYS-002-4 |

- §10 OQ-001~005: `open-questions.md` 섹션 A에 기재했고 미결정으로 남겼다.
- §11 작업 계약: FR ID·수용 기준·POL 연결·OQ 기록을 따랐다.

## 4. NFR 추적

| NFR | 근거 |
| --- | --- |
| NFR-001 데이터 정합성 | POL-SET-002, POL-TXN-005~007 |
| NFR-002 서버 권위 | POL-SYS-003, POL-TXN-004, POL-TXN-009 |
| NFR-003 멱등성 | POL-TXN-007 |
| NFR-004 최신성 표시 | POL-SYS-001, POL-SYS-002 |
| NFR-005 익명성 | POL-ROOM-001, POL-ROOM-004 |
| NFR-006 실시간성 | POL-VIEW-005 |
| NFR-007 규모 한도 | OQ-004 |
| NFR-008 지원 환경 | — |
