const { hasEnv, json } = require("./_utils");

const requiredEnv = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOSS_SECRET_KEY",
];

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { ok: false, message: "GET 요청만 사용할 수 있습니다." });
  }

  const env = Object.fromEntries(requiredEnv.map((name) => [name, hasEnv(name)]));
  const missing = requiredEnv.filter((name) => !env[name]);

  return json(res, missing.length ? 503 : 200, {
    ok: missing.length === 0,
    service: "motf-prototype",
    env,
    missing,
  });
};
