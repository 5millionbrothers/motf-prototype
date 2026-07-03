const { json } = require("./_utils");

const requiredEnv = ["PORTONE_API_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

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
    const error = new Error(data?.message || data?.error_description || "Supabase request failed.");
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

async function getPortOnePayment(paymentId) {
  const response = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `PortOne ${process.env.PORTONE_API_SECRET}`,
      "Content-Type": "application/json",
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || data?.type || "PortOne payment lookup failed.");
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

function extractPaymentId(body) {
  return body?.paymentId || body?.payment_id || body?.data?.paymentId || body?.data?.payment_id;
}

function paymentStatus(payment) {
  return payment?.status || payment?.paymentStatus || "";
}

function paymentKey(payment) {
  return payment?.transactionId || payment?.txId || payment?.portonePaymentId || payment?.motfProviderPaymentId || payment?.id;
}

function ledgerOrderIdFromPaymentId(paymentId) {
  const value = String(paymentId || "");
  if (/^MS-[0-9a-f]{32}$/i.test(value)) return `MOTF-STAY-${value.slice(3)}`;
  if (/^MM-[0-9a-f]{32}$/i.test(value)) return `MOTF-MARKET-${value.slice(3)}`;
  return value;
}

function paymentForLedger(payment, ledgerOrderId, providerPaymentId) {
  return {
    ...payment,
    originalPaymentId: payment?.id || payment?.paymentId || payment?.orderId || "",
    portonePaymentId: providerPaymentId,
    motfProviderPaymentId: providerPaymentId,
    id: ledgerOrderId,
    paymentId: ledgerOrderId,
    orderId: ledgerOrderId,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, message: "POST only." });
  }

  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length) {
    return json(res, 503, { ok: false, message: `Webhook env missing: ${missing.join(", ")}` });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const paymentId = extractPaymentId(body);
    if (!paymentId) return json(res, 400, { ok: false, message: "paymentId is required." });

    const ledgerOrderId = ledgerOrderIdFromPaymentId(paymentId);
    const payment = paymentForLedger(await getPortOnePayment(paymentId), ledgerOrderId, paymentId);
    if (paymentStatus(payment) !== "PAID") {
      return json(res, 200, { ok: true, ignored: true, status: paymentStatus(payment) });
    }

    const query = `/rest/v1/payment_intents?select=order_id,customer_id,status&order_id=eq.${encodeURIComponent(ledgerOrderId)}&limit=1`;
    const intents = await supabaseRequest(query, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const intent = intents?.[0];
    if (!intent) return json(res, 404, { ok: false, message: "Payment intent was not found." });
    if (intent.status === "confirmed") {
      return json(res, 200, { ok: true, alreadyConfirmed: true });
    }

    const finalized = await supabaseRequest(
      "/rest/v1/rpc/finalize_payment_intent",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        method: "POST",
        body: JSON.stringify({
          target_customer_id: intent.customer_id,
          target_order_id: ledgerOrderId,
          target_payment_key: paymentKey(payment),
          portone_response: payment,
        }),
      },
    );
    const result = Array.isArray(finalized) ? finalized[0] : finalized;
    return json(res, 200, { ok: true, transactionId: result?.transaction_id, kind: result?.kind });
  } catch (error) {
    console.error("portone-webhook", error);
    return json(res, error.statusCode || 500, {
      ok: false,
      code: "PORTONE_WEBHOOK_ERROR",
      message: error.message || "Webhook handling failed.",
    });
  }
};
