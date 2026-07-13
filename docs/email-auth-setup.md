# 회원가입 이메일 설정

## 코드에서 준비된 흐름

1. 이메일 회원가입 직후 인증 메일 확인 안내를 표시합니다.
2. 사용자가 인증 링크를 눌러 로그인되면 `/api/welcome-email`이 최초 한 번만 가입 완료 메일을 발송합니다.
3. 가입 완료 메일은 Resend를 사용하며 발신자는 기본적으로 `모티프 <hello@motf.co.kr>`입니다.

## Vercel 환경변수

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `WELCOME_EMAIL_FROM`: 예시 `모티프 <hello@motf.co.kr>`

Resend에서 `motf.co.kr` 도메인 인증을 완료해야 실제 모티프 주소로 발송됩니다.

## Supabase 인증 메일의 발신자 변경

인증 링크 메일은 Supabase Auth가 직접 발송하므로 코드가 아니라 Dashboard에서 설정합니다.

1. Supabase Dashboard → Project Settings → Authentication → SMTP Settings
2. Custom SMTP 활성화
3. Resend 또는 선택한 메일 서비스의 SMTP Host, Port, Username, Password 입력
4. Sender name은 `모티프`, Sender email은 인증한 `hello@motf.co.kr` 입력
5. Authentication → Email Templates에서 제목과 본문을 모티프 문구로 수정

Custom SMTP를 설정하지 않으면 인증 메일의 발신자가 계속 Supabase 기본 주소로 보입니다.
