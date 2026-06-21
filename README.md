# moTF 이용자 웹

대학생 MT 팀이 숙소를 예약하고 공판장 상품을 주문하는 이용자용 웹입니다.

## 저장소 역할

- 화면: 정적 HTML/CSS/JavaScript
- 인증·데이터: Supabase
- 배포: Vercel
- DB 마이그레이션 원본: [motf-database](https://github.com/5millionbrothers/motf-database)

이 저장소에는 DB SQL을 복사해 두지 않습니다. Supabase 변경은 반드시
`motf-database/supabase`에 다음 번호의 마이그레이션으로 추가합니다.

## 현재 연결된 기능

- 이용자 회원가입, 로그인, 계정 정보
- 승인된 숙소·공판장과 상품 조회
- 서버 검증을 거친 예약 요청과 공판장 주문
- 예약·주문 이용내역
- 실시간 채팅과 읽음 표시
- 문의·분쟁 접수

커뮤니티, 후기, 지도 좌표, 첨부파일 업로드와 실결제는 아직 완성 전입니다.
`/api/confirm-payment`는 잘못된 거래 생성을 막기 위해 의도적으로 501을 반환합니다.

## 설정과 배포

1. `config.js`에 Supabase URL과 Publishable Key를 설정합니다.
2. `motf-database`의 적용 예정 SQL을 Supabase SQL Editor에서 번호 순서대로 실행합니다.
3. 변경사항을 별도 브랜치에 올리고 Pull Request 검사를 통과시킵니다.
4. 승인 후 `main`에 합치면 Vercel이 배포합니다.

비밀 키와 `service_role` 키는 브라우저 코드나 GitHub에 넣지 않습니다.

## 배포 전 핵심 확인

- 일반 이용자로 로그인한 뒤 실제 상품이 보이는가
- 표시 가격을 브라우저에서 바꿔도 DB에는 원래 가격으로 저장되는가
- 일반 이용자가 다른 이용자의 예약·채팅을 읽을 수 없는가
- 사장님이 자기 업장의 거래만 읽고 처리할 수 있는가
- 데모 업장에서는 실제 예약·주문이 차단되는가
