const { json } = require("./_utils");
const { supabaseRequest } = require("./_server");
const { allowCors, readBody, verifiedSession, consumeSession, authenticatedUser } = require("./_identity");

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { ok: false, message: "POST only." });
  try {
    const user = await authenticatedUser(String(req.headers.authorization || ""));
    if (!user?.id) return json(res, 401, { ok: false, message: "로그인이 만료되었습니다." });
    const body = await readBody(req);
    const identity = await verifiedSession(String(body.identityToken || ""), "profile_upgrade");
    const duplicates = await supabaseRequest(`/rest/v1/profiles?identity_ci_hash=eq.${encodeURIComponent(identity.verified_ci_hash)}&id=neq.${encodeURIComponent(user.id)}&withdrawal_processed_at=is.null&select=id&limit=1`);
    if (duplicates?.length) return json(res, 409, { ok: false, message: "이미 다른 계정에 연결된 본인인증 정보입니다." });
    await supabaseRequest(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        full_name: identity.verified_name,
        phone: identity.verified_phone,
        birth_date: identity.verified_birth_date,
        identity_provider: "kcp",
        identity_ci_hash: identity.verified_ci_hash,
        identity_verified_at: identity.verified_at,
        adult_verified_at: identity.is_adult ? identity.verified_at : null,
      }),
    });
    await consumeSession(identity.id, user.id);
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, error.statusCode || 500, { ok: false, message: error.message || "본인인증 정보를 연결하지 못했습니다." });
  }
};
