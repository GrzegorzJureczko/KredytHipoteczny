-- Calculations saved by signed-in users. Row level security keeps every row private to its owner.
create table if not exists public.saved_calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists saved_calculations_user_created_idx
  on public.saved_calculations (user_id, created_at desc);

alter table public.saved_calculations enable row level security;

drop policy if exists "saved_calculations_select_own" on public.saved_calculations;
create policy "saved_calculations_select_own"
  on public.saved_calculations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "saved_calculations_insert_own" on public.saved_calculations;
create policy "saved_calculations_insert_own"
  on public.saved_calculations
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "saved_calculations_update_own" on public.saved_calculations;
create policy "saved_calculations_update_own"
  on public.saved_calculations
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "saved_calculations_delete_own" on public.saved_calculations;
create policy "saved_calculations_delete_own"
  on public.saved_calculations
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
