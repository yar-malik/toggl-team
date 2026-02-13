-- Merge projects that have exactly the same normalized name (case/space-insensitive).
-- Safe to run multiple times.

with normalized as (
  select
    p.project_key,
    p.project_name,
    lower(trim(p.project_name)) as norm_name,
    p.created_at
  from public.projects p
  where trim(p.project_name) <> ''
),
groups as (
  select
    n.norm_name,
    count(*) as item_count
  from normalized n
  group by n.norm_name
  having count(*) > 1
),
canonical as (
  select distinct on (n.norm_name)
    n.norm_name,
    n.project_key as canonical_project_key
  from normalized n
  join groups g on g.norm_name = n.norm_name
  order by n.norm_name, n.created_at asc, n.project_key asc
),
duplicates as (
  select
    n.project_key as source_project_key,
    c.canonical_project_key,
    n.norm_name
  from normalized n
  join canonical c on c.norm_name = n.norm_name
  where n.project_key <> c.canonical_project_key
)
insert into public.project_aliases (source_project_key, canonical_project_key, normalized_name, updated_at)
select d.source_project_key, d.canonical_project_key, d.norm_name, now()
from duplicates d
on conflict (source_project_key) do update
set
  canonical_project_key = excluded.canonical_project_key,
  normalized_name = excluded.normalized_name,
  updated_at = now();

update public.time_entries t
set project_key = a.canonical_project_key
from public.project_aliases a
where t.project_key = a.source_project_key
  and t.project_key is distinct from a.canonical_project_key;

update public.projects p
set updated_at = now()
where p.project_key in (
  select distinct canonical_project_key
  from public.project_aliases
);
