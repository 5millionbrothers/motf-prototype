const { json } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { ok: false, message: "GET 요청만 사용할 수 있습니다." });
  }
  res.setHeader("Cache-Control", "no-store");
  const enabledMethods = String(process.env.TOSS_ENABLED_METHODS || "CARD,TRANSFER")
    .split(",")
    .map((method) => method.trim().toUpperCase())
    .filter((method) => ["CARD", "TRANSFER", "VIRTUAL_ACCOUNT"].includes(method));
  return json(res, 200, {
    ok: true,
    tossClientKey: process.env.TOSS_CLIENT_KEY || "",
    enabledMethods: enabledMethods.length ? enabledMethods : ["CARD", "TRANSFER"],
    naverMapKeyId: process.env.NAVER_MAP_KEY_ID || "",
  });
};
