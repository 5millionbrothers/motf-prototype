이번 업로드는 api/confirm-payment.js 하나만 덮어씁니다.

수정 내용:
1. 예전 주문번호 구조(MOTF-STAY -> MS)와 새 짧은 주문번호 구조(MS)를 모두 허용합니다.
2. 현재 배포된 app.js가 clientPaymentWindowCompleted 플래그를 안 보내도, portoneResponse가 있고 에러 code가 없으면 결제창 완료로 인정합니다.
3. 포트원 서버 조회가 순간적으로 실패해도 payment_intents를 virtual_account_issued로 넘겨 관리자/사장님 입금대기 목록과 방막기에 반영합니다.
4. 저장된 virtual_account에 실제 계좌 정보가 없으면 다음 확인 때 다시 포트원 조회를 시도할 수 있게 했습니다.

업로드:
- GitHub motf-prototype 저장소의 api/confirm-payment.js만 이 파일로 덮어쓰기
- app.js는 건드리지 말기
- Supabase SQL 실행 없음
