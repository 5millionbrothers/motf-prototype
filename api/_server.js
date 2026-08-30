const { json } = require("./_utils");

function env(name) {
  const aliases = {
    SUPABASE_URL: ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
    SUPABASE_PUBLISHABLE_KEY: ["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    SUPABASE_SERVICE_ROLE_KEY: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"],
  };
  const candidates = aliases[name] || [name];
  return candidates.map((key) => String(process.env[key] || "").trim()).find(Boolean) || "";
}

function requireEnv(names) {
  const missing = names.filter((name) => !env(name));
  if (missing.length) {
    const error = new Error(`환경변수가 없습니다: ${missing.join(", ")}`);
    error.statusCode = 503;
    throw error;
  }
}

async function requestJson(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

function supabaseUrl() {
  return env("SUPABASE_URL").replace(/\/$/, "");
}

async function supabaseRequest(path, options = {}, key = env("SUPABASE_SERVICE_ROLE_KEY")) {
  const result = await requestJson(`${supabaseUrl()}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!result.ok) {
    const error = new Error(result.data?.message || result.data?.error_description || "데이터베이스 요청에 실패했습니다.");
    error.statusCode = result.status;
    error.details = result.data;
    throw error;
  }
  return result.data;
}

async function authenticatedUser(authorization) {
  if (!authorization?.startsWith("Bearer ")) return null;
  const result = await requestJson(`${supabaseUrl()}/auth/v1/user`, {
    headers: {
      apikey: env("SUPABASE_PUBLISHABLE_KEY"),
      Authorization: authorization,
    },
  });
  return result.ok ? result.data : null;
}

function tossAuthorization() {
  return `Basic ${Buffer.from(`${env("TOSS_SECRET_KEY")}:`).toString("base64")}`;
}

async function tossRequest(path, options = {}) {
  const result = await requestJson(`https://api.tosspayments.com${path}`, {
    ...options,
    headers: {
      Authorization: tossAuthorization(),
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  }, 12000);
  if (!result.ok) {
    const error = new Error(result.data?.message || "토스페이먼츠 요청에 실패했습니다.");
    error.statusCode = result.status;
    error.code = result.data?.code;
    error.details = result.data;
    throw error;
  }
  return result.data;
}

module.exports = {
  json,
  env,
  requireEnv,
  requestJson,
  supabaseRequest,
  authenticatedUser,
  tossRequest,
};
