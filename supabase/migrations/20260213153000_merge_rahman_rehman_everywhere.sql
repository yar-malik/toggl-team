begin;

-- Ensure canonical member exists.
insert into public.members (member_name)
values ('Rehman')
on conflict (member_name) do nothing;

-- Merge profile attributes onto canonical row.
with merged as (
  select
    max(email) filter (where email is not null and email <> '') as email,
    max(role) filter (where role is not null and role <> '') as role
  from public.members
  where lower(member_name) in ('rahman', 'rehman')
)
update public.members m
set
  email = coalesce(m.email, merged.email),
  role = coalesce(m.role, merged.role),
  updated_at = now()
from merged
where m.member_name = 'Rehman';

-- Merge daily stats first to avoid PK collisions.
insert into public.daily_member_stats (stat_date, member_name, total_seconds, entry_count, updated_at)
select
  stat_date,
  'Rehman' as member_name,
  sum(total_seconds) as total_seconds,
  sum(entry_count) as entry_count,
  now() as updated_at
from public.daily_member_stats
where lower(member_name) in ('rahman', 'rehman')
group by stat_date
on conflict (stat_date, member_name) do update
set
  total_seconds = excluded.total_seconds,
  entry_count = excluded.entry_count,
  updated_at = now();

delete from public.daily_member_stats
where lower(member_name) in ('rahman', 'rehman')
  and member_name <> 'Rehman';

-- Merge KPI rows by label.
insert into public.member_kpis (member_name, kpi_label, kpi_value, notes, updated_at)
select
  'Rehman' as member_name,
  kpi_label,
  (array_agg(kpi_value order by updated_at desc nulls last))[1] as kpi_value,
  (array_agg(notes order by updated_at desc nulls last))[1] as notes,
  now() as updated_at
from public.member_kpis
where lower(member_name) in ('rahman', 'rehman')
group by kpi_label
on conflict (member_name, kpi_label) do update
set
  kpi_value = excluded.kpi_value,
  notes = excluded.notes,
  updated_at = now();

delete from public.member_kpis
where lower(member_name) in ('rahman', 'rehman')
  and member_name <> 'Rehman';

-- Move entry ownership and historical events to canonical member.
update public.time_entries
set member_name = 'Rehman'
where lower(member_name) in ('rahman', 'rehman')
  and member_name <> 'Rehman';

update public.sync_events
set member_name = 'Rehman'
where lower(member_name) in ('rahman', 'rehman')
  and member_name <> 'Rehman';

-- Remove non-canonical member rows.
delete from public.members
where lower(member_name) in ('rahman', 'rehman')
  and member_name <> 'Rehman';

commit;
