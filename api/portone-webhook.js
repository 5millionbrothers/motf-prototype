const { json } = require("./_utils");
const dns = require("dns");
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

async function getPortOnePayment(paymentId) {
  const path = `/payments/${encodeURIComponent(paymentId)}`;
  try {
    return await Promise.any([
      getPortOnePaymentWithFetch(path).catch((error) => {
        error.lookupMethod = "fetch";
        throw error;
      }),
      getPortOnePaymentWithHttps(path).catch((error) => {
        error.lookupMethod = "https-ipv4";
        throw error;
      }),
    ]);
  } catch (error) {
    const details = error instanceof AggregateError
      ? error.errors.map((item) => `${item.lookupMethod || "lookup"}: ${item.message}`).join(" | ")
      : error.message;
    const statusCode = error instanceof AggregateError
      ? error.errors.find((item) => item.statusCode)?.statusCode
      : error.statusCode;
    const lookupError = new Error(`PortOne payment lookup failed: ${details || "network error"}`);
    lookupError.statusCode = statusCode || 502;
    throw lookupError;
  }
}

async function getPortOnePaymentWithFetch(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("PortOne fetch lookup timed out.")), 4500);
  try {
    const response = await fetch(`https://api.portone.io${path}`, {
      signal: controller.signal,
      headers: {
        Authorization: `PortOne ${String(process.env.PORTONE_API_SECRET || "").trim()}`,
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
  } finally {
    clearTimeout(timeout);
  }
}

function getPortOnePaymentWithHttps(path) {
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: "api.portone.io",
      path,
      method: "GET",
      family: 4,
      timeout: 4500,
      lookup: (hostname, options, callback) => dns.lookup(hostname, { ...options, family: 4 }, callback),
      headers: {
        Authorization: `PortOne ${String(process.env.PORTONE_API_SECRET || "").trim()}`,
        "Content-Type": "application/json",
      },
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        let data = null;
        try {
          data = body ? JSON.parse(body) : null;
        } catch (error) {
          reject(new Error("PortOne returned invalid JSON."));
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const error = new Error(data?.message || data?.type || "PortOne payment lookup failed.");
          error.statusCode = response.statusCode;
          reject(error);
          return;
        }
        resolve(data);
      });
    });
    request.on("timeout", () => {
      request.destroy(new Error("PortOne payment lookup timed out."));
    });
    request.on("error", reject);
    request.end();
  });
}

function extractPaymentId(body) {
  return body?.paymentId || body?.payment_id || body?.data?.paymentId || body?.data?.payment_id;
}

function paymentStatus(payment) {
  return payment?.status || payment?.paymentStatus || "";
}

function isVirtualAccountIssuedStatus(status) {
  return ["VIRTUAL_ACCOUNT_ISSUED", "READY", "PAY_PENDING", "PENDING"].includes(String(status || "").toUpperCase());
}

function paymentKey(payment) {
  return payment?.transactionId || payment?.txId || payment?.portonePaymentId || payment?.motfProviderPaymentId || payment?.id;
}

function pickVirtualAccountValue(source, keys) {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null && source[key] !== "") return source[key];
  }
  return "";
}

function findVirtualAccountSource(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  const preferred =
    value.virtualAccount ||
    value.virtual_account ||
    value.vbank ||
    value.vBank ||
    value.vbankIssued ||
    value.virtualAccountIssued ||
    value.virtual_account_issued ||
    value.bankAccount ||
    value.account ||
    value.paymentMethodDetail ||
    value.payment_method_detail ||
    value.paymentMethod ||
    value.payment_method;
  if (preferred && typeof preferred === "object") {
    const found = findVirtualAccountSource(preferred, seen);
    if (found) return found;
  }
  const accountNumber = pickVirtualAccountValue(value, [
    "accountNumber", "account_number", "accountNo", "account_no", "account", "number",
    "bankAccountNumber", "virtualAccountNumber", "vbankNum", "vbank_num", "vbankNumber",
  ]);
  const bankName = pickVirtualAccountValue(value, [
    "bankName", "bank_name", "bank", "bankCode", "bank_code", "bankId", "bank_id",
  ]);
  const holderName = pickVirtualAccountValue(value, [
    "holderName", "holder_name", "accountHolder", "account_holder", "customerName",
    "depositorName", "depositor", "ownerName", "owner",
  ]);
  const dueDate = pickVirtualAccountValue(value, [
    "dueDate", "due_date", "expiredAt", "expired_at", "expiresAt", "expires_at",
    "expiryDate", "expiry_date",
  ]) || value.expiry?.dueDate || value.expiry?.due_date || value.accountExpiry?.dueDate || value.accountExpiry?.due_date;
  if (accountNumber || (bankName && holderName) || dueDate) return value;
  for (const child of Object.values(value)) {
    const found = findVirtualAccountSource(child, seen);
    if (found) return found;
  }
  return null;
}

function pickVirtualAccount(payment) {
  const account = findVirtualAccountSource(payment) || {};
  const bank = pickVirtualAccountValue(account, ["bankName", "bank_name", "bank", "bankCode", "bank_code", "bankId", "bank_id"]);
  const accountNumber = pickVirtualAccountValue(account, [
    "accountNumber", "account_number", "accountNo", "account_no", "account", "number",
    "bankAccountNumber", "virtualAccountNumber", "vbankNum", "vbank_num", "vbankNumber",
  ]);
  const holderName = pickVirtualAccountValue(account, [
    "holderName", "holder_name", "accountHolder", "account_holder", "customerName",
    "depositorName", "depositor", "ownerName", "owner",
  ]);
  const dueDate = pickVirtualAccountValue(account, [
    "dueDate", "due_date", "expiredAt", "expired_at", "expiresAt", "expires_at",
    "expiryDate", "expiry_date",
  ]) || account.expiry?.dueDate || account.expiry?.due_date || account.accountExpiry?.dueDate || account.accountExpiry?.due_date || "";
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

function hasVirtualAccountInfo(account = {}) {
  return Boolean(account.bankName || account.accountNumber || account.holderName || account.dueDate);
}

function paymentForLedger(payment, ledgerOrderId, providerPaymentId) {
  const virtualAccount = pickVirtualAccount(payment);
  return {
    ...payment,
    originalPaymentId: payment?.id || payment?.paymentId || payment?.orderId || "",
    portonePaymentId: providerPaymentId,
    motfProviderPaymentId: providerPaymentId,
    virtualAccount: hasVirtualAccountInfo(virtualAccount) ? virtualAccount : payment?.virtualAccount,
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

    const ledgerOrderId = String(paymentId || "").trim();
    const payment = paymentForLedger(await getPortOnePayment(paymentId), ledgerOrderId, paymentId);
    const status = paymentStatus(payment);

    const query = `/rest/v1/payment_intents?select=order_id,customer_id,status&order_id=eq.${encodeURIComponent(ledgerOrderId)}&limit=1`;
    const intents = await supabaseRequest(query, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const intent = intents?.[0];
    if (!intent) return json(res, 404, { ok: false, message: "Payment intent was not found." });
    if (intent.status === "confirmed") {
      return json(res, 200, { ok: true, alreadyConfirmed: true });
    }

    if (isVirtualAccountIssuedStatus(status)) {
      if (intent.status === "virtual_account_issued") {
        return json(res, 200, { ok: true, alreadyIssued: true });
      }
      await supabaseRequest(
        "/rest/v1/rpc/mark_virtual_account_issued",
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          method: "POST",
          body: JSON.stringify({
            target_customer_id: intent.customer_id,
            target_order_id: ledgerOrderId,
            portone_response: payment,
          }),
        },
      );
      return json(res, 200, { ok: true, status: "virtual_account_issued" });
    }

    if (status !== "PAID") {
      return json(res, 200, { ok: true, ignored: true, status });
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
