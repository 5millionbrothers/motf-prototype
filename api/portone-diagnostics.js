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
    nodeVersion: process.version,
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
  const [dnsResult, supabaseConfiguredDns, supabaseEffectiveDns, fetchResult, httpsResult] = await Promise.all([
    dnsLookup(),
    hostLookup(env.configuredSupabaseHost),
    hostLookup(env.effectiveSupabaseHost),
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
    fetch: fetchResult,
    httpsIpv4: httpsResult,
    reachedPortOne,
    note: "404 means the server reached PortOne but this paymentId does not exist. 401 means the V2 API Secret is wrong or missing.",
  });
};
