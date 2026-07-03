긴급 복구용 파일입니다.

목적:
- 방금 올린 진단/재시도 수정본 때문에 사이트 터치가 안 되는 문제를 먼저 복구합니다.
- 기준 파일은 _upload_20260704_portone_pending_block_fix 입니다.
- 이 버전은 결제 fetch failed 문제를 고치기 전 상태지만, 사이트 UI 터치는 살아있던 버전입니다.

업로드:
1. app.js 를 GitHub 저장소 루트 app.js에 덮어쓰기
2. api/confirm-payment.js 를 GitHub 저장소 api/confirm-payment.js에 덮어쓰기
3. Supabase SQL 실행 없음
4. Vercel 배포 후 motf.co.kr 강력 새로고침
