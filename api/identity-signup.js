const { json } = require("./_utils");
const { env, requireEnv, requestJson, supabaseRequest } = require("./_server");
const { allowCors, readBody, passwordIsValid, verifiedSession, consumeSession, safeReturnUrl } = require("./_identity");

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { ok: false, message: "POST only." });
  let createdUserId = "";
  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);
    const body = await readBody(req);
    const accountType = body.accountType === "partner" ? "partner" : "user";
    const purpose = accountType === "partner" ? "owner_signup" : "signup";
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { ok: false, message: "이메일을 확인해주세요." });
    if (!passwordIsValid(password)) return json(res, 400, { ok: false, message: "비밀번호는 영문·숫자·특수문자를 포함한 8~12자리여야 합니다." });
    const identity = await verifiedSession(String(body.identityToken || ""), purpose);
    const duplicates = await supabaseRequest(`/rest/v1/profiles?identity_ci_hash=eq.${encodeURIComponent(identity.verified_ci_hash)}&withdrawal_processed_at=is.null&select=id&limit=1`);
    if (duplicates?.length) return json(res, 409, { ok: false, message: "이미 가입된 본인인증 정보입니다. 기존 계정으로 로그인하거나 비밀번호 찾기를 이용해주세요." });
    const emailDuplicates = await supabaseRequest(`/rest/v1/profiles?email=ilike.${encodeURIComponent(email)}&withdrawal_processed_at=is.null&select=id&limit=1`);
    if (emailDuplicates?.length) return json(res, 409, { ok: false, message: "이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해주세요." });
    const redirectTo = safeReturnUrl(body.emailRedirectTo, accountType === "partner" ? "https://motfowner.co.kr" : "https://motf.co.kr");
    const metadata = {
      account_type: accountType,
      full_name: identity.verified_name,
      phone: identity.verified_phone,
      birth_date: identity.verified_birth_date,
      ...(accountType === "partner" ? {
        business_type: body.businessType,
        business_name: String(body.businessName || "").trim(),
      } : {}),
    };
    const signup = await requestJson(`${env("SUPABASE_URL").replace(/\/$/, "")}/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      headers: { apikey: env("SUPABASE_PUBLISHABLE_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, data: metadata }),
    }, 12000);
    if (!signup.ok || !signup.data?.user?.id) {
      const error = new Error(signup.data?.msg || signup.data?.message || signup.data?.error_description || "회원가입에 실패했습니다.");
      error.statusCode = signup.status;
      throw error;
    }
    const userId = signup.data.user.id;
    if (Array.isArray(signup.data.user.identities) && signup.data.user.identities.length === 0) {
      return json(res, 409, { ok: false, message: "이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해주세요." });
    }
    createdUserId = userId;
    await supabaseRequest("/rest/v1/rpc/complete_identity_signup_profile", {
      method: "POST",
      body: JSON.stringify({
        target_user_id: userId,
        target_email: email,
        target_full_name: identity.verified_name,
        target_phone: identity.verified_phone,
        target_birth_date: identity.verified_birth_date,
        target_ci_hash: identity.verified_ci_hash,
        target_verified_at: identity.verified_at,
        target_is_adult: Boolean(identity.is_adult),
        target_account_type: accountType,
      }),
    });
    await consumeSession(identity.id, userId);
    createdUserId = "";
    return json(res, 200, { ok: true, emailConfirmationRequired: !signup.data.access_token });
  } catch (error) {
    if (createdUserId) {
      try {
        await supabaseRequest(`/auth/v1/admin/users/${encodeURIComponent(createdUserId)}`, { method: "DELETE" });
      } catch (rollbackError) {
        console.error("identity-signup rollback failed", { userId: createdUserId, message: rollbackError.message });
      }
    }
    console.error("identity-signup failed", { status: error.statusCode || 500, message: error.message });
    return json(res, error.statusCode || 500, { ok: false, message: error.message || "회원가입에 실패했습니다." });
  }
};
