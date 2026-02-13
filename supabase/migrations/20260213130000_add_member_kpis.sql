create table if not exists public.member_kpis (
  id bigint generated always as identity primary key,
  member_name text not null references public.members(member_name) on update cascade,
  kpi_label text not null,
  kpi_value text not null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_name, kpi_label)
);

drop trigger if exists trg_member_kpis_updated_at on public.member_kpis;
create trigger trg_member_kpis_updated_at
before update on public.member_kpis
for each row
execute procedure public.set_updated_at();

