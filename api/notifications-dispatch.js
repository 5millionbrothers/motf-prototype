const https = require("https");
const { json } = require("./_utils");

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const KNOWN_SUPABASE_URL = "https://izbwcqnvwsdijoognoag.supabase.co";
const DEAD_SUPABASE_HOSTS = new Set(["avvfqgtkeziughphppcj.supabase.co"]);

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

async function requestJson(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("fetch timed out")), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return requestJsonWithHttps(url, options, timeoutMs);
  } finally {
    clearTimeout(timeout);
  }
}

function requestJsonWithHttps(urlString, options = {}, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const body = options.body || "";
    const request = https.request({
      hostname: url.hostname,
      path: `${url.pathname}${url.search}`,
      method: options.method || "GET",
      timeout: timeoutMs,
      headers: {
        ...(options.headers || {}),
        ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
      },
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

function errorMessage(data, fallback = "Request failed.") {
  return data?.message || data?.msg || data?.error_description || data?.error || fallback;
}

async function supabaseRequest(path, options = {}) {
  const result = await requestJson(`${supabaseBaseUrl()}${path}`, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!result.ok) {
    const error = new Error(errorMessage(result.data, "Supabase request failed."));
    error.statusCode = result.status;
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

async function isAdminUser(userId) {
  const rows = await supabaseRequest(
    `/rest/v1/profiles?select=id,role,status&id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  const profile = rows?.[0];
  return profile?.role === "admin" && profile?.status === "approved";
}

async function authorizeDispatch(req) {
  const configuredSecret = String(process.env.NOTIFICATION_DISPATCH_SECRET || "").trim();
  const providedSecret = String(req.headers["x-notification-secret"] || "").trim();
  if (configuredSecret && providedSecret && configuredSecret === providedSecret) {
    return { ok: true, mode: "secret" };
  }

  const user = await authenticatedUser(req.headers.authorization);
  if (user?.id && await isAdminUser(user.id)) {
    return { ok: true, mode: "admin", userId: user.id };
  }

  return { ok: false };
}

async function claimBatch(limit) {
  const rows = await supabaseRequest("/rest/v1/rpc/claim_notification_batch", {
    method: "POST",
    body: JSON.stringify({ batch_limit: limit }),
  });
  return Array.isArray(rows) ? rows : [];
}

async function completeNotification(item, status, provider, providerMessageId, requestPayload, responsePayload, errorMessageText = null) {
  await supabaseRequest("/rest/v1/rpc/complete_notification", {
    method: "POST",
    body: JSON.stringify({
      target_outbox_id: item.id,
      final_status: status,
      target_provider: provider,
      target_provider_message_id: providerMessageId,
      target_request_payload: requestPayload,
      target_response_payload: responsePayload,
      target_error_message: errorMessageText,
    }),
  });
}

function buildMockRequestPayload(item) {
  return {
    channel: "kakao_alimtalk",
    provider: "mock",
    templateKey: item.template_key,
    eventKey: item.event_key,
    to: {
      userId: item.recipient_user_id,
      role: item.recipient_role,
      name: item.recipient_name,
      phone: item.recipient_phone,
    },
    payload: item.payload || {},
    buttonLinks: item.button_links || {},
  };
}

async function sendMockAlimtalk(item) {
  const requestPayload = buildMockRequestPayload(item);
  const providerMessageId = `mock_${item.id}_${Date.now()}`;
  return {
    status: "mock_sent",
    provider: "mock",
    providerMessageId,
    requestPayload,
    responsePayload: {
      ok: true,
      providerMessageId,
      message: "Mock Alimtalk dispatch completed. No real Kakao message was sent.",
    },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, message: "POST only." });
  }

  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length) {
    return json(res, 503, {
      ok: false,
      code: "NOTIFICATION_ENV_MISSING",
      message: `Notification env is missing: ${missing.join(", ")}`,
    });
  }

  const auth = await authorizeDispatch(req);
  if (!auth.ok) {
    return json(res, 401, {
      ok: false,
      message: "알림 발송 처리 권한이 없습니다.",
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const limit = Math.max(1, Math.min(Number(body.limit || 20), 100));
    const items = await claimBatch(limit);
    const results = [];

    for (const item of items) {
      try {
        const result = await sendMockAlimtalk(item);
        await completeNotification(
          item,
          result.status,
          result.provider,
          result.providerMessageId,
          result.requestPayload,
          result.responsePayload,
        );
        results.push({
          id: item.id,
          templateKey: item.template_key,
          status: result.status,
          providerMessageId: result.providerMessageId,
        });
      } catch (error) {
        const requestPayload = buildMockRequestPayload(item);
        await completeNotification(
          item,
          "failed",
          "mock",
          null,
          requestPayload,
          { ok: false, message: error.message || "Mock dispatch failed." },
          error.message || "Mock dispatch failed.",
        );
        results.push({
          id: item.id,
          templateKey: item.template_key,
          status: "failed",
          message: error.message || "Mock dispatch failed.",
        });
      }
    }

    return json(res, 200, {
      ok: true,
      mode: auth.mode,
      provider: "mock",
      claimed: items.length,
      results,
    });
  } catch (error) {
    console.error("notifications-dispatch", error);
    return json(res, error.statusCode || 500, {
      ok: false,
      code: "NOTIFICATION_DISPATCH_ERROR",
      message: error.message || "알림 발송 처리에 실패했습니다.",
    });
  }
};
