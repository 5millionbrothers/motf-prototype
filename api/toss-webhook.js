const { json, requireEnv, supabaseRequest, tossRequest } = require("./_server");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false });
  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TOSS_SECRET_KEY"]);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const paymentKey = String(body?.data?.paymentKey || body.paymentKey || "").trim();
    const hintedOrderId = String(body?.data?.orderId || body.orderId || "").trim();
    if (!paymentKey) return json(res, 200, { ok: true, ignored: true });

    // Webhook payloads are never trusted directly. Re-fetch the payment with the Toss secret key.
    const payment = await tossRequest(`/v1/payments/${encodeURIComponent(paymentKey)}`);
    const orderId = String(payment.orderId || hintedOrderId || "");
    const intents = await supabaseRequest(
      `/rest/v1/payment_intents?select=id,order_id,customer_id,status&order_id=eq.${encodeURIComponent(orderId)}&provider=eq.toss&limit=1`,
    );
    const intent = intents?.[0];
    if (!intent) return json(res, 200, { ok: true, ignored: true });

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
