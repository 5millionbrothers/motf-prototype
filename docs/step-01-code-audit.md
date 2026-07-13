# 1단계 코드 정리 노트

## 현재 상태

- 이용자 화면은 `index.html`, `styles.css`, `app.js` 중심의 정적 프론트엔드입니다.
- Vercel Serverless API는 `api/` 폴더에 있습니다.
- 현재 화면 데이터는 대부분 `app.js` 안의 mock data입니다.
- 결제 승인 API는 Toss Payments 승인 후 Supabase REST API에 결제/예약/주문 기록을 저장하도록 준비되어 있습니다.

## 이번 단계에서 정리한 것

- 서버 공통 함수 분리: `api/_utils.js`
- 환경변수 점검 API 추가: `api/health.js`
- Toss 프론트 Client Key를 `config.js`에서 관리하도록 변경
- README를 Vercel/Supabase/Toss 기준으로 최신화
- 업로드 제외 기준 `.gitignore` 추가

## 아직 mock data인 영역

- 숙소 목록
- 객실 목록
- 공판장 목록
- 상품 목록
- 커뮤니티 게시글/댓글/공감
- 채팅 메시지/읽음 상태
- 마이페이지 이용 내역

## 다음 단계에서 할 일

2단계는 데이터베이스 설계입니다.

아래 항목을 Supabase 테이블로 옮길 수 있게 설계해야 합니다.

- 회원/권한
- 사장님/업체
- 숙소/객실
- 공판장/상품
- 예약/주문/결제
- 채팅/메시지
- 게시판/게시글/댓글/공감
- 리뷰
- 첨부파일
- 문의/분쟁
- 예결산 파일
