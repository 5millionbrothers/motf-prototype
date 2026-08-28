const { json } = require("./_utils");
const { allowCors, readBody, verifiedSession } = require("./_identity");

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { ok: false, message: "POST only." });
  try {
    const body = await readBody(req);
    const session = await verifiedSession(String(body.identityToken || ""), String(body.purpose || "signup"));
    return json(res, 200, {
      ok: true,
      verified: true,
      person: {
        name: session.verified_name,
        phone: session.verified_phone,
        birthDate: session.verified_birth_date,
        isAdult: session.is_adult,
      },
    });
  } catch (error) {
    return json(res, error.statusCode || 401, { ok: false, verified: false, message: error.message });
  }
};
