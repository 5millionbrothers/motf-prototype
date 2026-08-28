const { env, supabaseRequest } = require("./_server");
const { readBody, identityHash, normalizePhone, normalizeBirthDate, isAdult, kcpAdapter } = require("./_identity");

function callbackHtml(payload) {
  const serialized = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>본인인증 완료</title></head><body><p>본인인증 결과를 확인하고 있습니다.</p><script>const data=${serialized};let target="https://motf.co.kr";try{target=new URL(data.returnUrl).origin}catch{}if(window.opener){window.opener.postMessage(data,target);window.close();}else{location.replace(data.returnUrl||"https://motf.co.kr/");}</script></body></html>`;
}

module.exports = async function handler(req, res) {
  let callbackReturnUrl = "https://motf.co.kr/";
  try {
    const body = await readBody(req);
    const regCertKey = String(body.reg_cert_key || body.regCertKey || "");
    if (!regCertKey) throw new Error("KCP 거래등록키가 없습니다.");
    const rows = await supabaseRequest(`/rest/v1/identity_verification_sessions?provider_transaction_id=eq.${encodeURIComponent(regCertKey)}&status=eq.pending&select=*&limit=1`);
    const session = rows?.[0];
    if (!session) throw new Error("본인인증 세션을 찾지 못했습니다.");
    callbackReturnUrl = session.request_context?.return_url || callbackReturnUrl;
    if (String(body.res_cd || "") !== "0000") throw new Error(String(body.res_msg || "본인인증이 취소되었습니다."));

    const verified = await kcpAdapter("/v1/kcp/cert/result", {
      siteCode: env("KCP_CERT_SITE_CODE"),
      regCertKey,
      orderId: session.provider_response?.order_id,
    });
    const birthDate = normalizeBirthDate(verified.birthDate || verified.birth_day);
    const phone = normalizePhone(verified.phone || verified.phone_no);
    const name = String(verified.name || verified.user_name || "").trim();
    const ci = String(verified.ci || verified.CI || "");
    const di = String(verified.di || verified.DI || "");
    if (!birthDate || !phone || !name || !ci) throw new Error("KCP 인증 결과의 필수 정보가 누락되었습니다.");

    await supabaseRequest(`/rest/v1/identity_verification_sessions?id=eq.${session.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "verified",
        verified_name: name,
        verified_phone: phone,
        verified_birth_date: birthDate,
        verified_ci_hash: identityHash(ci),
        verified_di_hash: di ? identityHash(di) : null,
        is_adult: isAdult(birthDate),
        provider_response: { per_cert_no: verified.perCertNo || verified.per_cert_no || null },
        verified_at: new Date().toISOString(),
      }),
    });
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(callbackHtml({ type: "motf:kcp-identity", ok: true, returnUrl: session.request_context?.return_url }));
  } catch (error) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(callbackHtml({ type: "motf:kcp-identity", ok: false, message: error.message || "본인인증에 실패했습니다.", returnUrl: callbackReturnUrl }));
  }
};
