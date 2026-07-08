# moTF 알림톡 발송 구조

작성일: 2026-07-05

## 목적

카카오 알림톡 딜러사를 선택하기 전에도 알림 시스템 개발을 진행하기 위한 기초 구조입니다.

현재 단계에서는 실제 카카오톡 메시지를 보내지 않고 `mock_sent` 상태로 처리합니다.  
나중에 SOLAPI, NHN Cloud, 비즈톡 등 딜러사를 선택하면 `api/notifications-dispatch.js`의 mock 발송 부분을 실제 API 호출로 교체합니다.

## 구성

### Supabase

SQL 파일:

```text
motf-database/supabase/40_notification_foundation.sql
```

생성되는 주요 테이블:

| 테이블 | 의미 |
| --- | --- |
| `notification_templates` | 알림톡 내부 템플릿 목록 |
| `notification_outbox` | 앞으로 발송해야 할 알림 대기열 |
| `notification_logs` | 발송 성공/실패 기록 |

주요 RPC:

| 함수 | 의미 |
| --- | --- |
| `enqueue_notification` | 알림 발송 대기열에 새 알림 추가 |
| `claim_notification_batch` | 발송 대기 알림을 처리 중 상태로 가져오기 |
| `complete_notification` | 발송 결과를 성공/실패로 기록 |

### Vercel API

```text
motf-prototype/api/notifications-dispatch.js
```

역할:

1. `notification_outbox`에서 `queued` 상태 알림을 가져옵니다.
2. 현재는 실제 발송 대신 mock 발송 처리합니다.
3. 성공 시 `mock_sent` 상태로 변경하고 `notification_logs`에 기록합니다.
4. 실패 시 재시도 가능하도록 다시 `queued` 또는 최종 `failed`로 기록합니다.

## 보안

발송 API는 아래 둘 중 하나로만 실행됩니다.

1. 관리자 계정 로그인 토큰
2. Vercel 환경변수 `NOTIFICATION_DISPATCH_SECRET`과 요청 헤더 `x-notification-secret`

크론이나 서버 작업으로 자동 실행하려면 나중에 `NOTIFICATION_DISPATCH_SECRET`을 Vercel에 추가하고, 같은 값을 헤더로 보내면 됩니다.

## 수동 테스트 흐름

1. Supabase SQL Editor에서 `40_notification_foundation.sql` 실행
2. Supabase SQL Editor에서 테스트 알림 추가

```sql
select public.enqueue_notification(
  'manual_test',
  'USER_CHAT_RECEIVED_V1',
  'user',
  null,
  '테스트 이용자',
  '010-0000-0000',
  '{"고객명":"테스트 이용자","상대명":"모티프","관련건":"테스트"}'::jsonb,
  '{"채팅 확인":"https://motf.co.kr/chat"}'::jsonb,
  'manual_test_001',
  now()
);
```

3. 관리자 로그인 상태에서 아래 API 호출

```text
POST https://motf.co.kr/api/notifications-dispatch
Body: {"limit":20}
```

4. `notification_outbox`의 상태가 `mock_sent`로 바뀌고, `notification_logs`에 기록이 생기면 성공입니다.

## 다음 단계

## 자동 큐 적재 이벤트

SQL 파일:

```text
motf-database/supabase/41_notification_event_hooks.sql
```

아래 이벤트가 발생하면 `notification_outbox`에 자동으로 알림이 쌓입니다.

| 이벤트 | 쌓이는 알림 |
| --- | --- |
| 가상계좌 발급 | 이용자 가상계좌 발급 안내 |
| 예약 요청 생성 | 이용자 예약 요청 접수, 사장님 새 예약 요청 |
| 예약 확정 | 이용자 예약 확정, 관리자 예약 상태 변경 |
| 예약 취소/거절 | 이용자 예약 취소/환불 안내, 관리자 예약 상태 변경, 환불 필요 알림 |
| 공판장 주문 생성 | 이용자 주문 접수, 사장님 새 주문 요청, 관리자 새 주문 |
| 공판장 주문 상태 변경 | 이용자 주문 상태 변경, 환불 필요 시 관리자 알림 |
| 채팅 메시지 생성 | 상대방에게 채팅 도착 알림 |

채팅 알림은 같은 대화방/수신자 기준 약 5분 단위로 dedupe key가 묶여 과도하게 쌓이지 않도록 설계되어 있습니다.

## 풀커버리지 알림 보강

SQL 파일:

```text
motf-database/supabase/43_notification_full_coverage.sql
```

이 파일까지 실행하면 아래 알림이 추가로 자동 큐에 쌓입니다.

| 이벤트 | 쌓이는 알림 |
| --- | --- |
| 입금 기한 임박 | 이용자 입금 기한 안내 |
| 문의/분쟁 접수 | 관리자 새 문의 접수 |
| 문의 답변 또는 해결 | 이용자 문의 답변 등록 |
| 환불 상태 변경 | 이용자 환불 상태 변경 |
| 결제 처리 실패 | 관리자 결제 처리 확인 필요 |
| 정산 생성/상태 변경 | 사장님 정산 상태, 관리자 정산 상태 |
| 외부 객실 일정 반영 | 사장님 객실 일정 확인, 관리자 객실 상태 변경 |
| 수동 객실 차단/해제 | 관리자 객실 상태 변경 |
| 채팅 응답 지연 | 관리자 채팅 응답 확인 필요 |
| 알림 최종 실패 | 관리자 알림 발송 확인 필요 |

또한 운영자가 수동으로 호출할 수 있는 RPC도 추가됩니다.

| RPC | 용도 |
| --- | --- |
| `enqueue_owner_admin_notice` | 특정 사장님에게 운영 안내 발송 |
| `enqueue_owner_cancel_refund_request` | 특정 예약의 취소/환불 확인 요청 발송 |

## 남은 외부 연동 단계

1. 알림톡 딜러사 선택
2. 카카오 채널/발신 프로필 연결
3. 템플릿 승인 신청
4. 승인된 템플릿 코드를 `notification_templates.provider_template_code`에 입력
5. `notifications-dispatch.js`의 mock 발송부를 실제 딜러사 API 호출로 교체
6. 사장님 수락/취소용 일회용 토큰 페이지 구현

## 자동 발송 호출 준비

알림 발송 API는 이제 `POST`와 `GET`을 모두 지원합니다.

```text
GET  https://motf.co.kr/api/notifications-dispatch?limit=20
POST https://motf.co.kr/api/notifications-dispatch
```

지원하는 인증 방식:

| 방식 | 사용처 |
| --- | --- |
| `x-notification-secret: NOTIFICATION_DISPATCH_SECRET` | 수동 테스트, 외부 스케줄러 |
| `Authorization: Bearer CRON_SECRET` | Vercel Cron |
| `Authorization: Bearer NOTIFICATION_DISPATCH_SECRET` | 외부 스케줄러가 Authorization 헤더만 지원할 때 |
| 관리자 로그인 토큰 | 관리자 화면에서 직접 실행할 때 |

Vercel Cron은 `GET` 요청으로 실행되며, `CRON_SECRET` 환경변수가 있으면 자동으로 `Authorization: Bearer <CRON_SECRET>` 헤더를 붙입니다.

## 즉시 발송 구조

알림은 기본적으로 즉시 발송을 시도합니다.

SQL 파일:

```text
motf-database/supabase/42A_setup_notification_dispatch_secret.sql
motf-database/supabase/42B_notification_immediate_dispatch.sql
```

동작 방식:

1. 예약, 주문, 채팅 이벤트가 생깁니다.
2. Supabase가 `notification_outbox`에 발송 대기 알림을 생성합니다.
3. `notification_outbox`에 `queued` 알림이 생기는 순간 `pg_net`이 Vercel의 `/api/notifications-dispatch`를 비동기로 호출합니다.
4. Vercel API가 알림을 처리합니다.

비밀키는 SQL 함수에 직접 넣지 않고 Supabase Vault에 `motf_notification_dispatch_secret` 이름으로 저장합니다.

## 5분 Cron 백업

현재 `vercel.json`에는 아래처럼 5분마다 알림 발송 API를 호출하는 Cron도 등록되어 있습니다.

```json
{
  "path": "/api/notifications-dispatch",
  "schedule": "*/5 * * * *"
}
```

이 Cron은 메인 발송 수단이 아니라 보험 장치입니다. 즉시 발송이 순간적으로 실패하거나 Vercel/카카오 딜러사 API가 잠깐 흔들렸을 때, `queued` 상태로 남아 있는 알림을 다시 주워서 처리합니다.

이 설정은 실서비스 기준 구조입니다. Vercel Hobby 플랜에서는 자주 실행되는 Cron이 제한될 수 있으므로, 실제 배포 시 Pro 이상 플랜 업그레이드가 필요할 수 있습니다.

Vercel Cron 대신 외부 스케줄러를 쓰는 경우에는 cron-job.org, EasyCron, UptimeRobot 같은 서비스에서 `https://motf.co.kr/api/notifications-dispatch?limit=20`을 1~5분 주기로 호출하면 됩니다.

외부 스케줄러를 쓰는 경우에는 요청 헤더에 아래 둘 중 하나를 넣으면 됩니다.

```text
x-notification-secret: Vercel의 NOTIFICATION_DISPATCH_SECRET 값
```

또는

```text
Authorization: Bearer Vercel의 NOTIFICATION_DISPATCH_SECRET 값
```
