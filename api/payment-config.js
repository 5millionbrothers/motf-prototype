const { json } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { ok: false, message: "GET 요청만 사용할 수 있습니다." });
  }
  res.setHeader("Cache-Control", "no-store");
  return json(res, 200, {
    ok: true,
    portoneStoreId: process.env.PORTONE_STORE_ID || "",
    portoneChannelKey: process.env.PORTONE_CHANNEL_KEY || "",
    naverMapKeyId: process.env.NAVER_MAP_KEY_ID || "",
  });
};
