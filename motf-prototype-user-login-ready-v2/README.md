# moTF prototype

대학생 MT 팀을 위한 숙소 예약, 공판장 주문, 커뮤니티, 채팅, 마이페이지 흐름을 확인하는 이용자용 MVP 프로토타입입니다.

현재 버전은 정적 프론트엔드와 Vercel Serverless API를 함께 사용합니다. 화면 데이터는 아직 대부분 브라우저 안의 mock data를 사용하며, 결제 승인 API에는 Toss Payments와 Supabase 저장 준비가 들어가 있습니다.

## 배포 구조

- Frontend: `index.html`, `styles.css`, `app.js`, `config.js`
- Assets: `assets/`
- API: `api/`
- Hosting: Vercel
- Database target: Supabase
- Payment target: Toss Payments

## GitHub에 올릴 파일

아래 파일과 폴더만 저장소에 올리면 됩니다.

- `api/`
- `assets/`
- `README.md`
- `app.js`
- `config.js`
- `index.html`
- `netlify.toml`
- `supabase/`
- `styles.css`
- `vercel.json`

로컬 백업 파일, zip 파일, 예전 실험용 `admin.html`, `provider.html` 등은 업로드하지 않습니다.

## Vercel 환경변수

Vercel 프로젝트 설정에서 아래 값을 추가해야 API가 정상 동작합니다.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TOSS_SECRET_KEY`

프론트에서 쓰는 공개 키는 현재 `config.js`의 `TOSS_CLIENT_KEY`, `NAVER_MAP_KEY_ID`에 둡니다. 실서비스 전에는 빌드 환경에 맞게 별도 관리하는 것을 권장합니다.

## 점검 API

배포 후 아래 주소에서 서버 환경변수 설정 여부를 확인할 수 있습니다.

```text
/api/health
```

이 API는 비밀키 값을 보여주지 않고, 설정 여부만 `true` 또는 `false`로 보여줍니다.

## 현재 단계

현재는 16단계 중 2단계인 데이터베이스 설계 단계입니다.

`docs/step-02-database-design.md`에는 비전공자용 DB 설계 설명이 있고, `supabase/schema.sql`에는 Supabase SQL Editor에 넣을 수 있는 테이블 생성 초안이 있습니다.

`docs/step-03-auth-and-permissions.md`에는 회원/권한 설계 설명이 있고, `supabase/rls.sql`에는 Supabase RLS 권한 정책 초안이 있습니다. RLS 정책은 운영 포털 MVP와 로그인 연결을 확인한 뒤 실행하는 것을 권장합니다.
