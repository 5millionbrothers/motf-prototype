const { json, requireEnv, requireTossSecret, supabaseRequest, tossRequest } = require("./_server");

const MAX_SINGLE_PAYMENT_AMOUNT = 10_000_000;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false });
  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const paymentKey = String(body?.data?.paymentKey || body.paymentKey || "").trim();
    const hintedOrderId = String(body?.data?.orderId || body.orderId || "").trim();
    if (!paymentKey || !hintedOrderId) return json(res, 200, { ok: true, ignored: true });

    const intents = await supabaseRequest(
      `/rest/v1/payment_intents?select=id,order_id,customer_id,kind,amount,original_amount,status&order_id=eq.${encodeURIComponent(hintedOrderId)}&provider=eq.toss&limit=1`,
    );
    const intent = intents?.[0];
    if (!intent) return json(res, 200, { ok: true, ignored: true });
    const merchantKind = intent.kind === "market" ? "market" : "stay";
    const tossSecret = requireTossSecret(merchantKind);

    // Webhook payloads are never trusted directly. Re-fetch with the secret paired to the intent's MID.
    const payment = await tossRequest(`/v1/payments/${encodeURIComponent(paymentKey)}`, {}, tossSecret);
    const orderId = String(payment.orderId || "");
    if (orderId !== intent.order_id) {
      throw Object.assign(new Error("토스 결제 주문번호와 결제 원장이 일치하지 않습니다."), { statusCode: 409 });
    }

    const paidAmount = Number(payment.totalAmount || payment.balanceAmount || 0);
    if (payment.status === "DONE" && (paidAmount > MAX_SINGLE_PAYMENT_AMOUNT
      || Number(intent.amount) > MAX_SINGLE_PAYMENT_AMOUNT
      || Number(intent.original_amount || intent.amount) > MAX_SINGLE_PAYMENT_AMOUNT)) {
      const cancelledPayment = await tossRequest(`/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, {
        method: "POST",
        headers: { "TossPayments-Idempotency-Key": `motf-limit-cancel-${intent.id}` },
        body: JSON.stringify({ cancelReason: "단건 결제 한도 초과 자동 취소" }),
      }, tossSecret);
      await supabaseRequest(`/rest/v1/payment_intents?id=eq.${encodeURIComponent(intent.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled", provider_status: "CANCELED", payment_response: cancelledPayment }),
      });
      return json(res, 200, { ok: true, cancelled: true, reason: "PAYMENT_AMOUNT_LIMIT_EXCEEDED" });
    }
    if (payment.status === "DONE" && paidAmount !== Number(intent.amount)) {
      throw Object.assign(new Error("토스 결제 금액과 주문 금액이 일치하지 않습니다."), { statusCode: 409 });
    }

    if (payment.status === "DONE" && intent.status !== "confirmed") {
      await supabaseRequest("/rest/v1/rpc/finalize_toss_payment_intent", {
        method: "POST",
        body: JSON.stringify({
          target_customer_id: intent.customer_id,
          target_order_id: orderId,
          target_payment_key: paymentKey,
          toss_payment: payment,
        }),
      });
    } else if (["CANCELED", "PARTIAL_CANCELED", "ABORTED", "EXPIRED"].includes(payment.status)) {
      const mapped = {
        CANCELED: "cancelled",
        PARTIAL_CANCELED: "partial_cancelled",
        ABORTED: "aborted",
        EXPIRED: "expired",
      }[payment.status];
      await supabaseRequest(`/rest/v1/payment_intents?id=eq.${encodeURIComponent(intent.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: mapped, provider_status: payment.status, payment_response: payment }),
      });
      await supabaseRequest("/rest/v1/rpc/release_expired_checkout_intents", { method: "POST", body: "{}" });
    }
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error("toss-webhook", error);
    return json(res, 500, { ok: false, message: error.message || "Webhook processing failed." });
  }
};
