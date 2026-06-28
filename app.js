const money = (value) => `${Number(value).toLocaleString("ko-KR")}원`;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
}[character]));
window.motfEscapeHtml = escapeHtml;

let PORTONE_STORE_ID = window.MOTF_CONFIG?.PORTONE_STORE_ID?.trim() || "";
let PORTONE_CHANNEL_KEY = window.MOTF_CONFIG?.PORTONE_CHANNEL_KEY?.trim() || "";
const PORTONE_PENDING_PAYMENT_KEY = "motf.pendingPayment";

let NAVER_MAP_KEY_ID = window.MOTF_CONFIG?.NAVER_MAP_KEY_ID?.trim() || "";
const NAVER_MAP_SCRIPT_ID = "motf-naver-map-sdk";
let naverMapPromise = null;

const mapState = {
  stays: { map: null, markers: [], infoWindow: null, version: 0 },
  market: { map: null, markers: [], infoWindow: null, version: 0 },
};

const photo = (id, params = "auto=format&fit=crop&w=1200&q=82") =>
  `https://images.unsplash.com/${id}?${params}`;

let stays = [
  {
    id: "river",
    name: "가평 리버사이드 펜션",
    region: "가평",
    price: 720000,
    maxPeople: 40,
    rating: 4.8,
    reviews: 128,
    distance: "가평역 차량 12분",
    location: { lat: 37.8314, lng: 127.5098 },
    detailTags: ["waterside", "convenience", "barbecue", "screen", "karaoke", "mic", "outdoor"],
    roomCount: 5,
    bathCount: 4,
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
    location: { lat: 37.4918, lng: 127.4877 },
    detailTags: ["valley", "barbecue", "screen", "mic", "field", "outdoor", "convenience"],
    roomCount: 6,
    bathCount: 4,
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
    location: { lat: 37.8056, lng: 127.6341 },
    detailTags: ["station", "convenience", "screen", "mic", "field"],
    roomCount: 10,
    bathCount: 8,
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
    location: { lat: 37.6842, lng: 127.3794 },
    detailTags: ["station", "convenience", "barbecue", "screen", "outdoor"],
    roomCount: 3,
    bathCount: 2,
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

let stores = [
  {
    id: "gapyeong",
    name: "가평 청춘 공판장",
    region: "가평",
    type: "숙소 배송 가능",
    rating: 4.9,
    location: { lat: 37.8329, lng: 127.5107 },
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
    location: { lat: 37.4924, lng: 127.4916 },
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
    location: { lat: 37.8062, lng: 127.6334 },
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
  { id: "bingo", title: "학과 빙고", people: "20~60명", peopleGroup: "medium", space: "indoor", mood: "icebreak", time: "25분", note: "첫 만남 아이스브레이킹", media: "진행지 PDF · 예시 이미지", image: photo("photo-1529156069898-49953e39b3ac"), likes: 42, comments: ["빙고 칸에 교수님 별명 넣으면 반응 좋아요.", "새터 첫날에도 잘 먹혔습니다."], detail: "학과, 동아리, 과잠, 취미 같은 키워드를 빙고판에 넣고 서로 질문하며 칸을 채우는 게임입니다." },
  { id: "auction", title: "팀별 미션 경매", people: "30~80명", peopleGroup: "large", space: "indoor", mood: "team", time: "45분", note: "예산 게임과 장기자랑 조합", media: "룰 설명 영상", image: photo("photo-1517048676732-d65bc937f952"), likes: 58, comments: ["진행자가 가격 조절을 잘해야 재밌어요.", "장기자랑 부담을 줄이기 좋았습니다."], detail: "팀마다 가상 예산을 주고 미션을 경매로 가져가게 한 뒤, 획득한 미션을 수행해 점수를 얻는 방식입니다." },
  { id: "court", title: "MT 재판소", people: "15~40명", peopleGroup: "medium", space: "indoor", mood: "calm", time: "30분", note: "익명 사연으로 진행", media: "대본 템플릿", image: photo("photo-1556761175-b413da4baf72"), likes: 35, comments: ["익명 사연 검수는 꼭 필요합니다.", "분위기 풀기 좋았어요."], detail: "익명 사연을 받아 판사, 변호인, 증인 역할을 나누고 가볍게 상황극을 하는 레크레이션입니다." },
  { id: "random-quiz", title: "랜덤 조 편성 퀴즈", people: "20~70명", peopleGroup: "large", space: "any", mood: "icebreak", time: "35분", note: "선후배 섞임 유도", media: "문제 예시", image: photo("photo-1523580846011-d3a5bc25702b"), likes: 49, comments: ["조 편성 뒤 바로 하기 좋습니다."], detail: "랜덤으로 섞인 조가 학교, 학과, MT 장소 관련 퀴즈를 풀며 자연스럽게 대화하도록 만드는 게임입니다." },
  { id: "body-relay", title: "몸으로 말해요 릴레이", people: "20~50명", peopleGroup: "medium", space: "outdoor", mood: "team", time: "20분", note: "장비 없이 빠르게 시작", media: "제시어 카드", image: photo("photo-1517457373958-b7bdd4587205"), likes: 31, comments: ["야외에서 하면 사진도 잘 나와요."], detail: "팀원이 차례로 제시어를 몸짓으로 전달하고 마지막 사람이 정답을 맞히는 빠른 팀 대항 게임입니다." },
  { id: "ban-word", title: "술자리 금지어 게임", people: "10~40명", peopleGroup: "small", space: "indoor", mood: "calm", time: "30분", note: "소규모 뒤풀이용", media: "카드 이미지", image: photo("photo-1543269865-cbf427effbad"), likes: 27, comments: ["술 없이 음료 벌칙으로 해도 됩니다."], detail: "각자 모르는 금지어를 머리 위에 붙이고 대화하면서 상대가 금지어를 말하게 유도하는 게임입니다." },
];

const communityBoards = [
  {
    id: "market-share",
    title: "나눔장터",
    description: "남는 고기, 술, 일회용품을 같은 지역 MT 팀에게 나눔하거나 양도해요.",
    posts: [
      { id: "share-soju", title: "대성리 소주 8병 남아요", body: "오늘 밤 10시 이후 대성리역 근처에서 드릴 수 있어요.", likes: 18, comments: ["혹시 11시도 가능할까요?", "저희 팀 필요해요."], media: "사진 1" },
      { id: "share-cups", title: "가평역 근처 종이컵 나눔", body: "50개 정도 남았습니다. 숙소 픽업 전 가져가세요.", likes: 9, comments: ["위치 어디쯤인가요?", "감사합니다!"], media: "사진 2" },
      { id: "share-charcoal", title: "숯 3kg 필요하신 팀?", body: "바베큐 취소돼서 그대로 남았어요.", likes: 12, comments: ["저희 받을 수 있을까요?"], media: "" },
    ],
  },
  {
    id: "match",
    title: "대결신청",
    description: "족구, 피구, 장기자랑, 레크레이션 대결을 같은 지역 MT 팀에게 신청해요.",
    posts: [
      { id: "match-footvolley", title: "강촌 족구 5:5 붙을 팀", body: "오늘 20시 이후 가능. 실력은 재미 위주입니다.", likes: 23, comments: ["저희 6명 있어요.", "장소 어디인가요?"], media: "영상 1" },
      { id: "match-talent", title: "가평 장기자랑 교류전 구해요", body: "서로 2팀씩 나와서 가볍게 해요.", likes: 15, comments: ["재밌겠다", "시간 맞으면 갈게요"], media: "" },
      { id: "match-dodgeball", title: "대성리 피구 대결 신청", body: "인원 12명 정도, 운동장 있는 팀이면 좋아요.", likes: 20, comments: ["여기 숙소 운동장 있어요."], media: "사진 1" },
    ],
  },
  {
    id: "field-info",
    title: "현장 정보",
    description: "픽업, 택시, 편의점, 날씨, 소음 규칙처럼 현장에서 필요한 정보를 공유해요.",
    posts: [
      { id: "info-taxi", title: "가평역 택시 줄 현재 20분", body: "단체면 미리 콜 부르는 게 나아 보여요.", likes: 34, comments: ["정보 감사합니다.", "지금은 10분 정도예요."], media: "사진 1" },
      { id: "info-ice", title: "근처 편의점 얼음 재고 있음", body: "큰 봉투 얼음 아직 넉넉합니다.", likes: 16, comments: ["어느 편의점인가요?"], media: "" },
      { id: "info-rain", title: "대성리 비 와서 운동장 젖었어요", body: "야외 게임이면 실내 대안 준비하세요.", likes: 19, comments: ["저희도 실내로 바꿨어요."], media: "사진 2" },
    ],
  },
  {
    id: "confession",
    title: "익명고백",
    description: "같은 날 같은 지역에서 마주친 다른 학교 MT 팀에게 익명으로 마음을 전해요.",
    posts: [
      { id: "confess-blue", title: "6/12 강촌역 파란 과잠 분들", body: "길 알려주셔서 무사히 숙소 도착했습니다.", likes: 45, comments: ["혹시 우리인가", "훈훈하다"], media: "" },
      { id: "confess-store", title: "가평 편의점에서 도와준 팀 고마워요", body: "박스 옮기는 거 도와주신 분들 복 받으세요.", likes: 38, comments: ["다들 고생했어요"], media: "" },
      { id: "confess-umbrella", title: "양평 버스정류장 우산 빌려주신 분", body: "우산 꼭 돌려드리고 싶어요.", likes: 41, comments: ["찾으면 후기 부탁"], media: "사진 1" },
    ],
  },
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
        { from: "admin", text: "moTF가 예약 규칙과 결제 내역을 함께 확인하는 중개 채팅입니다.", read: true },
        { from: "user", text: "6월 12일 32명인데 바베큐장 18시부터 이용 가능할까요?", read: true },
        { from: "owner", text: "가능합니다. 숯과 그릴 포함이면 120,000원이 추가됩니다.", read: false },
      ],
    },
    {
      id: "market-chat",
      title: "가평 청춘 공판장",
      subtitle: "수령 시간, 주류 확인",
      messages: [
        { from: "admin", text: "주류 주문은 수령 시 성인 인증이 필요합니다.", read: true },
        { from: "owner", text: "펜션 앞 배송은 17시부터 가능합니다.", read: false },
      ],
    },
  ],
  activeChatId: "river-chat",
  rating: 5,
  activeBoardId: "market-share",
  activeActivityId: "bingo",
  activePostId: "share-soju",
  pendingPayment: null,
  paymentResult: null,
};

window.motfApplyCatalog = function applyCatalog(nextStays, nextStores) {
  if (Array.isArray(nextStays) && nextStays.length) {
    stays = nextStays;
    state.selectedStay = stays[0];
    state.selectedRoom = stays[0].rooms[0];
  }
  if (Array.isArray(nextStores) && nextStores.length) {
    stores = nextStores;
    state.selectedStore = stores[0];
    state.selectedProduct = stores[0].products[0];
    state.cart = [];
  }
  const route = currentRoute();
  if (route === "stays") renderStays();
  if (route === "stayDetail") renderStayDetail();
  if (route === "market") renderStores();
  if (route === "storeDetail") renderStoreDetail();
};

window.motfGetReservationDraft = function getReservationDraft() {
  const checkIn = qs("#bookingCheckIn").value || qs("#stayDate").value;
  const nextDate = (value) => {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  };
  const rawCheckOut = qs("#bookingCheckOut").value;
  const checkOut = rawCheckOut && rawCheckOut > checkIn ? rawCheckOut : nextDate(checkIn);
  const requestDetails = [
    `체크인 ${checkIn}`,
    `체크아웃 ${checkOut}`,
    `시설 이용 ${qs("#bookingFacility").value}`,
    qs("#bookingMemo").value.trim(),
  ].filter(Boolean).join(" / ");
  return {
    business_id: state.selectedStay.id,
    offering_id: state.selectedRoom.id,
    customer_name: qs("#bookingName").value.trim(),
    group_name: qs("#bookingOrg").value.trim() || null,
    contact_phone: qs("#bookingPhone").value.trim() || null,
    event_date: checkIn,
    check_in_date: checkIn,
    check_out_date: checkOut,
    guest_count: Number(qs("#bookingPeople").value),
    request_memo: requestDetails || null,
  };
};

window.motfGetMarketOrderDraft = function getMarketOrderDraft() {
  const items = state.cart.map((cartItem) => {
    const found = findProduct(cartItem.productId);
    return {
      offering_id: found.product.id,
      quantity: cartItem.qty,
    };
  });
  return {
    business_id: state.selectedStore.id,
    customer_name: window.motfCurrentUserProfile?.full_name || "이용자",
    contact_phone: window.motfCurrentUserProfile?.phone || null,
    pickup_place: qs("#pickupPlace").value.trim(),
    pickup_time: qs("#pickupTime").value,
    request_memo: qs("#pickupMemo").value.trim() || null,
    items,
  };
};

window.motfStartPreparedPayment = function startPreparedPayment(intent, draft) {
  const type = intent.kind;
  const isStay = type === "stay";
  const amount = Number(intent.amount);
  state.pendingPayment = {
    type,
    title: isStay ? "숙소 예약" : "공판장 주문",
    itemName: intent.order_name,
    amount,
    orderId: intent.order_id,
    customerName: draft.customer_name || window.motfCurrentUserProfile?.full_name || "이용자",
    customerPhone: draft.contact_phone || window.motfCurrentUserProfile?.phone || "",
    stayName: isStay ? state.selectedStay.name : undefined,
    roomName: isStay ? state.selectedRoom.name : undefined,
    storeName: isStay ? undefined : state.selectedStore.name,
    date: isStay ? draft.event_date : undefined,
    people: isStay ? draft.guest_count : undefined,
    pickupTime: isStay ? undefined : draft.pickup_time,
    lines: [[isStay ? "객실 결제 금액" : "상품 결제 금액", amount]],
  };
  savePendingPayment(state.pendingPayment);
  routeParents.payment = isStay ? "stays" : "market";
  navigate("payment");
};

window.motfApplyMyTransactions = function applyMyTransactions(reservations, orders) {
  state.reservations = reservations;
  state.orders = orders;
  renderMypage();
};

const routeParents = {
  home: "home",
  stayDetail: "stays",
  roomDetail: "stays",
  booking: "stays",
  storeDetail: "market",
  productDetail: "market",
  cart: "market",
  payment: "",
  paymentResult: "",
  recreation: "community",
  activityDetail: "community",
  boardDetail: "community",
  postDetail: "community",
  myUsage: "mypage",
  myAccount: "mypage",
  myGuide: "mypage",
  review: "mypage",
  businessInfo: "home",
  terms: "home",
  privacy: "home",
  refundPolicy: "home",
  complete: "",
};

const appRoutes = new Set([
  "home",
  "stays",
  "stayDetail",
  "roomDetail",
  "booking",
  "market",
  "storeDetail",
  "productDetail",
  "cart",
  "payment",
  "paymentResult",
  "community",
  "recreation",
  "activityDetail",
  "boardDetail",
  "postDetail",
  "chat",
  "mypage",
  "myUsage",
  "myAccount",
  "myGuide",
  "review",
  "businessInfo",
  "terms",
  "privacy",
  "refundPolicy",
  "complete",
]);

const routeHistory = [];
let appHistoryDepth = 0;
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

function currentRoute() {
  return qs(".view.active")?.id || "home";
}

function routeFromLocation() {
  const hashRoute = window.location.hash.replace(/^#!/, "").replace("#", "");
  return appRoutes.has(hashRoute) ? hashRoute : "home";
}

function routeUrl(route) {
  const baseUrl = getBaseUrl();
  return route === "home" ? baseUrl : `${baseUrl}#!${route}`;
}

function updateBrowserRoute(route, options = {}) {
  if (options.updateHistory === false) return;
  const method = options.replace ? "replaceState" : "pushState";
  window.history[method]({ route }, "", routeUrl(route));
  if (!options.replace) appHistoryDepth += 1;
}

function replaceBrowserRoute(route) {
  window.history.replaceState({ route }, "", routeUrl(route));
}

function navigate(route, options = {}) {
  if (!appRoutes.has(route)) route = "home";
  const previousRoute = currentRoute();
  if (options.record !== false && previousRoute && previousRoute !== route) {
    routeHistory.push(previousRoute);
    if (routeHistory.length > 30) routeHistory.shift();
  }
  qsa(".view").forEach((view) => view.classList.toggle("active", view.id === route));
  document.body.dataset.currentRoute = route;
  const activeNav = routeParents[route] ?? route;
  qsa(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.route === activeNav));
  renderRoute(route);
  updateBrowserRoute(route, options);
  if (options.scroll !== false) {
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  refreshIcons();
}

function goBack(fallbackRoute = "home") {
  if (appHistoryDepth > 0) {
    window.history.back();
    return;
  }
  const previousRoute = routeHistory.pop() || fallbackRoute || "home";
  navigate(previousRoute, { record: false, replace: true });
}

function renderRoute(route) {
  if (route === "stays") renderStays();
  if (route === "stayDetail") renderStayDetail();
  if (route === "roomDetail") renderRoomDetail();
  if (route === "booking") renderBooking();
  if (route === "market") renderStores();
  if (route === "storeDetail") renderStoreDetail();
  if (route === "productDetail") renderProductDetail();
  if (route === "cart") renderCart();
  if (route === "payment") renderPayment();
  if (route === "paymentResult") renderPaymentResult();
  if (route === "community") renderCommunity();
  if (route === "recreation") renderRecreation();
  if (route === "activityDetail") renderActivityDetail();
  if (route === "boardDetail") renderBoardDetail();
  if (route === "postDetail") renderPostDetail();
  if (route === "chat") renderChat();
  if (route === "mypage") renderMypage();
  if (route === "myUsage") renderMypage();
  if (route === "review") renderReviews();
}

function hasNaverMapKey() {
  return Boolean(NAVER_MAP_KEY_ID);
}

function loadNaverMaps() {
  if (window.naver?.maps) return Promise.resolve(window.naver.maps);
  if (!hasNaverMapKey()) {
    return Promise.reject(new Error("네이버 지도 Client ID가 아직 비어 있습니다."));
  }
  if (naverMapPromise) return naverMapPromise;

  naverMapPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(NAVER_MAP_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.naver.maps), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("네이버 지도 스크립트를 불러오지 못했습니다.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = NAVER_MAP_SCRIPT_ID;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(NAVER_MAP_KEY_ID)}`;
    script.async = true;
    script.onload = () => {
      if (window.naver?.maps) {
        resolve(window.naver.maps);
      } else {
        reject(new Error("네이버 지도 SDK가 준비되지 않았습니다."));
      }
    };
    script.onerror = () => reject(new Error("네이버 지도 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });

  return naverMapPromise;
}

function mapPanel(kind) {
  return qs(`[data-map-kind="${kind}"]`);
}

function setMapStatus(kind, message) {
  const status = mapPanel(kind)?.querySelector("[data-map-status]");
  if (status) status.textContent = message;
}

function mapItems(kind, matches) {
  return matches.map((item) => ({
    id: item.id,
    name: item.name,
    region: item.region,
    line: kind === "stays" ? `최대 ${item.maxPeople}명` : item.type,
    amount: kind === "stays" ? money(item.price) : `상품 ${item.products.length}개`,
    location: item.location,
  }));
}

function fallbackMarker(item, kind, index) {
  const markerClass = ["marker-a", "marker-b", "marker-c", "marker-d"][index % 4];
  const dataAttr = kind === "stays" ? `data-stay-id="${item.id}"` : `data-store-id="${item.id}"`;
  return `<button class="map-marker ${markerClass}" ${dataAttr}>${item.region}<br />${item.line.replace("최대 ", "")}</button>`;
}

function renderFallbackMap(kind, matches, statusMessage) {
  const panel = mapPanel(kind);
  if (!panel) return;
  const fallback = panel.querySelector("[data-map-fallback]");
  const items = mapItems(kind, matches);

  panel.classList.remove("map-ready");
  fallback.innerHTML = `
    <div class="map-grid"></div>
    ${
      items.length
        ? items.map((item, index) => fallbackMarker(item, kind, index)).join("")
        : `<div class="map-empty">조건에 맞는 ${kind === "stays" ? "숙소" : "공판장"}이 없습니다.</div>`
    }
  `;
  setMapStatus(kind, statusMessage);
}

function clearNaverMarkers(kind) {
  mapState[kind].markers.forEach((marker) => marker.setMap(null));
  mapState[kind].markers = [];
  mapState[kind].infoWindow?.close();
}

function openListingFromMap(kind, itemId) {
  if (kind === "stays") {
    state.selectedStay = stays.find((stay) => stay.id === itemId) || stays[0];
    state.selectedRoom = state.selectedStay.rooms[0];
    navigate("stayDetail");
    return;
  }

  state.selectedStore = stores.find((store) => store.id === itemId) || stores[0];
  state.activeCategory = "전체";
  navigate("storeDetail");
}

function markerContent(item, kind) {
  return `
    <div class="naver-map-marker ${kind === "market" ? "market" : ""}">
      ${item.region}
      <span>${item.line}</span>
    </div>
  `;
}

function infoContent(item, kind) {
  const action = kind === "stays" ? "숙소 상세로 이동" : "공판장 상품 보기";
  return `
    <div class="naver-map-info">
      <strong>${item.name}</strong>
      <div>${item.line} · ${item.amount}</div>
      <div>${action}</div>
    </div>
  `;
}

function drawNaverMap(kind, matches, maps) {
  const panel = mapPanel(kind);
  const canvas = panel?.querySelector(".naver-map-canvas");
  if (!panel || !canvas) return;

  const items = mapItems(kind, matches).filter((item) => item.location);
  const fallbackCenter = kind === "stays" ? { lat: 37.7465, lng: 127.5065 } : { lat: 37.7108, lng: 127.5452 };
  const firstLocation = items[0]?.location || fallbackCenter;
  const center = new maps.LatLng(firstLocation.lat, firstLocation.lng);

  if (!mapState[kind].map) {
    mapState[kind].map = new maps.Map(canvas, {
      center,
      zoom: items.length <= 1 ? 11 : 10,
      mapDataControl: false,
      scaleControl: false,
    });
    mapState[kind].infoWindow = new maps.InfoWindow({ borderWidth: 0, disableAnchor: true });
  }

  const map = mapState[kind].map;
  clearNaverMarkers(kind);
  panel.classList.add("map-ready");
  setMapStatus(kind, `네이버 지도 연동됨 · ${items.length}개 표시`);

  if (!items.length) {
    map.setCenter(center);
    map.setZoom(10);
    return;
  }

  const bounds = new maps.LatLngBounds();
  items.forEach((item) => {
    const position = new maps.LatLng(item.location.lat, item.location.lng);
    bounds.extend(position);
    const marker = new maps.Marker({
      position,
      map,
      title: item.name,
      icon: {
        content: markerContent(item, kind),
        size: new maps.Size(102, 58),
        anchor: new maps.Point(51, 58),
      },
    });

    maps.Event.addListener(marker, "click", () => {
      mapState[kind].infoWindow.setContent(infoContent(item, kind));
      mapState[kind].infoWindow.open(map, marker);
      window.setTimeout(() => openListingFromMap(kind, item.id), 450);
    });
    mapState[kind].markers.push(marker);
  });

  if (items.length === 1) {
    map.setCenter(center);
    map.setZoom(12);
  } else {
    map.fitBounds(bounds);
  }

  window.setTimeout(() => {
    map.refresh?.();
  }, 0);
}

async function renderListingMap(kind, matches) {
  mapState[kind].version += 1;
  const version = mapState[kind].version;
  const waitingMessage = hasNaverMapKey() ? "네이버 지도 불러오는 중" : "config.js에 지도 키 입력 필요";
  renderFallbackMap(kind, matches, waitingMessage);

  if (!hasNaverMapKey()) return;

  try {
    const maps = await loadNaverMaps();
    if (mapState[kind].version !== version) return;
    drawNaverMap(kind, matches, maps);
  } catch (error) {
    if (mapState[kind].version !== version) return;
    renderFallbackMap(kind, matches, "네이버 지도 키 또는 도메인 확인 필요");
  }
}

function getStayDetailFilters() {
  return {
    tags: qsa("[data-stay-filter]:checked").map((input) => input.value),
    minRooms: Number(qs("#stayMinRooms")?.value || 0),
    minBaths: Number(qs("#stayMinBaths")?.value || 0),
  };
}

function stayMatchesDetailFilters(stay, filters) {
  const tags = stay.detailTags || [];
  const tagsOk = filters.tags.every((tag) => tags.includes(tag));
  const roomsOk = Number(stay.roomCount || 0) >= filters.minRooms;
  const bathsOk = Number(stay.bathCount || 0) >= filters.minBaths;
  return tagsOk && roomsOk && bathsOk;
}

function getStayMatches() {
  const region = qs("#stayRegion").value;
  const people = Number(qs("#stayPeople").value || 0);
  const maxPrice = Number(qs("#stayPrice").value || 0);
  const detailFilters = getStayDetailFilters();
  return stays.filter((stay) => {
    const regionOk = region === "전체" || stay.region === region;
    return regionOk && stay.maxPeople >= people && stay.price <= maxPrice && stayMatchesDetailFilters(stay, detailFilters);
  });
}

function renderStays() {
  const price = Number(qs("#stayPrice").value);
  qs("#stayPriceLabel").textContent = `${money(price)} 이하`;
  const detailFilters = getStayDetailFilters();
  const activeDetailFilterCount = detailFilters.tags.length + (detailFilters.minRooms > 0 ? 1 : 0) + (detailFilters.minBaths > 0 ? 1 : 0);
  const detailFilterButton = qs("[data-toggle-stay-filters]");
  if (detailFilterButton) {
    detailFilterButton.classList.toggle("active", activeDetailFilterCount > 0);
    detailFilterButton.innerHTML = `<i data-lucide="sliders-horizontal"></i>세부필터${activeDetailFilterCount ? ` ${activeDetailFilterCount}` : ""}`;
  }
  const matches = getStayMatches();
  qs("#stayCount").textContent = `${matches.length}개 숙소`;
  qs("#stayList").innerHTML = matches.length
    ? matches.map(stayCard).join("")
    : `<div class="empty-state">조건에 맞는 숙소가 없습니다. 인원이나 예산을 넓혀보세요.</div>`;
  renderListingMap("stays", matches);
  refreshIcons();
}

function stayCard(stay) {
  return `
    <article class="listing-card stay-listing-card">
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

function uniqueImages(images) {
  return [...new Set(images.filter(Boolean))];
}

function stayGalleryImages(stay) {
  return uniqueImages([
    stay.image,
    ...stay.images,
    ...stay.rooms.map((room) => room.image),
    photo("photo-1600566753190-17f0baa2a6c3"),
    photo("photo-1596394516093-501ba68a0ba6"),
    photo("photo-1523217582562-09d0def993a6"),
  ]).slice(0, 9);
}

function roomGalleryImages(stay, room) {
  return uniqueImages([
    room.image,
    ...stay.images,
    ...stay.rooms.map((item) => item.image),
    photo("photo-1600607688969-a5bfcd646154"),
    photo("photo-1493809842364-78817add7ffb"),
  ]).slice(0, 8);
}

function dashList(items) {
  return `<ul class="dash-list">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function roomCapacityMax(room) {
  const match = room.capacity.match(/(\d+)\D*$/);
  return match ? Number(match[1]) : 0;
}

function roomDetailFacts(stay, room) {
  return [
    ["정원", room.capacity],
    ["객실 금액", money(room.price)],
    ["숙소 위치", `${stay.region} · ${stay.distance}`],
    ["공간 구성", room.features.join(" · ")],
  ];
}

function renderStayGallery(images, alt) {
  return `
    <div class="stay-photo-layout">
      <img class="stay-main-photo" src="${images[0]}" alt="${alt} 대표 사진" />
      <div class="stay-side-photos">
        ${images.slice(1, 5).map((src) => `<img src="${src}" alt="${alt} 추가 사진" />`).join("")}
      </div>
    </div>
    <div class="photo-strip" aria-label="추가 사진">
      ${images.slice(1).map((src, index) => `<img src="${src}" alt="${alt} 추가 사진 ${index + 1}" />`).join("")}
    </div>
  `;
}

function roomOptionCard(room, index, stay) {
  return `
    <article class="room-option-card">
      <img src="${room.image}" alt="${room.name} 사진" />
      <div class="room-option-body">
        <div>
          <p class="eyebrow">객실 유형 ${index + 1}</p>
          <h3>${room.name}</h3>
          <p class="muted">${room.capacity} · ${money(room.price)}</p>
        </div>
        <div class="mini-detail-grid">
          ${roomDetailFacts(stay, room)
            .map(
              ([label, value]) => `
                <div class="mini-detail-block">
                  <strong>${label}</strong>
                  <span>- ${value}</span>
                </div>
              `
            )
            .join("")}
        </div>
        <div class="detail-meta">${room.features.map((feature) => `<span class="pill">${feature}</span>`).join("")}</div>
        <button class="primary-btn" data-room-index="${index}"><i data-lucide="door-open"></i>객실 자세히 보기</button>
      </div>
    </article>
  `;
}

function renderStayDetail() {
  const stay = state.selectedStay;
  const gallery = stayGalleryImages(stay);
  qs("#stayDetailContent").innerHTML = `
    <section class="stay-detail-top">
      <div>
        <p class="eyebrow">${stay.region} · ${stay.distance}</p>
        <h1 class="stay-detail-title">${stay.name}</h1>
        <p>${stay.intro}</p>
        <div class="detail-meta">
          <span class="pill success">최대 ${stay.maxPeople}명</span>
          <span class="pill">방 ${stay.roomCount}개</span>
          <span class="pill">화장실 ${stay.bathCount}개</span>
          <span class="pill">★ ${stay.rating} (${stay.reviews})</span>
        </div>
      </div>
      <div class="button-row">
        <button class="secondary-btn" data-open-chat="${stay.name}"><i data-lucide="messages-square"></i>사장님과 채팅</button>
        <button class="ghost-btn" data-route="review"><i data-lucide="star"></i>리뷰 보기</button>
      </div>
    </section>

    <section class="stay-gallery-section">
      ${renderStayGallery(gallery, stay.name)}
    </section>

    <section>
      <div class="section-toolbar">
        <h2>객실 유형 및 타입</h2>
        <span>객실을 누르면 상세 정보로 이동합니다</span>
      </div>
      <div class="room-list-vertical">
        ${stay.rooms.map((room, index) => roomOptionCard(room, index, stay)).join("")}
      </div>
    </section>

    <div class="detail-sections detail-sections-bottom">
      <section class="info-panel">
        <h2>편의시설</h2>
        ${dashList(stay.amenities)}
      </section>
      <section class="info-panel">
        <h2>추가요금</h2>
        ${dashList(stay.fees)}
      </section>
      <section class="info-panel">
        <h2>환불 및 규칙</h2>
        ${dashList(stay.policy)}
      </section>
    </div>
  `;
  refreshIcons();
}

function renderRoomDetail() {
  const stay = state.selectedStay;
  const room = state.selectedRoom;
  const gallery = roomGalleryImages(stay, room);
  const maxPeople = roomCapacityMax(room);
  qs("#roomDetailContent").innerHTML = `
    <section class="room-detail-hero">
      <div>
        <p class="eyebrow">${stay.name}</p>
        <h1 class="room-detail-title">${room.name}</h1>
        <p>${room.capacity} 기준으로 운영되는 객실입니다. 예약 전에 사진, 인원 규정, 추가 요금, 시설 조건을 한 번 더 확인해주세요.</p>
      </div>
      <aside class="room-reserve-card">
        <span>객실 금액</span>
        <strong>${money(room.price)}</strong>
        <p>최대 ${maxPeople || stay.maxPeople}명까지 선택 가능</p>
        <button class="primary-btn" data-route="booking"><i data-lucide="calendar-check"></i>예약 정보 입력하기</button>
      </aside>
    </section>

    <section class="stay-gallery-section">
      ${renderStayGallery(gallery, room.name)}
    </section>

    <div class="room-detail-grid">
      <section class="info-panel">
        <h2>객실 세부사항</h2>
        ${dashList([
          `정원 ${room.capacity}`,
          `객실 금액 ${money(room.price)}`,
          `${room.features.join(" · ")}`,
          "체크인 15:00 이후, 체크아웃 11:00 이전",
        ])}
      </section>
      <section class="info-panel">
        <h2>인원 규정</h2>
        ${dashList([
          `기본 정원은 ${room.capacity}입니다.`,
          "초과 인원은 숙소 규정에 따라 1인당 추가 요금이 발생합니다.",
          "미성년자 단체 이용은 대표자 확인이 필요합니다.",
        ])}
      </section>
      <section class="info-panel">
        <h2>포함 편의시설</h2>
        ${dashList([...room.features, ...stay.amenities.slice(0, 4)])}
      </section>
      <section class="info-panel">
        <h2>추가요금 및 환불</h2>
        ${dashList([...stay.fees.slice(0, 3), ...stay.policy.slice(0, 3)])}
      </section>
    </div>
  `;
  refreshIcons();
}

function bookingAmount() {
  const room = state.selectedRoom;
  return {
    roomFee: room.price,
    total: room.price,
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
      <div class="summary-line"><span>사장님 등록 객실 금액</span><strong>${money(amount.roomFee)}</strong></div>
      <div class="summary-line"><span>시설 이용 요청</span><strong>결제 후 사장님 확인</strong></div>
      <div class="summary-line total"><span>총 결제 금액</span><strong>${money(amount.total)}</strong></div>
    `;
  };
  update();
  ["#bookingPeople", "#bookingFacility"].forEach((selector) => {
    qs(selector).oninput = update;
    qs(selector).onchange = update;
  });
}

function renderStores() {
  const store = stores[0];
  state.selectedStore = store;
  const categories = ["전체", "식재료", "주류/음료", "일회용품", "냉동식품", "기타"];
  if (!categories.includes(state.activeCategory)) state.activeCategory = "전체";
  const products = state.activeCategory === "전체"
    ? store.products
    : store.products.filter((product) => product.category === state.activeCategory);
  const people = Number(qs("#marketPeople")?.value || 32);
  const porkKg = Math.ceil(people * 0.35);
  qs("#marketIntro").innerHTML = `
    <section class="market-intro">
      <img src="${store.image}" alt="${store.name} 매장 사진" />
      <div class="market-intro-body">
        <p class="eyebrow">${store.region} 계약 공판장</p>
        <h2>${store.name}</h2>
        <p>${store.intro} 숙소 일정에 맞춰 수령 또는 배송 요청을 남길 수 있습니다.</p>
        <div class="detail-meta">
          <span class="pill">★ ${store.rating}</span>
          <span class="pill success">${store.type}</span>
          <span class="pill warning">주류 성인 인증</span>
        </div>
        <div class="market-controls">
          <label>참여 인원<input type="number" id="marketPeople" min="10" max="120" value="${people}" /></label>
          <div class="market-reco">
            <strong>${people}명 기준</strong>
            <span>고기 약 ${porkKg}kg · 생수 2L 약 ${Math.ceil(people * 0.6)}병</span>
          </div>
        </div>
        <div class="button-row">
          <button class="secondary-btn" data-open-chat="${store.name}"><i data-lucide="messages-square"></i>공판장 문의</button>
          <button class="ghost-btn" data-route="cart"><i data-lucide="shopping-cart"></i>장바구니 보기</button>
        </div>
      </div>
    </section>
  `;
  qs("#marketProducts").innerHTML = `
    <div class="section-toolbar">
      <h2>상품 둘러보기</h2>
      <span>${products.length}개 상품</span>
    </div>
    <div class="category-tabs">
      ${categories.map((cat) => `<button class="category-tab ${cat === state.activeCategory ? "active" : ""}" data-category="${cat}">${cat}</button>`).join("")}
    </div>
    <div class="product-grid">
      ${products.map(productCard).join("")}
    </div>
  `;
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
  const total = cartTotal();
  qs("#cartSummary").innerHTML = `
    <div class="summary-line"><span>상품 금액</span><strong>${money(total)}</strong></div>
    <div class="summary-line total"><span>총 결제 금액</span><strong>${money(total)}</strong></div>
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

function getBaseUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function getStoredPendingPayment() {
  try {
    const rawPayment = window.localStorage.getItem(PORTONE_PENDING_PAYMENT_KEY);
    return rawPayment ? JSON.parse(rawPayment) : null;
  } catch {
    return null;
  }
}

function savePendingPayment(payment) {
  window.localStorage.setItem(PORTONE_PENDING_PAYMENT_KEY, JSON.stringify(payment));
}

function clearPendingPayment() {
  window.localStorage.removeItem(PORTONE_PENDING_PAYMENT_KEY);
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 20);
}

function formatVirtualAccount(account = {}) {
  const bank = account.bankName || account.bank || account.bankCode || account.bank_code || "";
  const number = account.accountNumber || account.account_number || account.number || "";
  const holder = account.holderName || account.accountHolder || account.account_holder || account.customerName || "";
  const due = account.dueDate || account.due_date || account.expiredAt || account.expiresAt || account.expiry || "";
  return {
    bank,
    number,
    holder,
    due,
    label: [bank, number, holder].filter(Boolean).join(" / "),
  };
}

function setTossWidgetStatus(message, isError = false) {
  const status = qs("#tossWidgetStatus");
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? "#b74332" : "#6d7368";
}

function loadPortOneSdk() {
  if (window.PortOne) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src="https://cdn.portone.io/v2/browser-sdk.js"]');
    if (existingScript) {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.portone.io/v2/browser-sdk.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function loadPaymentConfig() {
  try {
    const response = await fetch("/api/payment-config", { cache: "no-store" });
    const data = await response.json();
    if (response.ok && data.portoneStoreId) PORTONE_STORE_ID = data.portoneStoreId;
    if (response.ok && data.portoneChannelKey) PORTONE_CHANNEL_KEY = data.portoneChannelKey;
    if (response.ok && data.naverMapKeyId) NAVER_MAP_KEY_ID = data.naverMapKeyId;
  } catch (error) {
    console.warn("포트원 결제 공개 설정을 불러오지 못했습니다.", error);
  }
}

function renderPayment() {
  const payment = state.pendingPayment;
  if (!payment) {
    qs("#paymentSummary").innerHTML = `<div class="empty-state">결제할 내역이 없습니다.</div>`;
    return;
  }
  routeParents.payment = payment.type === "stay" ? "stays" : "market";
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
    if (!TOSS_CLIENT_KEY) {
      throw new Error("토스페이먼츠 Client Key가 설정되지 않았습니다.");
    }
    await loadTossSdk();
    const { data: sessionData } = await window.motfSupabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) throw new Error("로그인 후 결제할 수 있습니다.");
    const tossPayments = window.TossPayments(TOSS_CLIENT_KEY);
    tossWidgets = tossPayments.widgets({ customerKey: `motf_${userId.replaceAll("-", "")}` });
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
    const mobilePhone = normalizePhone(payment.customerPhone);
    await tossWidgets.requestPayment({
      orderId: payment.orderId,
      orderName: payment.itemName,
      successUrl: `${baseUrl}?tossResult=success`,
      failUrl: `${baseUrl}?tossResult=fail`,
      customerName: payment.customerName,
      ...(mobilePhone ? { customerMobilePhone: mobilePhone } : {}),
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

async function confirmPaymentOnServer(payment, params) {
  for (let i = 0; i < 20 && !window.motfSupabase; i += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  if (!window.motfSupabase) throw new Error("로그인 설정을 불러오지 못했습니다.");
  const { data: sessionData } = await window.motfSupabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("로그인이 만료되었습니다. 다시 로그인해주세요.");
  const payload = {
    paymentKey: params.get("paymentKey"),
    orderId: params.get("orderId") || payment.orderId,
    amount: Number(params.get("amount") || payment.amount),
  };
  const response = await fetch("/api/confirm-payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "서버 결제 승인에 실패했습니다.");
  }
  return data;
}

async function handleTossRedirect() {
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
    navigate("paymentResult", { replace: true });
    replaceBrowserRoute("paymentResult");
    return true;
  }

  state.pendingPayment = storedPayment;
  routeParents.paymentResult = storedPayment.type === "stay" ? "stays" : "market";

  if (tossResult === "success") {
    state.paymentResult = {
      status: "confirming",
      type: storedPayment.type,
      eyebrow: "토스 결제창 인증 완료",
      title: "서버에서 결제를 확인하는 중입니다",
      text: "토스에 결제 금액과 주문번호가 맞는지 확인하고, 맞으면 Supabase 장부에 저장합니다.",
      icon: "shield-check",
      className: "",
      orderId: params.get("orderId") || storedPayment.orderId,
      itemName: storedPayment.itemName,
      amount: Number(params.get("amount") || storedPayment.amount),
      paymentKey: params.get("paymentKey") || "토스에서 발급",
      backRoute: paymentBackRoute(),
    };
    navigate("paymentResult", { replace: true });
    replaceBrowserRoute("paymentResult");
    try {
      await confirmPaymentOnServer(storedPayment, params);
      await window.motfReloadTransactions?.();
      setPaymentResult("success");
    } catch (error) {
      state.paymentResult = {
        status: "fail",
        type: storedPayment.type,
        eyebrow: "서버 승인 실패",
        title: "결제 확인을 완료하지 못했습니다",
        text: error.message || "Vercel 환경변수나 Supabase 설정을 확인해주세요.",
        icon: "x",
        className: "fail",
        orderId: params.get("orderId") || storedPayment.orderId,
        itemName: storedPayment.itemName,
        amount: Number(params.get("amount") || storedPayment.amount),
        paymentKey: params.get("paymentKey") || "토스에서 발급",
        backRoute: paymentBackRoute(),
      };
      navigate("paymentResult", { replace: true });
    }
    return true;
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

  navigate("paymentResult", { replace: true });
  replaceBrowserRoute("paymentResult");
  return true;
}

function setPaymentResult(status) {
  const payment = state.pendingPayment;
  if (!payment) {
    toast("결제할 내역이 없습니다.");
    return;
  }

  const resultText = {
    success: {
      eyebrow: "토스페이먼츠 승인 완료",
      title: payment.type === "stay" ? "결제 완료, 숙소 예약 요청이 접수되었습니다" : "결제 완료, 공판장 주문 요청이 접수되었습니다",
      text: payment.type === "stay"
        ? "사장님이 예약 가능 여부를 확인한 뒤 확정합니다. 거절 시 결제 취소·환불 처리가 필요합니다."
        : "사장님이 주문 가능 여부를 확인한 뒤 확정합니다. 거절 시 결제 취소·환불 처리가 필요합니다.",
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
    result.virtualAccount?.bank ? `<div class="result-detail-row"><span>은행</span><strong>${result.virtualAccount.bank}</strong></div>` : "",
    result.virtualAccount?.number ? `<div class="result-detail-row"><span>입금 계좌</span><strong>${result.virtualAccount.number}</strong></div>` : "",
    result.virtualAccount?.holder ? `<div class="result-detail-row"><span>예금주</span><strong>${result.virtualAccount.holder}</strong></div>` : "",
    result.virtualAccount?.due ? `<div class="result-detail-row"><span>입금 기한</span><strong>${result.virtualAccount.due}</strong></div>` : "",
    result.errorCode ? `<div class="result-detail-row"><span>오류 코드</span><strong>${result.errorCode}</strong></div>` : "",
  ].join("");
  qs("#paymentResultDetails").innerHTML = `
    <div class="result-detail-row"><span>주문번호</span><strong>${result.orderId}</strong></div>
    <div class="result-detail-row"><span>상품명</span><strong>${result.itemName}</strong></div>
    <div class="result-detail-row"><span>금액</span><strong>${money(result.amount)}</strong></div>
    ${extraRows}
  `;
  let primaryAction = "";
  if (result.status === "confirming") {
    primaryAction = `<button class="primary-btn" type="button" disabled><i data-lucide="loader-circle"></i>서버 확인 중</button>`;
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
  const alcohol = Math.ceil(people * (style === "light" ? 1.1 : style === "heavy" ? 2.1 : 1.6));
  const water = Math.ceil(people * 0.6);
  const snacks = Math.ceil(people * (style === "heavy" ? 0.35 : 0.25));
  qs("#recommendResult").innerHTML = `
    <div class="recommend-total">
      <strong>${people}명 기준 추천</strong>
      <span>${style === "heavy" ? "든든한" : style === "light" ? "간단한" : "기본"} MT 장보기 기준</span>
    </div>
    <div class="recommend-row"><span>고기</span><strong>약 ${pork}kg</strong></div>
    <div class="recommend-row"><span>술/음료</span><strong>약 ${alcohol}병 또는 캔</strong></div>
    <div class="recommend-row"><span>생수</span><strong>2L ${water}병</strong></div>
    <div class="recommend-row"><span>안주</span><strong>약 ${snacks}kg · ${Math.ceil(people / 6)}세트</strong></div>
  `;
  qs("#activityList").innerHTML = activities
    .slice(0, 3)
    .map(
      (activity) => `
      <button class="mini-card interactive-card" type="button" data-activity-id="${activity.id}">
        <h3>${escapeHtml(activity.title)}</h3>
        <p>${activity.people} · ${activity.time}</p>
        <div class="activity-preview-details">
          <span class="activity-preview-line"><i data-lucide="sparkles"></i>${escapeHtml(activity.note)}</span>
          <span class="activity-preview-line"><i data-lucide="paperclip"></i>${activity.media}</span>
        </div>
        <span class="reaction-line"><i data-lucide="heart"></i>${activity.likes} <i data-lucide="message-circle"></i>${activity.comments.length}</span>
      </button>
    `
    )
    .join("");
  qs("#communityBoards").innerHTML = communityBoards
    .map(
      (board) => `
      <button class="board-card" type="button" data-board-id="${board.id}">
        <div>
          <h3>${board.title}</h3>
          <p>${board.description}</p>
        </div>
        <ul>
          ${board.posts
            .slice(0, 3)
            .map((post) => `<li>${escapeHtml(post.title)}<span>공감 ${post.likes} · 댓글 ${post.comments.length}</span></li>`)
            .join("")}
        </ul>
      </button>
    `
    )
    .join("");
  refreshIcons();
}

function activityMatchesFilters(activity) {
  const people = qs("#activityPeople")?.value || "전체";
  const space = qs("#activitySpace")?.value || "전체";
  const mood = qs("#activityMood")?.value || "전체";
  return (
    (people === "전체" || activity.peopleGroup === people) &&
    (space === "전체" || activity.space === space || activity.space === "any") &&
    (mood === "전체" || activity.mood === mood)
  );
}

function renderRecreation() {
  const matches = activities.filter(activityMatchesFilters);
  qs("#activityDirectory").innerHTML = matches.length
    ? matches
        .map(
          (activity) => `
        <article class="activity-card">
          <div class="activity-card-head">
            <div>
              <h3>${escapeHtml(activity.title)}</h3>
              <p class="activity-note">${escapeHtml(activity.note)}</p>
            </div>
            <span class="pill">${activity.time}</span>
          </div>
          <div class="detail-meta">
            <span class="pill">${activity.people}</span>
            <span class="pill">${activity.space === "indoor" ? "실내" : activity.space === "outdoor" ? "야외" : "공간 무관"}</span>
            <span class="pill">${activity.mood === "icebreak" ? "아이스브레이킹" : activity.mood === "team" ? "팀 대항" : "잔잔한 진행"}</span>
          </div>
          <div class="card-reactions">
            <span><i data-lucide="heart"></i>${activity.likes}</span>
            <span><i data-lucide="message-circle"></i>${activity.comments.length}</span>
          </div>
          <button class="ghost-btn" type="button" data-activity-id="${activity.id}"><i data-lucide="arrow-right"></i>자세히 보기</button>
        </article>
      `
        )
        .join("")
    : `<div class="empty-state">조건에 맞는 레크레이션이 없습니다.</div>`;
  refreshIcons();
}

function activeBoard() {
  return communityBoards.find((board) => board.id === state.activeBoardId) || communityBoards[0];
}

function activeActivity() {
  return activities.find((activity) => activity.id === state.activeActivityId) || activities[0];
}

function activePost() {
  const board = activeBoard();
  return board.posts.find((post) => post.id === state.activePostId) || board.posts[0];
}

function renderBoardDetail() {
  const board = activeBoard();
  qs("#boardDetailHeader").innerHTML = `
    <div>
      <p class="eyebrow">MT 익명 게시판</p>
      <h1>${board.title}</h1>
      <p>${board.description}</p>
    </div>
  `;
  qs("#boardPostList").innerHTML = board.posts
    .map(
      (post) => `
      <button class="anonymous-post interactive-card" type="button" data-post-id="${post.id}">
        <div class="post-topline">
          <strong>익명</strong>
          <span>방금 전</span>
        </div>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.body)}</p>
        <div class="post-actions">
          ${post.media ? `<span class="pill"><i data-lucide="image"></i>${post.media}</span>` : ""}
          <span class="reaction-line"><i data-lucide="heart"></i>${post.likes} <i data-lucide="message-square"></i>${post.comments.length}</span>
        </div>
      </button>
    `
    )
    .join("");
  qs("#boardPostBoard").value = board.id;
  qs("#boardPostTitle").value = "";
  qs("#boardPostBody").value = "";
  refreshIcons();
}

function renderActivityDetail() {
  const activity = activeActivity();
  qs("#activityDetailContent").innerHTML = `
    <img class="post-detail-media" src="${activity.image}" alt="${escapeHtml(activity.title)}" />
    <div class="post-detail-body">
      <p class="eyebrow">추천 레크레이션</p>
      <h1>${escapeHtml(activity.title)}</h1>
      <p class="activity-detail-description">${escapeHtml(activity.detail)}</p>
      <div class="detail-meta activity-detail-meta">
        <span class="pill">${activity.people}</span>
        <span class="pill">${activity.time}</span>
        <span class="pill">${activity.space === "indoor" ? "실내" : activity.space === "outdoor" ? "야외" : "공간 무관"}</span>
      </div>
      <div class="media-chip activity-media-chip"><i data-lucide="image-plus"></i>${activity.media}</div>
      <div class="post-actions">
        <button class="secondary-btn" type="button" data-like-activity><i data-lucide="heart"></i>공감 ${activity.likes}</button>
        <button class="ghost-btn" type="button" data-focus-activity-comment><i data-lucide="message-square"></i>댓글 ${activity.comments.length}</button>
      </div>
    </div>
  `;
  qs("#activityCommentList").innerHTML = activity.comments.map((comment) => `<div class="comment-item"><strong>익명</strong><span>${escapeHtml(comment)}</span></div>`).join("");
  refreshIcons();
}

function renderPostDetail() {
  const board = activeBoard();
  const post = activePost();
  qs("#postDetailContent").innerHTML = `
    <div class="post-detail-body">
      <p class="eyebrow">${board.title}</p>
      <h1>${escapeHtml(post.title)}</h1>
      <p>${escapeHtml(post.body)}</p>
      ${post.media ? `<div class="post-media-placeholder"><i data-lucide="image"></i>${post.media} 첨부 영역</div>` : ""}
      <div class="post-actions">
        <button class="secondary-btn" type="button" data-like-post><i data-lucide="heart"></i>공감 ${post.likes}</button>
        <button class="ghost-btn" type="button" data-focus-post-comment><i data-lucide="message-square"></i>댓글 ${post.comments.length}</button>
      </div>
    </div>
  `;
  qs("#postCommentList").innerHTML = post.comments.map((comment) => `<div class="comment-item"><strong>익명</strong><span>${escapeHtml(comment)}</span></div>`).join("");
  refreshIcons();
}

function renderChat() {
  if (!state.chats.length) {
    qs("#chatList").innerHTML = `<div class="empty-state">아직 시작한 대화가 없습니다.</div>`;
    qs("#chatRoomHeader").innerHTML = `<h2>채팅</h2><p class="muted">숙소 또는 공판장에서 문의를 시작해보세요.</p>`;
    qs("#chatMessages").innerHTML = `<div class="empty-state">대화를 선택하면 메시지가 표시됩니다.</div>`;
    refreshIcons();
    return;
  }
  qs("#chatList").innerHTML = state.chats
    .map(
      (thread) => `
      <button class="chat-thread ${thread.id === state.activeChatId ? "active" : ""}" data-chat-id="${thread.id}">
        <strong>${escapeHtml(thread.title)}</strong>
        <span>${escapeHtml(thread.subtitle)}</span>
      </button>
    `
    )
    .join("");
  const thread = state.chats.find((item) => item.id === state.activeChatId) || state.chats[0];
  qs("#chatRoomHeader").innerHTML = `
    <h2>${escapeHtml(thread.title)}</h2>
    <p class="muted">${escapeHtml(thread.subtitle)}</p>
  `;
  qs("#chatMessages").innerHTML = thread.messages
    .map(
      (message) => `
      <div class="message-row ${message.from}">
        <div class="bubble ${message.from}">
          ${message.text ? `<span>${escapeHtml(message.text)}</span>` : ""}
          ${message.attachments?.length ? `<div class="attachment-list">${message.attachments.map((name) => `<span class="attachment-chip"><i data-lucide="paperclip"></i>${escapeHtml(name)}</span>`).join("")}</div>` : ""}
        </div>
        <span class="read-status">${message.read ? "읽음" : "안읽음"}</span>
      </div>
    `
    )
    .join("");
  refreshIcons();
}

window.motfApplyChats = function applyChats(chats, activeChatId) {
  state.chats = Array.isArray(chats) ? chats : [];
  state.activeChatId = activeChatId || state.activeChatId || state.chats[0]?.id || "";
  if (!state.chats.some((item) => item.id === state.activeChatId)) state.activeChatId = state.chats[0]?.id || "";
  if (currentRoute() === "chat") renderChat();
};

window.motfGetActiveChatId = () => state.activeChatId;
window.motfFindBusinessByName = (name) => [...stays, ...stores].find((item) => item.name === escapeHtml(name)) || null;
window.motfNavigate = navigate;

function renderMypage() {
  const reservationList = qs("#reservationList");
  const orderList = qs("#orderList");
  if (!reservationList || !orderList) {
    refreshIcons();
    return;
  }
  reservationList.innerHTML = state.reservations.length
    ? state.reservations.map(reservationCard).join("")
    : `<div class="empty-state">아직 예약한 숙소가 없습니다.</div>`;
  orderList.innerHTML = state.orders.length
    ? state.orders.map(orderCard).join("")
    : `<div class="empty-state">아직 공판장 주문이 없습니다.</div>`;
  refreshIcons();
}

async function renderTossWidgets(payment) {
  const paymentMethods = qs("#tossPaymentMethods");
  const agreement = qs("#tossAgreement");
  if (!paymentMethods || !agreement || !payment) return;
  paymentMethods.innerHTML = `<div class="empty-state">KG이니시스 가상계좌만 사용할 수 있습니다.</div>`;
  agreement.innerHTML = `<div class="summary-line"><span>입금 후 처리</span><strong>입금 완료 후 예약·주문 요청이 접수됩니다</strong></div>`;
  setTossWidgetStatus("가상계좌 발급 버튼을 누르면 포트원 결제창이 열립니다.");
}

async function confirmPaymentOnServer(payment, params = new URLSearchParams()) {
  for (let i = 0; i < 20 && !window.motfSupabase; i += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  if (!window.motfSupabase) throw new Error("Login config was not loaded.");
  const { data: sessionData } = await window.motfSupabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Login expired. Please sign in again.");
  const response = await fetch("/api/confirm-payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      paymentId: params.get("paymentId") || params.get("orderId") || payment.orderId,
      portoneResponse: payment.portoneResponse || null,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Payment confirmation failed.");
  }
  return data;
}

async function requestTossPayment() {
  const payment = state.pendingPayment;
  if (!payment) {
    toast("결제할 내역이 없습니다.");
    return;
  }
  savePendingPayment(payment);
  try {
    if (!PORTONE_STORE_ID || !PORTONE_CHANNEL_KEY) {
      throw new Error("PortOne Store ID 또는 Channel Key가 설정되지 않았습니다.");
    }
    await loadPortOneSdk();
    const mobilePhone = normalizePhone(payment.customerPhone);
    const response = await window.PortOne.requestPayment({
      storeId: PORTONE_STORE_ID,
      channelKey: PORTONE_CHANNEL_KEY,
      paymentId: payment.orderId,
      orderName: payment.itemName,
      totalAmount: payment.amount,
      currency: "CURRENCY_KRW",
      payMethod: "VIRTUAL_ACCOUNT",
      customer: {
        fullName: payment.customerName || "moTF user",
        ...(mobilePhone ? { phoneNumber: mobilePhone } : {}),
      },
    });
    if (response?.code) throw new Error(response.message || "PortOne payment window failed.");
    payment.portoneResponse = {
      ...response,
      id: response.id || response.paymentId || payment.orderId,
      paymentId: response.paymentId || response.id || payment.orderId,
      status: response.status || response.paymentStatus || "VIRTUAL_ACCOUNT_ISSUED",
      amount: response.amount || { total: payment.amount },
    };
    savePendingPayment(payment);
    const result = await confirmPaymentOnServer(payment, new URLSearchParams({ paymentId: payment.orderId }));
    if (result.status === "paid") {
      await window.motfReloadTransactions?.();
      setPaymentResult("success");
      return;
    }
    const account = formatVirtualAccount(result.virtualAccount || {});
    state.paymentResult = {
      status: "virtual_account_issued",
      type: payment.type,
      eyebrow: "가상계좌 발급 완료",
      title: "입금이 확인되면 예약·주문 요청이 접수됩니다",
      text: "아직 실제 결제 완료가 아닙니다. 발급된 가상계좌로 입금하면 포트원 웹훅을 통해 자동으로 예약·주문이 생성됩니다.",
      icon: "landmark",
      className: "",
      orderId: payment.orderId,
      itemName: payment.itemName,
      amount: payment.amount,
      virtualAccount: account,
      paymentKey: account.label || payment.orderId,
      backRoute: paymentBackRoute(),
    };
    await window.motfReloadTransactions?.();
    navigate("paymentResult");
  } catch (error) {
    state.paymentResult = {
      status: "fail",
      type: payment.type,
      eyebrow: "가상계좌 발급 실패",
      title: "포트원 결제창을 완료하지 못했습니다",
      text: error.message || "브라우저 또는 결제 설정을 확인한 뒤 다시 시도해주세요.",
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

async function handleTossRedirect() {
  return false;
}

function reservationCard(item) {
  const account = item.virtualAccount || {};
  const accountInfo = account.accountNumber
    ? `<p class="muted">입금계좌: ${[account.bank, account.accountNumber, account.holder].filter(Boolean).join(" / ")}${account.due ? ` · 기한 ${account.due}` : ""}</p>`
    : "";
  return `
    <article class="listing-card">
      <div class="listing-body">
        <div class="listing-meta">
          <span class="pill success">${item.status}</span>
          <span class="pill">${item.date}</span>
          <span class="pill">${item.people}명</span>
        </div>
        <h3>${item.stayName}</h3>
        ${accountInfo}
        <p>${item.roomName} · ${money(item.amount)}</p>
        ${item.refundAmount ? `<p class="muted">환불 예정 금액 ${money(item.refundAmount)}</p>` : ""}
        <div class="button-row">
          <button class="secondary-btn" data-budget-file="${item.id}"><i data-lucide="file-spreadsheet"></i>예결산 엑셀 생성</button>
          <button class="ghost-btn" data-route="review"><i data-lucide="star"></i>리뷰</button>
        </div>
      </div>
    </article>
  `;
}

function orderCard(item) {
  const account = item.virtualAccount || {};
  const accountInfo = account.accountNumber
    ? `<p class="muted">입금계좌: ${[account.bank, account.accountNumber, account.holder].filter(Boolean).join(" / ")}${account.due ? ` · 기한 ${account.due}` : ""}</p>`
    : "";
  return `
    <article class="listing-card">
      <div class="listing-body">
        <div class="listing-meta">
          <span class="pill success">${item.status}</span>
          <span class="pill">${item.pickupTime}</span>
        </div>
        <h3>${item.storeName}</h3>
        ${accountInfo}
        <p>${item.items.length}개 품목 · ${money(item.amount)}</p>
        ${item.refundAmount ? `<p class="muted">환불 예정 금액 ${money(item.refundAmount)}</p>` : ""}
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
  qs("#ratingRow").innerHTML = [1, 2, 3, 4, 5]
    .map((score) => `<button type="button" class="star-btn ${score <= state.rating ? "active" : ""}" data-rating="${score}">★</button>`)
    .join("");
  refreshIcons();
}

function reviewCard(review) {
  return `
    <article class="review-card">
      <div class="listing-meta">
        <span class="pill">${escapeHtml(review.target)}</span>
        <span class="review-score">${"★".repeat(review.score)}${"☆".repeat(5 - review.score)}</span>
      </div>
      <p>${escapeHtml(review.text)}</p>
      <div class="detail-meta">${review.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}</div>
      <strong>${escapeHtml(review.author)}</strong>
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
  if (window.motfOpenDatabaseChat?.(title)) return;
  let thread = state.chats.find((item) => item.title === title);
  if (!thread) {
    thread = {
      id: `chat-${Date.now()}`,
      title,
      subtitle: "새 문의",
      messages: [{ from: "admin", text: "moTF가 대화와 예약 정보를 함께 확인합니다.", read: true }],
    };
    state.chats.unshift(thread);
  }
  state.activeChatId = thread.id;
  navigate("chat");
}

document.addEventListener("click", (event) => {
  const historyBackButton = event.target.closest("[data-history-back]");
  if (historyBackButton) {
    goBack(historyBackButton.dataset.fallbackRoute || "home");
    return;
  }

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
    navigate("roomDetail");
    return;
  }

  const stayFilterToggle = event.target.closest("[data-toggle-stay-filters]");
  if (stayFilterToggle) {
    const panel = qs("#stayAdvancedFilters");
    if (panel) panel.hidden = !panel.hidden;
    return;
  }

  const stayFilterReset = event.target.closest("[data-reset-stay-filters]");
  if (stayFilterReset) {
    qsa("[data-stay-filter]").forEach((input) => {
      input.checked = false;
    });
    qs("#stayMinRooms").value = 0;
    qs("#stayMinBaths").value = 0;
    renderStays();
    return;
  }

  if (event.target.closest("[data-stay-filter], .check-card")) {
    window.setTimeout(renderStays, 0);
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
    state.activeCategory = "전체";
    navigate("storeDetail");
    return;
  }

  const categoryButton = event.target.closest("[data-category]");
  if (categoryButton) {
    state.activeCategory = categoryButton.dataset.category;
    currentRoute() === "market" ? renderStores() : renderStoreDetail();
    return;
  }

  const communityWriteButton = event.target.closest("[data-community-write]");
  if (communityWriteButton) {
    state.activeBoardId = communityBoards[0].id;
    navigate("boardDetail");
    return;
  }

  const boardButton = event.target.closest("[data-board-id]");
  if (boardButton) {
    state.activeBoardId = boardButton.dataset.boardId;
    state.activePostId = activeBoard().posts[0]?.id || "";
    navigate("boardDetail");
    return;
  }

  const activityButton = event.target.closest("[data-activity-id]");
  if (activityButton) {
    state.activeActivityId = activityButton.dataset.activityId;
    navigate("activityDetail");
    return;
  }

  const postButton = event.target.closest("[data-post-id]");
  if (postButton) {
    state.activePostId = postButton.dataset.postId;
    navigate("postDetail");
    return;
  }

  if (event.target.closest("[data-like-activity]")) {
    activeActivity().likes += 1;
    renderActivityDetail();
    return;
  }

  if (event.target.closest("[data-like-post]")) {
    activePost().likes += 1;
    renderPostDetail();
    return;
  }

  if (event.target.closest("[data-focus-activity-comment]")) {
    qs("#activityCommentInput")?.focus();
    return;
  }

  if (event.target.closest("[data-focus-post-comment]")) {
    qs("#postCommentInput")?.focus();
    return;
  }

  if (event.target.closest("[data-open-recreation-form]")) {
    qs("#activitySubmitTitle")?.focus();
    qs("#activitySubmitForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  if (event.target.matches("#stayPrice, #stayRegion, #stayPeople, #stayDate, #stayMinRooms, #stayMinBaths")) renderStays();
  if (event.target.matches("#marketPeople")) renderStores();
  if (event.target.matches("#recommendPeople, #mealStyle")) renderCommunity();
  if (event.target.matches("#activityPeople, #activitySpace, #activityMood")) renderRecreation();
  if (event.target.matches("[data-cart-input]")) {
    const item = state.cart.find((row) => row.productId === event.target.dataset.cartInput);
    if (item) {
      item.qty = Math.max(1, Number(event.target.value || 1));
      renderCart();
    }
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("#stayRegion, #stayDate, [data-stay-filter], #stayMinRooms, #stayMinBaths")) renderStays();
  if (event.target.matches("#marketPeople")) renderStores();
  if (event.target.matches("#mealStyle")) renderCommunity();
  if (event.target.matches("#activityPeople, #activitySpace, #activityMood")) renderRecreation();
});

qs("#bookingForm").addEventListener("submit", (event) => {
  event.preventDefault();
  toast("결제 준비 모듈을 불러오지 못했습니다. 페이지를 새로고침해주세요.");
});

qs("#orderForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.cart.length) {
    toast("장바구니가 비어 있습니다.");
    return;
  }
  toast("결제 준비 모듈을 불러오지 못했습니다. 페이지를 새로고침해주세요.");
});

qs("#chatForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = qs("#chatText");
  const attachmentInput = qs("#chatAttachment");
  const text = input.value.trim();
  const attachments = attachmentInput?.files ? [...attachmentInput.files].map((file) => file.name) : [];
  if (!text && !attachments.length) return;
  const thread = state.chats.find((item) => item.id === state.activeChatId);
  thread.messages.push({ from: "user", text, attachments, read: false });
  input.value = "";
  if (attachmentInput) attachmentInput.value = "";
  renderChat();
  const messages = qs("#chatMessages");
  messages.scrollTop = messages.scrollHeight;
});

qs("#activitySubmitForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const title = qs("#activitySubmitTitle").value.trim();
  if (!title) {
    toast("레크레이션 제목을 입력해주세요.");
    return;
  }
  const spaceText = qs("#activitySubmitSpace").value;
  activities.unshift({
    id: `activity-${Date.now()}`,
    title,
    people: qs("#activitySubmitPeople").value.trim() || "인원 자유",
    peopleGroup: "medium",
    space: spaceText === "야외" ? "outdoor" : spaceText === "공간 무관" ? "any" : "indoor",
    mood: "icebreak",
    time: "추천 등록",
    note: qs("#activitySubmitNote").value.trim() || "이용자 추천 레크레이션",
    media: "이용자 첨부 가능",
    image: photo("photo-1529156069898-49953e39b3ac"),
    likes: 0,
    comments: [],
    detail: qs("#activitySubmitNote").value.trim() || "이용자가 새로 추천한 레크레이션입니다.",
  });
  event.target.reset();
  renderRecreation();
  toast("익명 레크레이션 추천이 등록되었습니다.");
});

qs("#boardWriteForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const selectedBoardId = qs("#boardPostBoard").value;
  const board = communityBoards.find((item) => item.id === selectedBoardId) || activeBoard();
  state.activeBoardId = board.id;
  const title = qs("#boardPostTitle").value.trim();
  const body = qs("#boardPostBody").value.trim();
  if (!title || !body) return;
  const post = {
    id: `post-${Date.now()}`,
    title,
    body,
    likes: 0,
    comments: [],
    media: "첨부 가능",
  };
  board.posts.unshift(post);
  state.activePostId = post.id;
  renderBoardDetail();
  toast("익명 게시글이 등록되었습니다.");
});

qs("#activityCommentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = qs("#activityCommentInput");
  const text = input.value.trim();
  if (!text) return;
  activeActivity().comments.push(text);
  input.value = "";
  renderActivityDetail();
});

qs("#postCommentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = qs("#postCommentInput");
  const text = input.value.trim();
  if (!text) return;
  activePost().comments.push(text);
  input.value = "";
  renderPostDetail();
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
    if (event.key === "Enter" || event.key === " ") navigate("home");
  });
});

window.addEventListener("popstate", () => {
  if (appHistoryDepth > 0) appHistoryDepth -= 1;
  routeHistory.pop();
  navigate(routeFromLocation(), { record: false, updateHistory: false });
});

(async function boot() {
  await loadPaymentConfig();
  const handledRedirect = await handleTossRedirect();
  if (!handledRedirect) {
    navigate(routeFromLocation(), { record: false, replace: true });
  }
  updateCartBadge();
  refreshIcons();
})();
