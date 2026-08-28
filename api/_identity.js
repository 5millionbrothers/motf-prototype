const crypto = require("crypto");
const { env, requireEnv, requestJson, supabaseRequest, authenticatedUser } = require("./_server");

const ALLOWED_ORIGINS = new Set([
  "https://motf.co.kr",
  "https://www.motf.co.kr",
  "https://motfowner.co.kr",
  "https://www.motfowner.co.kr",
  "https://motf-prototype.vercel.app",
  "https://motf-owner-app.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:4177",
  "http://127.0.0.1:4189",
]);

function allowCors(req, res) {
  const origin = String(req.headers.origin || "");
  if (ALLOWED_ORIGINS.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try {
        const type = String(req.headers["content-type"] || "");
        if (type.includes("application/x-www-form-urlencoded")) {
          resolve(Object.fromEntries(new URLSearchParams(raw)));
        } else {
          resolve(raw ? JSON.parse(raw) : {});
        }
      } catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function identityHash(value) {
  requireEnv(["IDENTITY_HASH_PEPPER"]);
  return sha256(`${env("IDENTITY_HASH_PEPPER")}:${String(value || "")}`);
}

function passwordIsValid(value) {
  return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d\s]).{8,12}$/.test(String(value || ""));
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 11);
}

function normalizeBirthDate(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 8) return "";
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function isAdult(birthDate) {
  const date = new Date(`${birthDate}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const beforeBirthday = today.getMonth() < date.getMonth()
    || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 19;
}

function safeReturnUrl(value, fallbackOrigin = "https://motf.co.kr") {
  try {
    const url = new URL(String(value || ""));
    if (!ALLOWED_ORIGINS.has(url.origin)) throw new Error("허용되지 않은 복귀 주소입니다.");
    return url.toString();
  } catch {
    return `${fallbackOrigin}/`;
  }
}

async function kcpAdapter(path, body) {
  requireEnv(["KCP_CERT_ADAPTER_URL", "KCP_CERT_ADAPTER_SECRET"]);
  const base = env("KCP_CERT_ADAPTER_URL").replace(/\/$/, "");
  const result = await requestJson(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("KCP_CERT_ADAPTER_SECRET")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, 15000);
  if (!result.ok) {
    const error = new Error(result.data?.message || "KCP 본인인증 서버 요청에 실패했습니다.");
    error.statusCode = result.status;
    throw error;
  }
  return result.data;
}

async function verifiedSession(identityToken, purpose) {
  const stateHash = sha256(identityToken);
  const rows = await supabaseRequest(`/rest/v1/identity_verification_sessions?state_hash=eq.${stateHash}&purpose=eq.${encodeURIComponent(purpose)}&status=eq.verified&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*&limit=1`);
  const session = rows?.[0];
  if (!session) {
    const error = new Error("본인인증이 만료되었거나 완료되지 않았습니다.");
    error.statusCode = 401;
    throw error;
  }
  return session;
}

async function consumeSession(id, userId = null) {
  await supabaseRequest(`/rest/v1/identity_verification_sessions?id=eq.${encodeURIComponent(id)}&status=eq.verified`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "consumed", consumed_at: new Date().toISOString(), ...(userId ? { user_id: userId } : {}) }),
  });
}

module.exports = {
  allowCors,
  readBody,
  sha256,
  randomToken,
  identityHash,
  passwordIsValid,
  normalizePhone,
  normalizeBirthDate,
  isAdult,
  safeReturnUrl,
  kcpAdapter,
  verifiedSession,
  consumeSession,
  authenticatedUser,
};
