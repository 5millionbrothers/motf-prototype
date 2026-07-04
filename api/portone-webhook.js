const { json } = require("./_utils");
const dns = require("dns");
const https = require("https");

const requiredEnv = ["PORTONE_API_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

const KNOWN_SUPABASE_URL = "https://izbwcqnvwsdijoognoag.supabase.co";
const DEAD_SUPABASE_HOSTS = new Set([
  "avvfqgtkeziughphppcj.supabase.co",
]);

function supabaseBaseUrl() {
  const configured = String(process.env.SUPABASE_URL || "").trim();
  try {
    const url = new URL(configured || KNOWN_SUPABASE_URL);
    if (DEAD_SUPABASE_HOSTS.has(url.hostname)) return KNOWN_SUPABASE_URL;
    return url.origin;
  } catch {
    return KNOWN_SUPABASE_URL;
  }
}

async function supabaseRequest(path, key, options = {}) {
  const result = await requestJson(`${supabaseBaseUrl()}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!result.ok) {
    const data = result.data;
    const error = new Error(data?.message || data?.error_description || "Supabase request failed.");
    error.statusCode = result.status;
    throw error;
  }
  return result.data;
}

async function requestJson(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("fetch timed out")), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return requestJsonWithHttps(url, options, timeoutMs);
  } finally {
    clearTimeout(timeout);
  }
}

function requestJsonWithHttps(urlString, options = {}, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const body = options.body || "";
    const headers = {
      ...(options.headers || {}),
      ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
    };
    const request = https.request({
      hostname: url.hostname,
      path: `${url.pathname}${url.search}`,
      method: options.method || "GET",
      timeout: timeoutMs,
      headers,
    }, (response) => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        responseBody += chunk;
      });
      response.on("end", () => {
        let data = null;
        try {
          data = responseBody ? JSON.parse(responseBody) : null;
        } catch {}
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode || 0,
          data,
        });
      });
    });
    request.on("timeout", () => {
      request.destroy(new Error("https timed out"));
    });
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
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
  return body?.paymentId
    || body?.payment_id
    || body?.id
    || body?.data?.paymentId
    || body?.data?.payment_id
    || body?.data?.id
    || body?.resource?.paymentId
    || body?.resource?.payment_id
    || body?.resource?.id;
}

function paymentStatus(payment) {
  return payment?.status || payment?.paymentStatus || "";
}

function isVirtualAccountIssuedStatus(status) {
  return [
    "VIRTUAL_ACCOUNT_ISSUED",
    "VIRTUAL_ACCOUNT_READY",
    "READY",
    "PAY_PENDING",
    "PAYMENT_PENDING",
    "PENDING",
    "WAITING_FOR_DEPOSIT",
    "WAITING_DEPOSIT",
    "DEPOSIT_READY",
    "VBANK_ISSUED",
    "ISSUED",
  ].includes(String(status || "").toUpperCase());
}

function ledgerOrderIdFromPaymentId(paymentId) {
  const value = String(paymentId || "").trim();
  if (value.startsWith("MS-")) return `MOTF-STAY-${value.slice(3)}`;
  if (value.startsWith("MM-")) return `MOTF-MARKET-${value.slice(3)}`;
  return value;
}

function inferWebhookStatus(body = {}) {
  const raw = [
    body.status,
    body.paymentStatus,
    body.type,
    body.eventType,
    body.event_type,
    body.data?.status,
    body.data?.paymentStatus,
    body.data?.type,
  ].filter(Boolean).join(" ").toUpperCase();
  if (raw.includes("PAID") || raw.includes("PAYMENT.PAID") || raw.includes("TRANSACTION.PAID")) return "PAID";
  if (raw.includes("CANCEL") || raw.includes("FAILED") || raw.includes("FAIL")) return "FAILED";
  if (raw.includes("VIRTUAL") || raw.includes("VBANK") || raw.includes("READY") || raw.includes("PENDING")) return "VIRTUAL_ACCOUNT_ISSUED";
  return "VIRTUAL_ACCOUNT_ISSUED";
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
    console.error("portone-webhook env missing", missing);
    return json(res, 200, { ok: false, accepted: true, message: `Webhook env missing: ${missing.join(", ")}` });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const paymentId = extractPaymentId(body);
    if (!paymentId) {
      console.warn("portone-webhook missing paymentId", body);
      return json(res, 200, { ok: false, accepted: true, message: "paymentId is required." });
    }

    const providerPaymentId = String(paymentId || "").trim();
    const candidateOrderIds = Array.from(new Set([
      providerPaymentId,
      ledgerOrderIdFromPaymentId(providerPaymentId),
    ].filter(Boolean)));
    const orderFilter = candidateOrderIds
      .map((id) => `order_id.eq.${encodeURIComponent(id)}`)
      .join(",");
    const query = `/rest/v1/payment_intents?select=order_id,customer_id,status,virtual_account&or=(${orderFilter})&limit=1`;
    const intents = await supabaseRequest(query, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const intent = intents?.[0];
    if (!intent) {
      console.warn("portone-webhook intent not found", { providerPaymentId, candidateOrderIds, body });
      return json(res, 200, { ok: false, accepted: true, message: "Payment intent was not found.", paymentId: providerPaymentId });
    }

    const ledgerOrderId = intent.order_id;
    let rawPayment = null;
    let lookupWarning = "";
    try {
      rawPayment = await getPortOnePayment(providerPaymentId);
    } catch (error) {
      lookupWarning = error.message || "PortOne lookup failed.";
      rawPayment = {
        ...(body && typeof body === "object" ? body : {}),
        id: ledgerOrderId,
        paymentId: ledgerOrderId,
        orderId: ledgerOrderId,
        portonePaymentId: providerPaymentId,
        motfProviderPaymentId: providerPaymentId,
        status: inferWebhookStatus(body),
      };
    }
    const payment = paymentForLedger(rawPayment, ledgerOrderId, providerPaymentId);
    const status = paymentStatus(payment);
    if (intent.status === "confirmed") {
      return json(res, 200, { ok: true, accepted: true, alreadyConfirmed: true });
    }

    if (isVirtualAccountIssuedStatus(status)) {
      const storedIntentAccount = pickVirtualAccount({ virtualAccount: intent.virtual_account || {} });
      if (intent.status === "virtual_account_issued" && hasVirtualAccountInfo(storedIntentAccount)) {
        return json(res, 200, { ok: true, accepted: true, alreadyIssued: true });
      }
      const issuedAccount = pickVirtualAccount(payment);
      if (!hasVirtualAccountInfo(issuedAccount)) {
        return json(res, 200, {
          ok: false,
          accepted: true,
          status: "virtual_account_issued",
          message: "Virtual account was issued but account info was not available yet.",
          lookupWarning,
        });
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
      return json(res, 200, { ok: true, accepted: true, status: "virtual_account_issued", lookupWarning });
    }

    if (status !== "PAID") {
      return json(res, 200, { ok: true, accepted: true, ignored: true, status, lookupWarning });
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
    return json(res, 200, { ok: true, accepted: true, transactionId: result?.transaction_id, kind: result?.kind, lookupWarning });
  } catch (error) {
    console.error("portone-webhook", error);
    return json(res, 200, {
      ok: false,
      accepted: true,
      code: "PORTONE_WEBHOOK_ERROR",
      message: error.message || "Webhook handling failed.",
    });
  }
};
