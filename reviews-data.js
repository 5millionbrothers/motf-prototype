(function connectVerifiedReviews() {
  const client = window.motfSupabase;
  if (!client) return;

  const statusText = {
    completed: "이용 완료",
    confirmed: "확정",
    pending: "승인 대기",
    rejected: "거절",
    cancelled: "취소",
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  function authorLabel(review) {
    if (review.author_name) return review.author_name;
    return "moTF 이용자";
  }

  async function loadReviews() {
    const { data, error } = await client
      .from("reviews")
      .select("id, author_name, rating, body, tags, image_urls, created_at, businesses(business_name)")
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) {
      console.error("리뷰를 불러오지 못했습니다.", error);
      return;
    }

    window.motfApplyReviews?.((data || []).map((review) => ({
      id: review.id,
      target: escapeHtml(review.businesses?.business_name || "이용 후기"),
      score: Number(review.rating) || 5,
      tags: Array.isArray(review.tags) ? review.tags.map(escapeHtml) : [],
      images: Array.isArray(review.image_urls) ? review.image_urls : [],
      text: escapeHtml(review.body || ""),
      author: escapeHtml(authorLabel(review)),
      createdAt: review.created_at,
    })));
  }

  async function loadReviewTargets() {
    const { data: authData } = await client.auth.getSession();
    const userId = authData.session?.user?.id;
    if (!userId) {
      window.motfApplyReviewTargets?.([]);
      return;
    }

    const reviewedResult = await client
      .from("reviews")
      .select("reservation_id, market_order_id")
      .eq("author_id", userId);

    const reviewedReservations = new Set((reviewedResult.data || []).map((item) => item.reservation_id).filter(Boolean));
    const reviewedOrders = new Set((reviewedResult.data || []).map((item) => item.market_order_id).filter(Boolean));

    const [reservationResult, orderResult] = await Promise.all([
      client.from("reservations")
        .select("id, business_id, offering_name, event_date, status, businesses(business_name)")
        .eq("customer_id", userId)
        .eq("status", "completed")
        .order("event_date", { ascending: false }),
      client.from("market_orders")
        .select("id, business_id, pickup_time, status, businesses(business_name)")
        .eq("customer_id", userId)
        .eq("status", "completed")
        .order("pickup_time", { ascending: false }),
    ]);

    if (reservationResult.error || orderResult.error || reviewedResult.error) {
      console.error("리뷰 작성 가능 내역을 불러오지 못했습니다.", reservationResult.error || orderResult.error || reviewedResult.error);
      window.motfApplyReviewTargets?.([]);
      return;
    }

    const reservationTargets = (reservationResult.data || [])
      .filter((item) => !reviewedReservations.has(item.id))
      .map((item) => ({
        id: `reservation:${item.id}`,
        type: "reservation",
        transactionId: item.id,
        label: `${item.businesses?.business_name || "숙소"} · ${item.offering_name || "예약"} · ${formatDate(item.event_date)} · ${statusText[item.status] || item.status}`,
      }));

    const orderTargets = (orderResult.data || [])
      .filter((item) => !reviewedOrders.has(item.id))
      .map((item) => ({
        id: `market_order:${item.id}`,
        type: "market_order",
        transactionId: item.id,
        label: `${item.businesses?.business_name || "공판장"} · 공판장 주문 · ${formatDate(item.pickup_time)} · ${statusText[item.status] || item.status}`,
      }));

    window.motfApplyReviewTargets?.([...reservationTargets, ...orderTargets]);
  }

  window.motfSubmitVerifiedReview = async function submitVerifiedReview(form) {
    const draft = window.motfGetReviewDraft?.();
    if (!draft?.transactionId) {
      alert("리뷰를 작성할 수 있는 이용 완료 내역이 없습니다.");
      return;
    }
    if (!draft.body || draft.body.length < 5) {
      alert("후기를 5자 이상 입력해주세요.");
      document.querySelector("#reviewText")?.focus();
      return;
    }
    if (draft.files.length > 5) {
      alert("사진은 최대 5장까지 등록할 수 있어요.");
      return;
    }

    const button = form?.querySelector('[type="submit"]');
    const originalHtml = button?.innerHTML;
    if (button) {
      button.disabled = true;
      button.textContent = draft.files.length ? "사진 업로드 중..." : "후기 저장 중...";
    }

    const imageUrls = [];
    for (const file of draft.files) {
      if (!file.type.startsWith("image/")) {
        alert("이미지 파일만 첨부할 수 있어요.");
        if (button) {
          button.disabled = false;
          button.innerHTML = originalHtml;
          window.refreshIcons?.();
        }
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        alert("사진 한 장은 8MB 이하만 등록할 수 있어요.");
        if (button) {
          button.disabled = false;
          button.innerHTML = originalHtml;
          window.refreshIcons?.();
        }
        return;
      }
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const safeName = `${window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}.${extension}`;
      const { data: authData } = await client.auth.getSession();
      const userId = authData.session?.user?.id || "anonymous";
      const path = `${userId}/${safeName}`;
      const uploadResult = await client.storage.from("review-images").upload(path, file, {
        cacheControl: "31536000",
        upsert: false,
      });
      if (uploadResult.error) {
        console.error(uploadResult.error);
        alert(`사진을 업로드하지 못했습니다.\n${uploadResult.error.message || "잠시 후 다시 시도해주세요."}`);
        if (button) {
          button.disabled = false;
          button.innerHTML = originalHtml;
          window.refreshIcons?.();
        }
        return;
      }
      const { data: publicUrlData } = client.storage.from("review-images").getPublicUrl(path);
      if (publicUrlData?.publicUrl) imageUrls.push(publicUrlData.publicUrl);
    }

    if (button) button.textContent = "후기 저장 중...";
    const { error } = await client.rpc("submit_verified_review", {
      target_type: draft.targetType,
      target_transaction_id: draft.transactionId,
      review_rating: draft.rating,
      review_body: draft.body,
      review_tags: draft.tags,
      review_image_urls: imageUrls,
    });

    if (button) {
      button.disabled = false;
      button.innerHTML = originalHtml;
      window.refreshIcons?.();
    }

    if (error) {
      console.error(error);
      alert(`후기를 등록하지 못했습니다.\n${error.message || "잠시 후 다시 시도해주세요."}`);
      return;
    }

    document.querySelector("#reviewText").value = "";
    const imageInput = document.querySelector("#reviewImages");
    if (imageInput) imageInput.value = "";
    await Promise.all([loadReviews(), loadReviewTargets()]);
    window.toast?.("후기가 등록되었습니다.");
  };

  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") window.setTimeout(loadReviewTargets, 0);
    if (event === "SIGNED_OUT") window.motfApplyReviewTargets?.([]);
  });

  window.setTimeout(() => {
    loadReviews();
    loadReviewTargets();
  }, 0);
})();
