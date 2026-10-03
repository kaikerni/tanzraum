-- TanzRaum-Admin: vollstaendige Benutzerliste (Administration → Benutzer)
--
-- Ergaenzt die bestehende Suche (admin_benutzer_suche, max. 50 Treffer) um eine Liste ALLER registrierten Konten:
--   - nur TanzRaum-Admin (serverseitig geprueft, auch bei direktem Aufruf)
--   - serverseitig gefiltert (Suche ab 2 Zeichen, Tarif, Status, Verein, Rolle), sortiert und seitenweise (20/50/100)
--   - Grundlage sind registrierte Konten (profiles + auth.users). Vereinsmitglieder ohne eigenes Konto (Tabelle mitglieder)
--     werden NICHT gezaehlt.
--   - Datenschutz wie bisher: gekuerzte E-Mail, keine Chats/Nachrichten, keine Vereins-/Mitgliederdatensaetze,
--     nur Vereinsname und Rolle. Letzte Aktivitaet = letzte Anmeldung (Datum), nicht der Online-Status.
-- Nur eine neue Lesefunktion; keine Tabellen, Daten oder bestehenden Funktionen werden veraendert.

create or replace function public.admin_benutzer_liste(
  p_q text default null,
  p_tarif text default null,
  p_status text default null,
  p_verein_id uuid default null,
  p_rolle text default null,
  p_sortierung text default 'registriert',
  p_absteigend boolean default true,
  p_seite integer default 1,
  p_pro_seite integer default 50
)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_pro int := case when p_pro_seite in (20, 50, 100) then p_pro_seite else 50 end;
  v_seite int := greatest(coalesce(p_seite, 1), 1);
  v_sort text := case when p_sortierung in ('name', 'handle', 'tarif', 'verein', 'registriert') then p_sortierung else 'registriert' end;
  v_ab boolean := coalesce(p_absteigend, true);
  v_erg jsonb;
begin
  if not ist_plattform_admin_aktuell() then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  -- Suche erst ab 2 Zeichen (wie die bestehende Suche)
  if v_q is not null and char_length(v_q) < 2 then v_q := null; end if;
  v_q := left(v_q, 100);

  with basis as (
    select p.id, p.vorname, p.nachname, p.handle, p.avatar_url,
           u.email, u.created_at as registriert_am, u.last_sign_in_at,
           coalesce(p.ist_plattform_admin, false) as ist_admin,
           coalesce(p.gesperrt, false) or (u.banned_until is not null and u.banned_until > now()) as gesperrt,
           vm.verein_id, v.name as verein_name, coalesce(vm.aktiv, true) as mitglied_aktiv,
           r.name as rolle_name, case when r.name is null then null else rollen_typ(r.name) end as rolle_typ,
           k.loeschen_ab, coalesce(k.durch_admin, false) as loeschung_durch_admin, k.zuletzt_blockiert,
           tarif_von(p.id) as tarif
    from profiles p
    join auth.users u on u.id = p.id
    left join vereins_mitglieder vm on vm.user_id = p.id
    left join vereine v on v.id = vm.verein_id
    left join rollen r on r.id = vm.rolle_id
    left join konto_loeschungen k on k.user_id = p.id
    where (v_q is null
           or (coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')) ilike '%' || v_q || '%'
           or p.handle ilike '%' || ltrim(v_q, '@') || '%'
           or u.email ilike '%' || v_q || '%'
           or v.name ilike '%' || v_q || '%')
      and (p_verein_id is null or vm.verein_id = p_verein_id)
      and (p_rolle is null or (r.name is not null and rollen_typ(r.name) = p_rolle))
  ), gefiltert as (
    select b.*,
           case v_sort
             when 'name' then lower(coalesce(nullif(btrim(coalesce(b.nachname, '') || ' ' || coalesce(b.vorname, '')), ''), b.handle, ''))
             when 'handle' then lower(coalesce(b.handle, ''))
             when 'tarif' then case b.tarif when 'free' then '1' when 'basic' then '2' else '3' end || to_char(b.registriert_am, 'YYYYMMDDHH24MISSUS')
             when 'verein' then lower(coalesce(b.verein_name, ''))
             else to_char(b.registriert_am, 'YYYYMMDDHH24MISSUS')
           end as sk
    from basis b
    where (p_tarif is null or b.tarif = p_tarif)
      and (p_status is null
           or (p_status = 'aktiv' and not b.gesperrt and b.loeschen_ab is null)
           or (p_status = 'deaktiviert' and (b.gesperrt or b.loeschen_ab is not null)))
  ), seite as (
    select g.*, row_number() over (
             order by case when v_ab then g.sk end desc nulls last, case when not v_ab then g.sk end asc nulls last, g.registriert_am desc, g.id) as nr
    from gefiltert g
    order by nr
    limit v_pro offset (v_seite - 1) * v_pro
  )
  select jsonb_build_object(
    'gesamt', (select count(*) from gefiltert),
    'seite', v_seite,
    'pro_seite', v_pro,
    'zeilen', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', s.id,
        'vorname', s.vorname,
        'nachname', s.nachname,
        'name', nullif(btrim(coalesce(s.vorname, '') || ' ' || coalesce(s.nachname, '')), ''),
        'handle', s.handle,
        'avatar_url', s.avatar_url,
        'email_maskiert', case when s.email is null then null
                               else left(split_part(s.email, '@', 1), 2) || '***@' || split_part(s.email, '@', 2) end,
        'tarif', s.tarif,
        'lizenzart', coalesce(a.lizenzart, case when s.tarif = 'verein' and s.verein_id is not null and verein_hat_lizenz(s.verein_id) then 'VEREIN' end),
        'manuell', coalesce(a.anbieter = 'manuell', false),
        'lizenz_bis', a.laeuft_bis,
        'verein_id', s.verein_id,
        'verein', s.verein_name,
        'vereinslizenz', case when s.verein_id is null then null else verein_hat_lizenz(s.verein_id) end,
        'mitglied_aktiv', s.mitglied_aktiv,
        'rolle', s.rolle_name,
        'rolle_typ', s.rolle_typ,
        'ist_admin', s.ist_admin,
        'gesperrt', s.gesperrt,
        'registriert_am', s.registriert_am,
        'zuletzt_angemeldet', s.last_sign_in_at,
        'loeschen_ab', s.loeschen_ab,
        'loeschung_durch_admin', s.loeschung_durch_admin,
        'blockiert', s.zuletzt_blockiert)
        order by s.nr)
      from seite s
      left join lateral (
        select abo_lizenzart(x) as lizenzart, x.anbieter, x.laeuft_bis
        from abos x where x.inhaber = 'person' and x.user_id = s.id and abo_gilt(x)
        order by (x.freischaltung = 'team_free') nulls first, x.erstellt_am desc limit 1
      ) a on true), '[]'::jsonb),
    'vereine', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name) order by lower(v.name)) from vereine v), '[]'::jsonb))
  into v_erg;
  return v_erg;
end;
$function$;

revoke all on function public.admin_benutzer_liste(text, text, text, uuid, text, text, boolean, integer, integer) from public, anon;
grant execute on function public.admin_benutzer_liste(text, text, text, uuid, text, text, boolean, integer, integer) to authenticated;
