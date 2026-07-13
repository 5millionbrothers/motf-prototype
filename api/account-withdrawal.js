const crypto = require("crypto");
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

async function requestJson(url, options = {}, timeoutMs = 7000) {
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

function requestJsonWithHttps(urlString, options = {}, timeoutMs = 7000) {
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

async function callWithdrawalRpc(authorization, reason, anonymizedEmail) {
  const result = await requestJson(`${supabaseBaseUrl()}/rest/v1/rpc/request_account_withdrawal`, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      request_reason: reason || null,
      anonymized_email: anonymizedEmail,
    }),
  });
  if (!result.ok) {
    const error = new Error(errorMessage(result.data, "회원 탈퇴 처리 조건을 확인하지 못했습니다."));
    error.statusCode = result.status;
    throw error;
  }
}

async function adminUpdateUser(userId, body) {
  const headers = {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
  const url = `${supabaseBaseUrl()}/auth/v1/admin/users/${encodeURIComponent(userId)}`;
  let result = await requestJson(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  if (!result.ok && [404, 405].includes(result.status)) {
    result = await requestJson(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
  }
  if (!result.ok) {
    const error = new Error(errorMessage(result.data, "Supabase Auth 계정 익명화에 실패했습니다."));
    error.statusCode = result.status;
    throw error;
  }
  return result.data;
}

function anonymizedEmail(userId) {
  return `deleted+${String(userId).replace(/-/g, "")}@withdrawn.motf.co.kr`;
}

function randomPassword() {
  return crypto.randomBytes(36).toString("base64url");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, message: "POST only." });
  }

  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length) {
    return json(res, 503, {
      ok: false,
      code: "ACCOUNT_WITHDRAWAL_ENV_MISSING",
      message: `Account withdrawal env is missing: ${missing.join(", ")}`,
    });
  }

  try {
    const user = await authenticatedUser(req.headers.authorization);
    if (!user?.id) {
      return json(res, 401, { ok: false, message: "로그인이 만료되었습니다. 다시 로그인해주세요." });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const reason = String(body.reason || "").trim().slice(0, 500);
    const nextEmail = anonymizedEmail(user.id);
    const withdrawnAt = new Date().toISOString();

    await callWithdrawalRpc(req.headers.authorization, reason, nextEmail);
    await adminUpdateUser(user.id, {
      email: nextEmail,
      email_confirm: true,
      password: randomPassword(),
      ban_duration: "876000h",
      user_metadata: {
        full_name: "탈퇴 회원",
        account_status: "withdrawn",
        withdrawn_at: withdrawnAt,
      },
    });

    return json(res, 200, {
      ok: true,
      status: "withdrawn",
      message: "회원 탈퇴가 처리되었습니다.",
    });
  } catch (error) {
    console.error("account-withdrawal", error);
    return json(res, error.statusCode || 500, {
      ok: false,
      code: "ACCOUNT_WITHDRAWAL_ERROR",
      message: error.message || "회원 탈퇴 처리에 실패했습니다.",
    });
  }
};
