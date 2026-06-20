alter table profiles enable row level security;
alter table partner_profiles enable row level security;
alter table stays enable row level security;
alter table rooms enable row level security;
alter table markets enable row level security;
alter table products enable row level security;
alter table reservations enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table boards enable row level security;
alter table posts enable row level security;
alter table recreation_posts enable row level security;
alter table comments enable row level security;
alter table likes enable row level security;
alter table chat_rooms enable row level security;
alter table messages enable row level security;
alter table reviews enable row level security;
alter table attachments enable row level security;
alter table disputes enable row level security;
alter table settlement_files enable row level security;

create or replace function public.current_user_role()
returns user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.is_partner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'partner', false)
$$;

create or replace function public.my_partner_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from partner_profiles where user_id = auth.uid() limit 1
$$;

create policy "profiles_select_self_or_admin"
on profiles for select
using (id = auth.uid() or public.is_admin());

create policy "profiles_insert_self"
on profiles for insert
with check (id = auth.uid() and role = 'user');

create policy "profiles_update_self_or_admin"
on profiles for update
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "partner_profiles_select_owner_or_admin"
on partner_profiles for select
using (user_id = auth.uid() or public.is_admin());

create policy "partner_profiles_update_owner_or_admin"
on partner_profiles for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "partner_profiles_insert_admin"
on partner_profiles for insert
with check (public.is_admin());

create policy "stays_select_public_or_owner_or_admin"
on stays for select
using (
  status = 'active'
  or partner_id = public.my_partner_id()
  or public.is_admin()
);

create policy "stays_write_owner_or_admin"
on stays for all
using (partner_id = public.my_partner_id() or public.is_admin())
with check (partner_id = public.my_partner_id() or public.is_admin());

create policy "rooms_select_public_or_owner_or_admin"
on rooms for select
using (
  status = 'active'
  or exists (
    select 1 from stays
    where stays.id = rooms.stay_id
      and (stays.partner_id = public.my_partner_id() or public.is_admin())
  )
);

create policy "rooms_write_owner_or_admin"
on rooms for all
using (
  exists (
    select 1 from stays
    where stays.id = rooms.stay_id
      and (stays.partner_id = public.my_partner_id() or public.is_admin())
  )
)
with check (
  exists (
    select 1 from stays
    where stays.id = rooms.stay_id
      and (stays.partner_id = public.my_partner_id() or public.is_admin())
  )
);

create policy "markets_select_public_or_owner_or_admin"
on markets for select
using (
  status = 'active'
  or partner_id = public.my_partner_id()
  or public.is_admin()
);

create policy "markets_write_owner_or_admin"
on markets for all
using (partner_id = public.my_partner_id() or public.is_admin())
with check (partner_id = public.my_partner_id() or public.is_admin());

create policy "products_select_public_or_owner_or_admin"
on products for select
using (
  status = 'active'
  or exists (
    select 1 from markets
    where markets.id = products.market_id
      and (markets.partner_id = public.my_partner_id() or public.is_admin())
  )
);

create policy "products_write_owner_or_admin"
on products for all
using (
  exists (
    select 1 from markets
    where markets.id = products.market_id
      and (markets.partner_id = public.my_partner_id() or public.is_admin())
  )
)
with check (
  exists (
    select 1 from markets
    where markets.id = products.market_id
      and (markets.partner_id = public.my_partner_id() or public.is_admin())
  )
);

create policy "reservations_select_user_partner_admin"
on reservations for select
using (
  user_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from stays
    where stays.id = reservations.stay_id
      and stays.partner_id = public.my_partner_id()
  )
);

create policy "reservations_insert_user"
on reservations for insert
with check (user_id = auth.uid() or public.is_admin());

create policy "reservations_update_partner_or_admin"
on reservations for update
using (
  public.is_admin()
  or exists (
    select 1 from stays
    where stays.id = reservations.stay_id
      and stays.partner_id = public.my_partner_id()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from stays
    where stays.id = reservations.stay_id
      and stays.partner_id = public.my_partner_id()
  )
);

create policy "orders_select_user_partner_admin"
on orders for select
using (
  user_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from markets
    where markets.id = orders.market_id
      and markets.partner_id = public.my_partner_id()
  )
);

create policy "orders_insert_user"
on orders for insert
with check (user_id = auth.uid() or public.is_admin());

create policy "orders_update_partner_or_admin"
on orders for update
using (
  public.is_admin()
  or exists (
    select 1 from markets
    where markets.id = orders.market_id
      and markets.partner_id = public.my_partner_id()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from markets
    where markets.id = orders.market_id
      and markets.partner_id = public.my_partner_id()
  )
);

create policy "order_items_select_via_order"
on order_items for select
using (
  exists (
    select 1 from orders
    where orders.id = order_items.order_id
      and (
        orders.user_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1 from markets
          where markets.id = orders.market_id
            and markets.partner_id = public.my_partner_id()
        )
      )
  )
);

create policy "order_items_insert_via_own_order"
on order_items for insert
with check (
  exists (
    select 1 from orders
    where orders.id = order_items.order_id
      and (orders.user_id = auth.uid() or public.is_admin())
  )
);

create policy "payments_select_admin_only"
on payments for select
using (public.is_admin());

create policy "boards_select_active"
on boards for select
using (status = 'active' or public.is_admin());

create policy "boards_write_admin"
on boards for all
using (public.is_admin())
with check (public.is_admin());

create policy "posts_select_active_or_author_or_admin"
on posts for select
using (status = 'active' or author_id = auth.uid() or public.is_admin());

create policy "posts_insert_signed_in"
on posts for insert
with check (auth.uid() is not null and is_anonymous = true);

create policy "posts_update_author_or_admin"
on posts for update
using (author_id = auth.uid() or public.is_admin())
with check (author_id = auth.uid() or public.is_admin());

create policy "recreation_posts_select_active_or_author_or_admin"
on recreation_posts for select
using (status = 'active' or author_id = auth.uid() or public.is_admin());

create policy "recreation_posts_insert_signed_in"
on recreation_posts for insert
with check (auth.uid() is not null);

create policy "recreation_posts_update_author_or_admin"
on recreation_posts for update
using (author_id = auth.uid() or public.is_admin())
with check (author_id = auth.uid() or public.is_admin());

create policy "comments_select_active_or_author_or_admin"
on comments for select
using (status = 'active' or author_id = auth.uid() or public.is_admin());

create policy "comments_insert_signed_in"
on comments for insert
with check (auth.uid() is not null and is_anonymous = true);

create policy "comments_update_author_or_admin"
on comments for update
using (author_id = auth.uid() or public.is_admin())
with check (author_id = auth.uid() or public.is_admin());

create policy "likes_select_signed_in"
on likes for select
using (auth.uid() is not null);

create policy "likes_insert_self"
on likes for insert
with check (user_id = auth.uid());

create policy "likes_delete_self"
on likes for delete
using (user_id = auth.uid());

create policy "chat_rooms_select_participant_or_admin"
on chat_rooms for select
using (
  user_id = auth.uid()
  or admin_id = auth.uid()
  or partner_id = public.my_partner_id()
  or public.is_admin()
);

create policy "chat_rooms_insert_signed_in"
on chat_rooms for insert
with check (auth.uid() is not null);

create policy "messages_select_via_chat_room"
on messages for select
using (
  exists (
    select 1 from chat_rooms
    where chat_rooms.id = messages.chat_room_id
      and (
        chat_rooms.user_id = auth.uid()
        or chat_rooms.admin_id = auth.uid()
        or chat_rooms.partner_id = public.my_partner_id()
        or public.is_admin()
      )
  )
);

create policy "messages_insert_via_chat_room"
on messages for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from chat_rooms
    where chat_rooms.id = messages.chat_room_id
      and (
        chat_rooms.user_id = auth.uid()
        or chat_rooms.admin_id = auth.uid()
        or chat_rooms.partner_id = public.my_partner_id()
        or public.is_admin()
      )
  )
);

create policy "reviews_select_active_or_author_or_admin"
on reviews for select
using (status = 'active' or author_id = auth.uid() or public.is_admin());

create policy "reviews_insert_user"
on reviews for insert
with check (author_id = auth.uid());

create policy "reviews_update_author_or_admin"
on reviews for update
using (author_id = auth.uid() or public.is_admin())
with check (author_id = auth.uid() or public.is_admin());

create policy "attachments_select_public_related_or_owner_admin"
on attachments for select
using (uploader_id = auth.uid() or public.is_admin() or auth.uid() is not null);

create policy "attachments_insert_owner"
on attachments for insert
with check (uploader_id = auth.uid());

create policy "disputes_select_reporter_or_admin"
on disputes for select
using (reporter_id = auth.uid() or public.is_admin());

create policy "disputes_insert_reporter"
on disputes for insert
with check (reporter_id = auth.uid());

create policy "disputes_update_admin"
on disputes for update
using (public.is_admin())
with check (public.is_admin());

create policy "settlement_files_select_owner_or_admin"
on settlement_files for select
using (user_id = auth.uid() or public.is_admin());

create policy "settlement_files_insert_owner_or_admin"
on settlement_files for insert
with check (user_id = auth.uid() or public.is_admin());
