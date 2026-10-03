-- Online-Status: standardmaessig AN fuer alle Konten
--
-- Bisher war "Online-Status zeigen" (profiles.online_sichtbar) ein Opt-in (Standard aus). Jetzt ist er fuer neue UND
-- bestehende Konten eingeschaltet; jede Person kann ihn unter Einstellungen → Online-Status jederzeit ausschalten.
-- Unveraendert fuer alle Nutzer: Konten unter 16 Jahren werden nie mit Namen als online gezeigt, gesperrte und blockierte
-- Personen nie; Namen sehen nur Kontakte/Vereinsmitglieder.
-- Zaehler (online_anzahl, online_uebersicht, admin_plattform_statistik) zaehlen nur Konten mit Online-Status AN.
-- Nur die TanzRaum-Administration sieht je Konto „Online“ / „Offline“ / „Online-Status AUS“ (admin_benutzer_liste).
-- Regeln (RLS) bleiben unveraendert; zusaetzlich wird die neue Fassung der Datenschutzerklaerung registriert.

alter table public.profiles alter column online_sichtbar set default true;

update public.profiles set online_sichtbar = true where online_sichtbar is distinct from true;

comment on column public.profiles.online_sichtbar is 'Online-Status fuer Kontakte/Vereinsmitglieder mit Namen zeigen (Standard: an, abschaltbar)';

-- Datenschutzerklaerung Fassung 03.10.2026 (Online-Status voreingestellt, abschaltbar)
insert into public.rechtstext_versionen (art, version, gueltig_ab, aenderungshinweis)
select 'datenschutz', '03.10.2026', timestamptz '2026-10-03 00:00:00+00',
       'Geändert: Online-Status voreingestellt und abschaltbar; ausgeschaltet weder angezeigt noch gezählt; Administration sieht je Konto Online/Offline/Status AUS'
where not exists (select 1 from public.rechtstext_versionen where art = 'datenschutz' and version = '03.10.2026');

-- ===== Zaehler: nur wer online ist UND den Online-Status nicht ausgeschaltet hat =====
-- (Online-Status AUS = fuer niemanden als online gezaehlt oder angezeigt; die TanzRaum-Administration sieht nur,
--  DASS der Status ausgeschaltet ist – siehe admin_benutzer_liste / admin_plattform_statistik)
create or replace function public.online_anzahl()
 returns integer
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when auth.uid() is null then null else (
    select count(*)::integer from profiles p
    where p.zuletzt_online > now() - interval '3 minutes' and p.online_sichtbar and not coalesce(p.gesperrt, false)) end;
$function$;

create or replace function public.online_uebersicht()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with grenze as (select now() - interval '3 minutes' as t),
  mein_verein as (
    select vm.verein_id from vereins_mitglieder vm
    where vm.user_id = auth.uid() and coalesce(vm.aktiv, true) and vm.aufnahme_status = 'aufgenommen' and verein_hat_lizenz(vm.verein_id)
    limit 1),
  kontakte as (
    select p.id, p.avatar_url, p.konto_privat
    from profiles p, grenze
    where auth.uid() is not null and p.id <> auth.uid() and p.zuletzt_online > grenze.t
      and p.online_sichtbar and not coalesce(p.gesperrt, false) and not ist_unter_16(p.id)
      and not ist_blockiert(auth.uid(), p.id)
      and (netzwerk_verbunden(auth.uid(), p.id) or hat_vereinsbeziehung(auth.uid(), p.id))
    order by p.zuletzt_online desc
    limit 12)
  select case when auth.uid() is null then null else jsonb_build_object(
    'gesamt', (select count(*) from profiles p, grenze where p.zuletzt_online > grenze.t and p.online_sichtbar and not coalesce(p.gesperrt, false)),
    'verein', (select count(*) from vereins_mitglieder vm join profiles p on p.id = vm.user_id, grenze
               where vm.verein_id = (select verein_id from mein_verein) and coalesce(vm.aktiv, true)
                 and p.zuletzt_online > grenze.t and p.online_sichtbar and vm.user_id <> auth.uid()),
    'hat_verein', exists (select 1 from mein_verein),
    'kontakte', coalesce((select jsonb_agg(jsonb_build_object('id', k.id,
                  'name', (select a.anzeige from anzeige_namen(array[k.id]) a),
                  'avatar_url', case when not coalesce(k.konto_privat, false) or kann_privates_profil_sehen(k.id) then k.avatar_url end))
                from kontakte k), '[]'::jsonb),
    'ich_sichtbar', (select online_sichtbar from profiles where id = auth.uid())) end;
$function$;

-- Plattform-Statistik: online_jetzt ohne ausgeschalteten Status; neu: online_aus (Konten mit Online-Status AUS)
create or replace function public.admin_plattform_statistik()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v jsonb;
begin
  if not ist_plattform_admin_aktuell() then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  with nutzer as (
    select p.id, p.created_at, p.zuletzt_online, p.online_sichtbar, tarif_stufe(p.id) as stufe,
      exists (select 1 from vereins_mitglieder vm where vm.user_id = p.id and coalesce(vm.aktiv, true)
              and vm.aufnahme_status = 'aufgenommen' and verein_hat_lizenz(vm.verein_id)) as zugeordnet
    from profiles p where not coalesce(p.ist_plattform_admin, false)),
  monate as (select generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') as m),
  wochen as (select generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') as w)
  select jsonb_build_object(
    'nutzer_gesamt', (select count(*) from nutzer),
    'free', (select count(*) from nutzer where stufe = 'free'),
    'basic', (select count(*) from nutzer where stufe = 'basic'),
    'verein_zugang', (select count(*) from nutzer where stufe = 'verein'),
    'mit_zuordnung', (select count(*) from nutzer where zugeordnet),
    'ohne_zuordnung', (select count(*) from nutzer where not zugeordnet),
    'online_jetzt', (select count(*) from nutzer where zuletzt_online > now() - interval '3 minutes' and online_sichtbar),
    'online_aus', (select count(*) from nutzer where not online_sichtbar),
    'aktiv_24h', (select count(*) from nutzer where zuletzt_online > now() - interval '24 hours'),
    'neu_7_tage', (select count(*) from nutzer where created_at > now() - interval '7 days'),
    'neu_30_tage', (select count(*) from nutzer where created_at > now() - interval '30 days'),
    'registrierungen', (select jsonb_agg(jsonb_build_object('monat', to_char(m, 'YYYY-MM'),
                          'neu', (select count(*) from nutzer n where date_trunc('month', n.created_at) = m),
                          'gesamt', (select count(*) from nutzer n where n.created_at < m + interval '1 month')) order by m) from monate),
    'vereine_gesamt', (select count(*) from vereine),
    'lizenzen_aktiv', (select count(*) from vereine x where verein_hat_lizenz(x.id)),
    'lizenzen_inaktiv', (select count(*) from vereine x where not verein_hat_lizenz(x.id)),
    'vereine_verlauf', (select jsonb_agg(jsonb_build_object('monat', to_char(m, 'YYYY-MM'),
                          'gesamt', (select count(*) from vereine x where x.created_at < m + interval '1 month')) order by m) from monate),
    'gruppen_gesamt', (select count(*) from gruppen),
    'nachrichten_wochen', (select jsonb_agg(jsonb_build_object('woche', to_char(w, 'IYYY-IW'),
                          'anzahl', (select count(*) from nachrichten n where date_trunc('week', n.gesendet_am) = w)) order by w) from wochen),
    'nachrichten_30_tage', (select count(*) from nachrichten n where n.gesendet_am > now() - interval '30 days'))
  into v;
  return v;
end;
$function$;

-- ===== Administration → Benutzer: Online-Status je Konto (nur TanzRaum-Admin) =====
-- online_status: 'online' (Status AN und gerade aktiv), 'offline' (Status AN), 'aus' (Online-Status AUS – es wird
-- nur die Einstellung gezeigt, keine Aktivitaet). Statusfilter zusaetzlich 'online' und 'online_aus'.
-- Die Administration kann die Einstellung anderer nicht aendern (online_sichtbar_setzen gilt nur fuer das eigene Konto).
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
           coalesce(p.online_sichtbar, false) as online_sichtbar,
           p.zuletzt_online > now() - interval '3 minutes' as gerade_aktiv,
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
           or (p_status = 'deaktiviert' and (b.gesperrt or b.loeschen_ab is not null))
           or (p_status = 'online' and b.online_sichtbar and coalesce(b.gerade_aktiv, false))
           or (p_status = 'online_aus' and not b.online_sichtbar))
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
        -- nur Stand der Einstellung bei AUS (keine Aktivitaet), sonst online/offline
        'online_status', case when not s.online_sichtbar then 'aus' when coalesce(s.gerade_aktiv, false) then 'online' else 'offline' end,
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
