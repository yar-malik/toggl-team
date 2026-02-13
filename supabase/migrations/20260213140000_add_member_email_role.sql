alter table public.members
  add column if not exists email text null;

alter table public.members
  add column if not exists role text not null default 'member';

create unique index if not exists idx_members_email_unique
  on public.members (email)
  where email is not null;

