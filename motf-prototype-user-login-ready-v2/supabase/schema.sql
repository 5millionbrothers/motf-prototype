create extension if not exists "pgcrypto";

create type user_role as enum ('user', 'partner', 'admin');
create type record_status as enum ('draft', 'pending', 'active', 'hidden', 'archived');
create type payment_status as enum ('pending', 'paid', 'failed', 'cancelled', 'refunded');
create type reservation_status as enum ('pending', 'confirmed', 'cancelled', 'completed');
create type order_status as enum ('pending', 'paid', 'preparing', 'ready', 'completed', 'cancelled');
create type target_type as enum ('stay', 'room', 'market', 'product', 'reservation', 'order', 'post', 'recreation', 'chat', 'review', 'dispute');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'user',
  display_name text not null,
  phone text,
  school text,
  organization text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table partner_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  business_name text not null,
  owner_name text,
  business_number text,
  phone text,
  approval_status record_status not null default 'pending',
  admin_memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table stays (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references partner_profiles(id) on delete set null,
  name text not null,
  region text not null,
  address text,
  intro text,
  base_price integer not null default 0,
  max_people integer not null default 0,
  lat numeric(10, 7),
  lng numeric(10, 7),
  status record_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references stays(id) on delete cascade,
  name text not null,
  capacity_min integer not null default 1,
  capacity_max integer not null default 1,
  price integer not null default 0,
  description text,
  features text[] not null default '{}',
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table markets (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references partner_profiles(id) on delete set null,
  name text not null,
  region text not null,
  address text,
  intro text,
  service_type text,
  lat numeric(10, 7),
  lng numeric(10, 7),
  status record_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  category text not null,
  name text not null,
  unit text,
  price integer not null default 0,
  origin text,
  detail text,
  stock_count integer,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  stay_id uuid references stays(id) on delete set null,
  room_id uuid references rooms(id) on delete set null,
  order_id text unique,
  stay_name_snapshot text,
  room_name_snapshot text,
  reserved_date date,
  people integer not null default 1,
  organization text,
  representative_name text,
  representative_phone text,
  check_in_time time,
  check_out_time time,
  facility text,
  memo text,
  amount integer not null default 0,
  status reservation_status not null default 'pending',
  payment_status payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  market_id uuid references markets(id) on delete set null,
  order_id text unique,
  market_name_snapshot text,
  pickup_place text,
  pickup_time timestamptz,
  memo text,
  amount integer not null default 0,
  status order_status not null default 'pending',
  payment_status payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  unit_price integer not null default 0,
  qty integer not null default 1,
  line_total integer not null default 0,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_code text not null,
  payment_key text,
  payment_type text not null,
  status payment_status not null default 'pending',
  amount integer not null default 0,
  currency text not null default 'KRW',
  order_name text,
  customer_name text,
  customer_phone text,
  toss_response jsonb,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table boards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  status record_status not null default 'active',
  created_at timestamptz not null default now()
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  title text not null,
  body text not null,
  is_anonymous boolean not null default true,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table recreation_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete set null,
  title text not null,
  people_label text,
  people_group text,
  space_type text,
  mood text,
  duration_label text,
  summary text,
  detail text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete set null,
  target_type target_type not null,
  target_id uuid not null,
  body text not null,
  is_anonymous boolean not null default true,
  status record_status not null default 'active',
  created_at timestamptz not null default now()
);

create table likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  target_type target_type not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create table chat_rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  context_type target_type,
  context_id uuid,
  user_id uuid references profiles(id) on delete set null,
  partner_id uuid references partner_profiles(id) on delete set null,
  admin_id uuid references profiles(id) on delete set null,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  chat_room_id uuid not null references chat_rooms(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,
  sender_role user_role,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete set null,
  target_type target_type not null,
  target_id uuid not null,
  rating integer not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  body text not null,
  status record_status not null default 'active',
  created_at timestamptz not null default now()
);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid references profiles(id) on delete set null,
  target_type target_type not null,
  target_id uuid not null,
  file_url text not null,
  file_name text,
  mime_type text,
  created_at timestamptz not null default now()
);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete set null,
  target_type target_type,
  target_id uuid,
  title text not null,
  body text not null,
  status record_status not null default 'pending',
  admin_memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table settlement_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  target_type target_type not null,
  target_id uuid not null,
  template_name text not null,
  file_url text,
  created_at timestamptz not null default now()
);

create index stays_region_idx on stays(region);
create index rooms_stay_id_idx on rooms(stay_id);
create index markets_region_idx on markets(region);
create index products_market_id_idx on products(market_id);
create index reservations_user_id_idx on reservations(user_id);
create index orders_user_id_idx on orders(user_id);
create index posts_board_id_idx on posts(board_id);
create index comments_target_idx on comments(target_type, target_id);
create index likes_target_idx on likes(target_type, target_id);
create index messages_chat_room_id_idx on messages(chat_room_id);
create index attachments_target_idx on attachments(target_type, target_id);

insert into boards (slug, title, description)
values
  ('market-share', '나눔장터', '남는 고기, 술, 일회용품을 같은 지역 MT 팀에게 나눔하거나 양도해요.'),
  ('match', '대결신청', '족구, 피구, 장기자랑, 레크레이션 대결을 같은 지역 MT 팀에게 신청해요.'),
  ('field-info', '현장정보', '픽업, 택시, 편의점, 날씨, 소음 규칙처럼 현장에서 필요한 정보를 공유해요.'),
  ('confession', '익명고백', '같은 날 같은 지역에서 마주친 다른 학교 MT 팀에게 익명으로 마음을 전해요.')
on conflict (slug) do nothing;
