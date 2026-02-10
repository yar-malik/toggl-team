create table if not exists public.cache_snapshots (
  cache_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_cache_snapshots_updated_at on public.cache_snapshots;
create trigger trg_cache_snapshots_updated_at
before update on public.cache_snapshots
for each row
execute procedure public.set_updated_at();

create index if not exists idx_cache_snapshots_expires_at
  on public.cache_snapshots (expires_at);
