-- Spotlights per Schalter der TanzRaum-Administration (statt fester Sperre im Code):
--   - plattform_einstellungen.spotlights_aktiv: an/aus fuer alle (aus = Leiste, Profilbereich, Medien und Erstellen weg)
--   - plattform_einstellungen.spotlights_tarife: fuer welche Tarife Spotlights erscheinen (free, basic, verein)
-- Erstellen bleibt wie bisher erst ab BASIC bzw. ueber einen Verein mit Lizenz (FREE nur ansehen) und nur als Foto.
-- Die Administration sieht Spotlights bei eingeschaltetem Schalter immer (Moderation von Meldungen).
-- Standard: aus (wie bisher). Nichts wird geloescht.

create table if not exists public.plattform_einstellungen (
  id boolean primary key default true check (id),
  spotlights_aktiv boolean not null default false,
  spotlights_tarife text[] not null default array['free', 'basic', 'verein']
    check (spotlights_tarife <@ array['free', 'basic', 'verein']),
  geaendert_am timestamptz not null default now(),
  geaendert_von uuid references public.profiles(id) on delete set null
);
insert into public.plattform_einstellungen (id) values (true) on conflict (id) do nothing;
comment on table public.plattform_einstellungen is 'Plattformweite Schalter der TanzRaum-Administration (eine Zeile)';

alter table public.plattform_einstellungen enable row level security;
drop policy if exists "Plattform-Einstellungen lesen" on public.plattform_einstellungen;
create policy "Plattform-Einstellungen lesen" on public.plattform_einstellungen for select to authenticated using (true);
revoke all on public.plattform_einstellungen from public, anon, authenticated;
grant select (id, spotlights_aktiv, spotlights_tarife, geaendert_am) on public.plattform_einstellungen to authenticated;
grant all on public.plattform_einstellungen to service_role;

-- Sind Spotlights fuer mich sichtbar? (Schalter an und mein Tarif freigegeben; Administration immer bei „an“)
create or replace function public.spotlights_fuer_mich()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select auth.uid() is not null and exists (
    select 1 from plattform_einstellungen e
    where e.id and e.spotlights_aktiv
      and (ist_plattform_admin_aktuell() or coalesce(tarif_von(auth.uid()), 'free') = any(e.spotlights_tarife)));
$function$;

-- Fuer die App: Schalter, Tarife, ob ich sehe und ob ich erstellen darf
create or replace function public.spotlights_status()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'aktiv', e.spotlights_aktiv,
    'tarife', to_jsonb(e.spotlights_tarife),
    'fuer_mich', spotlights_fuer_mich(),
    'darf_erstellen', spotlights_fuer_mich() and tarif_von(auth.uid()) in ('basic', 'verein') and konto_aktiv())
  from plattform_einstellungen e where e.id;
$function$;

create or replace function public.admin_spotlights_setzen(p_aktiv boolean, p_tarife text[])
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  if p_aktiv is null or p_tarife is null or not (p_tarife <@ array['free', 'basic', 'verein']) then
    raise exception 'Ungültige Einstellung.' using errcode = 'P0001';
  end if;
  update plattform_einstellungen
  set spotlights_aktiv = p_aktiv,
      spotlights_tarife = array(select distinct t from unnest(p_tarife) t order by 1),
      geaendert_am = now(), geaendert_von = auth.uid()
  where id;
end;
$function$;

do $mig$
declare
  d text;
  alt text;
  neu text;
begin
  -- Erstellen: feste Pause durch den Schalter ersetzen
  d := pg_get_functiondef('public.spotlight_erstellen(text, text, text, text, text, text)'::regprocedure);
  alt := $o$  -- PAUSE: Spotlights sind derzeit ausgeschaltet
  raise exception 'Spotlights sind derzeit nicht verfügbar.' using errcode = 'P0001';$o$;
  neu := $n$  -- Schalter der TanzRaum-Administration (an/aus, Tarife)
  if not spotlights_fuer_mich() then
    raise exception 'Spotlights sind derzeit nicht verfügbar.' using errcode = 'P0001';
  end if;$n$;
  if position(alt in d) = 0 then raise exception 'spotlight_erstellen: Ausdruck nicht gefunden'; end if;
  execute replace(d, alt, neu);

  -- Ansehen (Leiste, Profil, Medien): nur wenn Spotlights fuer mich eingeschaltet sind
  d := pg_get_functiondef('public.darf_spotlight_sehen(uuid)'::regprocedure);
  alt := $o$where s.id = p_id and auth.uid() is not null and s.entfernt_am is null$o$;
  neu := $n$where s.id = p_id and auth.uid() is not null and s.entfernt_am is null and spotlights_fuer_mich()$n$;
  if position(alt in d) = 0 then raise exception 'darf_spotlight_sehen: Ausdruck nicht gefunden'; end if;
  execute replace(d, alt, neu);

  -- Medien fuer die Administration ebenfalls nur bei eingeschaltetem Schalter
  d := pg_get_functiondef('public.spotlight_medium_sichtbar(text)'::regprocedure);
  alt := $o$(darf_spotlight_sehen(s.id) or ist_plattform_admin_aktuell())$o$;
  neu := $n$(darf_spotlight_sehen(s.id) or (ist_plattform_admin_aktuell() and spotlights_fuer_mich()))$n$;
  if position(alt in d) = 0 then raise exception 'spotlight_medium_sichtbar: Ausdruck nicht gefunden'; end if;
  execute replace(d, alt, neu);
end
$mig$;

-- Upload eigener Spotlight-Fotos nur, wenn Spotlights fuer mich an sind und ich erstellen darf
drop policy if exists "Nutzer laedt eigenes Spotlight-Medium hoch" on storage.objects;
create policy "Nutzer laedt eigenes Spotlight-Medium hoch" on storage.objects for insert to authenticated
  with check (bucket_id = 'spotlights' and (storage.foldername(name))[1] = (auth.uid())::text
              and public.spotlights_fuer_mich() and public.tarif_von(auth.uid()) in ('basic', 'verein'));

revoke execute on function public.spotlights_fuer_mich(), public.spotlights_status(), public.admin_spotlights_setzen(boolean, text[]) from public, anon;
grant execute on function public.spotlights_fuer_mich(), public.spotlights_status(), public.admin_spotlights_setzen(boolean, text[]) to authenticated;
