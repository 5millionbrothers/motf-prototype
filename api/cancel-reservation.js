const { json } = require("./_utils");

const requiredEnv = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "PORTONE_API_SECRET"];

function env(name) {
  return String(process.env[name] || "").trim();
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { message: text }; }
}

async function supabaseRequest(path, key, options = {}) {
  const response = await fetch(`${env("SUPABASE_URL")}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error_description || "Supabase request failed.");
  return data;
}

async function authenticatedUser(authorization) {
  const response = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, {
    headers: { apikey: env("SUPABASE_PUBLISHABLE_KEY"), Authorization: authorization },
  });
  const data = await readJson(response);
  if (!response.ok || !data?.id) throw new Error("로그인이 만료되었습니다.");
  return data;
}

function portOnePaymentId(orderId) {
  return String(orderId || "")
    .replace(/^MOTF-STAY-/, "MS-")
    .replace(/^MOTF-MARKET-/, "MM-")
    .slice(0, 40);
}

function daysUntil(dateText) {
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [year, month, day] = String(dateText).split("-").map(Number);
  return Math.floor((Date.UTC(year, month - 1, day) - todayUtc) / 86400000);
}

function refundPercentFor(reservation, policy) {
  if (reservation.status === "pending") return 100;
  const days = daysUntil(reservation.check_in_date || reservation.event_date);
  const rows = Array.isArray(policy) ? [...policy] : [];
  rows.sort((a, b) => Number(b.days_before || 0) - Number(a.days_before || 0));
  return Number(rows.find((row) => days >= Number(row.days_before || 0))?.refund_percent || 0);
}

function portOneRefundStatus(data) {
  const raw = String(data?.cancellation?.status || data?.status || data?.cancellationStatus || "").toUpperCase();
  if (raw.includes("FAIL")) return "failed";
  if (raw.includes("SUCCEED") || raw.includes("SUCCESS") || raw.includes("COMPLETE") || raw.includes("CANCELLED")) return "refunded";
  return "processing";
}

async function cancelPortOnePayment(paymentId, reason, amount, currentCancellableAmount, refundAccount) {
  const payload = { reason, refundAccount, currentCancellableAmount };
  if (amount < currentCancellableAmount) payload.amount = amount;
  if (env("PORTONE_STORE_ID")) payload.storeId = env("PORTONE_STORE_ID");
  const response = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}/cancel`, {
    method: "POST",
    headers: { Authorization: `PortOne ${env("PORTONE_API_SECRET")}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJson(response);
  if (!response.ok) {
    const error = new Error(data?.message || data?.type || "PortOne refund request failed.");
    error.responseBody = data;
    throw error;
  }
  return data;
}

async function markCancelled({ reservationId, orderId, amount, percent, reason, refundStatus, responseBody }) {
  const now = new Date().toISOString();
  const reservationPayload = {
    status: "cancelled",
    customer_cancelled_at: now,
    cancellation_refund_percent: percent,
    refund_amount: amount,
    refund_reason: reason,
    refund_status: refundStatus,
    payment_status: refundStatus === "refunded" ? "refunded" : refundStatus === "processing" ? "refund_processing" : refundStatus === "failed" ? "refund_failed" : "paid",
    refund_response: responseBody,
    refund_requested_at: amount > 0 ? now : null,
    ...(refundStatus === "refunded" ? { refunded_at: now } : {}),
  };
  await Promise.all([
    supabaseRequest(`/rest/v1/reservations?id=eq.${encodeURIComponent(reservationId)}`, env("SUPABASE_SERVICE_ROLE_KEY"), {
      method: "PATCH", body: JSON.stringify(reservationPayload),
    }),
    supabaseRequest(`/rest/v1/payment_intents?order_id=eq.${encodeURIComponent(orderId)}`, env("SUPABASE_SERVICE_ROLE_KEY"), {
      method: "PATCH",
      body: JSON.stringify({
        refund_amount: amount, refund_reason: reason, refund_status: refundStatus,
        refund_response: responseBody, refund_requested_at: amount > 0 ? now : null,
        ...(refundStatus === "refunded" ? { refunded_at: now } : {}),
      }),
    }),
    supabaseRequest(`/rest/v1/stay_availability_blocks?reservation_id=eq.${encodeURIComponent(reservationId)}&status=eq.active`, env("SUPABASE_SERVICE_ROLE_KEY"), {
      method: "PATCH", body: JSON.stringify({ status: "cancelled", note: "customer cancellation" }),
    }),
  ]);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, message: "POST only." });
  const missing = requiredEnv.filter((name) => !env(name));
  if (missing.length) return json(res, 500, { ok: false, message: `환경변수가 없습니다: ${missing.join(", ")}` });

  try {
    const authorization = req.headers.authorization || "";
    if (!authorization.startsWith("Bearer ")) return json(res, 401, { ok: false, message: "로그인이 필요합니다." });
    const user = await authenticatedUser(authorization);
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const reservationId = String(body.reservationId || "").trim();
    const reason = String(body.reason || "이용자 예약 취소").trim();
    if (!reservationId) return json(res, 400, { ok: false, message: "예약 ID가 필요합니다." });

    const reservations = await supabaseRequest(
      `/rest/v1/reservations?select=id,customer_id,status,event_date,check_in_date,total_amount,base_accommodation_amount&customer_id=eq.${encodeURIComponent(user.id)}&id=eq.${encodeURIComponent(reservationId)}&limit=1`,
      env("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const reservation = reservations?.[0];
    if (!reservation) return json(res, 404, { ok: false, message: "예약을 찾을 수 없습니다." });
    if (!["pending", "confirmed"].includes(reservation.status)) return json(res, 409, { ok: false, message: "현재 상태에서는 취소할 수 없습니다." });

    const intents = await supabaseRequest(
      `/rest/v1/payment_intents?select=order_id,amount,status&kind=eq.stay&transaction_id=eq.${encodeURIComponent(reservationId)}&status=eq.confirmed&limit=1`,
      env("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const intent = intents?.[0];
    if (!intent) return json(res, 409, { ok: false, message: "연결된 결제 내역을 찾을 수 없습니다." });

    const businesses = await supabaseRequest(
      `/rest/v1/reservations?select=businesses(refund_policy)&id=eq.${encodeURIComponent(reservationId)}&limit=1`,
      env("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const policy = businesses?.[0]?.businesses?.refund_policy || [];
    const percent = refundPercentFor(reservation, policy);
    const amount = Math.floor(Number(intent.amount || 0) * percent / 100);

    if (amount <= 0) {
      await markCancelled({ reservationId, orderId: intent.order_id, amount: 0, percent, reason, refundStatus: "none", responseBody: { policyApplied: true, refundPercent: percent } });
      return json(res, 200, { ok: true, refundStatus: "none", refundAmount: 0, refundPercent: percent, message: "예약이 취소되었습니다. 현재 취소 규정상 환불 금액은 없습니다." });
    }

    const accounts = await supabaseRequest(
      `/rest/v1/customer_refund_accounts?select=bank,account_number,holder_name,phone&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      env("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const account = accounts?.[0];
    if (!account) return json(res, 409, { ok: false, message: "환불계좌가 없습니다. 예약 화면에서 환불계좌를 등록하거나 운영팀에 문의해주세요." });
    const refundAccount = {
      bank: account.bank,
      number: String(account.account_number).replace(/\D/g, ""),
      holderName: account.holder_name,
      ...(account.phone ? { holderPhoneNumber: String(account.phone).replace(/\D/g, "") } : {}),
    };

    const cancelResponse = await cancelPortOnePayment(portOnePaymentId(intent.order_id), reason, amount, Number(intent.amount), refundAccount);
    const refundStatus = portOneRefundStatus(cancelResponse);
    await markCancelled({ reservationId, orderId: intent.order_id, amount, percent, reason, refundStatus, responseBody: cancelResponse });
    return json(res, 200, {
      ok: true, refundStatus, refundAmount: amount, refundPercent: percent,
      message: `${percent}% 환불 ${amount.toLocaleString("ko-KR")}원이 ${refundStatus === "refunded" ? "완료되었습니다." : "접수되었습니다."}`,
    });
  } catch (error) {
    console.error("cancel-reservation", error);
    return json(res, 502, { ok: false, message: error.message || "예약 취소를 처리하지 못했습니다." });
  }
};
