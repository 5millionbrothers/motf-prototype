const { json } = require("./_utils");
const https = require("https");

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

function portOneAuthHeader() {
  return `PortOne ${String(process.env.PORTONE_API_SECRET || "").replace(/^PortOne\s+/i, "").trim()}`;
}

function getJsonWithHttps(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: "GET",
      headers,
      family: 4,
      timeout: 8000,
    }, (response) => {
      let raw = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { raw += chunk; });
      response.on("end", () => {
        let data = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {
          const error = new Error("PortOne HTTPS response was not JSON.");
          error.statusCode = response.statusCode;
          reject(error);
          return;
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(data);
          return;
        }
        const error = new Error(data?.message || data?.type || `PortOne payment lookup failed with ${response.statusCode}.`);
        error.statusCode = response.statusCode;
        reject(error);
      });
    });
    req.on("timeout", () => req.destroy(new Error("PortOne HTTPS lookup timed out.")));
    req.on("error", reject);
    req.end();
  });
}

async function getPortOnePayment(paymentId) {
  const url = `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`;
  const headers = {
    Authorization: portOneAuthHeader(),
    "Content-Type": "application/json",
  };
  try {
    const response = await fetch(url, { headers });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.message || data?.type || "PortOne payment lookup failed.");
      error.statusCode = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    try {
      return await getJsonWithHttps(url, headers);
    } catch (httpsError) {
      const finalError = new Error(`PortOne lookup failed. fetch=${error.message || error}; https=${httpsError.message || httpsError}`);
      finalError.statusCode = httpsError.statusCode || error.statusCode;
      throw finalError;
    }
  }
}

function extractPaymentId(body) {
  return body?.paymentId || body?.payment_id || body?.data?.paymentId || body?.data?.payment_id;
}

function paymentStatus(payment) {
  return payment?.status || payment?.paymentStatus || "";
}

function paymentKey(payment) {
  return payment?.transactionId || payment?.txId || payment?.id;
}

function canonicalOrderId(value) {
  return String(value || "")
    .replace(/^MS-/, "MOTF-STAY-")
    .replace(/^MM-/, "MOTF-MARKET-");
}

function normalizePaymentForIntent(payment, orderId) {
  return {
    ...payment,
    id: orderId,
    paymentId: orderId,
    orderId,
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
    const orderId = canonicalOrderId(paymentId);

    const payment = await getPortOnePayment(paymentId);
    if (paymentStatus(payment) !== "PAID") {
      return json(res, 200, { ok: true, ignored: true, status: paymentStatus(payment) });
    }

    const query = `/rest/v1/payment_intents?select=order_id,customer_id,status&order_id=eq.${encodeURIComponent(orderId)}&limit=1`;
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
          target_order_id: orderId,
          target_payment_key: paymentKey(payment),
          portone_response: normalizePaymentForIntent(payment, orderId),
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
