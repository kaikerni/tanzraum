create or replace function public.team_rechte_katalog()
 returns text[]
 language sql
 immutable
 set search_path to 'public'
as $function$
  select array[
    'treff', 'treff.themen_erstellen', 'treff.themen_bearbeiten', 'treff.themen_loeschen', 'treff.beitraege_bearbeiten',
    'treff.beitraege_loeschen', 'treff.themen_verschieben', 'treff.themen_schliessen', 'treff.themen_oeffnen',
    'treff.themen_anpinnen', 'treff.themen_entpinnen', 'treff.meldungen_bearbeiten', 'treff.nutzer_melden',
    'treff.nutzer_sperren', 'treff.nutzer_entfernen', 'treff.empfehlen',
    'workshops', 'workshops.ansehen', 'workshops.erstellen', 'workshops.bearbeiten', 'workshops.freigeben',
    'workshops.ablehnen', 'workshops.archivieren', 'workshops.loeschen',
    'wissen', 'wissen.erstellen', 'wissen.bearbeiten', 'wissen.veroeffentlichen', 'wissen.loeschen',
    'news', 'news.verwalten',
    'spotlight', 'spotlight.meldungen_bearbeiten',
    'nutzer', 'nutzer.ansehen', 'nutzer.sperren'];
$function$;
grant execute on function public.team_rechte_katalog() to authenticated;

create table if not exists public.team_mitglieder (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  moderator boolean not null default false,
  kennzeichnen boolean not null default true,
  alle_rechte boolean not null default false,
  rechte text[] not null default '{}',
  notiz text check (char_length(notiz) <= 500),
  hinzugefuegt_von uuid references public.profiles(id) on delete set null,
  hinzugefuegt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  constraint team_rechte_gueltig check (rechte <@ team_rechte_katalog())
);
comment on table public.team_mitglieder is 'TanzRaum Team: interne Rolle mit ausdruecklich vergebenen Rechten (kein Plattform-Admin)';
comment on column public.team_mitglieder.alle_rechte is 'Alle vorgesehenen Team-Rechte – macht NICHT zum TanzRaum-Admin';
comment on column public.team_mitglieder.kennzeichnen is 'Oeffentlich als „TanzRaum Team“ (ggf. „· Moderator“) kennzeichnen';
alter table public.team_mitglieder enable row level security;
create policy "Team: Plattform-Admin und eigene Zeile" on public.team_mitglieder for select to authenticated
  using (user_id = auth.uid() or ist_plattform_admin_aktuell());
revoke all on public.team_mitglieder from public, anon, authenticated;
grant select on public.team_mitglieder to authenticated;
grant all on public.team_mitglieder to service_role;

-- Zentrale Rechtepruefung: Plattform-Admin immer; Teammitglied nur mit Bereich + Aktion (oder „alle Rechte“).
-- Gesperrte Konten haben keine Rechte.
create or replace function public.team_darf(p_recht text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select auth.uid() is not null and (
    ist_plattform_admin_aktuell()
    or exists (
      select 1 from team_mitglieder t join profiles p on p.id = t.user_id
      where t.user_id = auth.uid() and not coalesce(p.gesperrt, false)
        and p_recht = any(team_rechte_katalog())
        and (t.alle_rechte
             or (p_recht = any(t.rechte) and split_part(p_recht, '.', 1) = any(t.rechte)))));
$function$;
revoke all on function public.team_darf(text) from public, anon;
grant execute on function public.team_darf(text) to authenticated;

-- Fuer die App: meine Team-Rolle und Rechte (nur Anzeige; jede Aktion prueft erneut)
create or replace function public.meine_team_rechte()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'admin', ist_plattform_admin_aktuell(),
    'team', t.user_id is not null,
    'moderator', coalesce(t.moderator, false),
    'alle_rechte', coalesce(t.alle_rechte, false),
    'rechte', case when ist_plattform_admin_aktuell() or coalesce(t.alle_rechte, false) then to_jsonb(team_rechte_katalog())
                   else to_jsonb(coalesce(t.rechte, '{}'::text[])) end)
  from (select auth.uid() as uid) ich
  left join team_mitglieder t on t.user_id = ich.uid
  left join profiles p on p.id = ich.uid
  where ich.uid is not null and not coalesce(p.gesperrt, false);
$function$;
revoke all on function public.meine_team_rechte() from public, anon;
grant execute on function public.meine_team_rechte() to authenticated;

-- Oeffentliche Kennzeichnung: 'admin' (👑 TanzRaum-Admin), 'moderator' (🛡 TanzRaum Team · Moderator), 'team' (🛡 TanzRaum Team)
create or replace function public.team_kennzeichen(p_user_ids uuid[])
 returns table(user_id uuid, kennzeichen text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p.id,
    case when p.ist_plattform_admin then 'admin'
         when t.kennzeichnen and t.moderator then 'moderator'
         when t.kennzeichnen then 'team' end
  from profiles p left join team_mitglieder t on t.user_id = p.id
  where p.id = any(p_user_ids) and auth.uid() is not null
    and (p.ist_plattform_admin or t.kennzeichnen);
$function$;
revoke all on function public.team_kennzeichen(uuid[]) from public, anon;
grant execute on function public.team_kennzeichen(uuid[]) to authenticated;
