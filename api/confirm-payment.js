const { json } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, message: "POST 요청만 사용할 수 있습니다." });
  }

  // 이전 코드는 브라우저가 보낸 금액을 신뢰하고 현재 DB에 없는 테이블과
  // 컬럼에 기록했다. 결제 원장을 설계하기 전까지 잘못된 거래 생성을 막는다.
  return json(res, 501, {
    ok: false,
    code: "PAYMENT_NOT_CONFIGURED",
    message: "실결제 기능은 아직 준비 중입니다.",
  });
};
