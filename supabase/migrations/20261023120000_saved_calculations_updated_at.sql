-- Tracks the last modification of a saved calculation separately from its creation time.
alter table public.saved_calculations
  add column if not exists updated_at timestamptz not null default now();

update public.saved_calculations
set updated_at = created_at
where created_at is not null;

create or replace function public.set_saved_calculations_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saved_calculations_set_updated_at on public.saved_calculations;

create trigger saved_calculations_set_updated_at
before update on public.saved_calculations
for each row
execute function public.set_saved_calculations_updated_at();
