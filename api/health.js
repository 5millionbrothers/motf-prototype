const { json } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { ok: false, message: "GET 요청만 사용할 수 있습니다." });
  }

  return json(res, 200, {
    ok: true,
    service: "motf-prototype",
    portonePatch: "virtual-account-deep-parse-2026-06-29-1",
    paymentConfigured: Boolean(
      process.env.PORTONE_STORE_ID &&
      process.env.PORTONE_CHANNEL_KEY &&
      process.env.PORTONE_API_SECRET,
    ),
  });
};
