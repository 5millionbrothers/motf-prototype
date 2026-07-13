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

  function locationOf(business) {
    if (business.latitude == null || business.longitude == null || business.latitude === "" || business.longitude === "") return null;
    const lat = Number(business.latitude);
    const lng = Number(business.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  }

  function buildStay(business, offerings) {
    const rooms = offerings.map((item) => ({
      id: item.id,
      name: text(item.name),
      capacity: item.max_people ? `최대 ${item.max_people}명` : "인원 문의",
      price: Number(item.price) || 0,
      image: imageUrl(item.image_url || business.cover_image_url, roomFallback),
      features: item.feature_summary?.length ? item.feature_summary.map(text) : item.description ? [text(item.description)] : [],
      amenityDetails: Array.isArray(item.amenity_details) ? item.amenity_details : [],
      detailSections: item.detail_sections && typeof item.detail_sections === "object" ? item.detail_sections : {},
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
      location: locationOf(business),
      detailTags: [...new Set([
        ...(business.nearby_tags || []),
        ...(business.facilities || []),
        ...(business.station_distance_m != null && Number(business.station_distance_m) <= 500 ? ["station"] : []),
        ...(business.convenience_distance_m != null && Number(business.convenience_distance_m) <= 500 ? ["convenience"] : []),
      ])],
      stationDistanceM: business.station_distance_m == null ? null : Number(business.station_distance_m),
      convenienceDistanceM: business.convenience_distance_m == null ? null : Number(business.convenience_distance_m),
      roomCount: Number(business.room_count) || rooms.length,
      bathCount: Number(business.bath_count) || 0,
      image,
      images: [image, ...rooms.map((room) => room.image)],
      intro: text(business.description || "단체 행사 이용이 가능한 제휴 숙소입니다."),
      amenities: business.facilities?.length ? business.facilities.map(text) : ["상세 시설은 사장님에게 문의해주세요."],
      amenityDetails: Array.isArray(business.amenity_details) ? business.amenity_details : [],
      fees: Array.isArray(business.extra_fees) && business.extra_fees.length
        ? business.extra_fees.map((fee) => text(`${fee.label || "추가요금"}${fee.amount ? ` ${Number(fee.amount).toLocaleString("ko-KR")}원` : ""}${fee.detail ? ` · ${fee.detail}` : ""}`))
        : ["추가요금은 예약 전 사장님에게 확인해주세요."],
      policy: ["이용 14일 전까지 전액 환불", "이용 7일 전까지 50% 환불", "이용 3일 전까지 20% 환불", "이후 및 당일 취소는 환불 불가"],
      rooms,
    };
  }

  function buildStore(business, offerings) {
    const products = offerings.map((item) => ({
      id: item.id,
      category: text(item.category || "기타"),
      name: text(item.name),
      unit: text(item.unit || "1개"),
      price: Number(item.price) || 0,
      origin: text(item.origin || "업체 제공 상품"),
      image: imageUrl(item.image_url || business.cover_image_url, productFallback),
      detail: text(item.description || "상세 내용은 마트에 문의해주세요."),
      detailSections: item.detail_sections && typeof item.detail_sections === "object" ? item.detail_sections : {},
      nutritionInfo: item.nutrition_info && typeof item.nutrition_info === "object" ? item.nutrition_info : {},
      isAlcohol: Boolean(item.is_alcohol),
      stockQuantity: item.stock_quantity == null ? null : Number(item.stock_quantity),
    }));
    return {
      id: business.id,
      name: text(business.business_name),
      region: regionOf(business),
      type: "moTF 제휴 마트",
      rating: 0,
      location: locationOf(business),
      image: imageUrl(business.cover_image_url, products[0]?.image || marketFallback),
      intro: text(business.description || "단체 행사 물품을 준비할 수 있는 제휴 마트입니다."),
      recommendedSets: Array.isArray(business.recommended_sets) ? business.recommended_sets : [],
      products,
    };
  }

  (async () => {
    const [businessResult, offeringResult] = await Promise.all([
      client.from("businesses")
        .select("id, business_type, business_name, address, description, region, cover_image_url, facilities, approval_status, latitude, longitude, location_verified_at, station_distance_m, convenience_distance_m, nearby_tags, room_count, bath_count, amenity_details, extra_fees, refund_policy, recommended_sets")
        .eq("approval_status", "approved"),
      client.from("offerings")
        .select("id, business_id, name, description, price, is_active, max_people, min_people, unit, category, image_url, sort_order, feature_summary, amenity_details, detail_sections, origin, nutrition_info, is_alcohol, stock_quantity")
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
      .map((business) => buildStay(business, offerings.filter((item) => item.business_id === business.id)))
      .filter((business) => business.rooms.length);
    const stores = businesses
      .filter((business) => business.business_type === "market")
      .map((business) => buildStore(business, offerings.filter((item) => item.business_id === business.id)))
      .filter((business) => business.products.length);

    window.motfApplyCatalog(stays, stores);
  })();
})();
