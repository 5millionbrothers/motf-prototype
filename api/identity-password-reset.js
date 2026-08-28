const { json } = require("./_utils");
const { env, requireEnv, requestJson, supabaseRequest } = require("./_server");
const { allowCors, readBody, passwordIsValid, verifiedSession, consumeSession } = require("./_identity");

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { ok: false, message: "POST only." });
  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!passwordIsValid(password)) return json(res, 400, { ok: false, message: "비밀번호는 영문·숫자·특수문자를 포함한 8~12자리여야 합니다." });
    const identity = await verifiedSession(String(body.identityToken || ""), "password_reset");
    const profiles = await supabaseRequest(`/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,identity_ci_hash,status&limit=1`);
    const profile = profiles?.[0];
    if (!profile || profile.status !== "approved" || !profile.identity_ci_hash || profile.identity_ci_hash !== identity.verified_ci_hash) {
      return json(res, 403, { ok: false, message: "가입 정보와 본인인증 정보가 일치하지 않습니다." });
    }
    const base = env("SUPABASE_URL").replace(/\/$/, "");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const updated = await requestJson(`${base}/auth/v1/admin/users/${profile.id}`, {
      method: "PUT",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!updated.ok) throw new Error(updated.data?.message || "비밀번호를 변경하지 못했습니다.");
    await consumeSession(identity.id, profile.id);
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, error.statusCode || 500, { ok: false, message: error.message || "비밀번호를 변경하지 못했습니다." });
  }
};
