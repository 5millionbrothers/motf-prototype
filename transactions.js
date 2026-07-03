(function connectUserTransactions() {
  const client = window.motfSupabase;
  if (!client) {
    console.error("예약 연결에 필요한 로그인 설정을 불러오지 못했습니다.");
    return;
  }
  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
  const statusText = {
    pending: "결제 완료·승인 대기",
    confirmed: "확정",
    rejected: "거절",
    cancelled: "취소",
    completed: "이용 완료",
  };
  const refundText = {
    required: "거절·환불 예정",
    processing: "환불 처리 중",
    refunded: "환불 완료",
    failed: "환불 확인 필요",
  };
  function displayStatus(item) {
    if (item.refund_status && item.refund_status !== "none") return refundText[item.refund_status] || statusText[item.status] || item.status;
    return statusText[item.status] || item.status;
  }
  function localIssuedPayments() {
    try {
      return JSON.parse(window.localStorage.getItem("motf.localIssuedPayments") || "[]");
    } catch {
      return [];
    }
  }
  function bankLabel(value = "") {
    const code = String(value || "").trim();
    const upper = code.toUpperCase();
    const labels = {
      WOORI: "우리은행",
      IBK: "IBK기업은행",
      KB: "KB국민은행",
      KOOKMIN: "KB국민은행",
      SHINHAN: "신한은행",
      HANA: "하나은행",
      NH: "NH농협은행",
      NONGHYUP: "NH농협은행",
      KAKAOBANK: "카카오뱅크",
      K_BANK: "케이뱅크",
      TOSS_BANK: "토스뱅크",
      SC: "SC제일은행",
      CITI: "씨티은행",
      DAEGU: "대구은행",
      BUSAN: "부산은행",
      GWANGJU: "광주은행",
      JEONBUK: "전북은행",
      KYONGNAM: "경남은행",
      SAEMAUL: "새마을금고",
      SHINHYUP: "신협",
      SUHYUP: "수협은행",
      POST: "우체국",
    };
    return labels[upper] || code.replace(/_/g, " ");
  }
  function accountLabel(account = {}) {
    const bank = bankLabel(account.bankName || account.bank || account.bankCode);
    const number = String(account.accountNumber || account.account_number || "").replace(/\s+/g, "");
    const holder = account.holderName || account.accountHolder || account.customerName || "";
    return [bank, number].filter(Boolean).join(" ") + (holder ? ` (예금주 ${holder})` : "");
  }

  async function loadMyTransactions() {
    const { data: authData } = await client.auth.getSession();
    if (!authData.session?.user) return;
    const [reservationResult, orderResult, intentResult] = await Promise.all([
      client.from("reservations")
        .select("id, event_date, guest_count, offering_name, total_amount, status, refund_status, refund_amount, businesses(business_name)")
        .eq("customer_id", authData.session.user.id)
        .order("created_at", { ascending: false }),
      client.from("market_orders")
        .select("id, pickup_time, total_amount, status, refund_status, refund_amount, businesses(business_name), market_order_items(id)")
        .eq("customer_id", authData.session.user.id)
        .order("created_at", { ascending: false }),
      client.from("payment_intents")
        .select("order_id, kind, amount, order_name, status, virtual_account, virtual_account_issued_at, created_at")
        .eq("customer_id", authData.session.user.id)
        .eq("status", "virtual_account_issued")
        .order("created_at", { ascending: false }),
    ]);
    if (reservationResult.error || orderResult.error || intentResult.error) return;
    const reservations = (reservationResult.data || []).map((item) => ({
      id: item.id,
      stayName: item.businesses?.business_name || "숙소",
      roomName: item.offering_name,
      date: item.event_date,
      people: item.guest_count,
      amount: item.total_amount,
      status: displayStatus(item),
      refundAmount: item.refund_amount,
    }));
    const orders = (orderResult.data || []).map((item) => ({
      id: item.id,
      storeName: item.businesses?.business_name || "공판장",
      pickupTime: String(item.pickup_time || "").slice(0, 5),
      amount: item.total_amount,
      status: displayStatus(item),
      refundAmount: item.refund_amount,
      items: item.market_order_items || [],
    }));
    (intentResult.data || []).forEach((item) => {
      const account = item.virtual_account || {};
      const label = accountLabel(account);
      const pendingItem = {
        id: item.order_id,
        amount: item.amount,
        status: "입금 전",
        virtualAccount: account,
        isPendingVirtualAccount: true,
      };
      if (item.kind === "stay") {
        reservations.unshift({
          ...pendingItem,
          stayName: "가상계좌 입금 대기",
          roomName: item.order_name,
          date: String(item.virtual_account_issued_at || item.created_at || "").slice(0, 10),
          people: "-",
        });
      } else {
        orders.unshift({
          ...pendingItem,
          storeName: "가상계좌 입금 대기",
          pickupTime: String(item.virtual_account_issued_at || item.created_at || "").slice(11, 16),
          items: [{ id: item.order_id }],
        });
      }
    });
    localIssuedPayments()
      .filter((item) => !reservations.some((reservation) => reservation.id === item.orderId) && !orders.some((order) => order.id === item.orderId))
      .forEach((item) => {
        const pendingItem = {
          id: item.orderId,
          amount: item.amount,
          status: "입금 전",
          virtualAccount: item.virtualAccount,
          isPendingVirtualAccount: true,
        };
        if (item.type === "stay") {
          reservations.unshift({
            ...pendingItem,
            stayName: item.stayName || "예약 요청 숙소",
            roomName: item.roomName || item.itemName,
            date: item.date || String(item.issuedAt || "").slice(0, 10),
            checkOutDate: item.checkOutDate || "",
            people: item.people || "-",
          });
        } else {
          orders.unshift({
            ...pendingItem,
            storeName: item.storeName || "공판장 주문 요청",
            pickupTime: item.pickupTime || String(item.issuedAt || "").slice(11, 16),
            items: [{ id: item.orderId }],
          });
        }
      });
    window.motfApplyMyTransactions?.(reservations, orders);
  }
  window.motfReloadTransactions = loadMyTransactions;

  document.addEventListener("submit", async (event) => {
    if (event.target.id === "bookingForm") {
      const draft = window.motfGetReservationDraft?.();
      if (!draft || !isUuid(draft.business_id)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        alert("이 숙소는 아직 데모 정보라 실제 예약을 접수할 수 없습니다.\n사장님이 등록한 실제 숙소를 선택해주세요.");
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const submitButton = event.target.querySelector('[type="submit"]');
      const originalHtml = submitButton?.innerHTML;
      if (submitButton) { submitButton.disabled = true; submitButton.textContent = "결제 금액 확인 중..."; }
      try {
        const { data, error } = await client.rpc("prepare_stay_payment", {
          target_business_id: draft.business_id,
          target_offering_id: draft.offering_id,
          customer_name: draft.customer_name,
          group_name: draft.group_name,
          contact_phone: draft.contact_phone,
          event_date: draft.event_date,
          guest_count: draft.guest_count,
          request_memo: draft.request_memo,
          check_in_date: draft.event_date,
          check_out_date: draft.check_out_date,
        });
        if (error) throw error;
        const intent = Array.isArray(data) ? data[0] : data;
        if (!intent) throw new Error("결제 대기 정보를 만들지 못했습니다.");
        window.motfStartPreparedPayment?.(intent, draft);
      } catch (error) {
        console.error(error);
        alert(`결제를 준비하지 못했습니다.\n${error.message || "잠시 후 다시 시도해주세요."}`);
      } finally {
        if (submitButton) { submitButton.disabled = false; submitButton.innerHTML = originalHtml; window.refreshIcons?.(); }
      }
      return;
    }

    if (event.target.id === "orderForm") {
      const draft = window.motfGetMarketOrderDraft?.();
      if (!draft || !isUuid(draft.business_id)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        alert("이 공판장은 아직 데모 정보라 실제 주문을 접수할 수 없습니다.\n사장님이 등록한 실제 공판장을 선택해주세요.");
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const submitButton = event.target.querySelector('[type="submit"]');
      const originalHtml = submitButton?.innerHTML;
      if (submitButton) { submitButton.disabled = true; submitButton.textContent = "결제 금액 확인 중..."; }
      try {
        const { data, error } = await client.rpc("prepare_market_payment", {
          target_business_id: draft.business_id,
          customer_name: draft.customer_name,
          contact_phone: draft.contact_phone,
          pickup_place: draft.pickup_place,
          pickup_time: draft.pickup_time,
          request_memo: draft.request_memo,
          items: draft.items,
        });
        if (error) throw error;
        const intent = Array.isArray(data) ? data[0] : data;
        if (!intent) throw new Error("결제 대기 정보를 만들지 못했습니다.");
        window.motfStartPreparedPayment?.(intent, draft);
      } catch (error) {
        console.error(error);
        alert(`결제를 준비하지 못했습니다.\n${error.message || "잠시 후 다시 시도해주세요."}`);
      } finally {
        if (submitButton) { submitButton.disabled = false; submitButton.innerHTML = originalHtml; window.refreshIcons?.(); }
      }
    }
  }, true);

  // 필수 입력값이 빠져 submit 이벤트 자체가 발생하지 않는 경우에도
  // 사용자가 버튼이 고장 났다고 느끼지 않도록 명확한 안내를 보여준다.
  document.addEventListener("click", (event) => {
    const submitButton = event.target.closest('#bookingForm [type="submit"], #orderForm [type="submit"]');
    if (!submitButton) return;
    const form = submitButton.closest("form");
    if (form && !form.checkValidity()) {
      window.setTimeout(() => alert("필수 입력 항목과 동의 체크를 모두 확인해주세요."), 0);
    }
  }, true);

  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") window.setTimeout(loadMyTransactions, 0);
  });
  window.setTimeout(loadMyTransactions, 0);
})();
