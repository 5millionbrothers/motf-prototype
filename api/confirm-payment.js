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

async function getPortOnePayment(paymentId, diagnostics = {}) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
      headers: {
        Authorization: `PortOne ${String(process.env.PORTONE_API_SECRET || "").trim()}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json().catch(() => null);
    diagnostics.portoneLookup = {
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt,
      type: data?.type || "",
      message: data?.message || "",
    };
    if (!response.ok) {
      const error = new Error(data?.message || data?.type || "PortOne payment lookup failed.");
      error.statusCode = response.status;
      error.stage = "portone_lookup";
      error.diagnostics = diagnostics;
      throw error;
    }
    return data;
  } catch (error) {
    diagnostics.portoneLookup = diagnostics.portoneLookup || {
      ok: false,
      durationMs: Date.now() - startedAt,
      message: error.message || "fetch failed",
    };
    error.stage = error.stage || "portone_lookup";
    error.statusCode = error.statusCode || 502;
    error.diagnostics = diagnostics;
    throw error;
  }
}

function paymentAmount(payment) {
  return Number(payment?.amount?.total ?? payment?.amount ?? payment?.totalAmount ?? 0);
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

function mergePaymentLookupWithClient(lookupPayment, clientPayment) {
  if (!clientPayment || typeof clientPayment !== "object") return lookupPayment;
  if (!lookupPayment || typeof lookupPayment !== "object") return clientPayment;
  const lookupAccount = pickVirtualAccount(lookupPayment);
  const clientAccount = pickVirtualAccount(clientPayment);
  const merged = {
    ...clientPayment,
    ...lookupPayment,
  };
  if (!hasVirtualAccountInfo(lookupAccount) && hasVirtualAccountInfo(clientAccount)) {
    merged.virtualAccount = clientAccount;
  }
  if (!paymentStatus(merged) && paymentStatus(clientPayment)) {
    merged.status = paymentStatus(clientPayment);
  }
  return merged;
}

function safePaymentFromClient(ledgerOrderId, providerPaymentId, payment, allowClientIssuedFallback = false) {
  if (!payment || typeof payment !== "object") return null;
  if (!allowClientIssuedFallback) return null;
  const allowedIds = new Set([ledgerOrderId, providerPaymentId].filter(Boolean));
  const candidateIds = [
    payment.paymentId,
    payment.orderId,
    payment.merchantUid,
    payment.merchant_uid,
    payment.id,
  ].filter(Boolean).map(String);
  const hasMatchingId = candidateIds.some((id) => allowedIds.has(id));
  const virtualAccount = pickVirtualAccount(payment);
  const hasVirtualAccount = hasVirtualAccountInfo(virtualAccount);
  return {
    ...payment,
    virtualAccount: hasVirtualAccount ? virtualAccount : payment.virtualAccount,
    status: paymentStatus(payment) || (payment.code ? "FAILED" : "VIRTUAL_ACCOUNT_ISSUED"),
    clientPaymentWindowCompleted: true,
    id: hasMatchingId ? candidateIds.find((id) => allowedIds.has(id)) : (providerPaymentId || ledgerOrderId),
  };
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

async function applyPortOnePayment(userId, orderId, payment, providerPaymentId) {
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

  if (isVirtualAccountIssuedStatus(status) || hasVirtualAccount) {
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

  return { status: "pending", portoneStatus: status, virtualAccount: pickVirtualAccount(payment) };
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
    if (providerPaymentId && providerPaymentId !== portOnePaymentId(ledgerOrderId)) {
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
    let lookupWarning = "";
    try {
      diagnostics.stage = "portone_lookup";
      payment = mergePaymentLookupWithClient(await getPortOnePayment(providerPaymentId, diagnostics), body.portoneResponse);
    } catch (error) {
      diagnostics.stage = "client_fallback";
      diagnostics.lookupError = {
        message: error.message || "",
        statusCode: error.statusCode || null,
        stage: error.stage || "portone_lookup",
      };
      const fallback = safePaymentFromClient(
        ledgerOrderId,
        providerPaymentId,
        body.portoneResponse,
        body.clientPaymentWindowCompleted === true || Boolean(body.portoneResponse && !body.portoneResponse.code),
      );
      if (!fallback) throw error;
      payment = fallback;
      diagnostics.usedClientFallback = true;
      lookupWarning = error.message || "PortOne lookup failed; stored client response.";
    }
    const ledgerPayment = paymentForLedger(payment, ledgerOrderId, providerPaymentId);
    diagnostics.portoneStatus = paymentStatus(ledgerPayment);
    diagnostics.hasVirtualAccount = hasVirtualAccountInfo(pickVirtualAccount(ledgerPayment));

    const checkedAmount = paymentAmount(ledgerPayment);
    if (checkedAmount > 0 && checkedAmount !== Number(intent.amount)) {
      return json(res, 400, {
        ok: false,
        message: "Payment amount does not match the server ledger.",
        diagnostics: { ...diagnostics, stage: "portone_amount_match", checkedAmount },
      });
    }

    diagnostics.stage = "apply_payment";
    const applied = await applyPortOnePayment(user.id, ledgerOrderId, ledgerPayment, providerPaymentId);
    diagnostics.stage = "done";
    return json(res, 200, { ok: true, ...applied, lookupWarning, diagnostics });
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
