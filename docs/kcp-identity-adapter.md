# KCP 휴대폰 본인확인 어댑터 계약

KCP 본인확인은 거래등록과 결과 복호화에 KCP가 배포하는 공식 암복호화 라이브러리가 필요합니다. Vercel JavaScript에서 암호화를 임의 구현하지 않고, 공식 라이브러리를 실행할 수 있는 작은 서버를 별도로 둡니다.

## moTF가 호출하는 API

모든 요청은 `Authorization: Bearer <KCP_CERT_ADAPTER_SECRET>`을 확인해야 합니다.

### `POST /v1/kcp/cert/register`

입력:

```json
{
  "siteCode": "발급 사이트코드",
  "webSiteId": "선택값",
  "orderId": "MOTF-CERT-...",
  "returnUrl": "https://motf.co.kr/api/identity-callback",
  "state": "일회성 토큰",
  "purpose": "signup"
}
```

출력:

```json
{
  "regCertKey": "KCP 거래등록키",
  "callUrl": "KCP 인증창 호출 URL"
}
```

### `POST /v1/kcp/cert/result`

입력:

```json
{
  "siteCode": "발급 사이트코드",
  "regCertKey": "KCP 거래등록키",
  "orderId": "MOTF-CERT-..."
}
```

출력:

```json
{
  "name": "홍길동",
  "phone": "01012345678",
  "birthDate": "20010101",
  "ci": "복호화된 CI",
  "di": "복호화된 DI",
  "perCertNo": "KCP 인증번호"
}
```

## 보안 원칙

- CI/DI 원문은 로그나 DB에 저장하지 않습니다. moTF API에서 pepper를 섞어 SHA-256 해시로만 저장합니다.
- 어댑터는 공개 브라우저 호출을 받지 않고, moTF Vercel API에서 온 비밀값 인증 요청만 받습니다.
- KCP 사이트코드, 암호화 키, 어댑터 비밀값은 서버 환경변수에만 저장합니다.
- 운영 전 가입·비밀번호 재설정·카카오 가입정보 보완을 각각 실사용자 테스트합니다.
