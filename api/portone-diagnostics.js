const { json } = require("./_utils");
const dns = require("dns");
const https = require("https");

const PORTONE_HOST = "api.portone.io";
const KNOWN_SUPABASE_URL = "https://izbwcqnvwsdijoognoag.supabase.co";
const DEAD_SUPABASE_HOSTS = new Set([
  "avvfqgtkeziughphppcj.supabase.co",
]);

function redactedEnv() {
  const secret = String(process.env.PORTONE_API_SECRET || "").trim();
  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  let configuredSupabaseHost = "";
  let effectiveSupabaseHost = "";
  try {
    configuredSupabaseHost = new URL(supabaseUrl).hostname;
  } catch {}
  try {
    const effectiveUrl = configuredSupabaseHost && !DEAD_SUPABASE_HOSTS.has(configuredSupabaseHost)
      ? supabaseUrl
      : KNOWN_SUPABASE_URL;
    effectiveSupabaseHost = new URL(effectiveUrl).hostname;
  } catch {}
  return {
    portoneApiSecretConfigured: Boolean(secret),
    portoneApiSecretLength: secret ? secret.length : 0,
    supabaseUrlConfigured: Boolean(supabaseUrl),
    configuredSupabaseHost,
    effectiveSupabaseHost,
    supabaseUrlCorrected: Boolean(configuredSupabaseHost && configuredSupabaseHost !== effectiveSupabaseHost),
    supabaseServiceKey: serviceKeyInfo(serviceKey),
    nodeVersion: process.version,
  };
}

function serviceKeyInfo(value) {
  const prefix = value.startsWith("sb_publishable_")
    ? "sb_publishable"
    : value.startsWith("sb_secret_")
      ? "sb_secret"
      : value.startsWith("eyJ")
        ? "jwt"
        : value
          ? "unknown"
          : "";
  let jwtRole = "";
  if (prefix === "jwt") {
    try {
      const payload = JSON.parse(Buffer.from(value.split(".")[1] || "", "base64url").toString("utf8"));
      jwtRole = payload.role || "";
    } catch {}
  }
  return {
    configured: Boolean(value),
    length: value.length,
    prefix,
    jwtRole,
    likelyServerKey: prefix === "sb_secret" || jwtRole === "service_role",
  };
}

function dnsLookup() {
  return new Promise((resolve) => {
    dns.lookup(PORTONE_HOST, { all: true, family: 4 }, (error, addresses) => {
      if (error) {
        resolve({ ok: false, message: error.message });
        return;
      }
      resolve({
        ok: true,
        addresses: (addresses || []).map((item) => item.address),
      });
    });
  });
}

function hostLookup(hostname) {
  return new Promise((resolve) => {
    if (!hostname) {
      resolve({ ok: false, message: "hostname is empty" });
      return;
    }
    dns.lookup(hostname, { all: true, family: 4 }, (error, addresses) => {
      if (error) {
        resolve({ ok: false, host: hostname, message: error.message });
        return;
      }
      resolve({
        ok: true,
        host: hostname,
        addresses: (addresses || []).map((item) => item.address),
      });
    });
  });
}

async function requestJson(url, options = {}, timeoutMs = 5000) {
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

function requestJsonWithHttps(urlString, options = {}, timeoutMs = 5000) {
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

async function supabasePermissionProbe(effectiveSupabaseHost) {
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!key || !effectiveSupabaseHost) {
    return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY or Supabase host is missing." };
  }
  try {
    const result = await requestJson(`https://${effectiveSupabaseHost}/rest/v1/payment_intents?select=order_id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });
    return {
      ok: result.ok,
      status: result.status,
      message: result.data?.message || result.data?.error_description || "",
      code: result.data?.code || "",
      canReadPaymentIntents: result.ok,
    };
  } catch (error) {
    return { ok: false, message: error.message || "Supabase permission probe failed." };
  }
}

async function fetchProbe(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("fetch timed out")), 3500);
  try {
    const startedAt = Date.now();
    const response = await fetch(`https://${PORTONE_HOST}${path}`, {
      signal: controller.signal,
      headers: {
        Authorization: `PortOne ${String(process.env.PORTONE_API_SECRET || "").trim()}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json().catch(() => null);
    return {
      ok: true,
      status: response.status,
      durationMs: Date.now() - startedAt,
      type: data?.type || "",
      message: data?.message || "",
    };
  } catch (error) {
    return { ok: false, message: error.message || "fetch failed" };
  } finally {
    clearTimeout(timeout);
  }
}

function httpsProbe(path) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const request = https.request({
      hostname: PORTONE_HOST,
      path,
      method: "GET",
      family: 4,
      timeout: 3500,
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
        } catch {}
        resolve({
          ok: true,
          status: response.statusCode,
          durationMs: Date.now() - startedAt,
          type: data?.type || "",
          message: data?.message || "",
        });
      });
    });
    request.on("timeout", () => {
      request.destroy(new Error("https timed out"));
    });
    request.on("error", (error) => {
      resolve({ ok: false, message: error.message || "https failed" });
    });
    request.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { ok: false, message: "GET only." });
  }

  const url = new URL(req.url || "/api/portone-diagnostics", "https://motf.co.kr");
  const paymentId = String(url.searchParams.get("paymentId") || "MOTF-DIAGNOSTIC-NONEXISTENT").trim();
  const path = `/payments/${encodeURIComponent(paymentId)}`;
  const env = redactedEnv();
  const [dnsResult, supabaseConfiguredDns, supabaseEffectiveDns, supabasePermission, fetchResult, httpsResult] = await Promise.all([
    dnsLookup(),
    hostLookup(env.configuredSupabaseHost),
    hostLookup(env.effectiveSupabaseHost),
    supabasePermissionProbe(env.effectiveSupabaseHost),
    fetchProbe(path),
    httpsProbe(path),
  ]);

  const reachedPortOne = Boolean(
    fetchResult.ok && fetchResult.status
    || httpsResult.ok && httpsResult.status
  );

  return json(res, 200, {
    ok: true,
    paymentId,
    env,
    dns: dnsResult,
    supabaseDns: {
      configured: supabaseConfiguredDns,
      effective: supabaseEffectiveDns,
    },
    supabasePermission,
    fetch: fetchResult,
    httpsIpv4: httpsResult,
    reachedPortOne,
    note: "404 means the server reached PortOne but this paymentId does not exist. 401 means the V2 API Secret is wrong or missing.",
  });
};
