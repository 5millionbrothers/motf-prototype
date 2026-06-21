(function loadPublicCatalog() {
  const client = window.motfSupabase;
  if (!client || typeof window.motfApplyCatalog !== "function") return;

  const stayFallback = "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=82";
  const marketFallback = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=82";
  const roomFallback = "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=82";
  const productFallback = "https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=1200&q=82";
  const text = (value) => window.motfEscapeHtml?.(value) ?? String(value ?? "");
  const imageUrl = (value, fallback) => {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : fallback;
    } catch {
      return fallback;
    }
  };

  function regionOf(business) {
    return text(business.region || business.address?.split(/[ ,]/).filter(Boolean)[0] || "지역 미정");
  }

  function buildStay(business, offerings, index) {
    const rooms = offerings.map((item) => ({
      id: item.id,
      name: text(item.name),
      capacity: item.max_people ? `최대 ${item.max_people}명` : "인원 문의",
      price: Number(item.price) || 0,
      image: imageUrl(item.image_url || business.cover_image_url, roomFallback),
      features: item.description ? [text(item.description)] : [],
    }));
    const image = business.cover_image_url || rooms[0]?.image || stayFallback;
    return {
      id: business.id,
      name: text(business.business_name),
      region: regionOf(business),
      price: Math.min(...rooms.map((room) => room.price)),
      maxPeople: Math.max(...rooms.map((room) => Number(room.capacity.match(/\d+/)?.[0] || 40))),
      rating: 0,
      reviews: 0,
      distance: text(business.address || "주소 문의"),
      location: { lat: 37.8314 + index * 0.006, lng: 127.5098 + index * 0.006 },
      detailTags: [],
      roomCount: rooms.length,
      bathCount: 0,
      image,
      images: [image, ...rooms.map((room) => room.image)],
      intro: text(business.description || "단체 행사 이용이 가능한 제휴 숙소입니다."),
      amenities: business.facilities?.length ? business.facilities.map(text) : ["상세 시설은 사장님에게 문의해주세요."],
      fees: ["추가요금은 예약 전 사장님에게 확인해주세요."],
      policy: ["취소 및 환불 규정은 예약 단계에서 안내됩니다."],
      rooms,
    };
  }

  function buildStore(business, offerings, index) {
    const products = offerings.map((item) => ({
      id: item.id,
      category: text(item.category || "기타"),
      name: text(item.name),
      unit: text(item.unit || "1개"),
      price: Number(item.price) || 0,
      origin: "업체 제공 상품",
      image: imageUrl(item.image_url || business.cover_image_url, productFallback),
      detail: text(item.description || "상세 내용은 공판장에 문의해주세요."),
    }));
    return {
      id: business.id,
      name: text(business.business_name),
      region: regionOf(business),
      type: "moTF 제휴 공판장",
      rating: 0,
      location: { lat: 37.8329 + index * 0.006, lng: 127.5107 + index * 0.006 },
      image: imageUrl(business.cover_image_url, products[0]?.image || marketFallback),
      intro: text(business.description || "단체 행사 물품을 준비할 수 있는 제휴 공판장입니다."),
      products,
    };
  }

  (async () => {
    const [businessResult, offeringResult] = await Promise.all([
      client.from("businesses")
        .select("id, business_type, business_name, address, description, region, cover_image_url, facilities, approval_status")
        .eq("approval_status", "approved"),
      client.from("offerings")
        .select("id, business_id, name, description, price, is_active, max_people, unit, category, image_url, sort_order")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    if (businessResult.error || offeringResult.error) {
      console.warn("실제 제휴처 목록을 불러오지 못해 데모 목록을 유지합니다.", businessResult.error || offeringResult.error);
      return;
    }

    const businesses = businessResult.data || [];
    const offerings = offeringResult.data || [];
    const stays = businesses
      .filter((business) => business.business_type === "stay")
      .map((business, index) => buildStay(business, offerings.filter((item) => item.business_id === business.id), index))
      .filter((business) => business.rooms.length);
    const stores = businesses
      .filter((business) => business.business_type === "market")
      .map((business, index) => buildStore(business, offerings.filter((item) => item.business_id === business.id), index))
      .filter((business) => business.products.length);

    window.motfApplyCatalog(stays, stores);
  })();
})();
