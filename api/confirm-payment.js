const { json } = require("./_utils");

const requiredEnv = [
  "PORTONE_API_SECRET",
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
    const error = new Error(data?.message || data?.error_description || "Supabase request failed.");
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

async function getPaymentIntent(orderId) {
  const query = `/rest/v1/payment_intents?select=order_id,customer_id,amount,status,transaction_id,kind,expires_at,virtual_account,virtual_account_issued_at,order_name&order_id=eq.${encodeURIComponent(orderId)}&limit=1`;
  const intents = await supabaseRequest(query, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return intents?.[0] || null;
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

function paymentAmount(payment) {
  return Number(payment?.amount?.total ?? payment?.amount ?? payment?.totalAmount ?? 0);
}

function paymentStatus(payment) {
  return payment?.status || payment?.paymentStatus || "";
}

function paymentKey(payment) {
  return payment?.transactionId || payment?.txId || payment?.id;
}

function pickVirtualAccount(payment) {
  const method = payment?.paymentMethod || payment?.payment_method || {};
  const detail = payment?.paymentMethodDetail || payment?.payment_method_detail || {};
  const account = payment?.virtualAccount
    || payment?.virtual_account
    || payment?.virtualAccountIssued
    || payment?.virtual_account_issued
    || (method.type === "VIRTUAL_ACCOUNT" ? method : null)
    || (detail.type === "VIRTUAL_ACCOUNT" ? detail : null)
    || {};

  const bank = account.bankName || account.bank || account.bankCode || account.bank_code || "";
  const accountNumber = account.accountNumber || account.account_number || account.number || "";
  const holderName = account.holderName || account.accountHolder || account.account_holder || account.customerName || "";
  const dueDate = account.dueDate || account.due_date || account.expiredAt || account.expiresAt || account.expiry || "";

  return {
    bank,
    bankName: account.bankName || bank,
    bankCode: account.bankCode || account.bank_code || "",
    accountNumber,
    holderName,
    dueDate,
    raw: account,
  };
}

function safePaymentFromClient(orderId, payment) {
  if (!payment || typeof payment !== "object") return null;
  const id = payment.id || payment.paymentId || payment.orderId;
  if (id && id !== orderId) return null;
  return {
    ...payment,
    id: id || orderId,
  };
}

async function applyPortOnePayment(userId, orderId, payment) {
  const status = paymentStatus(payment);
  if (status === "PAID") {
    const finalized = await supabaseRequest(
      "/rest/v1/rpc/finalize_payment_intent",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        method: "POST",
        body: JSON.stringify({
          target_customer_id: userId,
          target_order_id: orderId,
          target_payment_key: paymentKey(payment),
          portone_response: payment,
        }),
      },
    );
    const result = Array.isArray(finalized) ? finalized[0] : finalized;
    return { status: "paid", transactionId: result?.transaction_id, kind: result?.kind };
  }

  if (status === "VIRTUAL_ACCOUNT_ISSUED" || status === "READY") {
    const issued = await supabaseRequest(
      "/rest/v1/rpc/mark_virtual_account_issued",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        method: "POST",
        body: JSON.stringify({
          target_customer_id: userId,
          target_order_id: orderId,
          portone_response: payment,
        }),
      },
    );
    const result = Array.isArray(issued) ? issued[0] : issued;
    const storedAccount = result?.virtual_account && Object.keys(result.virtual_account).length
      ? result.virtual_account
      : null;
    return {
      status: "virtual_account_issued",
      orderId: result?.order_id,
      virtualAccount: pickVirtualAccount({ ...payment, virtualAccount: storedAccount || payment?.virtualAccount }),
    };
  }

  return { status: "pending", portoneStatus: status, virtualAccount: pickVirtualAccount(payment) };
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
    const user = await authenticatedUser(req.headers.authorization);
    if (!user?.id) return json(res, 401, { ok: false, message: "Login expired. Please sign in again." });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const orderId = body.paymentId || body.orderId;
    if (!orderId) return json(res, 400, { ok: false, message: "paymentId is required." });

    const intent = await getPaymentIntent(orderId);
    if (!intent || intent.customer_id !== user.id) {
      return json(res, 404, { ok: false, message: "Prepared payment was not found." });
    }
    if (intent.status === "confirmed") {
      return json(res, 200, { ok: true, status: "paid", transactionId: intent.transaction_id, kind: intent.kind, alreadyConfirmed: true });
    }
    if (intent.status === "virtual_account_issued" && intent.virtual_account && Object.keys(intent.virtual_account).length) {
      return json(res, 200, {
        ok: true,
        status: "virtual_account_issued",
        orderId: intent.order_id,
        orderName: intent.order_name,
        virtualAccount: pickVirtualAccount({ virtualAccount: intent.virtual_account }),
        alreadyIssued: true,
      });
    }
    if (new Date(intent.expires_at).getTime() < Date.now()) {
      return json(res, 410, { ok: false, message: "Prepared payment expired. Please try again." });
    }

    let payment;
    let lookupWarning = "";
    try {
      payment = await getPortOnePayment(orderId);
    } catch (error) {
      const fallback = safePaymentFromClient(orderId, body.portoneResponse);
      if (!fallback) throw error;
      payment = fallback;
      lookupWarning = error.message || "PortOne lookup failed; stored client response.";
    }

    const checkedAmount = paymentAmount(payment);
    if (checkedAmount > 0 && checkedAmount !== Number(intent.amount)) {
      return json(res, 400, { ok: false, message: "Payment amount does not match the server ledger." });
    }

    const applied = await applyPortOnePayment(user.id, orderId, payment);
    return json(res, 200, { ok: true, ...applied, lookupWarning });
  } catch (error) {
    console.error("confirm-payment", error);
    return json(res, error.statusCode || 500, {
      ok: false,
      code: "PAYMENT_CONFIRM_ERROR",
      message: error.message || "Payment confirmation failed.",
    });
  }
};
