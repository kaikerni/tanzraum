-- Zentrale Online-Anzeige fuer alle Dashboards (nutzt die bestehende Online-Logik: profiles.zuletzt_online per
-- Herzschlag online_melden, online = aktiv in den letzten 3 Minuten, Opt-in profiles.online_sichtbar).
--
-- online_anzahl(): eine Zahl fuer alle (TanzRaum-weit, ohne Personenbezug) – dieselbe Definition wie online_uebersicht.gesamt.
-- online_liste():  wer davon fuer MICH sichtbar ist, nach den bestehenden Regeln:
--   - nur Personen mit Opt-in (online_sichtbar), nicht gesperrt, nicht unter 16 (Jugendschutz), nicht blockiert
--   - FREE: nur eigene Kontakte und Vereinsbeziehungen (kein Zugriff auf TanzRaum Connect)
--   - BASIC/VEREIN/Administration: zusaetzlich oeffentliche Profile (wie in TanzRaum Connect)
--   - Name wie ueberall ueber anzeige_namen, Profilbild nur bei oeffentlichem Profil oder erlaubter Profilsicht
--   - keine Vereins-, JuryRaum- oder sonstigen internen Angaben; keine Sonderrechte fuer die Administration
-- Keine neue Tabelle, keine Speicherung zusaetzlicher Daten.

create or replace function public.online_anzahl()
 returns integer
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when auth.uid() is null then null else (
    select count(*)::integer from profiles p
    where p.zuletzt_online > now() - interval '3 minutes' and not coalesce(p.gesperrt, false)) end;
$function$;

create or replace function public.online_liste(p_suche text default null, p_limit integer default 50)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_ich uuid := auth.uid();
  v_frei boolean;
  v_suche text := nullif(trim(coalesce(p_suche, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if v_ich is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  v_frei := coalesce(mein_tarif(), 'free') = 'free';
  if v_suche is not null then
    v_suche := left(v_suche, 60);
  end if;

  return (
    with sichtbar as (
      select p.id, p.zuletzt_online, p.konto_privat, p.avatar_url,
             netzwerk_verbunden(v_ich, p.id) or hat_vereinsbeziehung(v_ich, p.id) as bekannt
      from profiles p
      where p.zuletzt_online > now() - interval '3 minutes'
        and p.id <> v_ich
        and p.online_sichtbar
        and not coalesce(p.gesperrt, false)
        and not coalesce(ist_unter_16(p.id), true)
        and not ist_blockiert(v_ich, p.id)
    ),
    erlaubt as (
      select s.*, (select a.anzeige from anzeige_namen(array[s.id]) a) as name
      from sichtbar s
      where s.bekannt or (not v_frei and not coalesce(s.konto_privat, false))
    ),
    treffer as (
      select * from erlaubt e
      where v_suche is null or e.name ilike '%' || replace(replace(v_suche, '%', ''), '_', '') || '%'
    )
    select jsonb_build_object(
      'gesamt', online_anzahl(),
      'sichtbar', (select count(*) from erlaubt),
      'treffer', (select count(*) from treffer),
      'personen', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', t.id, 'name', t.name, 'kontakt', t.bekannt,
          'avatar_url', case when not coalesce(t.konto_privat, false) or t.bekannt or kann_privates_profil_sehen(t.id) then t.avatar_url end)
          order by t.bekannt desc, t.name)
        from (select * from treffer order by bekannt desc, name limit v_limit) t), '[]'::jsonb),
      'profile_verlinken', not v_frei)
  );
end;
$function$;

revoke execute on function public.online_anzahl(), public.online_liste(text, integer) from public, anon;
grant execute on function public.online_anzahl(), public.online_liste(text, integer) to authenticated;
