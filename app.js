const money = (value) => `${Number(value).toLocaleString("ko-KR")}원`;

const TOSS_CLIENT_KEY = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";
const TOSS_PENDING_PAYMENT_KEY = "motf.pendingPayment";
const TOSS_CUSTOMER_KEY = "motf-demo-customer_001";
let tossWidgets = null;
let tossWidgetOrderId = null;

const photo = (id, params = "auto=format&fit=crop&w=1200&q=82") =>
  `https://images.unsplash.com/${id}?${params}`;

const stays = [
  {
    id: "river",
    name: "가평 리버사이드 펜션",
    region: "가평",
    price: 720000,
    maxPeople: 40,
    rating: 4.8,
    reviews: 128,
    distance: "가평역 차량 12분",
    image: photo("photo-1564013799919-ab600027ffc6"),
    images: [
      photo("photo-1564013799919-ab600027ffc6"),
      photo("photo-1510798831971-661eb04b3739"),
      photo("photo-1505693416388-ac5ce068fe85"),
    ],
    intro: "강변 데크와 넓은 바베큐장을 갖춘 30명대 MT 팀용 단체 펜션입니다.",
    amenities: ["대형 바베큐장", "노래방", "세미나실", "주차 8대", "빔프로젝터", "취사 가능"],
    fees: ["바베큐 숯/그릴 120,000원", "기준 32명 초과 시 1인 20,000원", "얼리 체크인 시간당 50,000원"],
    policy: ["숙박 7일 전 100% 환불", "3일 전 50% 환불", "당일 취소 환불 불가", "시설 파손 시 실비 정산"],
    rooms: [
      {
        name: "단체동 A",
        capacity: "24~32명",
        price: 720000,
        image: photo("photo-1505693416388-ac5ce068fe85"),
        features: ["온돌방 3", "화장실 3", "거실형"],
      },
      {
        name: "별채 B",
        capacity: "12~18명",
        price: 430000,
        image: photo("photo-1613490493576-7fde63acd811"),
        features: ["복층", "개별 바베큐", "조용한 위치"],
      },
      {
        name: "전체 대관",
        capacity: "35~40명",
        price: 980000,
        image: photo("photo-1600585154340-be6161a56a0c"),
        features: ["독채", "운동장", "세미나실 포함"],
      },
    ],
  },
  {
    id: "pine",
    name: "양평 숲속 스테이",
    region: "양평",
    price: 930000,
    maxPeople: 48,
    rating: 4.7,
    reviews: 94,
    distance: "양평역 차량 18분",
    image: photo("photo-1449158743715-0a90ebb6d2d8"),
    images: [
      photo("photo-1449158743715-0a90ebb6d2d8"),
      photo("photo-1600607687939-ce8a6c25118c"),
      photo("photo-1523217582562-09d0def993a6"),
    ],
    intro: "넓은 잔디 마당과 독립 강당이 있어 신입생 OT와 학과 MT에 잘 맞습니다.",
    amenities: ["독립 강당", "잔디 마당", "족구장", "주방 2개", "방송 장비", "버스 진입 가능"],
    fees: ["강당 이용 150,000원", "침구 추가 1세트 8,000원", "기준 40명 초과 시 1인 18,000원"],
    policy: ["숙박 10일 전 100% 환불", "5일 전 70% 환불", "2일 전 30% 환불", "소음 민원 발생 시 이용 제한"],
    rooms: [
      {
        name: "메인 하우스",
        capacity: "30~40명",
        price: 930000,
        image: photo("photo-1600607687920-4e2a09cf159d"),
        features: ["방 6", "화장실 4", "강당 인접"],
      },
      {
        name: "숲동",
        capacity: "15~22명",
        price: 560000,
        image: photo("photo-1500530855697-b586d89ba3ee"),
        features: ["테라스", "개별 주방", "조용한 위치"],
      },
      {
        name: "전체 대관",
        capacity: "42~48명",
        price: 1250000,
        image: photo("photo-1600607688969-a5bfcd646154"),
        features: ["단독 행사", "강당 포함", "버스 주차"],
      },
    ],
  },
  {
    id: "campus",
    name: "강촌 캠퍼스 리조트",
    region: "강촌",
    price: 1450000,
    maxPeople: 70,
    rating: 4.6,
    reviews: 211,
    distance: "강촌역 도보 9분",
    image: photo("photo-1601918774946-25832a4be0d6"),
    images: [
      photo("photo-1601918774946-25832a4be0d6"),
      photo("photo-1600566753190-17f0baa2a6c3"),
      photo("photo-1596394516093-501ba68a0ba6"),
    ],
    intro: "역에서 가까운 대형 리조트형 숙소로 50명 이상 대규모 행사에 적합합니다.",
    amenities: ["대강당", "음향 장비", "편의점 인접", "엘리베이터", "객실 분리", "관리자 상주"],
    fees: ["대강당 250,000원", "음향 장비 80,000원", "기준 60명 초과 시 1인 15,000원"],
    policy: ["숙박 14일 전 100% 환불", "7일 전 50% 환불", "3일 전 20% 환불", "분리수거 미준수 시 청소비 발생"],
    rooms: [
      {
        name: "캠퍼스홀 패키지",
        capacity: "45~60명",
        price: 1450000,
        image: photo("photo-1596394516093-501ba68a0ba6"),
        features: ["객실 10", "대강당", "조식 선택"],
      },
      {
        name: "스탠다드 단체",
        capacity: "30~44명",
        price: 1030000,
        image: photo("photo-1560448204-e02f11c3d0e2"),
        features: ["객실 7", "소강당", "역 인접"],
      },
      {
        name: "전체 플로어",
        capacity: "61~70명",
        price: 1720000,
        image: photo("photo-1566073771259-6a8506099945"),
        features: ["층 단독", "운영실", "야간 담당자"],
      },
    ],
  },
  {
    id: "station",
    name: "대성리 스테이션 하우스",
    region: "대성리",
    price: 580000,
    maxPeople: 30,
    rating: 4.5,
    reviews: 57,
    distance: "대성리역 도보 6분",
    image: photo("photo-1522708323590-d24dbb6b0267"),
    images: [
      photo("photo-1522708323590-d24dbb6b0267"),
      photo("photo-1493809842364-78817add7ffb"),
      photo("photo-1507089947368-19c1da9775ae"),
    ],
    intro: "작은 학생회와 동아리 MT가 쓰기 좋은 역세권 숙소입니다.",
    amenities: ["역 도보권", "루프탑", "개별 바베큐", "보드게임", "주차 4대", "편의점 3분"],
    fees: ["루프탑 바베큐 90,000원", "침구 추가 1세트 7,000원", "기준 24명 초과 시 1인 16,000원"],
    policy: ["숙박 7일 전 100% 환불", "4일 전 60% 환불", "1일 전 20% 환불", "야외 소음 22시 이후 제한"],
    rooms: [
      {
        name: "루프탑 단체룸",
        capacity: "20~24명",
        price: 580000,
        image: photo("photo-1493809842364-78817add7ffb"),
        features: ["방 3", "루프탑", "역 인접"],
      },
      {
        name: "복층룸",
        capacity: "14~18명",
        price: 390000,
        image: photo("photo-1507089947368-19c1da9775ae"),
        features: ["복층", "개별 취사", "소규모"],
      },
      {
        name: "전체 대관",
        capacity: "25~30명",
        price: 720000,
        image: photo("photo-1600585152220-90363fe7e115"),
        features: ["독채", "루프탑 포함", "주차 4대"],
      },
    ],
  },
];

const stores = [
  {
    id: "gapyeong",
    name: "가평 청춘 공판장",
    region: "가평",
    type: "숙소 배송 가능",
    rating: 4.9,
    image: photo("photo-1542838132-92c53300491e"),
    intro: "MT용 바베큐 세트와 주류, 일회용품을 한 번에 준비하는 공판장입니다.",
    products: [
      {
        id: "pork-set",
        category: "식재료",
        name: "국내산 삼겹살 MT 세트",
        unit: "1kg",
        price: 23900,
        origin: "국내산 돼지고기",
        image: photo("photo-1602470520998-f4a52199a3d6"),
        detail: "두께감 있는 구이용 삼겹살입니다. 1kg 기준 4~5인분으로 계산하기 좋습니다.",
      },
      {
        id: "beef-set",
        category: "식재료",
        name: "프라임 소고기 모둠",
        unit: "800g",
        price: 42900,
        origin: "미국산 소고기",
        image: photo("photo-1551028150-64b9f398f678"),
        detail: "등심, 갈비살, 부채살을 섞은 모둠팩입니다. 행사 예산이 넉넉할 때 추천합니다.",
      },
      {
        id: "soju",
        category: "주류/음료",
        name: "소주 20병 박스",
        unit: "360ml x 20",
        price: 34800,
        origin: "국내 제조",
        image: photo("photo-1606765962248-7ff407b51667"),
        detail: "성인 인증 후 주문 가능한 상품입니다. 수령 시 신분증 확인이 필요합니다.",
      },
      {
        id: "beer",
        category: "주류/음료",
        name: "맥주 24캔 박스",
        unit: "500ml x 24",
        price: 51800,
        origin: "국내 제조",
        image: photo("photo-1608270586620-248524c67de9"),
        detail: "MT 저녁 식사용으로 많이 주문하는 캔맥주 박스입니다.",
      },
      {
        id: "paper-set",
        category: "일회용품",
        name: "일회용품 30인 세트",
        unit: "접시/컵/젓가락",
        price: 15900,
        origin: "국내 유통",
        image: photo("photo-1589365278144-c9e705f843ba"),
        detail: "접시, 종이컵, 나무젓가락, 비닐장갑으로 구성된 기본 세트입니다.",
      },
      {
        id: "dumpling",
        category: "냉동식품",
        name: "야식 만두 대용량",
        unit: "2.4kg",
        price: 21900,
        origin: "국내 제조",
        image: photo("photo-1496116218417-1a781b1c416c"),
        detail: "뒤풀이 야식용 냉동 만두입니다. 에어프라이어 또는 팬 조리가 가능합니다.",
      },
      {
        id: "charcoal",
        category: "기타",
        name: "숯과 토치 세트",
        unit: "숯 5kg + 토치",
        price: 18900,
        origin: "국내 유통",
        image: photo("photo-1532635224-cf024e66d122"),
        detail: "바베큐장 이용 시 필요한 숯과 점화 도구를 묶은 세트입니다.",
      },
    ],
  },
  {
    id: "yangpyeong",
    name: "양평 두물머리 식자재",
    region: "양평",
    type: "픽업 전용",
    rating: 4.7,
    image: photo("photo-1516594798947-e65505dbb29d"),
    intro: "채소와 고기 품질이 좋은 지역 식자재 매장입니다.",
    products: [
      {
        id: "veg-set",
        category: "식재료",
        name: "쌈채소와 버섯 세트",
        unit: "30인분",
        price: 32900,
        origin: "국내산 채소",
        image: photo("photo-1540420773420-3366772f4999"),
        detail: "상추, 깻잎, 고추, 마늘, 버섯이 포함된 바베큐 채소 세트입니다.",
      },
      {
        id: "ramen-box",
        category: "냉동식품",
        name: "봉지라면 혼합 박스",
        unit: "40봉",
        price: 31800,
        origin: "국내 제조",
        image: photo("photo-1612929633738-8fe44f7ec841"),
        detail: "아침 해장용으로 쓰기 좋은 라면 혼합 박스입니다.",
      },
      {
        id: "water",
        category: "주류/음료",
        name: "생수 2L 묶음",
        unit: "2L x 12",
        price: 11900,
        origin: "국내 제조",
        image: photo("photo-1523362628745-0c100150b504"),
        detail: "조리와 음용에 모두 쓰는 대용량 생수 묶음입니다.",
      },
      {
        id: "clean-set",
        category: "기타",
        name: "분리수거와 청소 세트",
        unit: "봉투/장갑/물티슈",
        price: 13900,
        origin: "국내 유통",
        image: photo("photo-1583947581924-a31d55c8e3e2"),
        detail: "퇴실 전 정리를 돕는 쓰레기봉투, 장갑, 물티슈 구성입니다.",
      },
    ],
  },
  {
    id: "gangchon",
    name: "강촌 캠프 마켓",
    region: "강촌",
    type: "역 앞 픽업",
    rating: 4.6,
    image: photo("photo-1606787366850-de6330128bfc"),
    intro: "강촌역 앞에서 빠르게 픽업할 수 있는 MT 전문 장보기 매장입니다.",
    products: [
      {
        id: "chicken",
        category: "식재료",
        name: "닭갈비 밀키트",
        unit: "4kg",
        price: 59900,
        origin: "국내산 닭고기",
        image: photo("photo-1604908176997-125f25cc6f3d"),
        detail: "강촌 MT에 잘 맞는 닭갈비 밀키트입니다. 양념과 채소 일부가 포함됩니다.",
      },
      {
        id: "snack-box",
        category: "기타",
        name: "레크레이션 간식 박스",
        unit: "40인분",
        price: 44900,
        origin: "국내 유통",
        image: photo("photo-1621939514649-280e2ee25f60"),
        detail: "게임 상품과 야식으로 나눠 쓰기 좋은 과자, 젤리, 초콜릿 혼합 박스입니다.",
      },
      {
        id: "cup-set",
        category: "일회용품",
        name: "컵과 접시 대용량",
        unit: "50인 세트",
        price: 21800,
        origin: "국내 유통",
        image: photo("photo-1627989580309-bfaf3e58af6f"),
        detail: "컵, 접시, 숟가락, 젓가락까지 넉넉하게 구성한 대용량 세트입니다.",
      },
      {
        id: "soda",
        category: "주류/음료",
        name: "탄산음료 혼합 박스",
        unit: "1.5L x 12",
        price: 27900,
        origin: "국내 제조",
        image: photo("photo-1622483767028-3f66f32aef97"),
        detail: "콜라, 사이다, 과일 탄산을 섞은 음료 박스입니다.",
      },
    ],
  },
];

const activities = [
  { title: "학과 빙고", people: "20~60명", time: "25분", note: "첫 만남 아이스브레이킹에 좋음" },
  { title: "팀별 미션 경매", people: "30~80명", time: "45분", note: "예산 게임과 장기자랑을 섞기 좋음" },
  { title: "MT 재판소", people: "15~40명", time: "30분", note: "웃긴 사연 제보를 받아 진행" },
  { title: "랜덤 조 편성 퀴즈", people: "20~70명", time: "35분", note: "선후배 섞임을 자연스럽게 만듦" },
];

const state = {
  selectedStay: stays[0],
  selectedRoom: stays[0].rooms[0],
  selectedStore: stores[0],
  selectedProduct: stores[0].products[0],
  activeCategory: "전체",
  cart: [
    { productId: "pork-set", storeId: "gapyeong", qty: 8 },
    { productId: "paper-set", storeId: "gapyeong", qty: 1 },
  ],
  reservations: [
    {
      id: "R-260612-001",
      stayName: "가평 리버사이드 펜션",
      roomName: "단체동 A",
      date: "2026-06-12",
      people: 32,
      amount: 840000,
      status: "결제 완료",
    },
  ],
  orders: [],
  reviews: [
    {
      target: "가평 리버사이드 펜션",
      score: 5,
      tags: ["소통이 빨라요", "단체 이용 좋아요"],
      text: "바베큐장 동선이 좋아서 30명대 MT 진행이 편했습니다. 사장님 답변도 빨랐어요.",
      author: "경영학과 학생회",
    },
    {
      target: "가평 청춘 공판장",
      score: 4,
      tags: ["가격이 합리적", "픽업이 편해요"],
      text: "삼겹살 양 계산이 쉬웠고 일회용품을 같이 담을 수 있어서 준비 시간이 줄었습니다.",
      author: "동아리 기획팀",
    },
  ],
  chats: [
    {
      id: "river-chat",
      title: "가평 리버사이드 펜션",
      subtitle: "바베큐장, 체크인 문의",
      messages: [
        { from: "admin", text: "moTF가 예약 규칙과 결제 내역을 함께 확인하는 중개 채팅입니다." },
        { from: "user", text: "6월 12일 32명인데 바베큐장 18시부터 이용 가능할까요?" },
        { from: "owner", text: "가능합니다. 숯과 그릴 포함이면 120,000원이 추가됩니다." },
      ],
    },
    {
      id: "market-chat",
      title: "가평 청춘 공판장",
      subtitle: "수령 시간, 주류 확인",
      messages: [
        { from: "admin", text: "주류 주문은 수령 시 성인 인증이 필요합니다." },
        { from: "owner", text: "펜션 앞 배송은 17시부터 가능합니다." },
      ],
    },
  ],
  activeChatId: "river-chat",
  rating: 5,
  pendingPayment: null,
  paymentResult: null,
};

const routeParents = {
  stayDetail: "stays",
  booking: "stays",
  storeDetail: "market",
  productDetail: "market",
  cart: "market",
  payment: "",
  paymentResult: "",
  review: "mypage",
  complete: "",
};

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => [...document.querySelectorAll(selector)];

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

window.__motfRefreshIcons = refreshIcons;

function toast(message) {
  const el = qs("#toast");
  el.textContent = message;
  el.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => el.classList.remove("show"), 2200);
}

function navigate(route) {
  qsa(".view").forEach((view) => view.classList.toggle("active", view.id === route));
  const activeNav = routeParents[route] ?? route;
  qsa(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.route === activeNav));
  renderRoute(route);
  window.scrollTo({ top: 0, behavior: "smooth" });
  refreshIcons();
}

function renderRoute(route) {
  if (route === "stays") renderStays();
  if (route === "stayDetail") renderStayDetail();
  if (route === "booking") renderBooking();
  if (route === "market") renderStores();
  if (route === "storeDetail") renderStoreDetail();
  if (route === "productDetail") renderProductDetail();
  if (route === "cart") renderCart();
  if (route === "payment") renderPayment();
  if (route === "paymentResult") renderPaymentResult();
  if (route === "community") renderCommunity();
  if (route === "chat") renderChat();
  if (route === "mypage") renderMypage();
  if (route === "review") renderReviews();
}

function getStayMatches() {
  const region = qs("#stayRegion").value;
  const people = Number(qs("#stayPeople").value || 0);
  const maxPrice = Number(qs("#stayPrice").value || 0);
  return stays.filter((stay) => {
    const regionOk = region === "전체" || stay.region === region;
    return regionOk && stay.maxPeople >= people && stay.price <= maxPrice;
  });
}

function renderStays() {
  const price = Number(qs("#stayPrice").value);
  qs("#stayPriceLabel").textContent = `${money(price)} 이하`;
  const matches = getStayMatches();
  qs("#stayCount").textContent = `${matches.length}개 숙소`;
  qs("#stayList").innerHTML = matches.length
    ? matches.map(stayCard).join("")
    : `<div class="empty-state">조건에 맞는 숙소가 없습니다. 인원이나 예산을 넓혀보세요.</div>`;
  refreshIcons();
}

function stayCard(stay) {
  return `
    <article class="listing-card">
      <img src="${stay.image}" alt="${stay.name} 사진" />
      <div class="listing-body">
        <div>
          <div class="listing-meta">
            <span class="pill">${stay.region}</span>
            <span class="pill success">최대 ${stay.maxPeople}명</span>
            <span class="pill">★ ${stay.rating} (${stay.reviews})</span>
          </div>
          <h3>${stay.name}</h3>
          <p>${stay.intro}</p>
          <p class="muted">${stay.distance}</p>
        </div>
        <div class="listing-actions">
          <span class="price">${money(stay.price)}부터</span>
          <button class="primary-btn" data-stay-id="${stay.id}"><i data-lucide="search"></i>상세 보기</button>
          <button class="ghost-btn" data-open-chat="${stay.name}"><i data-lucide="message-circle"></i>문의</button>
        </div>
      </div>
    </article>
  `;
}

function renderStayDetail() {
  const stay = state.selectedStay;
  qs("#stayDetailContent").innerHTML = `
    <div class="detail-hero">
      <div class="photo-grid">
        ${stay.images.map((src) => `<img src="${src}" alt="${stay.name} 내부 사진" />`).join("")}
      </div>
      <aside class="detail-intro">
        <div>
          <p class="eyebrow">${stay.region} · ${stay.distance}</p>
          <h1>${stay.name}</h1>
          <p>${stay.intro}</p>
          <div class="detail-meta">
            <span class="pill success">최대 ${stay.maxPeople}명</span>
            <span class="pill">★ ${stay.rating}</span>
            <span class="pill warning">${stay.reviews}개 리뷰</span>
          </div>
        </div>
        <div class="button-row">
          <button class="secondary-btn" data-open-chat="${stay.name}"><i data-lucide="messages-square"></i>사장님과 채팅</button>
          <button class="ghost-btn" data-route="review"><i data-lucide="star"></i>리뷰 보기</button>
        </div>
      </aside>
    </div>

    <div class="detail-sections">
      <section class="info-panel">
        <h2>편의시설</h2>
        <ul>${stay.amenities.map((item) => `<li>${item}</li>`).join("")}</ul>
      </section>
      <section class="info-panel">
        <h2>추가요금</h2>
        <ul>${stay.fees.map((item) => `<li>${item}</li>`).join("")}</ul>
      </section>
      <section class="info-panel">
        <h2>환불 및 규칙</h2>
        <ul>${stay.policy.map((item) => `<li>${item}</li>`).join("")}</ul>
      </section>
    </div>

    <section>
      <div class="section-toolbar">
        <h2>객실 선택</h2>
        <span>객실별 정원·금액</span>
      </div>
      <div class="room-grid">
        ${stay.rooms
          .map(
            (room, index) => `
          <article class="room-card">
            <img src="${room.image}" alt="${room.name} 사진" />
            <div>
              <h3>${room.name}</h3>
              <p>${room.capacity}</p>
              <div class="detail-meta">${room.features.map((feature) => `<span class="pill">${feature}</span>`).join("")}</div>
              <p class="price">${money(room.price)}</p>
              <button class="primary-btn" data-room-index="${index}"><i data-lucide="calendar-check"></i>이 방 예약</button>
            </div>
          </article>
        `
          )
          .join("")}
      </div>
    </section>
  `;
  refreshIcons();
}

function bookingAmount() {
  const room = state.selectedRoom;
  const facility = qs("#bookingFacility")?.value || "바베큐장";
  const people = Number(qs("#bookingPeople")?.value || 0);
  const extraPeople = Math.max(0, people - Number(room.capacity.split("~")[1].replace(/\D/g, "")));
  const facilityFee = facility === "바베큐장" ? 120000 : facility === "강당" ? 150000 : facility === "운동장" ? 70000 : 0;
  const extraFee = extraPeople * 18000;
  return {
    roomFee: room.price,
    facilityFee,
    extraFee,
    serviceFee: 30000,
    total: room.price + facilityFee + extraFee + 30000,
  };
}

function renderBooking() {
  const stay = state.selectedStay;
  const room = state.selectedRoom;
  qs("#bookingPeople").value = Math.min(stay.maxPeople, Number(qs("#stayPeople").value || 32));
  const update = () => {
    const amount = bookingAmount();
    qs("#bookingSummary").innerHTML = `
      <div class="summary-line"><span>${stay.name}</span><strong>${room.name}</strong></div>
      <div class="summary-line"><span>객실 금액</span><strong>${money(amount.roomFee)}</strong></div>
      <div class="summary-line"><span>시설 이용료</span><strong>${money(amount.facilityFee)}</strong></div>
      <div class="summary-line"><span>추가 인원</span><strong>${money(amount.extraFee)}</strong></div>
      <div class="summary-line"><span>moTF 중개 수수료</span><strong>${money(amount.serviceFee)}</strong></div>
      <div class="summary-line total"><span>총 결제 금액</span><strong>${money(amount.total)}</strong></div>
    `;
  };
  update();
  ["#bookingPeople", "#bookingFacility"].forEach((selector) => {
    qs(selector).oninput = update;
    qs(selector).onchange = update;
  });
}

function getStoreMatches() {
  const region = qs("#marketRegion").value;
  const category = qs("#marketCategory").value;
  return stores.filter((store) => {
    const regionOk = region === "전체" || store.region === region;
    const categoryOk = category === "전체" || store.products.some((product) => product.category === category);
    return regionOk && categoryOk;
  });
}

function renderStores() {
  const matches = getStoreMatches();
  qs("#storeCount").textContent = `${matches.length}개 공판장`;
  qs("#storeList").innerHTML = matches.length
    ? matches.map(storeCard).join("")
    : `<div class="empty-state">조건에 맞는 공판장이 없습니다.</div>`;
  updateCartBadge();
  refreshIcons();
}

function storeCard(store) {
  const people = Number(qs("#marketPeople").value || 32);
  const porkKg = Math.ceil(people * 0.35);
  return `
    <article class="listing-card">
      <img src="${store.image}" alt="${store.name} 사진" />
      <div class="listing-body">
        <div>
          <div class="listing-meta">
            <span class="pill">${store.region}</span>
            <span class="pill success">${store.type}</span>
            <span class="pill">★ ${store.rating}</span>
          </div>
          <h3>${store.name}</h3>
          <p>${store.intro}</p>
          <p class="muted">${people}명 기준 고기 추천량 약 ${porkKg}kg</p>
        </div>
        <div class="listing-actions">
          <span class="price">상품 ${store.products.length}개</span>
          <button class="primary-btn" data-store-id="${store.id}"><i data-lucide="shopping-bag"></i>공판장 보기</button>
          <button class="ghost-btn" data-open-chat="${store.name}"><i data-lucide="message-circle"></i>문의</button>
        </div>
      </div>
    </article>
  `;
}

function renderStoreDetail() {
  const store = state.selectedStore;
  const categories = ["전체", "식재료", "주류/음료", "일회용품", "냉동식품", "기타"];
  const products = state.activeCategory === "전체"
    ? store.products
    : store.products.filter((product) => product.category === state.activeCategory);
  qs("#storeDetailContent").innerHTML = `
    <div class="store-header">
      <img src="${store.image}" alt="${store.name} 매장 사진" />
      <div>
        <p class="eyebrow">${store.region} · ${store.type}</p>
        <h1>${store.name}</h1>
        <p>${store.intro}</p>
        <div class="detail-meta">
          <span class="pill">★ ${store.rating}</span>
          <span class="pill success">장바구니/바로구매</span>
          <span class="pill warning">주류 성인 인증</span>
        </div>
        <div class="button-row">
          <button class="secondary-btn" data-open-chat="${store.name}"><i data-lucide="messages-square"></i>공판장 문의</button>
          <button class="ghost-btn" data-route="cart"><i data-lucide="shopping-cart"></i>장바구니 보기</button>
        </div>
      </div>
    </div>
    <div class="category-tabs">
      ${categories.map((cat) => `<button class="category-tab ${cat === state.activeCategory ? "active" : ""}" data-category="${cat}">${cat}</button>`).join("")}
    </div>
    <div class="product-grid">
      ${products.map(productCard).join("")}
    </div>
  `;
  refreshIcons();
}

function productCard(product) {
  return `
    <article class="product-card">
      <img src="${product.image}" alt="${product.name} 사진" />
      <div>
        <span class="pill">${product.category}</span>
        <h3>${product.name}</h3>
        <p>${product.unit} · ${product.origin}</p>
        <p class="price">${money(product.price)}</p>
        <div class="button-row">
          <button class="primary-btn" data-product-id="${product.id}"><i data-lucide="search"></i>상세</button>
          <button class="ghost-btn" data-add-product="${product.id}"><i data-lucide="plus"></i>담기</button>
        </div>
      </div>
    </article>
  `;
}

function renderProductDetail() {
  const product = state.selectedProduct;
  qs("#productDetailContent").innerHTML = `
    <div class="product-detail">
      <img src="${product.image}" alt="${product.name} 사진" />
      <section class="info-panel">
        <p class="eyebrow">${product.category}</p>
        <h1>${product.name}</h1>
        <div class="product-meta">
          <span class="pill">${product.unit}</span>
          <span class="pill success">${product.origin}</span>
          <span class="pill warning">수령 전 변경 가능</span>
        </div>
        <p>${product.detail}</p>
        <p class="price">${money(product.price)}</p>
        <div class="quantity-control">
          <button type="button" data-qty-change="-1">-</button>
          <input id="productQty" value="1" inputmode="numeric" />
          <button type="button" data-qty-change="1">+</button>
        </div>
        <div class="button-row">
          <button class="secondary-btn" data-add-current><i data-lucide="shopping-cart"></i>장바구니 담기</button>
          <button class="primary-btn" data-buy-current><i data-lucide="credit-card"></i>바로구매</button>
        </div>
      </section>
    </div>
  `;
  refreshIcons();
}

function findProduct(productId) {
  for (const store of stores) {
    const product = store.products.find((item) => item.id === productId);
    if (product) return { product, store };
  }
  return null;
}

function addToCart(productId, qty = 1) {
  const found = findProduct(productId);
  if (!found) return;
  const existing = state.cart.find((item) => item.productId === productId);
  if (existing) {
    existing.qty += qty;
  } else {
    state.cart.push({ productId, storeId: found.store.id, qty });
  }
  updateCartBadge();
  toast(`${found.product.name} ${qty}개를 장바구니에 담았습니다.`);
}

function updateCartBadge() {
  const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const badge = qs("#cartBadge");
  if (badge) badge.textContent = count;
}

function cartTotal() {
  return state.cart.reduce((sum, item) => {
    const found = findProduct(item.productId);
    return sum + (found ? found.product.price * item.qty : 0);
  }, 0);
}

function renderCart() {
  updateCartBadge();
  qs("#cartItems").innerHTML = state.cart.length
    ? state.cart
        .map((item) => {
          const found = findProduct(item.productId);
          if (!found) return "";
          return `
            <article class="cart-row">
              <img src="${found.product.image}" alt="${found.product.name} 사진" />
              <div>
                <span class="pill">${found.store.name}</span>
                <h3>${found.product.name}</h3>
                <p>${found.product.unit} · ${money(found.product.price)}</p>
              </div>
              <div>
                <div class="quantity-control">
                  <button type="button" data-cart-change="${item.productId}" data-delta="-1">-</button>
                  <input value="${item.qty}" data-cart-input="${item.productId}" inputmode="numeric" />
                  <button type="button" data-cart-change="${item.productId}" data-delta="1">+</button>
                </div>
                <p class="price">${money(found.product.price * item.qty)}</p>
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">장바구니가 비어 있습니다. 공판장에서 상품을 담아보세요.</div>`;
  const deliveryFee = state.cart.length ? 15000 : 0;
  const total = cartTotal();
  qs("#cartSummary").innerHTML = `
    <div class="summary-line"><span>상품 금액</span><strong>${money(total)}</strong></div>
    <div class="summary-line"><span>수령/배송 준비비</span><strong>${money(deliveryFee)}</strong></div>
    <div class="summary-line total"><span>총 결제 금액</span><strong>${money(total + deliveryFee)}</strong></div>
  `;
  refreshIcons();
}

function paymentBackRoute() {
  if (!state.pendingPayment) return "stays";
  return state.pendingPayment.type === "stay" ? "booking" : "cart";
}

function paymentHomeRoute() {
  if (!state.paymentResult) return "stays";
  return state.paymentResult.type === "stay" ? "stays" : "market";
}

function makePaymentId(prefix) {
  return `${prefix}-${Date.now()}`;
}

function getBaseUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function getStoredPendingPayment() {
  try {
    const rawPayment = window.localStorage.getItem(TOSS_PENDING_PAYMENT_KEY);
    return rawPayment ? JSON.parse(rawPayment) : null;
  } catch {
    return null;
  }
}

function savePendingPayment(payment) {
  window.localStorage.setItem(TOSS_PENDING_PAYMENT_KEY, JSON.stringify(payment));
}

function clearPendingPayment() {
  window.localStorage.removeItem(TOSS_PENDING_PAYMENT_KEY);
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 20);
}

function setTossWidgetStatus(message, isError = false) {
  const status = qs("#tossWidgetStatus");
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? "#b74332" : "#556575";
}

function loadTossSdk() {
  if (window.TossPayments) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src="https://js.tosspayments.com/v2/standard"]');
    if (existingScript) {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.tosspayments.com/v2/standard";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function createStayPendingPayment() {
  const amount = bookingAmount();
  const people = Number(qs("#bookingPeople").value);
  return {
    type: "stay",
    title: `${state.selectedStay.name} 예약`,
    itemName: state.selectedRoom.name,
    amount: amount.total,
    orderId: makePaymentId("stay"),
    customerName: qs("#bookingName").value || "대표자",
    customerPhone: qs("#bookingPhone").value || "010-0000-0000",
    stayName: state.selectedStay.name,
    roomName: state.selectedRoom.name,
    date: qs("#stayDate").value,
    people,
    lines: [
      ["객실 금액", amount.roomFee],
      ["시설 이용료", amount.facilityFee],
      ["추가 인원", amount.extraFee],
      ["moTF 중개 수수료", amount.serviceFee],
    ],
  };
}

function createOrderPendingPayment() {
  const itemSnapshots = state.cart.map((item) => {
    const found = findProduct(item.productId);
    return {
      name: found.product.name,
      qty: item.qty,
      price: found.product.price,
      storeName: found.store.name,
    };
  });
  const productTotal = cartTotal();
  return {
    type: "market",
    title: "공판장 주문",
    itemName: itemSnapshots.length === 1 ? itemSnapshots[0].name : `${itemSnapshots[0].name} 외 ${itemSnapshots.length - 1}개`,
    amount: productTotal + 15000,
    orderId: makePaymentId("market"),
    customerName: "MT 대표자",
    customerPhone: "010-0000-0000",
    storeName: itemSnapshots[0].storeName,
    pickupTime: qs("#pickupTime").value,
    pickupPlace: qs("#pickupPlace").value,
    items: itemSnapshots,
    lines: [
      ["상품 금액", productTotal],
      ["수령/배송 준비비", 15000],
    ],
  };
}

function renderPayment() {
  const payment = state.pendingPayment;
  if (!payment) {
    qs("#paymentSummary").innerHTML = `<div class="empty-state">결제할 내역이 없습니다.</div>`;
    return;
  }
  routeParents.payment = payment.type === "stay" ? "stays" : "market";
  qs("#paymentBackBtn").dataset.route = paymentBackRoute();
  qs("#paymentSummary").innerHTML = `
    <div class="summary-line"><span>결제 대상</span><strong>${payment.title}</strong></div>
    <div class="summary-line"><span>상품명</span><strong>${payment.itemName}</strong></div>
    ${payment.lines.map(([label, value]) => `<div class="summary-line"><span>${label}</span><strong>${money(value)}</strong></div>`).join("")}
    <div class="summary-line"><span>주문번호</span><strong>${payment.orderId}</strong></div>
    <div class="summary-line total"><span>총 결제 금액</span><strong>${money(payment.amount)}</strong></div>
  `;
  renderTossWidgets(payment);
  refreshIcons();
}

async function renderTossWidgets(payment) {
  const paymentMethods = qs("#tossPaymentMethods");
  const agreement = qs("#tossAgreement");
  if (!paymentMethods || !agreement) return;

  if (tossWidgets && tossWidgetOrderId === payment.orderId) return;

  paymentMethods.innerHTML = "";
  agreement.innerHTML = "";
  setTossWidgetStatus("토스 결제위젯을 불러오는 중입니다.");

  try {
    await loadTossSdk();
    const tossPayments = window.TossPayments(TOSS_CLIENT_KEY);
    tossWidgets = tossPayments.widgets({ customerKey: TOSS_CUSTOMER_KEY });
    tossWidgetOrderId = payment.orderId;
    await tossWidgets.setAmount({
      currency: "KRW",
      value: payment.amount,
    });
    await Promise.all([
      tossWidgets.renderPaymentMethods({
        selector: "#tossPaymentMethods",
        variantKey: "DEFAULT",
      }),
      tossWidgets.renderAgreement({
        selector: "#tossAgreement",
        variantKey: "AGREEMENT",
      }),
    ]);
    setTossWidgetStatus("결제수단과 약관을 확인한 뒤 결제를 진행할 수 있습니다.");
  } catch (error) {
    tossWidgets = null;
    tossWidgetOrderId = null;
    setTossWidgetStatus(error.message || "토스 결제위젯을 불러오지 못했습니다.", true);
  }
}

async function requestTossPayment() {
  const payment = state.pendingPayment;
  if (!payment) {
    toast("결제할 내역이 없습니다.");
    return;
  }

  savePendingPayment(payment);

  try {
    await loadTossSdk();
    if (!tossWidgets || tossWidgetOrderId !== payment.orderId) {
      await renderTossWidgets(payment);
    }
    if (!tossWidgets) {
      throw new Error("토스 결제위젯이 아직 준비되지 않았습니다.");
    }
    const baseUrl = getBaseUrl();
    await tossWidgets.requestPayment({
      orderId: payment.orderId,
      orderName: payment.itemName,
      successUrl: `${baseUrl}?tossResult=success`,
      failUrl: `${baseUrl}?tossResult=fail`,
      customerName: payment.customerName,
      customerMobilePhone: normalizePhone(payment.customerPhone),
    });
  } catch (error) {
    state.paymentResult = {
      status: "fail",
      type: payment.type,
      eyebrow: "결제창 실행 실패",
      title: "토스 결제창을 열지 못했습니다",
      text: error.message || "브라우저나 네트워크 상태를 확인한 뒤 다시 시도해주세요.",
      icon: "x",
      className: "fail",
      orderId: payment.orderId,
      itemName: payment.itemName,
      amount: payment.amount,
      backRoute: paymentBackRoute(),
    };
    navigate("paymentResult");
  }
}

function handleTossRedirect() {
  const params = new URLSearchParams(window.location.search);
  const tossResult = params.get("tossResult");
  if (!tossResult) return false;

  const storedPayment = getStoredPendingPayment();
  if (!storedPayment) {
    state.paymentResult = {
      status: "fail",
      type: "stay",
      eyebrow: "결제 정보 확인 필요",
      title: "결제 요청 정보를 찾지 못했습니다",
      text: "결제창에서 돌아왔지만 브라우저에 저장된 주문 정보가 없습니다. 다시 결제를 시도해주세요.",
      icon: "x",
      className: "fail",
      orderId: params.get("orderId") || "-",
      itemName: "확인 필요",
      amount: Number(params.get("amount") || 0),
      backRoute: "stays",
    };
    navigate("paymentResult");
    window.history.replaceState({}, "", getBaseUrl());
    return true;
  }

  state.pendingPayment = storedPayment;
  routeParents.paymentResult = storedPayment.type === "stay" ? "stays" : "market";

  if (tossResult === "success") {
    state.paymentResult = {
      status: "authSuccess",
      type: storedPayment.type,
      eyebrow: "토스 결제창 인증 완료",
      title: "서버 승인만 남았습니다",
      text: "토스 결제창은 통과했습니다. 실제 서비스에서는 서버가 금액을 다시 확인하고 최종 결제 완료로 바꿉니다.",
      icon: "shield-check",
      className: "",
      orderId: params.get("orderId") || storedPayment.orderId,
      itemName: storedPayment.itemName,
      amount: Number(params.get("amount") || storedPayment.amount),
      paymentKey: params.get("paymentKey") || "토스에서 발급",
      backRoute: paymentBackRoute(),
    };
  } else {
    state.paymentResult = {
      status: "fail",
      type: storedPayment.type,
      eyebrow: "토스 결제 실패",
      title: "결제가 완료되지 않았습니다",
      text: params.get("message") || "결제창에서 실패 또는 취소가 발생했습니다.",
      icon: "x",
      className: "fail",
      orderId: params.get("orderId") || storedPayment.orderId,
      itemName: storedPayment.itemName,
      amount: storedPayment.amount,
      errorCode: params.get("code") || "",
      backRoute: paymentBackRoute(),
    };
  }

  navigate("paymentResult");
  window.history.replaceState({}, "", getBaseUrl());
  return true;
}

function confirmPendingPayment() {
  const payment = state.pendingPayment;
  if (!payment) return null;

  if (payment.type === "stay") {
    const reservation = {
      id: payment.orderId,
      stayName: payment.stayName,
      roomName: payment.roomName,
      date: payment.date,
      people: payment.people,
      amount: payment.amount,
      status: "결제 완료",
    };
    state.reservations.unshift(reservation);
  } else {
    state.orders.unshift({
      id: payment.orderId,
      storeName: payment.storeName,
      items: payment.items,
      amount: payment.amount,
      pickupTime: payment.pickupTime,
      status: "결제 완료",
    });
    state.cart = [];
    updateCartBadge();
  }

  return payment;
}

function setPaymentResult(status) {
  const payment = status === "success" ? confirmPendingPayment() : state.pendingPayment;
  if (!payment) {
    toast("결제할 내역이 없습니다.");
    return;
  }

  const resultText = {
    success: {
      eyebrow: "토스페이먼츠 승인 완료",
      title: payment.type === "stay" ? "숙소 예약 결제가 완료되었습니다" : "공판장 주문 결제가 완료되었습니다",
      text: "실제 연동 때는 이 순간 서버가 토스에 결제 금액을 다시 확인하고, 맞으면 결제 완료로 저장합니다.",
      icon: "check",
      className: "",
    },
    fail: {
      eyebrow: "결제 실패",
      title: "결제가 완료되지 않았습니다",
      text: "카드 한도, 인증 실패, 네트워크 문제처럼 결제가 실패한 상황을 보여주는 화면입니다.",
      icon: "x",
      className: "fail",
    },
    cancel: {
      eyebrow: "결제 취소",
      title: "결제를 취소했습니다",
      text: "이용자가 토스 결제창을 닫거나 뒤로 가기를 눌렀을 때 보여주는 화면입니다.",
      icon: "rotate-ccw",
      className: "cancel",
    },
  }[status];

  state.paymentResult = {
    ...resultText,
    status,
    type: payment.type,
    orderId: payment.orderId,
    itemName: payment.itemName,
    amount: payment.amount,
    backRoute: paymentBackRoute(),
  };
  routeParents.paymentResult = payment.type === "stay" ? "stays" : "market";

  if (status === "success") {
    state.pendingPayment = null;
    clearPendingPayment();
  }

  navigate("paymentResult");
}

function renderPaymentResult() {
  const result = state.paymentResult;
  if (!result) return;
  routeParents.paymentResult = result.type === "stay" ? "stays" : "market";
  const icon = qs("#paymentResultIcon");
  icon.className = `complete-icon ${result.className}`;
  icon.innerHTML = `<i data-lucide="${result.icon}"></i>`;
  qs("#paymentResultEyebrow").textContent = result.eyebrow;
  qs("#paymentResultTitle").textContent = result.title;
  qs("#paymentResultText").textContent = result.text;
  const extraRows = [
    result.paymentKey ? `<div class="result-detail-row"><span>paymentKey</span><strong>${result.paymentKey}</strong></div>` : "",
    result.errorCode ? `<div class="result-detail-row"><span>오류 코드</span><strong>${result.errorCode}</strong></div>` : "",
  ].join("");
  qs("#paymentResultDetails").innerHTML = `
    <div class="result-detail-row"><span>주문번호</span><strong>${result.orderId}</strong></div>
    <div class="result-detail-row"><span>상품명</span><strong>${result.itemName}</strong></div>
    <div class="result-detail-row"><span>금액</span><strong>${money(result.amount)}</strong></div>
    ${extraRows}
  `;
  let primaryAction = "";
  if (result.status === "authSuccess") {
    primaryAction = `<button class="primary-btn" data-payment-action="success"><i data-lucide="check-circle"></i>시연용 결제 완료 처리</button>`;
  } else if (result.status !== "success") {
    primaryAction = `<button class="primary-btn" data-route="${result.backRoute}"><i data-lucide="credit-card"></i>다시 결제하기</button>`;
  }
  qs("#paymentResultActions").innerHTML = `
    ${primaryAction}
    <button class="secondary-btn" data-route="mypage"><i data-lucide="user-round"></i>마이페이지 확인</button>
    <button class="ghost-btn" data-route="${paymentHomeRoute()}"><i data-lucide="home"></i>목록으로</button>
  `;
  refreshIcons();
}

function renderCommunity() {
  const people = Number(qs("#recommendPeople").value || 32);
  const style = qs("#mealStyle").value;
  const factor = style === "heavy" ? 0.45 : style === "light" ? 0.28 : 0.35;
  const pork = Math.ceil(people * factor);
  const drinks = Math.ceil(people * 1.7);
  const water = Math.ceil(people * 0.6);
  qs("#recommendResult").innerHTML = `
    <strong>${people}명 기준 추천</strong>
    <span>고기: 약 ${pork}kg</span>
    <span>음료/주류: 약 ${drinks}병 또는 캔</span>
    <span>생수 2L: 약 ${water}병</span>
  `;
  qs("#activityList").innerHTML = activities
    .map(
      (activity) => `
      <article class="mini-card">
        <h3>${activity.title}</h3>
        <p>${activity.people} · ${activity.time}</p>
        <span class="pill">${activity.note}</span>
      </article>
    `
    )
    .join("");
  qs("#communityReviews").innerHTML = state.reviews.map(reviewCard).join("");
  refreshIcons();
}

function renderChat() {
  qs("#chatList").innerHTML = state.chats
    .map(
      (thread) => `
      <button class="chat-thread ${thread.id === state.activeChatId ? "active" : ""}" data-chat-id="${thread.id}">
        <strong>${thread.title}</strong>
        <span>${thread.subtitle}</span>
      </button>
    `
    )
    .join("");
  const thread = state.chats.find((item) => item.id === state.activeChatId) || state.chats[0];
  qs("#chatRoomHeader").innerHTML = `
    <h2>${thread.title}</h2>
    <p class="muted">${thread.subtitle}</p>
  `;
  qs("#chatMessages").innerHTML = thread.messages
    .map((message) => `<div class="bubble ${message.from}">${message.text}</div>`)
    .join("");
  refreshIcons();
}

function renderMypage() {
  qs("#reservationList").innerHTML = state.reservations.length
    ? state.reservations.map(reservationCard).join("")
    : `<div class="empty-state">아직 예약한 숙소가 없습니다.</div>`;
  qs("#orderList").innerHTML = state.orders.length
    ? state.orders.map(orderCard).join("")
    : `<div class="empty-state">아직 공판장 주문이 없습니다.</div>`;
  refreshIcons();
}

function reservationCard(item) {
  return `
    <article class="listing-card">
      <div class="listing-body">
        <div class="listing-meta">
          <span class="pill success">${item.status}</span>
          <span class="pill">${item.date}</span>
          <span class="pill">${item.people}명</span>
        </div>
        <h3>${item.stayName}</h3>
        <p>${item.roomName} · ${money(item.amount)}</p>
        <div class="button-row">
          <button class="secondary-btn" data-budget-file="${item.id}"><i data-lucide="file-spreadsheet"></i>예결산 엑셀 생성</button>
          <button class="ghost-btn" data-route="review"><i data-lucide="star"></i>리뷰</button>
        </div>
      </div>
    </article>
  `;
}

function orderCard(item) {
  return `
    <article class="listing-card">
      <div class="listing-body">
        <div class="listing-meta">
          <span class="pill success">${item.status}</span>
          <span class="pill">${item.pickupTime}</span>
        </div>
        <h3>${item.storeName}</h3>
        <p>${item.items.length}개 품목 · ${money(item.amount)}</p>
        <div class="button-row">
          <button class="secondary-btn" data-budget-file="${item.id}"><i data-lucide="file-spreadsheet"></i>예결산 엑셀 생성</button>
          <button class="ghost-btn" data-route="review"><i data-lucide="star"></i>리뷰</button>
        </div>
      </div>
    </article>
  `;
}

function renderReviews() {
  qs("#reviewList").innerHTML = state.reviews.map(reviewCard).join("");
  qs("#communityReviews") && (qs("#communityReviews").innerHTML = state.reviews.map(reviewCard).join(""));
  qs("#ratingRow").innerHTML = [1, 2, 3, 4, 5]
    .map((score) => `<button type="button" class="star-btn ${score <= state.rating ? "active" : ""}" data-rating="${score}">★</button>`)
    .join("");
  refreshIcons();
}

function reviewCard(review) {
  return `
    <article class="review-card">
      <div class="listing-meta">
        <span class="pill">${review.target}</span>
        <span class="review-score">${"★".repeat(review.score)}${"☆".repeat(5 - review.score)}</span>
      </div>
      <p>${review.text}</p>
      <div class="detail-meta">${review.tags.map((tag) => `<span class="pill">${tag}</span>`).join("")}</div>
      <strong>${review.author}</strong>
    </article>
  `;
}

function complete(type, title, text) {
  qs("#completeEyebrow").textContent = type;
  qs("#completeTitle").textContent = title;
  qs("#completeText").textContent = text;
  navigate("complete");
}

function ensureChat(title) {
  let thread = state.chats.find((item) => item.title === title);
  if (!thread) {
    thread = {
      id: `chat-${Date.now()}`,
      title,
      subtitle: "새 문의",
      messages: [{ from: "admin", text: "moTF가 대화와 예약 정보를 함께 확인합니다." }],
    };
    state.chats.unshift(thread);
  }
  state.activeChatId = thread.id;
  navigate("chat");
}

document.addEventListener("click", (event) => {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) {
    navigate(routeButton.dataset.route);
    return;
  }

  const stayButton = event.target.closest("[data-stay-id]");
  if (stayButton) {
    state.selectedStay = stays.find((stay) => stay.id === stayButton.dataset.stayId) || stays[0];
    state.selectedRoom = state.selectedStay.rooms[0];
    navigate("stayDetail");
    return;
  }

  const roomButton = event.target.closest("[data-room-index]");
  if (roomButton) {
    state.selectedRoom = state.selectedStay.rooms[Number(roomButton.dataset.roomIndex)];
    navigate("booking");
    return;
  }

  const chatButton = event.target.closest("[data-open-chat]");
  if (chatButton) {
    ensureChat(chatButton.dataset.openChat);
    return;
  }

  const storeButton = event.target.closest("[data-store-id]");
  if (storeButton) {
    state.selectedStore = stores.find((store) => store.id === storeButton.dataset.storeId) || stores[0];
    state.activeCategory = qs("#marketCategory")?.value || "전체";
    navigate("storeDetail");
    return;
  }

  const categoryButton = event.target.closest("[data-category]");
  if (categoryButton) {
    state.activeCategory = categoryButton.dataset.category;
    renderStoreDetail();
    return;
  }

  const productButton = event.target.closest("[data-product-id]");
  if (productButton) {
    const found = findProduct(productButton.dataset.productId);
    if (found) {
      state.selectedProduct = found.product;
      state.selectedStore = found.store;
      navigate("productDetail");
    }
    return;
  }

  const addButton = event.target.closest("[data-add-product]");
  if (addButton) {
    addToCart(addButton.dataset.addProduct, 1);
    return;
  }

  if (event.target.closest("[data-add-current]")) {
    const qty = Math.max(1, Number(qs("#productQty").value || 1));
    addToCart(state.selectedProduct.id, qty);
    return;
  }

  if (event.target.closest("[data-buy-current]")) {
    const qty = Math.max(1, Number(qs("#productQty").value || 1));
    addToCart(state.selectedProduct.id, qty);
    navigate("cart");
    return;
  }

  const qtyButton = event.target.closest("[data-qty-change]");
  if (qtyButton) {
    const input = qs("#productQty");
    input.value = Math.max(1, Number(input.value || 1) + Number(qtyButton.dataset.qtyChange));
    return;
  }

  const cartButton = event.target.closest("[data-cart-change]");
  if (cartButton) {
    const item = state.cart.find((row) => row.productId === cartButton.dataset.cartChange);
    if (item) {
      item.qty += Number(cartButton.dataset.delta);
      if (item.qty <= 0) state.cart = state.cart.filter((row) => row !== item);
      renderCart();
    }
    return;
  }

  const chatThread = event.target.closest("[data-chat-id]");
  if (chatThread) {
    state.activeChatId = chatThread.dataset.chatId;
    renderChat();
    return;
  }

  const ratingButton = event.target.closest("[data-rating]");
  if (ratingButton) {
    state.rating = Number(ratingButton.dataset.rating);
    renderReviews();
    return;
  }

  const tagButton = event.target.closest(".tag-chip");
  if (tagButton) {
    tagButton.classList.toggle("active");
    return;
  }

  const tossPaymentButton = event.target.closest("[data-toss-payment]");
  if (tossPaymentButton) {
    requestTossPayment();
    return;
  }

  const paymentActionButton = event.target.closest("[data-payment-action]");
  if (paymentActionButton) {
    setPaymentResult(paymentActionButton.dataset.paymentAction);
    return;
  }

  const payChip = event.target.closest(".pay-chip");
  if (payChip) {
    const group = payChip.closest(".payment-methods");
    group.querySelectorAll(".pay-chip").forEach((chip) => chip.classList.remove("active"));
    payChip.classList.add("active");
    return;
  }

  const budgetButton = event.target.closest("[data-budget-file]");
  if (budgetButton) {
    toast("예결산 양식 선택 화면으로 연결됩니다.");
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches("#stayPrice, #stayRegion, #stayPeople, #stayDate")) renderStays();
  if (event.target.matches("#marketRegion, #marketCategory, #marketPeople, #marketDate")) renderStores();
  if (event.target.matches("#recommendPeople, #mealStyle")) renderCommunity();
  if (event.target.matches("[data-cart-input]")) {
    const item = state.cart.find((row) => row.productId === event.target.dataset.cartInput);
    if (item) {
      item.qty = Math.max(1, Number(event.target.value || 1));
      renderCart();
    }
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("#stayRegion, #stayDate")) renderStays();
  if (event.target.matches("#marketRegion, #marketCategory, #marketDate")) renderStores();
  if (event.target.matches("#mealStyle")) renderCommunity();
});

qs("#bookingForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.pendingPayment = createStayPendingPayment();
  routeParents.payment = "stays";
  navigate("payment");
});

qs("#orderForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.cart.length) {
    toast("장바구니가 비어 있습니다.");
    return;
  }
  state.pendingPayment = createOrderPendingPayment();
  routeParents.payment = "market";
  navigate("payment");
});

qs("#chatForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = qs("#chatText");
  const text = input.value.trim();
  if (!text) return;
  const thread = state.chats.find((item) => item.id === state.activeChatId);
  thread.messages.push({ from: "user", text });
  input.value = "";
  renderChat();
  const messages = qs("#chatMessages");
  messages.scrollTop = messages.scrollHeight;
});

qs("#reviewForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const activeTags = qsa(".tag-chip.active").map((tag) => tag.textContent);
  state.reviews.unshift({
    target: qs("#reviewTarget").value,
    score: state.rating,
    tags: activeTags,
    text: qs("#reviewText").value,
    author: "내 MT 팀",
  });
  qs("#reviewText").value = "";
  renderReviews();
  toast("후기가 등록되었습니다.");
});

qsa(".brand").forEach((brand) => {
  brand.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") navigate("stays");
  });
});

if (!handleTossRedirect()) {
  renderStays();
}
updateCartBadge();
refreshIcons();
