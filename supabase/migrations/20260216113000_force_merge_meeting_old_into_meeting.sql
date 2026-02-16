begin;

do $$
declare
  canonical_key text;
begin
  -- Prefer an existing "Meeting" project as canonical.
  select p.project_key
  into canonical_key
  from public.projects p
  where lower(trim(p.project_name)) = 'meeting'
  order by p.created_at asc, p.project_key asc
  limit 1;

  -- If no exact Meeting exists, promote the earliest Meeting-Old variant.
  if canonical_key is null then
    select p.project_key
    into canonical_key
    from public.projects p
    where lower(p.project_name) ~ 'meeting[\s\-_]*old'
    order by p.created_at asc, p.project_key asc
    limit 1;

    if canonical_key is not null then
      update public.projects
      set project_name = 'Meeting',
          updated_at = now()
      where project_key = canonical_key;
    end if;
  end if;

  if canonical_key is null then
    return;
  end if;

  -- Alias every Meeting-Old style project to canonical Meeting.
  insert into public.project_aliases (source_project_key, canonical_project_key, normalized_name, updated_at)
  select
    p.project_key,
    canonical_key,
    'meeting',
    now()
  from public.projects p
  where p.project_key <> canonical_key
    and lower(p.project_name) ~ 'meeting[\s\-_]*old'
  on conflict (source_project_key) do update
  set canonical_project_key = excluded.canonical_project_key,
      normalized_name = excluded.normalized_name,
      updated_at = now();

  -- Rewrite historical entries to canonical key.
  update public.time_entries t
  set project_key = canonical_key
  where t.project_key in (
    select p.project_key
    from public.projects p
    where p.project_key <> canonical_key
      and lower(p.project_name) ~ 'meeting[\s\-_]*old'
  );
end
$$;

commit;

