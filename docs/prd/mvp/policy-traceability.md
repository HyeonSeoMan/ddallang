# 딸랑 MVP — 정책 추적표 (정책 → FR → 수용 기준)

- 기준: 통합 정책 v1.0.0(`ddallang-mvp-policy-consolidated.md` 현행 내용 + 기존 정책에만 있던 규칙 7건, 사용자 결정 2026-11-07)(앵커 `C§x.y`), 기존 정책 `ddallang-mvp-policy.md` v1.0.0(`POL-*`), `prd.md` v0.5.2 (확정, 사용자 G1 재승인 2026-11-09)
- `C§6.1`(지원 환경)은 NFR에, `C§7.x`(통합 정책이 Spec 이관·미결로 남긴 항목)는 질문 번호에 대응한다. 질문의 현재 상태는 행마다 "결정 완료 / 부분 결정 / 열림"으로 적었다(`open-questions.md`가 기준). `C§7.3`은 FR-ROOM-008이 직접 인용하므로 FR로 센다.
- 이 표는 `prd.md`의 `- POL:`과 `- 통합:` 항목에서 스크립트로 생성했다. `C§x.y`는 통합 정책의 절 번호와 글머리표 순서이며 정책이 부여한 ID가 아니다(`policy-verification.md` 1.1절).
- 기존 정책 ID 34개 중 FR에 연결된 ID: 34개, 누락: 0개.
- 통합 정책 앵커 32개의 연결 현황: FR 26개, NFR 1개, 질문 번호 대응(OQ) 5개(결정 완료 4, 부분 결정 1, 열림 0), 연결 누락 0개 (없음).

## 1. 통합 정책 → FR → AC

| 앵커 | 통합 정책 내용 | FR | 수용 기준 수 |
| --- | --- | --- | --- |
| C§1.1 | 포함: 방 생성·초대 링크 입장, 익명 RoomMember, 참여자 등록·관리, 단건 거래 생성·수정·삭… | FR-ROOM-002, FR-SYS-003 | 13 |
| C§1.2 | 제외: RoomMember–Participant 연결/해제, 일괄 입력, 정산 확정·버전, 종료 후 정정… | FR-ROOM-004, FR-ROOM-007, FR-SET-007, FR-SYS-002 | 16 |
| C§2.1 | 방 이름: 필수, 1~12자, 한글·영문·숫자·중간 공백만 허용, 앞뒤 공백·특수문자·이모지 불가, 중복… | FR-ROOM-001 | 14 |
| C§2.2 | 생성 시 원·점수·칩 등 정산 단위 선택; 이후 변경·환산 불가. | FR-ROOM-001, FR-ROOM-003 | 17 |
| C§2.3 | 생성 브라우저에 익명 RoomMember 신원을 발급하고 서버가 최초 방장으로 지정. 회원가입·비밀번호 … | FR-ROOM-001, FR-ROOM-002, FR-ROOM-005, FR-ROOM-007 | 29 |
| C§2.4 | RoomMember와 Participant는 독립 개체이며 MVP에서 연결·해제 기능 없음 (OQ-001… | FR-ROOM-004 | 5 |
| C§2.5 | 방별 RoomMember 최대 10명, Participant 최대 10명, 거래 최대 1,000건. 초과… | FR-ROOM-008 | 11 |
| C§2.6 | RoomMember·Participant 닉네임 각각 1~12자, 한글·영문·숫자·중간 공백 허용. 앞뒤… | FR-ROOM-006, FR-PART-003 | 16 |
| C§2.7 | 진행 중 참여자 추가 가능. 방장만 참여자 비활성화·재활성화 가능. 비활성 참여자는 새 거래에 사용 불가… | FR-ROOM-002, FR-ROOM-007, FR-PART-001, FR-PART-002, FR-PART-004, FR-SET-005 | 32 |
| C§3.1 | 필수: 서로 다른 Participant ID의 지급자·수취자, 금액 1~999,999,999의 정수. 모… | FR-TXN-001, FR-TXN-002, FR-TXN-008 | 16 |
| C§3.2 | 진행 중 모든 RoomMember가 거래 생성 가능. 수정·삭제는 작성자 또는 방장만 가능. 수정 필드는… | FR-ROOM-007, FR-PART-002, FR-TXN-001, FR-TXN-003, FR-TXN-004, FR-TXN-005 | 33 |
| C§3.3 | 삭제 거래는 일반 목록·손익·정산에서 제외하며 최소 감사 데이터 보존. 상세 감사 UI는 후속 (OQ-0… | FR-TXN-005 | 8 |
| C§3.4 | 거래 생성·수정·삭제에 idempotency key 적용. 동일 키·동일 내용 재시도는 최초 결과 재사용… | FR-TXN-007, FR-TXN-008 | 18 |
| C§3.5 | 동시 수정은 서버에서 마지막으로 성공한 저장이 최종값(LWW). 삭제된 거래 수정 불가. | FR-TXN-006 | 4 |
| C§4.1 | 누적 손익은 순손익 내림차순, 동률은 참여자 등록 순서. | FR-VIEW-001, FR-VIEW-002 | 5 |
| C§4.2 | 거래 목록은 원본 서버 생성 시각 내림차순 → 서버 생성 순번 내림차순. 수정해도 목록 순서 불변. 20… | FR-VIEW-003, FR-VIEW-004 | 15 |
| C§4.3 | 참여자 한 명의 지급·수취 거래 필터는 목록에만 적용. 누적 손익은 언제나 전체 유효 거래 기준. 필터 … | FR-VIEW-001, FR-VIEW-004 | 11 |
| C§4.4 | 거래 변경, 참여자 추가·활성 상태 변경, 게임 종료·정산 변경을 새로고침 없이 반영. 재연결 시 서버 … | FR-VIEW-005, FR-SET-008, FR-SYS-002 | 20 |
| C§4.5 | 연결 오류 시 오래된 캐시를 최신처럼 표시하지 않고 조회 차단·오류 안내. 현재 작성 중인 입력 유지, … | FR-TXN-008, FR-SYS-001, FR-SYS-002 | 15 |
| C§5.1 | 방장만 종료 가능. 최초 종료 요청만 성공; 새로운 반복 요청은 `이미 종료된 게임입니다` 거부, 동일 … | FR-ROOM-007, FR-TXN-009, FR-SET-001 | 17 |
| C§5.2 | 진행 중에도 전체 유효 거래로 예상 정산 제공·실시간 갱신. 종료 후에는 최종 정산 표시. 같은 계산 알… | FR-SET-008 | 7 |
| C§5.3 | 지급자 순손익 차감·수취자 순손익 가산, 전체 순손익 합계 0. 탐욕 정산은 매칭마다 남은 채무·채권을 … | FR-SET-002, FR-SET-003 | 12 |
| C§5.4 | 정산 항목은 금액 내림차순, 동률은 참여자 등록 순서. 화면·복사 텍스트 순서 일치. | FR-SET-004 | 4 |
| C§5.5 | MVP 복사 상태 문자열은 `게임 종료` 고정. 방 이름·지급자→수취자·금액 포함. 정산 확정 상태·버전… | FR-SET-005, FR-SET-007 | 9 |
| C§5.6 | 수동 종료 후 일반 거래 생성·수정·삭제 불가. 자동 종료·재개·접근 만료·삭제는 후속 (OQ-003). | FR-TXN-009, FR-SET-001 | 14 |
| C§6.1 | iOS Safari, Android Chrome, 데스크톱 Chrome·Safari·Edge. 모바일 중… | NFR-008 (OQ-032 결정, PRD v0.5.2) | - |
| C§7.1 | OQ-019: 실시간 지연 목표 수치·측정 조건·수용 기준. | OQ-019 (결정, PRD v0.5.2) → NFR-006, FR-VIEW-005 | - |
| C§7.2 | OQ-026: 검증 실패와 서버 처리 불명확 상태별 idempotency key 보관·재사용 정책. | OQ-026 (결정 완료: 일부 사용자 결정 2.1절, 잔여는 Claude 위임 결정 2.2절) → FR-TXN-007 | - |
| C§7.3 | OQ-004: 삭제 거래를 1,000건 한도에 포함하는지. | FR-ROOM-008 | 11 |
| C§7.4 | OQ-008: 유니코드 정규화·중간 반복 공백 처리. | OQ-008 (결정 완료, open-questions 2.1절) → FR-ROOM-001, FR-ROOM-006 | - |
| C§7.5 | OQ-009: 선택 사유·라운드의 길이·형식. | OQ-009 (결정 완료, 허용 문자는 OQ-039 결정, PRD v0.5.2) → FR-TXN-001 | - |
| C§7.6 | 동시 거래 저장/게임 종료 순서, 생성 순번 고유성, 최소 지원 브라우저 버전, UX/접근성·테스트 기준… | OQ-030·031·032 (결정, PRD v0.5.2), OQ-033 (열림) → FR-TXN-009, FR-VIEW-003, NFR-008 | - |

## 2. 기존 정책 → FR → AC

| POL | 정책 요약 | FR | 수용 기준 |
| --- | --- | --- | --- |
| POL-ROOM-001 | 회원가입 없이 닉네임으로 초대 링크를 통해 입장한다. 방 코드와 최근 방 목록은 없다. | FR-ROOM-002 | AC-ROOM-002-1, AC-ROOM-002-2, AC-ROOM-002-3, AC-ROOM-002-4, AC-ROOM-002-5 |
| POL-ROOM-002 | 방 생성 시 정산 단위(원·점수·칩 등)를 정하며 이후 변경할 수 없다. 단위 간 환산은 … | FR-ROOM-001, FR-ROOM-003 | AC-ROOM-001-1, AC-ROOM-001-2, AC-ROOM-001-3, AC-ROOM-001-4, AC-ROOM-001-5, AC-ROOM-001-6, AC-ROOM-001-7, AC-ROOM-001-8, AC-ROOM-001-9, AC-ROOM-001-10, AC-ROOM-001-11, AC-ROOM-001-12, AC-ROOM-001-13, AC-ROOM-001-14, AC-ROOM-003-1, AC-ROOM-003-2, AC-ROOM-003-3 |
| POL-ROOM-003 | RoomMember(접속자)와 Participant(게임 참여자)는 서로 다른 개념이다. … | FR-ROOM-004 | AC-ROOM-004-1, AC-ROOM-004-2, AC-ROOM-004-3, AC-ROOM-004-4, AC-ROOM-004-5 |
| POL-ROOM-004 | 익명 신원은 동일 브라우저 재접속 시 복원한다. 브라우저 식별자를 잃으면 새 RoomMem… | FR-ROOM-005 | AC-ROOM-005-1, AC-ROOM-005-2, AC-ROOM-005-3, AC-ROOM-005-4, AC-ROOM-005-5, AC-ROOM-005-6, AC-ROOM-005-7 |
| POL-ROOM-005 | RoomMember 및 Participant 닉네임은 각각 같은 방 내에서 대소문자 구분 … | FR-ROOM-006 | AC-ROOM-006-1, AC-ROOM-006-2, AC-ROOM-006-3, AC-ROOM-006-4, AC-ROOM-006-5, AC-ROOM-006-6, AC-ROOM-006-7, AC-ROOM-006-8, AC-ROOM-006-9, AC-ROOM-006-10, AC-ROOM-006-12, AC-ROOM-006-13, AC-ROOM-006-11 |
| POL-ROOM-006 | 현재 방장은 게임을 종료할 수 있다. 방장 권한은 초대 링크 자체로 부여되지 않는다. | FR-ROOM-007 | AC-ROOM-007-1, AC-ROOM-007-2, AC-ROOM-007-3 |
| POL-PART-001 | 방장은 참여자를 미리 등록할 수 있고, 게임 진행 중 참여자를 추가할 수 있다. | FR-ROOM-007, FR-PART-001 | AC-ROOM-007-1, AC-ROOM-007-2, AC-ROOM-007-3, AC-PART-001-1, AC-PART-001-2, AC-PART-001-3, AC-PART-001-4, AC-PART-001-5, AC-PART-001-6 |
| POL-PART-002 | 방장은 진행 중 참여자를 비활성화·재활성화할 수 있다. 비활성 참여자의 과거 거래·손익은 … | FR-ROOM-007, FR-PART-002 | AC-ROOM-007-1, AC-ROOM-007-2, AC-ROOM-007-3, AC-PART-002-1, AC-PART-002-2, AC-PART-002-3, AC-PART-002-4, AC-PART-002-5, AC-PART-002-6, AC-PART-002-7, AC-PART-002-8, AC-PART-002-9 |
| POL-PART-003 | 참여자 이름을 잘못 입력했더라도 이름을 직접 변경하거나 기록을 다른 참여자에게 이전하지 않… | FR-PART-003 | AC-PART-003-1, AC-PART-003-2, AC-PART-003-3 |
| POL-PART-004 | 게임 종료 후에는 참여자 추가, 활성 상태 변경을 허용하지 않는다. | FR-PART-004 | AC-PART-004-1, AC-PART-004-2, AC-PART-004-3 |
| POL-TXN-001 | 거래 필드는 지급자, 수취자, 금액, 선택적 사유와 라운드다. | FR-TXN-001 | AC-TXN-001-1, AC-TXN-001-2, AC-TXN-001-3, AC-TXN-001-4, AC-TXN-001-5, AC-TXN-001-6 |
| POL-TXN-002 | 금액은 0보다 큰 정수만 허용한다. 동일한 Participant ID 간 거래는 금지한다. | FR-TXN-002 | AC-TXN-002-1, AC-TXN-002-2, AC-TXN-002-3, AC-TXN-002-4, AC-TXN-002-5 |
| POL-TXN-003 | 방에 입장한 RoomMember는 게임 진행 중 단건 거래를 등록할 수 있다. | FR-TXN-003 | AC-TXN-003-1, AC-TXN-003-2, AC-TXN-003-3 |
| POL-TXN-004 | 거래 수정·삭제는 거래 작성자 또는 현재 방장만 할 수 있다. 서버에서 권한을 검증한다. | FR-ROOM-007, FR-TXN-004 | AC-ROOM-007-1, AC-ROOM-007-2, AC-ROOM-007-3, AC-TXN-004-1, AC-TXN-004-2, AC-TXN-004-3, AC-TXN-004-4 |
| POL-TXN-005 | 수정은 별도 확인 없이 저장한다. 삭제는 확인 절차를 거치며 손익 집계에서 제외하되 최소한… | FR-TXN-005 | AC-TXN-005-1, AC-TXN-005-2, AC-TXN-005-3, AC-TXN-005-4, AC-TXN-005-5, AC-TXN-005-6, AC-TXN-005-7, AC-TXN-005-8 |
| POL-TXN-006 | 동일 거래에 대한 동시 수정은 서버에서 마지막으로 성공한 저장을 최종값으로 삼는다. 삭제된… | FR-TXN-006 | AC-TXN-006-1, AC-TXN-006-2, AC-TXN-006-3, AC-TXN-006-4 |
| POL-TXN-007 | 저장 중 중복 제출을 방지하고, 서버는 동일 요청 ID의 중복 생성을 막는다. 내용이 같은… | FR-TXN-007 | AC-TXN-007-1, AC-TXN-007-2, AC-TXN-007-3, AC-TXN-007-4, AC-TXN-007-5, AC-TXN-007-6, AC-TXN-007-7, AC-TXN-007-8, AC-TXN-007-9, AC-TXN-007-10, AC-TXN-007-11, AC-TXN-007-12, AC-TXN-007-13 |
| POL-TXN-008 | 저장 실패 시 성공한 것처럼 표시하지 않는다. 입력값은 현재 화면에서 유지하며 사용자가 수… | FR-TXN-008 | AC-TXN-008-1, AC-TXN-008-2, AC-TXN-008-3, AC-TXN-008-4, AC-TXN-008-5 |
| POL-TXN-009 | 게임 종료 후에는 일반 거래 추가·수정·삭제가 불가능하다. 서버에서 처리 시점의 게임 상태… | FR-TXN-009 | AC-TXN-009-1, AC-TXN-009-2, AC-TXN-009-3, AC-TXN-009-4, AC-TXN-009-5 |
| POL-VIEW-001 | '누적 손익'과 '거래 내역'을 구분한다. | FR-VIEW-001 | AC-VIEW-001-1, AC-VIEW-001-2 |
| POL-VIEW-002 | 순손익은 내림차순으로 표시하고 동률이면 참여자 등록 순서를 따른다. | FR-VIEW-002 | AC-VIEW-002-1, AC-VIEW-002-2, AC-VIEW-002-3 |
| POL-VIEW-003 | 거래 목록은 원본 생성 시각 내림차순이다. 수정으로 목록 위치를 변경하지 않는다. | FR-VIEW-003 | AC-VIEW-003-1, AC-VIEW-003-2, AC-VIEW-003-3, AC-VIEW-003-4, AC-VIEW-003-5, AC-VIEW-003-6 |
| POL-VIEW-004 | 거래 목록은 20건 단위로 불러오며, 참여자 1명 기준 필터를 제공한다. 해당 참여자가 지… | FR-VIEW-004 | AC-VIEW-004-1, AC-VIEW-004-2, AC-VIEW-004-3, AC-VIEW-004-4, AC-VIEW-004-5, AC-VIEW-004-6, AC-VIEW-004-7, AC-VIEW-004-8, AC-VIEW-004-9 |
| POL-VIEW-005 | 거래 변경은 다른 접속자의 손익과 목록에 실시간 반영한다. 변경 토스트는 필수가 아니다. | FR-VIEW-005 | AC-VIEW-005-1, AC-VIEW-005-2, AC-VIEW-005-3, AC-VIEW-005-4, AC-VIEW-005-5, AC-VIEW-005-6, AC-VIEW-005-7, AC-VIEW-005-8 |
| POL-SET-001 | 방장만 수동 종료할 수 있으며 종료 전 확인한다. 종료 후 일반 거래를 잠근다. | FR-ROOM-007, FR-SET-001 | AC-ROOM-007-1, AC-ROOM-007-2, AC-ROOM-007-3, AC-SET-001-1, AC-SET-001-2, AC-SET-001-3, AC-SET-001-4, AC-SET-001-5, AC-SET-001-6, AC-SET-001-7, AC-SET-001-8, AC-SET-001-9 |
| POL-SET-002 | 거래별 지급자 순손익을 차감하고 수취자 순손익을 가산한다. 모든 참여자의 순손익 합계는 0… | FR-SET-002 | AC-SET-002-1, AC-SET-002-2, AC-SET-002-3, AC-SET-002-4, AC-SET-002-5 |
| POL-SET-003 | 정산은 순채무자와 순채권자를 잔액 큰 순서대로 탐욕 매칭한다. 동률은 참여자 등록 순서를 … | FR-SET-003 | AC-SET-003-1, AC-SET-003-2, AC-SET-003-3, AC-SET-003-4, AC-SET-003-5, AC-SET-003-6, AC-SET-003-7 |
| POL-SET-004 | 정산 항목은 금액 내림차순, 동률은 참여자 등록 순서로 표시한다. | FR-SET-004 | AC-SET-004-1, AC-SET-004-2, AC-SET-004-4, AC-SET-004-3 |
| POL-SET-005 | 정산 결과는 조회하고 일반 텍스트로 복사할 수 있다. 방 이름·정산 상태·지급자·수취자·금… | FR-SET-005 | AC-SET-005-1, AC-SET-005-2, AC-SET-005-3, AC-SET-005-4, AC-SET-005-5, AC-SET-005-6 |
| POL-SET-006 | 정산할 송금 항목이 없으면 '정산할 내역이 없습니다.'를 표시하고 복사 버튼을 비활성화한다… | FR-SET-006 | AC-SET-006-1, AC-SET-006-2, AC-SET-006-3 |
| POL-SET-007 | MVP에는 정산 확정·버전 관리 기능이 없으므로 종료 후 정산은 별도 확정 단계 없이 계산… | FR-SET-007 | AC-SET-007-1, AC-SET-007-2, AC-SET-007-3 |
| POL-SYS-001 | 온라인 상태에서만 데이터를 조회·변경한다. 연결이 끊기면 최신 데이터로 오인할 수 있는 오… | FR-SYS-001 | AC-SYS-001-1, AC-SYS-001-2, AC-SYS-001-3, AC-SYS-001-4, AC-SYS-001-5 |
| POL-SYS-002 | 연결 복구 시 최신 서버 상태를 다시 조회한다. 미완료 거래를 자동 제출하지 않는다. | FR-SYS-002 | AC-SYS-002-1, AC-SYS-002-2, AC-SYS-002-3, AC-SYS-002-4, AC-SYS-002-5 |
| POL-SYS-003 | 서버는 사용자 권한, 방 상태, 참여자 상태, 거래 유효성을 최종 검증한다. | FR-SYS-003 | AC-SYS-003-1, AC-SYS-003-2, AC-SYS-003-3, AC-SYS-003-4, AC-SYS-003-5, AC-SYS-003-6, AC-SYS-003-7, AC-SYS-003-8 |

## 3. FR → 정책

| FR | 제목 | POL | 통합 | AC 수 |
| --- | --- | --- | --- | --- |
| FR-ROOM-001 | 방 생성 | POL-ROOM-002 | C§2.1, C§2.2, C§2.3 | 14 |
| FR-ROOM-002 | 초대 링크 입장 | POL-ROOM-001 | C§1.1, C§2.3, C§2.7 | 5 |
| FR-ROOM-003 | 정산 단위 불변 | POL-ROOM-002 | C§2.2 | 3 |
| FR-ROOM-004 | RoomMember와 Participant 독립 | POL-ROOM-003 | C§2.4, C§1.2 | 5 |
| FR-ROOM-005 | 브라우저 기반 신원 복원 | POL-ROOM-004 | C§2.3 | 7 |
| FR-ROOM-006 | 닉네임 규칙 | POL-ROOM-005 | C§2.6 | 13 |
| FR-ROOM-007 | 방장 권한 경계 | POL-ROOM-006, POL-PART-001, POL-PART-002, POL-TXN-004, POL-SET-001 | C§2.3, C§2.7, C§3.2, C§5.1, C§1.2 | 3 |
| FR-ROOM-008 | 운영 한도 | - | C§2.5, C§7.3 | 11 |
| FR-PART-001 | 참여자 등록 | POL-PART-001 | C§2.7 | 6 |
| FR-PART-002 | 참여자 비활성화·재활성화 | POL-PART-002 | C§2.7, C§3.2 | 9 |
| FR-PART-003 | 참여자 이름 변경·기록 이전 금지 | POL-PART-003 | C§2.6 | 3 |
| FR-PART-004 | 종료 후 참여자 변경 금지 | POL-PART-004 | C§2.7 | 3 |
| FR-TXN-001 | 거래 데이터 | POL-TXN-001 | C§3.1, C§3.2 | 6 |
| FR-TXN-002 | 거래 값 검증 | POL-TXN-002 | C§3.1 | 5 |
| FR-TXN-003 | 거래 등록 권한 | POL-TXN-003 | C§3.2 | 3 |
| FR-TXN-004 | 거래 수정·삭제 권한 | POL-TXN-004 | C§3.2 | 4 |
| FR-TXN-005 | 수정·삭제 동작 | POL-TXN-005 | C§3.2, C§3.3 | 8 |
| FR-TXN-006 | 동시 수정과 삭제된 거래 | POL-TXN-006 | C§3.5 | 4 |
| FR-TXN-007 | 중복 요청 방지 (Idempotency Key) | POL-TXN-007 | C§3.4 | 13 |
| FR-TXN-008 | 저장 실패 처리 | POL-TXN-008 | C§3.1, C§3.4, C§4.5 | 5 |
| FR-TXN-009 | 종료 후 일반 거래 잠금 | POL-TXN-009 | C§5.6, C§5.1 | 5 |
| FR-VIEW-001 | 누적 손익과 거래 내역 구분 | POL-VIEW-001 | C§4.1, C§4.3 | 2 |
| FR-VIEW-002 | 순손익 정렬 | POL-VIEW-002 | C§4.1 | 3 |
| FR-VIEW-003 | 거래 목록 정렬 | POL-VIEW-003 | C§4.2 | 6 |
| FR-VIEW-004 | 목록 페이지 단위와 참여자 필터 | POL-VIEW-004 | C§4.2, C§4.3 | 9 |
| FR-VIEW-005 | 실시간 반영 | POL-VIEW-005 | C§4.4 | 8 |
| FR-SET-001 | 게임 종료 | POL-SET-001 | C§5.1, C§5.6 | 9 |
| FR-SET-002 | 순손익 계산 | POL-SET-002 | C§5.3 | 5 |
| FR-SET-003 | 정산 매칭 | POL-SET-003 | C§5.3 | 7 |
| FR-SET-004 | 정산 항목 정렬 | POL-SET-004 | C§5.4 | 4 |
| FR-SET-005 | 정산 조회와 텍스트 복사 | POL-SET-005 | C§5.5, C§2.7 | 6 |
| FR-SET-006 | 정산 항목 없음 | POL-SET-006 | - | 3 |
| FR-SET-007 | 정산 확정·버전 없음 | POL-SET-007 | C§5.5, C§1.2 | 3 |
| FR-SET-008 | 예상 정산 | - | C§5.2, C§4.4 | 7 |
| FR-SYS-001 | 온라인 전용과 오래된 데이터 표시 금지 | POL-SYS-001 | C§4.5 | 5 |
| FR-SYS-002 | 연결 복구 | POL-SYS-002 | C§4.4, C§4.5, C§1.2 | 5 |
| FR-SYS-003 | 서버 최종 검증 | POL-SYS-003 | C§1.1 | 8 |

## 4. 연기·제외 항목의 부재 검증

| 제외 항목 | 부재를 검증하는 AC |
| --- | --- |
| 여러 거래 일괄 입력 | AC-TXN-001-5 |
| 정산 확정·버전 관리 | AC-SET-007-1, AC-SET-007-2 |
| 종료 후 정정 거래 | AC-TXN-009-4 |
| 방장 이전·강제 퇴장·초대 링크 재발급 | AC-ROOM-007-3 |
| 상세 감사 이력·감사 UI | AC-TXN-005-4 |
| 자동 종료·재개 | AC-SET-001-4, AC-SET-001-5 |
| 접근 만료·자동 삭제 | AC-SET-001-7 |
| 미저장 입력 초안 자동 복원 | AC-SYS-002-4 |
| RoomMember–Participant 연결·해제 | AC-ROOM-004-5 |

## 5. NFR 추적

| NFR | 근거 |
| --- | --- |
| NFR-001 데이터 정합성 | POL-SET-002, POL-TXN-005~007, C§5.3 |
| NFR-002 서버 권위 | POL-SYS-003, POL-TXN-004, POL-TXN-009 |
| NFR-003 멱등성 | C§3.4, C§5.1, 사용자 결정 OQ-026·OQ-040 |
| NFR-004 최신성 표시 | POL-SYS-001, POL-SYS-002, C§4.5 |
| NFR-005 익명성 | POL-ROOM-001, POL-ROOM-004, C§2.3 |
| NFR-006 실시간성 | POL-VIEW-005, C§4.4 |
| NFR-007 규모 한도 | C§2.5, 사용자 결정 OQ-004 |
| NFR-008 지원 환경 | C§6.1 |
| NFR-009 금액 정확성 | C§3.1, C§2.5 |
