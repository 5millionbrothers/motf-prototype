const { json } = require("./_utils");
const https = require("https");

const requiredEnv = [
  "PORTONE_API_SECRET",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

async function safeFetch(label, url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (error) {
    const wrapped = new Error(`${label} fetch failed: ${error.message || error}`);
    wrapped.code = `${label}_FETCH_FAILED`;
    throw wrapped;
  }
}

async function supabaseRequest(path, key, options = {}) {
  const { label = "SUPABASE", ...requestOptions } = options;
  const response = await safeFetch(label, `${process.env.SUPABASE_URL}${path}`, {
    ...requestOptions,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(requestOptions.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`${label} error: ${data?.message || data?.error_description || "Supabase request failed."}`);
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

async function authenticatedUser(authorization) {
  if (!authorization?.startsWith("Bearer ")) return null;
  const response = await safeFetch("SUPABASE_AUTH", `${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: authorization,
    },
  });
  if (!response.ok) return null;
  return response.json();
}

async function getPaymentIntent(orderId) {
  const query = `/rest/v1/payment_intents?select=order_id,customer_id,amount,status,transaction_id,kind,expires_at&order_id=eq.${encodeURIComponent(orderId)}&limit=1`;
  const intents = await supabaseRequest(query, process.env.SUPABASE_SERVICE_ROLE_KEY, { label: "PAYMENT_INTENT" });
  return intents?.[0] || null;
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
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 600));
    try {
      const response = await safeFetch("PORTONE_LOOKUP", url, { headers });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(`PORTONE_LOOKUP error: ${data?.message || data?.type || "PortOne payment lookup failed."}`);
        error.statusCode = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      try {
        return await getJsonWithHttps(url, headers);
      } catch (httpsError) {
        lastError = new Error(`PORTONE_LOOKUP failed. fetch=${error.message || error}; https=${httpsError.message || httpsError}`);
        lastError.statusCode = httpsError.statusCode || error.statusCode;
      }
    }
  }
  throw lastError;
}

function paymentAmount(payment) {
  return Number(payment?.amount?.total ?? payment?.amount ?? payment?.totalAmount ?? 0);
}

function paymentStatus(payment) {
  return payment?.status || payment?.paymentStatus || "";
}

function isVirtualAccountStatus(status) {
  return ["VIRTUAL_ACCOUNT_ISSUED", "READY", "PENDING"].includes(status);
}

function paymentKey(payment) {
  return payment?.transactionId || payment?.txId || payment?.id;
}

function virtualAccountInfo(payment) {
  const source =
    payment?.virtualAccount ||
    payment?.virtual_account ||
    payment?.method?.virtualAccount ||
    payment?.method?.virtual_account ||
    (payment?.method?.type === "VIRTUAL_ACCOUNT" ? payment.method : null) ||
    payment?.paymentMethod?.virtualAccount ||
    payment?.paymentMethod?.virtual_account ||
    (payment?.paymentMethod?.type === "VIRTUAL_ACCOUNT" ? payment.paymentMethod : null) ||
    {};
  return {
    bankName: source.bankName || source.bank || source.bankCode || "",
    accountNumber: source.accountNumber || source.account_number || source.number || "",
    holderName: source.holderName || source.accountHolder || source.customerName || source.depositorName || "",
    dueDate: source.dueDate || source.expiry?.dueDate || source.accountExpiry?.dueDate || source.expiredAt || "",
    raw: source,
  };
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

async function applyPortOnePayment(userId, orderId, payment) {
  const intentPayment = normalizePaymentForIntent(payment, orderId);
  const status = paymentStatus(payment);
  if (status === "PAID") {
    const finalized = await supabaseRequest(
        "/rest/v1/rpc/finalize_payment_intent",
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          label: "FINALIZE_PAYMENT",
          method: "POST",
          body: JSON.stringify({
          target_customer_id: userId,
          target_order_id: orderId,
          target_payment_key: paymentKey(payment),
          portone_response: intentPayment,
        }),
      },
    );
    const result = Array.isArray(finalized) ? finalized[0] : finalized;
    return { status: "paid", transactionId: result?.transaction_id, kind: result?.kind };
  }

  if (isVirtualAccountStatus(status)) {
    const virtualAccount = virtualAccountInfo(payment);
    try {
      const issued = await supabaseRequest(
        "/rest/v1/rpc/mark_virtual_account_issued",
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          label: "MARK_VIRTUAL_ACCOUNT",
          method: "POST",
          body: JSON.stringify({
            target_customer_id: userId,
            target_order_id: orderId,
            portone_response: intentPayment,
          }),
        },
      );
      const result = Array.isArray(issued) ? issued[0] : issued;
      return { status: "virtual_account_issued", orderId: result?.order_id, virtualAccount: result?.virtual_account || virtualAccount };
    } catch (error) {
      console.error("mark_virtual_account_issued", error);
      return {
        status: "virtual_account_issued",
        orderId,
        virtualAccount,
        persistence: "failed",
        warning: error.message || "DB에 입금대기 저장을 완료하지 못했습니다.",
      };
    }
  }

  return { status: "pending", portoneStatus: status };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, message: "POST only." });
  }

  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length) {
    return json(res, 503, {
      ok: false,
      code: "PAYMENT_ENV_MISSING",
      message: `Payment server env is missing: ${missing.join(", ")}`,
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const paymentId = body.paymentId || body.orderId;
    const orderId = canonicalOrderId(body.orderId || body.paymentId);
    if (!paymentId || !orderId) return json(res, 400, { ok: false, message: "paymentId is required." });

    const payment = await getPortOnePayment(paymentId);
    const expectedAmount = Number(body.amount || 0);
    if (expectedAmount > 0 && paymentAmount(payment) !== expectedAmount) {
      return json(res, 400, { ok: false, message: "Payment amount does not match the client payment request." });
    }

    let user = null;
    let authWarning = "";
    try {
      user = await authenticatedUser(req.headers.authorization);
    } catch (error) {
      authWarning = error.message || "Supabase Auth 확인에 실패했습니다.";
    }
    if (!user?.id) {
      const status = paymentStatus(payment);
      if (isVirtualAccountStatus(status)) {
        return json(res, 200, {
          ok: true,
          status: "virtual_account_issued",
          orderId,
          virtualAccount: virtualAccountInfo(payment),
          persistence: "failed",
          warning: authWarning || "로그인 확인이 지연되어 관리자 저장은 보류되었습니다.",
        });
      }
      return json(res, 401, { ok: false, message: authWarning || "Login expired. Please sign in again." });
    }

    const intent = await getPaymentIntent(orderId);
    if (!intent || intent.customer_id !== user.id) {
      return json(res, 404, { ok: false, message: "Prepared payment was not found." });
    }
    if (intent.status === "confirmed") {
      return json(res, 200, { ok: true, status: "paid", transactionId: intent.transaction_id, kind: intent.kind, alreadyConfirmed: true });
    }
    if (new Date(intent.expires_at).getTime() < Date.now()) {
      return json(res, 410, { ok: false, message: "Prepared payment expired. Please try again." });
    }

    if (paymentAmount(payment) !== Number(intent.amount)) {
      return json(res, 400, { ok: false, message: "Payment amount does not match the server ledger." });
    }

    const applied = await applyPortOnePayment(user.id, orderId, payment);
    return json(res, 200, { ok: true, ...applied });
  } catch (error) {
    console.error("confirm-payment", error);
    return json(res, error.statusCode || 500, {
      ok: false,
      code: "PAYMENT_CONFIRM_ERROR",
      patch: "confirm-payment-portone-first-2026-06-29-1",
      message: error.message || "Payment confirmation failed.",
    });
  }
};
