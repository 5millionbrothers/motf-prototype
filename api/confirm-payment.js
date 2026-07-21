const { json } = require("./_utils");
const dns = require("dns");
const https = require("https");

const requiredEnv = [
  "PORTONE_API_SECRET",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

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
    const rawMessage = data?.message || data?.error_description || "Supabase request failed.";
    const permissionMessage = String(rawMessage).toLowerCase().includes("permission denied")
      ? "Supabase 서버 권한이 없습니다. Vercel의 SUPABASE_SERVICE_ROLE_KEY가 현재 Supabase 프로젝트의 service_role/secret key인지 확인해주세요."
      : rawMessage;
    const error = new Error(permissionMessage);
    error.statusCode = result.status;
    error.supabaseMessage = rawMessage;
    throw error;
  }
  return result.data;
}

async function authenticatedUser(authorization) {
  if (!authorization?.startsWith("Bearer ")) return null;
  const result = await requestJson(`${supabaseBaseUrl()}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: authorization,
    },
  });
  if (!result.ok) return null;
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

async function getPaymentIntent(orderId) {
  const query = `/rest/v1/payment_intents?select=order_id,customer_id,amount,status,transaction_id,kind,expires_at,virtual_account,virtual_account_issued_at,order_name&order_id=eq.${encodeURIComponent(orderId)}&limit=1`;
  const intents = await supabaseRequest(query, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return intents?.[0] || null;
}

async function getPortOnePayment(paymentId, diagnostics = {}) {
  const startedAt = Date.now();
  const path = `/payments/${encodeURIComponent(paymentId)}`;
  try {
    const payment = await Promise.any([
      getPortOnePaymentWithFetch(path).catch((error) => {
        error.lookupMethod = "fetch";
        throw error;
      }),
      getPortOnePaymentWithHttps(path).catch((error) => {
        error.lookupMethod = "https-ipv4";
        throw error;
      }),
    ]);
    diagnostics.portoneLookup = {
      ok: true,
      status: 200,
      durationMs: Date.now() - startedAt,
      type: payment?.type || "",
      message: "",
    };
    return payment;
  } catch (error) {
    const aggregateDetails = error instanceof AggregateError
      ? error.errors.map((item) => `${item.lookupMethod || "lookup"}: ${item.message}`).join(" | ")
      : error.message;
    const aggregateStatus = error instanceof AggregateError
      ? error.errors.find((item) => item.statusCode)?.statusCode
      : error.statusCode;
    diagnostics.portoneLookup = {
      ok: false,
      durationMs: Date.now() - startedAt,
      message: aggregateDetails || "fetch failed",
    };
    const lookupError = new Error(`PortOne payment lookup failed: ${aggregateDetails || "network error"}`);
    lookupError.stage = "portone_lookup";
    lookupError.statusCode = aggregateStatus || 502;
    lookupError.diagnostics = diagnostics;
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

function paymentAmount(payment) {
  return Number(payment?.amount?.total ?? payment?.amount ?? payment?.totalAmount ?? 0);
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

function paymentKey(payment) {
  return payment?.transactionId || payment?.txId || payment?.portonePaymentId || payment?.motfProviderPaymentId || payment?.id;
}

function portOnePaymentId(orderId) {
  return String(orderId || "")
    .trim()
    .replace(/^MOTF-STAY-/, "MS-")
    .replace(/^MOTF-MARKET-/, "MM-")
    .slice(0, 40);
}

function ledgerOrderIdFromPaymentId(paymentId) {
  const value = String(paymentId || "").trim();
  if (value.startsWith("MS-")) return `MOTF-STAY-${value.slice(3)}`;
  if (value.startsWith("MM-")) return `MOTF-MARKET-${value.slice(3)}`;
  return value;
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

async function applyPortOnePayment(userId, orderId, payment, providerPaymentId, forceVirtualAccountIssued = false) {
  const status = paymentStatus(payment);
  const virtualAccount = pickVirtualAccount(payment);
  const hasVirtualAccount = hasVirtualAccountInfo(virtualAccount);
  if (status === "PAID") {
    const finalized = await supabaseRequest(
      "/rest/v1/rpc/finalize_payment_intent",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        method: "POST",
        body: JSON.stringify({
          target_customer_id: userId,
          target_order_id: orderId,
          target_payment_key: paymentKey(payment) || providerPaymentId,
          portone_response: payment,
        }),
      },
    );
    const result = Array.isArray(finalized) ? finalized[0] : finalized;
    return { status: "paid", transactionId: result?.transaction_id, kind: result?.kind };
  }

  if ((forceVirtualAccountIssued || isVirtualAccountIssuedStatus(status) || hasVirtualAccount) && hasVirtualAccount) {
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
      virtualAccount: pickVirtualAccount({ ...payment, virtualAccount: storedAccount || payment?.virtualAccount || virtualAccount }),
    };
  }

  return { status: "pending", portoneStatus: status, virtualAccount };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, message: "POST only." });
  }

  const diagnostics = {
    stage: "start",
    hasClientResponse: false,
  };

  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length) {
    return json(res, 503, {
      ok: false,
      code: "PAYMENT_ENV_MISSING",
      message: `Payment server env is missing: ${missing.join(", ")}`,
      diagnostics: { ...diagnostics, stage: "env_check", missing },
    });
  }

  try {
    diagnostics.stage = "auth";
    const user = await authenticatedUser(req.headers.authorization);
    if (!user?.id) return json(res, 401, { ok: false, message: "Login expired. Please sign in again." });

    diagnostics.stage = "parse_body";
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const ledgerOrderId = String(body.orderId || ledgerOrderIdFromPaymentId(body.paymentId) || "").trim();
    const providerPaymentId = String(body.paymentId || portOnePaymentId(ledgerOrderId) || "").trim();
    diagnostics.orderId = ledgerOrderId;
    diagnostics.paymentId = providerPaymentId;
    diagnostics.requestedAmount = Number(body.amount || 0) || null;
    diagnostics.hasClientResponse = Boolean(body.portoneResponse && typeof body.portoneResponse === "object");
    diagnostics.clientResponseKeys = diagnostics.hasClientResponse ? Object.keys(body.portoneResponse).slice(0, 30) : [];
    if (!ledgerOrderId) return json(res, 400, { ok: false, message: "orderId is required." });
    const allowedProviderPaymentIds = new Set([
      ledgerOrderId,
      portOnePaymentId(ledgerOrderId),
    ].filter(Boolean));
    if (providerPaymentId && !allowedProviderPaymentIds.has(providerPaymentId)) {
      return json(res, 400, {
        ok: false,
        message: "Payment id does not match the prepared order id.",
        diagnostics: { ...diagnostics, stage: "id_match" },
      });
    }

    diagnostics.stage = "load_intent";
    const intent = await getPaymentIntent(ledgerOrderId);
    if (!intent || intent.customer_id !== user.id) {
      return json(res, 404, {
        ok: false,
        message: "Prepared payment was not found.",
        diagnostics: { ...diagnostics, stage: "load_intent", intentFound: Boolean(intent) },
      });
    }
    diagnostics.intentStatus = intent.status;
    diagnostics.intentAmount = Number(intent.amount);
    if (intent.status === "confirmed") {
      return json(res, 200, { ok: true, status: "paid", transactionId: intent.transaction_id, kind: intent.kind, alreadyConfirmed: true, diagnostics });
    }
    const storedIntentAccount = pickVirtualAccount({ virtualAccount: intent.virtual_account || {} });
    if (intent.status === "virtual_account_issued" && hasVirtualAccountInfo(storedIntentAccount)) {
      return json(res, 200, {
        ok: true,
        status: "virtual_account_issued",
        orderId: intent.order_id,
        orderName: intent.order_name,
        virtualAccount: storedIntentAccount,
        alreadyIssued: true,
        diagnostics,
      });
    }
    if (new Date(intent.expires_at).getTime() < Date.now()) {
      return json(res, 410, {
        ok: false,
        message: "Prepared payment expired. Please try again.",
        diagnostics: { ...diagnostics, stage: "intent_expired", expiresAt: intent.expires_at },
      });
    }
    const requestedAmount = Number(body.amount || 0);
    if (requestedAmount > 0 && requestedAmount !== Number(intent.amount)) {
      return json(res, 400, {
        ok: false,
        message: "Requested amount does not match the server ledger.",
        diagnostics: { ...diagnostics, stage: "amount_match" },
      });
    }

    let payment;
    try {
      diagnostics.stage = "portone_lookup";
      payment = await getPortOnePayment(providerPaymentId, diagnostics);
    } catch (error) {
      diagnostics.stage = "portone_lookup_failed";
      diagnostics.lookupError = {
        message: error.message || "",
        statusCode: error.statusCode || null,
        stage: error.stage || "portone_lookup",
      };
      return json(res, 502, {
        ok: false,
        code: "PORTONE_LOOKUP_UNAVAILABLE",
        retryable: true,
        message: "포트원 결제 확인이 지연되고 있습니다. 잠시 후 다시 확인해주세요.",
        diagnostics,
      });
    }
    const ledgerPayment = paymentForLedger(payment, ledgerOrderId, providerPaymentId);
    diagnostics.portoneStatus = paymentStatus(ledgerPayment);
    diagnostics.hasVirtualAccount = hasVirtualAccountInfo(pickVirtualAccount(ledgerPayment));
    const forceVirtualAccountIssued = hasVirtualAccountInfo(pickVirtualAccount(ledgerPayment));
    diagnostics.forceVirtualAccountIssued = forceVirtualAccountIssued;

    const checkedAmount = paymentAmount(ledgerPayment);
    if (checkedAmount <= 0 || checkedAmount !== Number(intent.amount)) {
      return json(res, 400, {
        ok: false,
        message: "포트원에서 확인한 결제 금액이 주문 원장과 일치하지 않습니다.",
        diagnostics: { ...diagnostics, stage: "portone_amount_match", checkedAmount },
      });
    }

    diagnostics.stage = "apply_payment";
    const applied = await applyPortOnePayment(user.id, ledgerOrderId, ledgerPayment, providerPaymentId, forceVirtualAccountIssued);
    diagnostics.stage = "done";
    return json(res, 200, { ok: true, ...applied, diagnostics });
  } catch (error) {
    console.error("confirm-payment", error);
    const errorDiagnostics = {
      ...diagnostics,
      ...(error.diagnostics || {}),
      stage: error.stage || diagnostics.stage || "unknown",
      errorMessage: error.message || "Payment confirmation failed.",
      errorStatusCode: error.statusCode || 500,
    };
    return json(res, error.statusCode || 500, {
      ok: false,
      code: "PAYMENT_CONFIRM_ERROR",
      message: error.message || "Payment confirmation failed.",
      diagnostics: errorDiagnostics,
    });
  }
};
