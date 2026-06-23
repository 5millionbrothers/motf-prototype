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

  async function loadMyTransactions() {
    const { data: authData } = await client.auth.getSession();
    if (!authData.session?.user) return;
    const [reservationResult, orderResult] = await Promise.all([
      client.from("reservations")
        .select("id, event_date, guest_count, offering_name, total_amount, status, businesses(business_name)")
        .eq("customer_id", authData.session.user.id)
        .order("created_at", { ascending: false }),
      client.from("market_orders")
        .select("id, pickup_time, total_amount, status, businesses(business_name), market_order_items(id)")
        .eq("customer_id", authData.session.user.id)
        .order("created_at", { ascending: false }),
    ]);
    if (reservationResult.error || orderResult.error) return;
    const reservations = (reservationResult.data || []).map((item) => ({
      id: item.id,
      stayName: item.businesses?.business_name || "숙소",
      roomName: item.offering_name,
      date: item.event_date,
      people: item.guest_count,
      amount: item.total_amount,
      status: statusText[item.status] || item.status,
    }));
    const orders = (orderResult.data || []).map((item) => ({
      id: item.id,
      storeName: item.businesses?.business_name || "공판장",
      pickupTime: String(item.pickup_time || "").slice(0, 5),
      amount: item.total_amount,
      status: statusText[item.status] || item.status,
      items: item.market_order_items || [],
    }));
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
