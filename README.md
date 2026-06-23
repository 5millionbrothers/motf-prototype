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
- DB 가격 검증과 포트원 KG이니시스 가상계좌 입금 완료 후 생성되는 예약·공판장 주문
- 예약·주문 이용내역
- 실시간 채팅과 읽음 표시
- 문의·분쟁 접수
- 네이버 Dynamic Map 기반 숙소·공판장 지도와 마커

커뮤니티와 후기는 현재 프로토타입 UI 중심입니다. 지도는 네이버 Dynamic Map과
사장님 앱에서 저장한 좌표를 사용합니다. 주소 검색과 좌표 저장은 사장님 앱에서
처리하며, 이용자 화면은 저장된 좌표가 있는 승인 업장만 지도 마커로 표시합니다.
포트원 KG이니시스 가상계좌 결제는 `motf-database`의 21번, 26번 SQL과 Vercel 환경변수를
적용한 뒤 테스트 결제로 검증합니다.

## 설정과 배포

1. `config.js`에 Supabase URL과 Publishable Key를 설정합니다.
2. `motf-database`의 적용 예정 SQL을 Supabase SQL Editor에서 번호 순서대로 실행합니다.
3. 변경사항을 별도 브랜치에 올리고 Pull Request 검사를 통과시킵니다.
4. 승인 후 `main`에 합치면 Vercel이 배포합니다.

## 포트원 가상계좌 결제 환경변수

Vercel 프로젝트의 Development, Preview, Production 환경에 아래 값을 설정합니다.

```text
PORTONE_STORE_ID=포트원 상점 ID
PORTONE_CHANNEL_KEY=KG이니시스 채널 키
PORTONE_API_SECRET=포트원 V2 API Secret
NAVER_MAP_KEY_ID=네이버 지도 API Key ID
SUPABASE_URL=https://프로젝트.supabase.co
SUPABASE_PUBLISHABLE_KEY=Supabase Publishable Key
SUPABASE_SERVICE_ROLE_KEY=Supabase service_role Key
```

`PORTONE_API_SECRET`와 `SUPABASE_SERVICE_ROLE_KEY`는 GitHub, `config.js`, 브라우저 코드에
절대 입력하지 않습니다. Vercel 서버 환경변수에만 저장합니다.

비밀 키와 `service_role` 키는 브라우저 코드나 GitHub에 넣지 않습니다.

## 도메인 기준 설정

운영 기준 이용자 도메인은 아래 주소입니다.

```text
https://motf.co.kr
https://www.motf.co.kr
```

Supabase Authentication의 Redirect URLs, 네이버 클라우드 Maps 허용 도메인, 토스페이먼츠
성공/실패 URL 검수에는 위 도메인을 우선 등록합니다. Vercel 기본 주소는 테스트용으로만
유지합니다.

## 배포 전 핵심 확인

- 일반 이용자로 로그인한 뒤 실제 상품이 보이는가
- 표시 가격을 브라우저에서 바꿔도 DB에는 원래 가격으로 저장되는가
- 일반 이용자가 다른 이용자의 예약·채팅을 읽을 수 없는가
- 사장님이 자기 업장의 거래만 읽고 처리할 수 있는가
- 데모 업장에서는 실제 예약·주문이 차단되는가
