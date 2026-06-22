const { json } = require("./_utils");

const requiredEnv = [
  "TOSS_SECRET_KEY",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

async function supabaseRequest(path, key, options = {}) {
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || data?.error_description || "Supabase 요청에 실패했습니다.");
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

async function authenticatedUser(authorization) {
  if (!authorization?.startsWith("Bearer ")) return null;
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: authorization,
    },
  });
  if (!response.ok) return null;
  return response.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, message: "POST 요청만 사용할 수 있습니다." });
  }

  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length) {
    return json(res, 503, {
      ok: false,
      code: "PAYMENT_ENV_MISSING",
      message: `결제 서버 설정이 필요합니다: ${missing.join(", ")}`,
    });
  }

  try {
    const user = await authenticatedUser(req.headers.authorization);
    if (!user?.id) return json(res, 401, { ok: false, message: "로그인이 만료되었습니다. 다시 로그인해주세요." });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { paymentKey, orderId, amount } = body;
    if (!paymentKey || !orderId || !Number.isInteger(Number(amount)) || Number(amount) <= 0) {
      return json(res, 400, { ok: false, message: "결제 승인 정보가 올바르지 않습니다." });
    }

    const query = `/rest/v1/payment_intents?select=order_id,customer_id,amount,status,transaction_id,kind,expires_at&order_id=eq.${encodeURIComponent(orderId)}&limit=1`;
    const intents = await supabaseRequest(query, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const intent = intents?.[0];
    if (!intent || intent.customer_id !== user.id) {
      return json(res, 404, { ok: false, message: "결제 대기 내역을 찾을 수 없습니다." });
    }
    if (Number(intent.amount) !== Number(amount)) {
      return json(res, 400, { ok: false, message: "결제 금액이 서버 장부와 일치하지 않습니다." });
    }
    if (intent.status === "confirmed") {
      return json(res, 200, { ok: true, transactionId: intent.transaction_id, kind: intent.kind, alreadyConfirmed: true });
    }
    if (new Date(intent.expires_at).getTime() < Date.now()) {
      return json(res, 410, { ok: false, message: "결제 요청 시간이 만료되었습니다. 다시 결제를 준비해주세요." });
    }

    const tossResponse = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64")}`,
        "Content-Type": "application/json",
        "Idempotency-Key": orderId,
      },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    });
    const tossPayment = await tossResponse.json().catch(() => null);
    if (!tossResponse.ok) {
      return json(res, tossResponse.status, {
        ok: false,
        code: tossPayment?.code || "TOSS_CONFIRM_FAILED",
        message: tossPayment?.message || "토스 결제 승인에 실패했습니다.",
      });
    }

    const finalized = await supabaseRequest(
      "/rest/v1/rpc/finalize_payment_intent",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        method: "POST",
        body: JSON.stringify({
          target_customer_id: user.id,
          target_order_id: orderId,
          target_payment_key: paymentKey,
          payment_response: tossPayment,
        }),
      },
    );
    const result = Array.isArray(finalized) ? finalized[0] : finalized;
    return json(res, 200, {
      ok: true,
      transactionId: result?.transaction_id,
      kind: result?.kind,
    });
  } catch (error) {
    console.error("confirm-payment", error);
    return json(res, error.statusCode || 500, {
      ok: false,
      code: "PAYMENT_CONFIRM_ERROR",
      message: error.message || "결제 승인 중 오류가 발생했습니다.",
    });
  }
};
