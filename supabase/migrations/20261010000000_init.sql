-- =====================================================================
-- AminZi Tailor — initial schema
-- Paste this whole file into Supabase Dashboard → SQL Editor → Run.
-- Safe to run once on an empty project.
--
-- Security model
--   * Users are created ONLY in Supabase Dashboard → Authentication → Users
--     (turn OFF "Allow new users to sign up"). Every Auth user automatically
--     becomes an Admin of the shop (trigger on auth.users, see the end of file).
--   * Every row belongs to a shop (shop_id).
--   * A Supabase Auth user can read/write a shop's rows only if they are
--     listed in shop_members for that shop (row-level security).
--   * The browser only ever holds the PUBLISHABLE key. Never ship the
--     secret / service_role key in the app.
--   * Stock and money move through ledgers (fabric_movements,
--     perfume_movements, payments). Triggers keep the running totals,
--     and block direct edits of those totals from the client.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table public.shops (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(trim(name)) > 0),
  phone           text,
  calendar        text not null default 'Solar Hijri' check (calendar in ('Solar Hijri','Gregorian')),
  lang            text not null default 'English' check (lang in ('English','Dari','Pashto')),
  flip_rtl        boolean not null default false,   -- mirror layout for Dari/Pashto
  receipt_printer text not null default 'XP-80 (USB)',
  label_printer   text not null default 'Zebra ZD220 (USB)',
  auto_backup     boolean not null default true,
  last_backup     timestamptz,
  order_prefix    text not null default 'AZ' check (order_prefix ~ '^[A-Z]{1,4}$'),
  low_fabric_m    numeric(10,1) not null default 8,
  low_perfume     integer not null default 5,
  garments        jsonb not null default '[
    {"name":"Perahan Tunban","price":2400,"m":4.5},
    {"name":"Waskat","price":2200,"m":1.5},
    {"name":"Over Coat","price":9500,"m":3},
    {"name":"Chapan","price":12000,"m":4}
  ]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.shop_members (
  shop_id    uuid not null references public.shops(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

-- People who work at the counter / in the workshop (PIN sign-in inside the app)
create table public.staff (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  role        text not null check (role in ('Admin','Front desk','Tailor')),
  phone       text,
  active      boolean not null default true,
  piece_rate  numeric(12,2) not null default 0 check (piece_rate >= 0),  -- ؋ per finished piece (tailors)
  pin_hash    text,          -- PBKDF2-SHA256, computed on the device
  pin_salt    text,
  last_seen   timestamptz,
  user_id     uuid unique references auth.users(id) on delete set null,  -- set only for Supabase Auth users (always Admin)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  code        text not null,                      -- C-0118
  name        text not null check (length(trim(name)) > 0),
  phone       text not null,
  since       integer not null default extract(year from now())::int,
  meas        jsonb not null default '{}'::jsonb,  -- {shoulder, chest, ... cuff} in cm
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (shop_id, code)
);

create table public.measurement_history (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  staff_id    uuid references public.staff(id) on delete set null,
  text        text not null,
  meas        jsonb not null default '{}'::jsonb,  -- snapshot after the change
  created_at  timestamptz not null default now()
);

create table public.fabrics (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops(id) on delete cascade,
  code            text not null,                  -- FB-201
  name            text not null check (length(trim(name)) > 0),
  color           text not null default 'White',
  swatch          text not null default '#f4f1ea' check (swatch ~ '^#[0-9a-fA-F]{6}$'),
  metres_left     numeric(10,1) not null default 0,
  metres_of       numeric(10,1) not null default 0 check (metres_of >= 0),
  price_per_metre numeric(12,2) not null default 0 check (price_per_metre >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (shop_id, code)
);

create table public.perfumes (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  code        text not null,                      -- PF-01
  name        text not null check (length(trim(name)) > 0),
  size        text not null default '50 ml',
  price       numeric(12,2) not null check (price >= 0),
  stock       integer not null default 0,
  tint        text not null default '#a98bd6' check (tint ~ '^#[0-9a-fA-F]{6}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (shop_id, code)
);

create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  code          text not null,                    -- AZ-1043
  customer_id   uuid not null references public.customers(id) on delete restrict,
  garment       text not null,
  qty           integer not null default 1 check (qty > 0),
  fabric_id     uuid references public.fabrics(id) on delete set null,
  metres        numeric(10,1) not null default 0 check (metres >= 0),
  tailor_id     uuid references public.staff(id) on delete set null,
  stage         text not null default 'Cutting' check (stage in ('Cutting','Sewing','Ready','Delivered')),
  due           date not null,
  total         numeric(12,2) not null check (total > 0),
  paid          numeric(12,2) not null default 0 check (paid >= 0),
  notes         text,
  ready_at      timestamptz,   -- set when the order reaches Ready (drives tailor wages)
  delivered_at  timestamptz,
  created_by    uuid references public.staff(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (shop_id, code),
  check (paid <= total)
);

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  order_id    uuid not null references public.orders(id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  staff_id    uuid references public.staff(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.fabric_movements (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  fabric_id   uuid not null references public.fabrics(id) on delete cascade,
  delta       numeric(10,1) not null check (delta <> 0),
  reason      text not null check (reason in ('order','sale','restock','adjust')),
  order_id    uuid references public.orders(id) on delete set null,
  staff_id    uuid references public.staff(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.perfume_movements (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  perfume_id  uuid not null references public.perfumes(id) on delete cascade,
  delta       integer not null check (delta <> 0),
  reason      text not null check (reason in ('sale','restock','adjust')),
  unit_price  numeric(12,2),
  staff_id    uuid references public.staff(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index on public.shop_members (user_id);
create index on public.staff (shop_id);
create index on public.customers (shop_id);
create index on public.measurement_history (shop_id, customer_id, created_at desc);
create index on public.fabrics (shop_id);
create index on public.perfumes (shop_id);
create index on public.orders (shop_id, stage, due);
create index on public.orders (customer_id);
create index on public.payments (shop_id, order_id);
create index on public.fabric_movements (shop_id, fabric_id);
create index on public.perfume_movements (shop_id, perfume_id);

-- ---------------------------------------------------------------------
-- Membership helper (used by every RLS policy)
-- ---------------------------------------------------------------------

create or replace function public.is_shop_member(p_shop uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.shop_members m
    where m.shop_id = p_shop and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['shops','staff','customers','fabrics','perfumes','orders'] loop
    execute format('create trigger touch_updated_at before update on public.%I
                    for each row execute function public.tg_touch_updated_at()', t);
  end loop;
end $$;

-- Orders: paid only moves through payments; stage drives ready_at / delivered_at.
create or replace function public.tg_orders_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.paid := 0;
    new.ready_at := case when new.stage in ('Ready','Delivered') then now() end;
    new.delivered_at := case when new.stage = 'Delivered' then now() end;
    return new;
  end if;

  if coalesce(current_setting('aminzi.allow_paid', true), '') <> 'on' then
    new.paid := old.paid;
  end if;
  new.shop_id := old.shop_id;

  if new.stage is distinct from old.stage then
    new.ready_at := case when new.stage in ('Ready','Delivered') then coalesce(old.ready_at, now()) end;
    new.delivered_at := case when new.stage = 'Delivered' then coalesce(old.delivered_at, now()) end;
  else
    new.ready_at := old.ready_at;
    new.delivered_at := old.delivered_at;
  end if;
  if new.total < new.paid then
    raise exception 'Total cannot be less than what is already paid';
  end if;
  return new;
end $$;

create trigger orders_guard before insert or update on public.orders
for each row execute function public.tg_orders_guard();

-- Payments: add to orders.paid, never above the total.
create or replace function public.tg_payments_apply()
returns trigger language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = new.order_id for update;
  if not found or o.shop_id <> new.shop_id then
    raise exception 'Order not found in this shop';
  end if;
  if o.paid + new.amount > o.total then
    raise exception 'Payment of % is more than the balance of %', new.amount, o.total - o.paid;
  end if;
  perform set_config('aminzi.allow_paid', 'on', true);
  update public.orders set paid = paid + new.amount where id = new.order_id;
  perform set_config('aminzi.allow_paid', 'off', true);
  return new;
end $$;

create trigger payments_apply after insert on public.payments
for each row execute function public.tg_payments_apply();

-- Staff: the link to a Supabase Auth user is set by the database only, and that person stays Admin.
create or replace function public.tg_staff_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('authenticated', 'anon') then new.user_id := null; end if;
    return new;
  end if;
  new.user_id := old.user_id;
  new.shop_id := old.shop_id;
  if old.user_id is not null then new.role := 'Admin'; new.active := true; end if;
  return new;
end $$;

create trigger staff_guard before insert or update on public.staff
for each row execute function public.tg_staff_guard();

-- Fabric stock only moves through fabric_movements.
create or replace function public.tg_fabrics_guard()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('aminzi.allow_stock', true), '') <> 'on' then
    new.metres_left := old.metres_left;
    new.metres_of := greatest(new.metres_of, old.metres_of);
  end if;
  new.shop_id := old.shop_id;
  return new;
end $$;

create trigger fabrics_guard before update on public.fabrics
for each row execute function public.tg_fabrics_guard();

create or replace function public.tg_fabric_movements_apply()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('aminzi.allow_stock', 'on', true);
  update public.fabrics
     set metres_left = metres_left + new.delta,
         metres_of   = greatest(metres_of, metres_left + new.delta)
   where id = new.fabric_id and shop_id = new.shop_id;
  perform set_config('aminzi.allow_stock', 'off', true);
  if not found then raise exception 'Fabric not found in this shop'; end if;
  return new;
end $$;

create trigger fabric_movements_apply after insert on public.fabric_movements
for each row execute function public.tg_fabric_movements_apply();

-- Perfume stock only moves through perfume_movements.
create or replace function public.tg_perfumes_guard()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('aminzi.allow_stock', true), '') <> 'on' then
    new.stock := old.stock;
  end if;
  new.shop_id := old.shop_id;
  return new;
end $$;

create trigger perfumes_guard before update on public.perfumes
for each row execute function public.tg_perfumes_guard();

create or replace function public.tg_perfume_movements_apply()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('aminzi.allow_stock', 'on', true);
  update public.perfumes set stock = stock + new.delta
   where id = new.perfume_id and shop_id = new.shop_id;
  perform set_config('aminzi.allow_stock', 'off', true);
  if not found then raise exception 'Perfume not found in this shop'; end if;
  return new;
end $$;

create trigger perfume_movements_apply after insert on public.perfume_movements
for each row execute function public.tg_perfume_movements_apply();

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------

alter table public.shops               enable row level security;
alter table public.shop_members        enable row level security;
alter table public.staff               enable row level security;
alter table public.customers           enable row level security;
alter table public.measurement_history enable row level security;
alter table public.fabrics             enable row level security;
alter table public.perfumes            enable row level security;
alter table public.orders              enable row level security;
alter table public.payments            enable row level security;
alter table public.fabric_movements    enable row level security;
alter table public.perfume_movements   enable row level security;

-- Shops: members read and update their shop. The shop is created by the auth.users trigger below.
create policy shops_select on public.shops for select to authenticated using (public.is_shop_member(id));
create policy shops_update on public.shops for update to authenticated
  using (public.is_shop_member(id)) with check (public.is_shop_member(id));

-- Memberships: a user sees only their own rows.
create policy members_select on public.shop_members for select to authenticated using (user_id = auth.uid());

-- Shop data tables: full access for members of the row's shop.
do $$
declare t text;
begin
  foreach t in array array['staff','customers','fabrics','perfumes','orders'] loop
    execute format('create policy %1$s_rw on public.%1$I for all to authenticated
                    using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id))', t);
  end loop;
  -- Ledgers are append-only from the app: select + insert, no update/delete.
  foreach t in array array['measurement_history','payments','fabric_movements','perfume_movements'] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated
                    using (public.is_shop_member(shop_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated
                    with check (public.is_shop_member(shop_id))', t);
  end loop;
end $$;

-- Nothing in this schema is for anonymous visitors.
revoke all on public.shops, public.shop_members, public.staff, public.customers,
  public.measurement_history, public.fabrics, public.perfumes, public.orders,
  public.payments, public.fabric_movements, public.perfume_movements from anon;

-- ---------------------------------------------------------------------
-- Supabase Auth users → Admins
-- A user added in Dashboard → Authentication → Users is linked to the shop
-- (created on first use) and gets an Admin staff record. Name comes from the
-- user's metadata "name" if set, otherwise from the email address.
-- ---------------------------------------------------------------------

create or replace function public.link_auth_user(p_id uuid, p_email text, p_phone text, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_shop uuid; v_name text;
begin
  select id into v_shop from public.shops order by created_at limit 1;
  if v_shop is null then
    insert into public.shops (name) values ('AminZi Fabrics & Tailors') returning id into v_shop;
  end if;
  insert into public.shop_members (shop_id, user_id, role) values (v_shop, p_id, 'admin') on conflict do nothing;
  v_name := coalesce(nullif(trim(p_meta ->> 'name'), ''), nullif(trim(p_meta ->> 'full_name'), ''),
                     initcap(replace(split_part(coalesce(p_email, ''), '@', 1), '.', ' ')), 'Admin');
  if v_name = '' then v_name := 'Admin'; end if;
  insert into public.staff (shop_id, name, role, phone, user_id)
  values (v_shop, v_name, 'Admin', nullif(p_phone, ''), p_id)
  on conflict (user_id) do nothing;
end $$;

create or replace function public.tg_auth_user_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.link_auth_user(new.id, new.email, new.phone, coalesce(new.raw_user_meta_data, '{}'::jsonb));
  return new;
end $$;

drop trigger if exists aminzi_on_auth_user_created on auth.users;
create trigger aminzi_on_auth_user_created after insert on auth.users
for each row execute function public.tg_auth_user_created();

-- Users that already existed before this script ran become Admins too.
do $$
declare u record;
begin
  for u in select id, email, phone, raw_user_meta_data from auth.users order by created_at loop
    perform public.link_auth_user(u.id, u.email, u.phone, coalesce(u.raw_user_meta_data, '{}'::jsonb));
  end loop;
end $$;

revoke all on function public.link_auth_user(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.tg_auth_user_created() from public, anon, authenticated;
revoke all on function public.is_shop_member(uuid) from public, anon;
grant execute on function public.is_shop_member(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Realtime: other counters see changes live
-- ---------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.shops, public.staff, public.customers, public.measurement_history,
      public.fabrics, public.perfumes, public.orders, public.payments;
  end if;
end $$;
