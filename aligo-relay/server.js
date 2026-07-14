const crypto = require("crypto");
const http = require("http");

const PORT = Number(process.env.PORT || 8080);
const ALIGO_API_BASE = "https://kakaoapi.aligo.in";
const ALLOWED_PATHS = new Set([
  "/akv10/template/list/",
  "/akv10/alimtalk/send/",
]);
const MAX_BODY_BYTES = 128 * 1024;

function json(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

function normalizePhone(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function credentials() {
  return {
    userid: String(process.env.ALIGO_USER_ID || "").trim(),
    apikey: String(process.env.ALIGO_API_KEY || "").trim(),
    senderkey: String(process.env.ALIGO_SENDER_KEY || "").trim(),
    sender: normalizePhone(process.env.ALIGO_SENDER_NUMBER),
  };
}

function validateConfiguration() {
  const required = {
    ALIGO_RELAY_SECRET: String(process.env.ALIGO_RELAY_SECRET || "").trim(),
    ALIGO_USER_ID: String(process.env.ALIGO_USER_ID || "").trim(),
    ALIGO_API_KEY: String(process.env.ALIGO_API_KEY || "").trim(),
    ALIGO_SENDER_KEY: String(process.env.ALIGO_SENDER_KEY || "").trim(),
    ALIGO_SENDER_NUMBER: normalizePhone(process.env.ALIGO_SENDER_NUMBER),
  };
  return Object.entries(required).filter(([, value]) => !value).map(([name]) => name);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
        request.destroy();
        return;
      }
      raw += chunk;
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error("Invalid JSON body."), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
}

async function aligoRequest(path, clientParams) {
  const baseCredentials = credentials();
  const params = {
    ...(clientParams && typeof clientParams === "object" ? clientParams : {}),
    apikey: baseCredentials.apikey,
    userid: baseCredentials.userid,
    senderkey: baseCredentials.senderkey,
  };
  if (path === "/akv10/alimtalk/send/") params.sender = baseCredentials.sender;

  const response = await fetch(`${ALIGO_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json().catch(() => ({
    code: -1,
    message: "Aligo returned an unreadable response.",
  }));
  return { status: response.status, data };
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    const missing = validateConfiguration();
    return json(response, missing.length ? 503 : 200, {
      ok: missing.length === 0,
      service: "motf-aligo-relay",
      missing,
    });
  }

  if (request.method !== "POST" || request.url !== "/v1/aligo/request") {
    return json(response, 404, { ok: false, message: "Not found." });
  }

  const configuredSecret = String(process.env.ALIGO_RELAY_SECRET || "").trim();
  if (!safeEqual(request.headers["x-relay-secret"], configuredSecret)) {
    return json(response, 401, { ok: false, message: "Unauthorized." });
  }

  const missing = validateConfiguration();
  if (missing.length) {
    return json(response, 503, { ok: false, message: `Relay environment is missing: ${missing.join(", ")}` });
  }

  try {
    const body = await readJson(request);
    const path = String(body.path || "");
    if (!ALLOWED_PATHS.has(path)) {
      return json(response, 400, { ok: false, message: "Unsupported Aligo API path." });
    }
    const result = await aligoRequest(path, body.params);
    return json(response, result.status, result.data);
  } catch (error) {
    console.error("aligo-relay", error.message);
    return json(response, error.statusCode || 502, {
      ok: false,
      message: error.name === "TimeoutError" ? "Aligo request timed out." : "Aligo relay request failed.",
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`motf-aligo-relay listening on ${PORT}`);
});
