alter table public.projects
  add column if not exists project_archived boolean not null default false;

create index if not exists idx_projects_archived_name
  on public.projects (project_archived, project_name);
