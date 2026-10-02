create table if not exists public.admin_protokoll (
  id uuid primary key default gen_random_uuid(),
  akteur_id uuid references public.profiles(id) on delete set null,
  akteur_name text,
  aktion text not null check (char_length(aktion) between 1 and 80),
  ziel_user_id uuid references public.profiles(id) on delete set null,
  ziel_name text,
  details jsonb not null default '{}'::jsonb,
  erstellt_am timestamptz not null default now()
);
create index if not exists admin_protokoll_zeit on public.admin_protokoll (erstellt_am desc);
create index if not exists admin_protokoll_ziel on public.admin_protokoll (ziel_user_id);
comment on table public.admin_protokoll is 'Protokoll administrativer Aktionen (TanzRaum-Admin und TanzRaum Team): wer, was, wann';
alter table public.admin_protokoll enable row level security;
