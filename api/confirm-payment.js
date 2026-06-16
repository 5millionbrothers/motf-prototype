const TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";
const { getRequiredEnv, insertSupabaseRow, json, readJsonBody } = require("./_utils");

async function confirmTossPayment({ paymentKey, orderId, amount }) {
  const secretKey = getRequiredEnv("TOSS_SECRET_KEY");
  const basicToken = Buffer.from(`${secretKey}:`).toString("base64");
  const response = await fetch(TOSS_CONFIRM_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data.message || "토스 결제 승인에 실패했습니다.";
    const error = new Error(message);
    error.details = data;
    throw error;
  }
  return data;
}

async function saveBusinessRecord(payment, tossPayment) {
  if (payment.type === "stay") {
    return insertSupabaseRow("reservations", {
      order_id: payment.orderId,
      stay_name: payment.stayName,
      room_name: payment.roomName,
      reserved_date: payment.date || null,
      people: payment.people,
      amount: payment.amount,
      payment_status: "paid",
    });
  }

  return insertSupabaseRow("orders", {
    order_id: payment.orderId,
    store_name: payment.storeName,
    pickup_place: payment.pickupPlace || null,
    pickup_time: payment.pickupTime || null,
    items: payment.items || [],
    amount: payment.amount,
    payment_status: "paid",
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, message: "POST 요청만 사용할 수 있습니다." });
  }

  try {
    const body = await readJsonBody(req);
    const { paymentKey, orderId, amount, payment } = body || {};
    if (!paymentKey || !orderId || !amount || !payment) {
      return json(res, 400, { ok: false, message: "결제 확인에 필요한 값이 부족합니다." });
    }
    if (payment.orderId !== orderId || Number(payment.amount) !== Number(amount)) {
      return json(res, 400, { ok: false, message: "주문번호 또는 금액이 일치하지 않습니다." });
    }

    const tossPayment = await confirmTossPayment({ paymentKey, orderId, amount });
    await insertSupabaseRow("payments", {
      order_id: orderId,
      payment_key: paymentKey,
      payment_type: payment.type,
      status: "paid",
      amount: Number(amount),
      currency: "KRW",
      order_name: payment.itemName,
      customer_name: payment.customerName || null,
      customer_phone: payment.customerPhone || null,
      toss_response: tossPayment,
      approved_at: new Date().toISOString(),
    });
    await saveBusinessRecord(payment, tossPayment);

    return json(res, 200, { ok: true, payment: tossPayment });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      message: error.message || "결제 확인 중 오류가 발생했습니다.",
      details: error.details || null,
    });
  }
};
