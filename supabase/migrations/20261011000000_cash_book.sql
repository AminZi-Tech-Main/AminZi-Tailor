-- =====================================================================
-- AminZi Tailor — cash book (run once, after 20261010000000_init.sql)
--
-- Money the shop has = every customer payment (public.payments)
--                    + money in here  (fabric and perfume sales, opening cash, other income)
--                    − money out here (tailor wages, rent, bills, fabric purchases, other).
-- Append-only like the other ledgers: rows are added, never edited or deleted from the app.
-- Safe to run more than once.
-- =====================================================================

create table if not exists public.cash_entries (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  direction   text not null check (direction in ('in', 'out')),
  amount      numeric(12,2) not null check (amount > 0),
  category    text not null check (category in (
                'fabric_sale', 'perfume_sale', 'opening', 'other_in',
                'wages', 'rent', 'bills', 'purchase', 'other_out')),
  note        text check (char_length(note) <= 200),
  staff_id    uuid references public.staff(id) on delete set null,
  created_at  timestamptz not null default now(),
  -- money in uses an "in" category, money out an "out" category
  check ((direction = 'in')  = (category in ('fabric_sale', 'perfume_sale', 'opening', 'other_in')))
);

create index if not exists cash_entries_shop_created on public.cash_entries (shop_id, created_at desc);

alter table public.cash_entries enable row level security;

drop policy if exists cash_entries_select on public.cash_entries;
drop policy if exists cash_entries_insert on public.cash_entries;
create policy cash_entries_select on public.cash_entries for select to authenticated
  using (public.is_shop_member(shop_id));
create policy cash_entries_insert on public.cash_entries for insert to authenticated
  with check (public.is_shop_member(shop_id));

revoke all on public.cash_entries from anon;
grant select, insert on public.cash_entries to authenticated;

-- Other counters see money movements live.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cash_entries') then
    alter publication supabase_realtime add table public.cash_entries;
  end if;
end $$;
