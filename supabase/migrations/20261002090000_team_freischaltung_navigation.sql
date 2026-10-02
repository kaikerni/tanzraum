-- TanzRaum Team, Freischaltungen und Navigation – Rest (Teil 1 bis 8 bereits eingespielt: 20261002012339 … 20261002012619)
-- Grundsatz: ROLLE, BERECHTIGUNG und NAVIGATION bleiben getrennt. Nichts wird geloescht, bestehende Daten bleiben unveraendert.

-- Tarif neu berechnen: eine unbefristete (oder pausierte) gueltige Lizenz begrenzt den Zugang nicht durch das Enddatum
-- einer zusaetzlichen befristeten Lizenz (z. B. TEAM_FREE unbefristet + MANUAL_FREE befristet).
CREATE OR REPLACE FUNCTION public.tarif_neu_berechnen_person(p_user_id uuid, p_grund text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_alt text;
  v_anzahl int;
  v_bis timestamptz;
  v_offen boolean;
  v_neu text;
begin
  select tarif into v_alt from profiles where id = p_user_id;
  if v_alt is null then return; end if;
  -- persoenlicher VEREIN-Tarif aus der Zeit vor den Abos bleibt unangetastet (Fall C)
  if v_alt = 'verein' and not exists (select 1 from abos a where a.inhaber = 'person' and a.user_id = p_user_id) then
    return;
  end if;
  select count(*), coalesce(bool_or(a.periode = 'unbefristet' or a.status = 'paused_by_organization'), false),
         max(a.laeuft_bis)
    into v_anzahl, v_offen, v_bis
  from abos a where a.inhaber = 'person' and a.user_id = p_user_id and abo_gilt(a);
  v_neu := case when v_anzahl > 0 then 'basic' else 'free' end;
  insert into tarif_system_freigabe (txid) values (txid_current()) on conflict do nothing;
  update profiles set tarif = v_neu, tarif_aktiv_bis = case when v_neu = 'free' or v_offen then null else v_bis end where id = p_user_id;
  delete from tarif_system_freigabe where txid = txid_current();
  if v_alt is distinct from v_neu then
    insert into tarif_ereignisse (user_id, previous_plan, new_plan, reason) values (p_user_id, v_alt, v_neu, coalesce(p_grund, 'abo'));
  end if;
end;
$function$;

-- Ablauf: zusaetzlich manuelle Lizenzen mit Enddatum (befristete Freischaltungen, manuelle Vereinslizenzen)
create or replace function public.abos_ablaufen()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
begin
  for r in update abos set status = 'expired', aktualisiert_am = now()
           where (status = 'cancelled' and laeuft_bis is not null and laeuft_bis <= now())
              or (anbieter = 'ueberweisung' and status in ('active', 'past_due') and laeuft_bis is not null and laeuft_bis <= now())
              or (anbieter = 'manuell' and status in ('active', 'trialing') and periode <> 'unbefristet' and laeuft_bis is not null and laeuft_bis <= now())
           returning inhaber, user_id, verein_id loop
    if r.inhaber = 'person' then perform tarif_neu_berechnen_person(r.user_id, 'abgelaufen');
    else perform tarif_neu_berechnen_verein(r.verein_id, 'abgelaufen'); end if;
  end loop;
  update zahlungsaufforderungen z set status = 'storniert', storniert_am = now()
   where z.status = 'offen' and z.art = 'neu' and z.erstellt_am < now() - interval '30 days';
  delete from abos a where a.status = 'pending' and a.anbieter = 'ueberweisung'
     and not exists (select 1 from zahlungsaufforderungen z where z.abo_id = a.id and z.status = 'offen');
  delete from abos where status = 'pending' and anbieter <> 'ueberweisung' and erstellt_am < now() - interval '2 days';
  insert into vereins_lizenz_abdeckungen (verein_id, user_id, vereins_mitglied_id, status, source, starts_at)
  select vm.verein_id, vm.user_id, vm.id, 'active', 'club_license', now()
  from vereins_mitglieder vm
  where vm.user_id is not null and coalesce(vm.aktiv, true) and verein_hat_lizenz(vm.verein_id)
    and not exists (select 1 from vereins_lizenz_abdeckungen d where d.vereins_mitglied_id = vm.id and d.status = 'active');
  update vereins_lizenz_abdeckungen d set status = 'ended', ended_at = now(), ends_at = now()
  where d.status = 'active' and not exists (
    select 1 from vereins_mitglieder vm where vm.id = d.vereins_mitglied_id and coalesce(vm.aktiv, true) and verein_hat_lizenz(vm.verein_id));
end;
$$;

-- „Nutzer freischalten“: neuer Zugang FREE / BASIC / VEREIN, kostenlos manuell oder regulaer bezahlt, unbefristet oder befristet.
-- Bezahlte Abos (Karte, PayPal, Ueberweisung) und TEAM_FREE werden nie angetastet.
create or replace function public.admin_freischalten(p_user_id uuid, p_tarif text, p_art text, p_bis date, p_notiz text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_verein uuid;
  v_bis timestamptz;
  v_alt text;
  v_notiz text := nullif(left(btrim(coalesce(p_notiz, '')), 500), '');
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  if p_tarif not in ('free', 'basic', 'verein') then raise exception 'Ungültiger Zugang.' using errcode = 'P0001'; end if;
  if p_art not in ('kostenlos', 'bezahlt') then raise exception 'Ungültige Freischaltungsart.' using errcode = 'P0001'; end if;
  if not exists (select 1 from profiles p where p.id = p_user_id) then raise exception 'Nutzer nicht gefunden.' using errcode = 'P0001'; end if;
  if exists (select 1 from profiles p where p.id = p_user_id and p.ist_plattform_admin) then
    raise exception 'Der TanzRaum-Admin hat ohnehin vollen Zugang.' using errcode = 'P0001';
  end if;
  if p_bis is not null and p_bis < v_heute then raise exception 'Das Enddatum liegt in der Vergangenheit.' using errcode = 'P0001'; end if;
  if p_bis is not null and p_bis > v_heute + 3660 then raise exception 'Bitte ein Enddatum innerhalb von 10 Jahren wählen.' using errcode = 'P0001'; end if;
  v_bis := case when p_bis is null then null else tagesende_berlin(p_bis) end;
  v_alt := tarif_von(p_user_id);

  if p_tarif in ('free', 'basic') then
    -- bisherige manuelle Freischaltungen (nicht TEAM_FREE) enden
    update abos set status = 'expired', laeuft_bis = least(coalesce(laeuft_bis, now()), now()), aktualisiert_am = now()
    where inhaber = 'person' and user_id = p_user_id and anbieter = 'manuell' and status in ('active', 'trialing', 'paused_by_organization')
      and freischaltung is distinct from 'team_free';
    if p_tarif = 'basic' then
      insert into abos (inhaber, user_id, tarif, periode, preis_cent, anbieter, status, laeuft_bis, freischaltung, notiz, erteilt_von)
      values ('person', p_user_id, 'basic', case when v_bis is null then 'unbefristet' else 'befristet' end, 0, 'manuell', 'active', v_bis,
              case when p_art = 'kostenlos' then 'manual_free' else 'manuell_bezahlt' end, v_notiz, auth.uid());
    end if;
    perform tarif_neu_berechnen_person(p_user_id, 'admin_freischaltung');
  else
    v_verein := offizieller_verein_von(p_user_id);
    if v_verein is null then
      raise exception 'Diese Person gehört keinem Verein an. Die Vereinslizenz gilt immer für einen ganzen Verein.' using errcode = 'P0001';
    end if;
    if exists (select 1 from abos a where a.inhaber = 'verein' and a.verein_id = v_verein and a.anbieter <> 'manuell' and abo_gilt(a)) then
      raise exception 'Der Verein hat bereits eine laufende bezahlte Lizenz.' using errcode = 'P0001';
    end if;
    update abos set status = 'expired', laeuft_bis = least(coalesce(laeuft_bis, now()), now()), aktualisiert_am = now()
    where inhaber = 'verein' and verein_id = v_verein and anbieter = 'manuell' and status in ('active', 'trialing');
    insert into abos (inhaber, user_id, verein_id, tarif, periode, preis_cent, anbieter, status, laeuft_bis, freischaltung, notiz, erteilt_von)
    values ('verein', p_user_id, v_verein, 'verein', case when v_bis is null then 'unbefristet' else 'befristet' end, 0, 'manuell', 'active', v_bis,
            case when p_art = 'kostenlos' then 'manual_free' else 'manuell_bezahlt' end, v_notiz, auth.uid());
    perform tarif_neu_berechnen_verein(v_verein, 'admin_freischaltung');
  end if;

  perform protokollieren(case when p_tarif = 'free' then 'freischaltung_beendet' else 'nutzer_freigeschaltet' end, p_user_id,
    jsonb_build_object('vorher', v_alt, 'zugang', p_tarif, 'art', p_art, 'bis', p_bis, 'verein_id', v_verein, 'notiz', v_notiz));
  return jsonb_build_object('tarif', tarif_von(p_user_id));
end;
$function$;
revoke all on function public.admin_freischalten(uuid, text, text, date, text) from public, anon;
grant execute on function public.admin_freischalten(uuid, text, text, date, text) to authenticated;

-- Einzelne manuelle Lizenz beenden („Kostenlose Freischaltung deaktivieren“) – Rueckstufung nach bestehender Tariflogik
create or replace function public.admin_freischaltung_beenden(p_abo_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a abos%rowtype;
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  select * into a from abos where id = p_abo_id;
  if a.id is null or a.anbieter <> 'manuell' then raise exception 'Nur manuelle Freischaltungen können hier beendet werden.' using errcode = 'P0001'; end if;
  update abos set status = 'expired', laeuft_bis = least(coalesce(laeuft_bis, now()), now()), aktualisiert_am = now() where id = p_abo_id;
  if a.inhaber = 'person' then perform tarif_neu_berechnen_person(a.user_id, 'admin_freischaltung_beendet');
  else perform tarif_neu_berechnen_verein(a.verein_id, 'admin_freischaltung_beendet'); end if;
  perform protokollieren('freischaltung_beendet', case when a.inhaber = 'person' then a.user_id end,
    jsonb_build_object('abo_id', a.id, 'lizenzart', abo_lizenzart(a), 'verein_id', a.verein_id));
  return jsonb_build_object('ok', true);
end;
$function$;
revoke all on function public.admin_freischaltung_beenden(uuid) from public, anon;
grant execute on function public.admin_freischaltung_beenden(uuid) to authenticated;

-- Manuelle Lizenz verlaengern bzw. Laufzeit aendern (NULL = unbefristet)
create or replace function public.admin_freischaltung_verlaengern(p_abo_id uuid, p_bis date)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a abos%rowtype;
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  select * into a from abos where id = p_abo_id;
  if a.id is null or a.anbieter <> 'manuell' or not abo_gilt(a) then
    raise exception 'Nur laufende manuelle Freischaltungen können verlängert werden.' using errcode = 'P0001';
  end if;
  if p_bis is not null and p_bis < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'Das Enddatum liegt in der Vergangenheit.' using errcode = 'P0001';
  end if;
  update abos set laeuft_bis = case when p_bis is null then null else tagesende_berlin(p_bis) end,
    periode = case when p_bis is null then 'unbefristet' else 'befristet' end, aktualisiert_am = now()
  where id = p_abo_id;
  if a.inhaber = 'person' then perform tarif_neu_berechnen_person(a.user_id, 'admin_verlaengert');
  else perform tarif_neu_berechnen_verein(a.verein_id, 'admin_verlaengert'); end if;
  perform protokollieren('lizenz_verlaengert', case when a.inhaber = 'person' then a.user_id end,
    jsonb_build_object('abo_id', a.id, 'lizenzart', abo_lizenzart(a), 'bis_vorher', a.laeuft_bis, 'bis', p_bis, 'verein_id', a.verein_id));
  return jsonb_build_object('ok', true);
end;
$function$;
revoke all on function public.admin_freischaltung_verlaengern(uuid, date) from public, anon;
grant execute on function public.admin_freischaltung_verlaengern(uuid, date) to authenticated;

-- Lizenzuebersicht fuer den TanzRaum-Admin: Personen mit Tarif, Status, Laufzeit, Art, Team, Verein, Notiz
create or replace function public.admin_lizenzen(p_q text default null)
 returns table(user_id uuid, name text, handle text, avatar_url text, email_maskiert text, tarif text, status text,
               start timestamptz, ablauf timestamptz, zahlungsart text, lizenzart text, abo_id uuid, abo_manuell boolean,
               team boolean, moderator boolean, verein text, notiz text, registriert_am timestamptz)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_q text := nullif(lower(btrim(coalesce(p_q, ''))), '');
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  return query
  with leute as (
    select p.* from profiles p
    left join auth.users u on u.id = p.id
    where not coalesce(p.ist_plattform_admin, false)
      and (v_q is null
        or lower(coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')) like '%' || v_q || '%'
        or lower(coalesce(p.handle, '')) like '%' || ltrim(v_q, '@') || '%'
        or lower(coalesce(u.email, '')) like '%' || v_q || '%')
      and (v_q is not null or exists (select 1 from abos a where a.inhaber = 'person' and a.user_id = p.id)
           or exists (select 1 from team_mitglieder t where t.user_id = p.id)
           or vereinslizenz_verein_von(p.id) is not null)
    order by p.created_at desc
    limit 300
  ), abo as (
    select distinct on (a.user_id) a.* from abos a
    where a.inhaber = 'person' and a.user_id in (select id from leute) and abo_gilt(a)
    order by a.user_id, (a.freischaltung = 'team_free') nulls first, a.erstellt_am desc
  )
  select l.id, profil_name(l.id), l.handle, l.avatar_url,
    (select case when u.email is null then null else left(split_part(u.email, '@', 1), 2) || '***@' || split_part(u.email, '@', 2) end
     from auth.users u where u.id = l.id),
    tarif_von(l.id),
    case when a.id is not null then
           case when a.laeuft_bis is not null and a.laeuft_bis <= now() then 'abgelaufen'
                when a.laeuft_bis is not null and a.laeuft_bis <= now() + interval '14 days' then 'laeuft_ab'
                when a.status = 'cancelled' then 'gekuendigt'
                when a.status = 'paused_by_organization' then 'pausiert'
                else 'aktiv' end
         when vereinslizenz_verein_von(l.id) is not null then 'aktiv'
         else 'free' end,
    a.erstellt_am, a.laeuft_bis, a.anbieter,
    case when a.id is not null then abo_lizenzart(a) when vereinslizenz_verein_von(l.id) is not null then 'VEREIN' end,
    a.id, a.anbieter = 'manuell',
    t.user_id is not null, coalesce(t.moderator, false),
    (select v.name from vereine v where v.id = offizieller_verein_von(l.id)),
    a.notiz, l.created_at
  from leute l
  left join abo a on a.user_id = l.id
  left join team_mitglieder t on t.user_id = l.id;
end;
$function$;
revoke all on function public.admin_lizenzen(text) from public, anon;
grant execute on function public.admin_lizenzen(text) to authenticated;

-- Alle laufenden Lizenzen einer Person (Detail in der Freischaltkarte)
create or replace function public.admin_lizenzen_person(p_user_id uuid)
 returns table(abo_id uuid, tarif text, lizenzart text, anbieter text, status text, periode text, start timestamptz, ablauf timestamptz, notiz text, verein text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  return query
  select a.id, a.tarif, abo_lizenzart(a), a.anbieter, a.status, a.periode, a.erstellt_am, a.laeuft_bis, a.notiz,
         (select v.name from vereine v where v.id = a.verein_id)
  from abos a
  where abo_gilt(a) and ((a.inhaber = 'person' and a.user_id = p_user_id)
     or (a.inhaber = 'verein' and a.verein_id = offizieller_verein_von(p_user_id)))
  order by a.erstellt_am desc;
end;
$function$;
revoke all on function public.admin_lizenzen_person(uuid) from public, anon;
grant execute on function public.admin_lizenzen_person(uuid) to authenticated;

-- =============================================================================================
-- 4) Team verwalten (nur TanzRaum-Admin) inkl. optionalem kostenlosem BASIC (TEAM_FREE)
-- =============================================================================================
create or replace function public.admin_team_liste()
 returns table(user_id uuid, name text, handle text, avatar_url text, moderator boolean, kennzeichnen boolean, alle_rechte boolean,
               rechte text[], notiz text, hinzugefuegt_am timestamptz, team_basic boolean, team_basic_bis timestamptz, tarif text, verein text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  return query
  select t.user_id, profil_name(t.user_id), p.handle, p.avatar_url, t.moderator, t.kennzeichnen, t.alle_rechte, t.rechte, t.notiz,
         t.hinzugefuegt_am,
         exists (select 1 from abos a where a.inhaber = 'person' and a.user_id = t.user_id and a.freischaltung = 'team_free' and abo_gilt(a)),
         (select a.laeuft_bis from abos a where a.inhaber = 'person' and a.user_id = t.user_id and a.freischaltung = 'team_free' and abo_gilt(a)
          order by a.erstellt_am desc limit 1),
         tarif_von(t.user_id),
         (select v.name from vereine v where v.id = offizieller_verein_von(t.user_id))
  from team_mitglieder t join profiles p on p.id = t.user_id
  order by t.hinzugefuegt_am;
end;
$function$;
revoke all on function public.admin_team_liste() from public, anon;
grant execute on function public.admin_team_liste() to authenticated;

-- Personen fuer „Teammitglied hinzufuegen“ / „Nutzer freischalten“ suchen (Name, @Nutzername, E-Mail)
create or replace function public.admin_personen_suche(p_q text)
 returns table(user_id uuid, name text, handle text, avatar_url text, email_maskiert text, tarif text, team boolean, verein text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_q text := lower(btrim(coalesce(p_q, '')));
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  if char_length(ltrim(v_q, '@')) < 2 then return; end if;
  return query
  select p.id, profil_name(p.id), p.handle, p.avatar_url,
    case when u.email is null then null else left(split_part(u.email, '@', 1), 2) || '***@' || split_part(u.email, '@', 2) end,
    tarif_von(p.id), exists (select 1 from team_mitglieder t where t.user_id = p.id),
    (select v.name from vereine v where v.id = offizieller_verein_von(p.id))
  from profiles p left join auth.users u on u.id = p.id
  where not coalesce(p.ist_plattform_admin, false)
    and (lower(coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')) like '%' || v_q || '%'
      or lower(coalesce(p.handle, '')) like '%' || ltrim(v_q, '@') || '%'
      or lower(coalesce(u.email, '')) = v_q)
  order by p.handle
  limit 20;
end;
$function$;
revoke all on function public.admin_personen_suche(text) from public, anon;
grant execute on function public.admin_personen_suche(text) to authenticated;

-- Teammitglied anlegen bzw. aendern. p_basic: kostenloses BASIC (TEAM_FREE) an/aus, p_basic_bis: NULL = unbefristet.
create or replace function public.admin_team_setzen(p_user_id uuid, p_moderator boolean, p_kennzeichnen boolean, p_alle_rechte boolean,
                                                    p_rechte text[], p_basic boolean, p_basic_bis date, p_notiz text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  alt team_mitglieder%rowtype;
  v_rechte text[];
  v_team_abo abos%rowtype;
  v_bis timestamptz := case when p_basic_bis is null then null else tagesende_berlin(p_basic_bis) end;
  v_neu boolean;
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  if p_user_id is null or not exists (select 1 from profiles p where p.id = p_user_id) then
    raise exception 'Nutzer nicht gefunden.' using errcode = 'P0001';
  end if;
  if exists (select 1 from profiles p where p.id = p_user_id and p.ist_plattform_admin) then
    raise exception 'Der TanzRaum-Admin ist kein Teammitglied – er hat ohnehin alle Rechte.' using errcode = 'P0001';
  end if;
  if p_basic and p_basic_bis is not null and p_basic_bis < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'Das Enddatum liegt in der Vergangenheit.' using errcode = 'P0001';
  end if;
  -- nur bekannte Rechte; eine Aktion braucht ihren Bereich
  v_rechte := array(select distinct x from unnest(coalesce(p_rechte, '{}')) x where x = any(team_rechte_katalog()) order by x);
  v_rechte := array(select x from unnest(v_rechte) x where position('.' in x) = 0 or split_part(x, '.', 1) = any(v_rechte));
  select * into alt from team_mitglieder where user_id = p_user_id;
  v_neu := alt.user_id is null;
  insert into team_mitglieder (user_id, moderator, kennzeichnen, alle_rechte, rechte, notiz, hinzugefuegt_von)
  values (p_user_id, coalesce(p_moderator, false), coalesce(p_kennzeichnen, true), coalesce(p_alle_rechte, false), v_rechte,
          nullif(left(btrim(coalesce(p_notiz, '')), 500), ''), auth.uid())
  on conflict (user_id) do update set moderator = excluded.moderator, kennzeichnen = excluded.kennzeichnen,
    alle_rechte = excluded.alle_rechte, rechte = excluded.rechte, notiz = excluded.notiz, geaendert_am = now();

  -- Kostenloses BASIC als Teammitglied (TEAM_FREE) – unabhaengig von MANUAL_FREE
  select * into v_team_abo from abos a where a.inhaber = 'person' and a.user_id = p_user_id and a.freischaltung = 'team_free' and abo_gilt(a)
  order by a.erstellt_am desc limit 1;
  if coalesce(p_basic, false) and v_team_abo.id is null then
    insert into abos (inhaber, user_id, tarif, periode, preis_cent, anbieter, status, laeuft_bis, freischaltung, erteilt_von)
    values ('person', p_user_id, 'basic', case when v_bis is null then 'unbefristet' else 'befristet' end, 0, 'manuell', 'active', v_bis, 'team_free', auth.uid());
    perform protokollieren('team_basic_freigeschaltet', p_user_id, jsonb_build_object('bis', p_basic_bis));
  elsif coalesce(p_basic, false) and v_team_abo.laeuft_bis is distinct from v_bis then
    update abos set laeuft_bis = v_bis, periode = case when v_bis is null then 'unbefristet' else 'befristet' end, aktualisiert_am = now()
    where id = v_team_abo.id;
    perform protokollieren('team_basic_verlaengert', p_user_id, jsonb_build_object('bis', p_basic_bis));
  elsif not coalesce(p_basic, false) and v_team_abo.id is not null then
    update abos set status = 'expired', laeuft_bis = least(coalesce(laeuft_bis, now()), now()), aktualisiert_am = now() where id = v_team_abo.id;
    perform protokollieren('team_basic_beendet', p_user_id, '{}'::jsonb);
  end if;
  perform tarif_neu_berechnen_person(p_user_id, 'team');

  if v_neu then
    perform protokollieren('team_hinzugefuegt', p_user_id,
      jsonb_build_object('moderator', coalesce(p_moderator, false), 'alle_rechte', coalesce(p_alle_rechte, false), 'rechte', v_rechte));
  else
    if alt.moderator is distinct from coalesce(p_moderator, false) then
      perform protokollieren(case when p_moderator then 'moderator_aktiviert' else 'moderator_deaktiviert' end, p_user_id, '{}'::jsonb);
    end if;
    if array(select unnest(v_rechte) except select unnest(alt.rechte)) <> '{}' or alt.alle_rechte is distinct from coalesce(p_alle_rechte, false) and p_alle_rechte then
      perform protokollieren('recht_vergeben', p_user_id, jsonb_build_object(
        'rechte', array(select unnest(v_rechte) except select unnest(alt.rechte)), 'alle_rechte', coalesce(p_alle_rechte, false)));
    end if;
    if array(select unnest(alt.rechte) except select unnest(v_rechte)) <> '{}' or alt.alle_rechte and not coalesce(p_alle_rechte, false) then
      perform protokollieren('recht_entfernt', p_user_id, jsonb_build_object(
        'rechte', array(select unnest(alt.rechte) except select unnest(v_rechte)), 'alle_rechte_entzogen', alt.alle_rechte and not coalesce(p_alle_rechte, false)));
    end if;
  end if;
  return jsonb_build_object('ok', true, 'tarif', tarif_von(p_user_id));
end;
$function$;
revoke all on function public.admin_team_setzen(uuid, boolean, boolean, boolean, text[], boolean, date, text) from public, anon;
grant execute on function public.admin_team_setzen(uuid, boolean, boolean, boolean, text[], boolean, date, text) to authenticated;

-- Teammitglied entfernen: Teamrechte weg; das kostenlose Team-BASIC nur auf Wunsch behalten
create or replace function public.admin_team_entfernen(p_user_id uuid, p_basic_behalten boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  if not exists (select 1 from team_mitglieder t where t.user_id = p_user_id) then
    raise exception 'Diese Person ist kein Teammitglied.' using errcode = 'P0001';
  end if;
  delete from team_mitglieder where user_id = p_user_id;
  if not coalesce(p_basic_behalten, false) then
    update abos set status = 'expired', laeuft_bis = least(coalesce(laeuft_bis, now()), now()), aktualisiert_am = now()
    where inhaber = 'person' and user_id = p_user_id and freischaltung = 'team_free' and abo_gilt(abos);
  end if;
  perform tarif_neu_berechnen_person(p_user_id, 'team_entfernt');
  perform protokollieren('team_entfernt', p_user_id, jsonb_build_object('basic_behalten', coalesce(p_basic_behalten, false)));
  return jsonb_build_object('ok', true, 'tarif', tarif_von(p_user_id));
end;
$function$;
revoke all on function public.admin_team_entfernen(uuid, boolean) from public, anon;
grant execute on function public.admin_team_entfernen(uuid, boolean) to authenticated;

-- Protokoll lesen (TanzRaum-Admin)
create or replace function public.admin_protokoll_liste(p_limit integer default 100)
 returns table(id uuid, akteur text, aktion text, ziel text, details jsonb, erstellt_am timestamptz)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  return query
  select a.id, coalesce(a.akteur_name, 'System'), a.aktion, a.ziel_name, a.details, a.erstellt_am
  from admin_protokoll a order by a.erstellt_am desc limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$function$;
revoke all on function public.admin_protokoll_liste(integer) from public, anon;
grant execute on function public.admin_protokoll_liste(integer) to authenticated;

-- =============================================================================================
-- 5) Mein Tarif & Lizenz: Lizenzart und Start je Abo ergaenzt
-- =============================================================================================
create or replace function public.mein_tarif_status()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $$
  with admin_v as (
    select v.* from vereine v where exists (select 1 from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
      where vm.verein_id = v.id and vm.user_id = auth.uid() and coalesce(vm.aktiv, true) and rollen_typ(r.name) = 'admin')
  ), offen as (
    select z.* from zahlungsaufforderungen z where z.status = 'offen' and z.verein_id in (select id from admin_v)
  )
  select jsonb_build_object(
    'zugang', effektiver_zugang(auth.uid()),
    'verein_name', (select v.name from vereine v where v.id = vereinslizenz_verein_von(auth.uid())),
    'vereinslizenz_bis', (select v.tarif_aktiv_bis from vereine v where v.id = vereinslizenz_verein_von(auth.uid())),
    'team', exists (select 1 from team_mitglieder t where t.user_id = auth.uid()),
    'abos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'tarif', a.tarif, 'periode', a.periode, 'preis_cent', a.preis_cent,
        'anbieter', a.anbieter, 'status', a.status, 'laeuft_bis', a.laeuft_bis, 'gekuendigt_zum', a.gekuendigt_zum,
        'pause_grund', a.pause_grund, 'pausiert_am', a.pausiert_am, 'pause_verein', (select v.name from vereine v where v.id = a.pause_verein_id),
        'lizenzart', abo_lizenzart(a), 'start', a.erstellt_am)
        order by a.erstellt_am desc)
      from abos a where a.inhaber = 'person' and a.user_id = auth.uid() and abo_gilt(a)), '[]'::jsonb),
    'admin_vereine', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'lizenz', verein_hat_lizenz(v.id),
        'lizenz_bis', v.tarif_aktiv_bis,
        'abo', (select jsonb_build_object('id', a.id, 'periode', a.periode, 'preis_cent', a.preis_cent, 'anbieter', a.anbieter, 'status', a.status,
                  'laeuft_bis', a.laeuft_bis, 'gekuendigt_zum', a.gekuendigt_zum, 'lizenzart', abo_lizenzart(a), 'start', a.erstellt_am)
                from abos a where a.inhaber = 'verein' and a.verein_id = v.id and abo_gilt(a) order by a.erstellt_am desc limit 1),
        'ueberweisung', (select jsonb_build_object('id', o.id, 'art', o.art, 'betrag_cent', o.betrag_cent, 'referenz', o.referenz,
                  'faellig_am', o.faellig_am, 'erstellt_am', o.erstellt_am, 'empfaenger_email', o.empfaenger_email)
                from offen o where o.verein_id = v.id order by o.erstellt_am desc limit 1))
        order by v.name)
      from admin_v v), '[]'::jsonb),
    'bank', case when exists (select 1 from offen) then
      (select jsonb_build_object('inhaber', p.bank_inhaber, 'iban', p.iban, 'bic', p.bic, 'bank', p.bank_name) from plattform_anbieter p where p.id = true)
      end,
    'ueberweisung_moeglich', exists (select 1 from plattform_anbieter p where p.id = true and p.iban is not null and p.bank_inhaber is not null));
$$;

-- Ablaufhinweise (Benachrichtigung): BASIC bzw. Vereinslizenz endet in 14 bzw. 3 Tagen und verlaengert sich nicht automatisch
create table if not exists public.lizenz_ablauf_hinweise (
  schluessel text primary key,
  erstellt_am timestamptz not null default now()
);
alter table public.lizenz_ablauf_hinweise enable row level security;
revoke all on public.lizenz_ablauf_hinweise from public, anon, authenticated;
grant all on public.lizenz_ablauf_hinweise to service_role;

create or replace function public.lizenz_ablauf_hinweise_senden()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  n int := 0;
  v_tage int;
begin
  for r in
    select a.id, a.inhaber, a.user_id, a.verein_id, a.laeuft_bis from abos a
    where abo_gilt(a) and a.laeuft_bis is not null and a.laeuft_bis > now() and a.laeuft_bis <= now() + interval '14 days'
      and (a.status = 'cancelled' or a.anbieter in ('manuell', 'ueberweisung'))
  loop
    v_tage := greatest(0, ((r.laeuft_bis at time zone 'Europe/Berlin')::date - (now() at time zone 'Europe/Berlin')::date));
    continue when v_tage > 14;
    -- je Lizenz hoechstens zwei Hinweise: bei <= 14 und bei <= 3 Tagen
    if not exists (select 1 from lizenz_ablauf_hinweise h where h.schluessel = r.id || ':' || case when v_tage <= 3 then '3' else '14' end) then
      insert into lizenz_ablauf_hinweise (schluessel) values (r.id || ':' || case when v_tage <= 3 then '3' else '14' end);
      if r.inhaber = 'person' then
        insert into benachrichtigungen (user_id, typ, text)
        values (r.user_id, 'lizenz_ablauf', 'Deine BASIC-Lizenz ist noch ' || v_tage || ' Tag' || case when v_tage = 1 then '' else 'e' end
                || ' gültig (bis ' || to_char(r.laeuft_bis at time zone 'Europe/Berlin', 'DD.MM.YYYY') || ').');
      else
        insert into benachrichtigungen (user_id, typ, text)
        select vm.user_id, 'lizenz_ablauf', 'Die Vereinslizenz von ' || v.name || ' ist noch ' || v_tage || ' Tag' || case when v_tage = 1 then '' else 'e' end
               || ' gültig (bis ' || to_char(r.laeuft_bis at time zone 'Europe/Berlin', 'DD.MM.YYYY') || ').'
        from vereins_mitglieder vm join rollen ro on ro.id = vm.rolle_id join vereine v on v.id = vm.verein_id
        where vm.verein_id = r.verein_id and vm.user_id is not null and coalesce(vm.aktiv, true) and rollen_typ(ro.name) = 'admin';
      end if;
      n := n + 1;
    end if;
  end loop;
  delete from lizenz_ablauf_hinweise where erstellt_am < now() - interval '400 days';
  return n;
end;
$function$;
revoke all on function public.lizenz_ablauf_hinweise_senden() from public, anon, authenticated;
grant execute on function public.lizenz_ablauf_hinweise_senden() to service_role;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    begin
      perform cron.unschedule('lizenz-ablauf-hinweise');
    exception when others then null;
    end;
    perform cron.schedule('lizenz-ablauf-hinweise', '13 7 * * *', 'select public.lizenz_ablauf_hinweise_senden()');
  end if;
end $$;

-- =============================================================================================
-- 6) Navigation (nur Anzeige – vergibt und entzieht nie Rechte)
-- =============================================================================================
-- a) Admin-Navigation: der TanzRaum-Admin blendet Punkte seiner eigenen Navigation aus (Reihenfolge: meine_navigation)
alter table public.profiles add column if not exists navigation_ausgeblendet text[];
comment on column public.profiles.navigation_ausgeblendet is 'Nur Anzeige: vom TanzRaum-Admin ausgeblendete Punkte der eigenen Admin-Navigation (Rechte bleiben)';

create or replace function public.meine_navigation_ausgeblendet()
 returns text[]
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when p.ist_plattform_admin then p.navigation_ausgeblendet end from profiles p where p.id = auth.uid();
$function$;
revoke all on function public.meine_navigation_ausgeblendet() from public, anon;
grant execute on function public.meine_navigation_ausgeblendet() to authenticated;

create or replace function public.admin_navigation_ausblenden(p_hrefs text[])
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v text[];
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  if coalesce(array_length(p_hrefs, 1), 0) > 100 then raise exception 'Zu viele Einträge.' using errcode = 'P0001'; end if;
  v := array(select distinct x from unnest(coalesce(p_hrefs, '{}')) x where x ~ '^/[a-z0-9/#_-]{1,80}$' and x <> '/dashboard/einstellungen' order by x);
  update profiles set navigation_ausgeblendet = case when v = '{}' then null else v end where id = auth.uid();
  perform protokollieren('navigation_geaendert', null, jsonb_build_object('admin_ausgeblendet', v));
end;
$function$;
revoke all on function public.admin_navigation_ausblenden(text[]) from public, anon;
grant execute on function public.admin_navigation_ausblenden(text[]) to authenticated;

-- b) Globale Nutzer-Navigation: Sichtbarkeit je Bereich und Tarif ({"/dashboard/workshops": ["free","basic","verein"], …}).
--    Fehlt ein Bereich, gilt er fuer alle Tarife (Standard). Zugriff prueft weiterhin jede Seite/Funktion selbst.
alter table public.plattform_einstellungen add column if not exists navigation_tarife jsonb not null default '{}'::jsonb;
alter table public.plattform_einstellungen drop constraint if exists plattform_navigation_tarife_objekt;
alter table public.plattform_einstellungen add constraint plattform_navigation_tarife_objekt check (jsonb_typeof(navigation_tarife) = 'object');
grant select (navigation_tarife) on public.plattform_einstellungen to authenticated;

create or replace function public.admin_navigation_tarife_setzen(p_einstellung jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  k text;
  w jsonb;
  v jsonb := '{}'::jsonb;
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  if jsonb_typeof(coalesce(p_einstellung, '{}'::jsonb)) <> 'object' then raise exception 'Ungültige Einstellung.' using errcode = 'P0001'; end if;
  for k, w in select * from jsonb_each(coalesce(p_einstellung, '{}'::jsonb)) loop
    if k !~ '^/[a-z0-9/#_-]{1,80}$' or jsonb_typeof(w) <> 'array' then raise exception 'Ungültiger Bereich.' using errcode = 'P0001'; end if;
    if exists (select 1 from jsonb_array_elements_text(w) t where t not in ('free', 'basic', 'verein')) then
      raise exception 'Ungültiger Tarif.' using errcode = 'P0001';
    end if;
    v := v || jsonb_build_object(k, (select coalesce(jsonb_agg(distinct t), '[]'::jsonb) from jsonb_array_elements_text(w) t));
  end loop;
  if (select count(*) from jsonb_object_keys(v)) > 100 then raise exception 'Zu viele Bereiche.' using errcode = 'P0001'; end if;
  update plattform_einstellungen set navigation_tarife = v, geaendert_am = now(), geaendert_von = auth.uid() where id;
  perform protokollieren('navigation_geaendert', null, jsonb_build_object('tarife', v));
end;
$function$;
revoke all on function public.admin_navigation_tarife_setzen(jsonb) from public, anon;
grant execute on function public.admin_navigation_tarife_setzen(jsonb) to authenticated;

-- c) Vereine koennen „Workshops“ fuer ihre Vereinsumgebung ausblenden (Vereinsmodul; global bleibt der Bereich an)
create or replace function public.vereins_module()
 returns text[]
 language sql
 immutable
 set search_path to 'public'
as $function$
  select array['training', 'anwesenheit', 'kalender', 'saisonplanung', 'turniere', 'news', 'chat', 'dateien',
               'fahrgemeinschaften', 'kostueme', 'finanzen', 'musik', 'statistiken', 'trainer_netzwerk', 'workshops'];
$function$;

-- =============================================================================================
-- 7) Team-Rechte fuer bestehende zentrale Bereiche (News, Spotlight-Meldungen, Konten sperren)
-- =============================================================================================
-- News: TanzRaum-Ankuendigungen und „Updates & Neuigkeiten“
drop policy if exists "Plattformadmin verwaltet Ankuendigungen" on public.plattform_ankuendigungen;
create policy "Plattformadmin verwaltet Ankuendigungen" on public.plattform_ankuendigungen for all to authenticated
  using (ist_plattform_admin_aktuell() or team_darf('news.verwalten')) with check (ist_plattform_admin_aktuell() or team_darf('news.verwalten'));

drop policy if exists "Plattformadmin laedt Ankuendigungsbilder hoch" on storage.objects;
create policy "Plattformadmin laedt Ankuendigungsbilder hoch" on storage.objects for insert to authenticated
  with check (bucket_id = 'ankuendigungen' and (public.ist_plattform_admin_aktuell() or public.team_darf('news.verwalten')));
drop policy if exists "Plattformadmin ersetzt Ankuendigungsbilder" on storage.objects;
create policy "Plattformadmin ersetzt Ankuendigungsbilder" on storage.objects for update to authenticated
  using (bucket_id = 'ankuendigungen' and (public.ist_plattform_admin_aktuell() or public.team_darf('news.verwalten')));
drop policy if exists "Plattformadmin loescht Ankuendigungsbilder" on storage.objects;
create policy "Plattformadmin loescht Ankuendigungsbilder" on storage.objects for delete to authenticated
  using (bucket_id = 'ankuendigungen' and (public.ist_plattform_admin_aktuell() or public.team_darf('news.verwalten')));

do $$
declare
  f text := pg_get_functiondef('public.ankuendigungen_admin()'::regprocedure);
  alt text := 'from plattform_ankuendigungen a where ist_plattform_admin_aktuell()';
begin
  if position(alt in f) = 0 then raise exception 'ankuendigungen_admin: erwartete Stelle nicht gefunden'; end if;
  execute replace(f, alt, 'from plattform_ankuendigungen a where (ist_plattform_admin_aktuell() or team_darf(''news.verwalten''))');
end $$;

-- Spotlight-Meldungen: Teammitglieder mit „spotlight.meldungen_bearbeiten“ sehen und bearbeiten Meldungen zu Spotlights;
-- Konten sperren nur mit „nutzer.sperren“. Alles andere bleibt beim TanzRaum-Admin.
alter table public.meldungen add column if not exists bereich text not null default 'allgemein';
alter table public.meldungen drop constraint if exists meldungen_bereich_check;
alter table public.meldungen add constraint meldungen_bereich_check check (bereich in ('allgemein', 'treff'));

CREATE OR REPLACE FUNCTION public.meldung_bearbeiten(p_id uuid, p_notiz text, p_spotlight_entfernen boolean, p_konto_sperren boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m meldungen%rowtype;
  v_admin boolean := ist_plattform_admin_aktuell();
begin
  select * into m from meldungen where id = p_id;
  if m.id is null then raise exception 'Meldung nicht gefunden.' using errcode = 'P0001'; end if;
  if not (v_admin or (m.bereich = 'allgemein' and m.spotlight_id is not null and team_darf('spotlight.meldungen_bearbeiten'))) then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  if coalesce(p_spotlight_entfernen, false) and m.spotlight_id is not null then
    update spotlights set entfernt_am = now(), ablauf_am = least(ablauf_am, now()) where id = m.spotlight_id;
  end if;
  if coalesce(p_konto_sperren, false) and m.ziel_user_id is not null
     and not exists (select 1 from profiles p where p.id = m.ziel_user_id and p.ist_plattform_admin) then
    if not (v_admin or team_darf('nutzer.sperren')) then
      raise exception 'Konten sperren darf nur, wer dieses Recht hat.' using errcode = '42501';
    end if;
    if not v_admin and exists (select 1 from team_mitglieder t where t.user_id = m.ziel_user_id) then
      raise exception 'Teammitglieder kann nur der TanzRaum-Admin sperren.' using errcode = '42501';
    end if;
    update profiles set gesperrt = true where id = m.ziel_user_id;
    perform protokollieren('nutzer_gesperrt', m.ziel_user_id, jsonb_build_object('meldung_id', m.id));
  end if;
  update meldungen set status = 'erledigt', admin_notiz = nullif(left(btrim(coalesce(p_notiz, '')), 2000), ''),
    bearbeitet_von = auth.uid(), bearbeitet_am = now()
  where id = p_id;
  if not v_admin then
    perform protokollieren('meldung_bearbeitet', m.ziel_user_id, jsonb_build_object('meldung_id', m.id,
      'spotlight_entfernt', coalesce(p_spotlight_entfernen, false), 'konto_gesperrt', coalesce(p_konto_sperren, false)));
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.meldungen_admin(p_status text)
 RETURNS TABLE(id uuid, grund text, text text, status text, erstellt_am timestamp with time zone, melder text, ziel_user_id uuid, ziel text, ziel_gesperrt boolean, spotlight_id uuid, spotlight_typ text, spotlight_text text, spotlight_pfad text, spotlight_entfernt boolean, admin_notiz text, bearbeitet_am timestamp with time zone, anzahl_zum_ziel integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_admin boolean := ist_plattform_admin_aktuell();
begin
  if not (v_admin or team_darf('spotlight.meldungen_bearbeiten')) then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  return query
  select m.id, m.grund, m.text, m.status, m.erstellt_am,
    coalesce((select a.anzeige from anzeige_namen(array[m.melder_id]) a), 'Gelöschtes Konto'),
    m.ziel_user_id,
    coalesce((select a.anzeige from anzeige_namen(array[m.ziel_user_id]) a), 'Gelöschtes Konto'),
    coalesce((select p.gesperrt from profiles p where p.id = m.ziel_user_id), false),
    m.spotlight_id, s.media_typ, s.text_overlay, s.media_path, s.entfernt_am is not null,
    m.admin_notiz, m.bearbeitet_am,
    (select count(*)::int from meldungen x where x.ziel_user_id = m.ziel_user_id)
  from meldungen m left join spotlights s on s.id = m.spotlight_id
  where m.bereich = 'allgemein' and (p_status is null or m.status = p_status)
    and (v_admin or m.spotlight_id is not null)
  order by m.status = 'offen' desc, m.erstellt_am desc
  limit 200;
end;
$function$;

-- Konto sperren/entsperren (Team mit „nutzer.sperren“; nie Plattform-Admin, Teammitglieder nur durch den Admin)
create or replace function public.team_konto_sperren(p_user_id uuid, p_gesperrt boolean, p_grund text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_admin boolean := ist_plattform_admin_aktuell();
begin
  if not (v_admin or team_darf('nutzer.sperren')) then raise exception 'Dafür fehlt dir das Recht „Nutzer sperren“.' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'Das eigene Konto kann nicht gesperrt werden.' using errcode = 'P0001'; end if;
  if exists (select 1 from profiles p where p.id = p_user_id and p.ist_plattform_admin) then
    raise exception 'Der TanzRaum-Admin kann nicht gesperrt werden.' using errcode = '42501';
  end if;
  if not v_admin and exists (select 1 from team_mitglieder t where t.user_id = p_user_id) then
    raise exception 'Teammitglieder kann nur der TanzRaum-Admin sperren.' using errcode = '42501';
  end if;
  update profiles set gesperrt = coalesce(p_gesperrt, false) where id = p_user_id;
  if not found then raise exception 'Nutzer nicht gefunden.' using errcode = 'P0001'; end if;
  perform protokollieren(case when p_gesperrt then 'nutzer_gesperrt' else 'nutzer_entsperrt' end, p_user_id,
    jsonb_build_object('grund', nullif(left(btrim(coalesce(p_grund, '')), 500), '')));
end;
$function$;
revoke all on function public.team_konto_sperren(uuid, boolean, text) from public, anon;
grant execute on function public.team_konto_sperren(uuid, boolean, text) to authenticated;

-- Nutzersuche fuer das Team (nur Name, @Nutzername, Tarif, Sperrstatus – keine E-Mail, keine Vereins- oder Mitgliederdaten)
create or replace function public.team_nutzer_suche(p_q text)
 returns table(user_id uuid, name text, handle text, avatar_url text, tarif text, gesperrt boolean, team boolean)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_q text := lower(btrim(coalesce(p_q, '')));
begin
  if not (ist_plattform_admin_aktuell() or team_darf('nutzer.ansehen') or team_darf('nutzer.sperren')) then
    raise exception 'Dafür fehlt dir das Recht „Nutzerverwaltung“.' using errcode = '42501';
  end if;
  if char_length(ltrim(v_q, '@')) < 2 then return; end if;
  return query
  select p.id, '@' || p.handle, p.handle, p.avatar_url, tarif_von(p.id), coalesce(p.gesperrt, false),
         exists (select 1 from team_mitglieder t where t.user_id = p.id)
  from profiles p
  where not coalesce(p.ist_plattform_admin, false) and lower(coalesce(p.handle, '')) like '%' || ltrim(v_q, '@') || '%'
  order by p.handle limit 20;
end;
$function$;
revoke all on function public.team_nutzer_suche(text) from public, anon;
grant execute on function public.team_nutzer_suche(text) to authenticated;

-- Datenexport/Kontoloeschung: Team-Eintrag gehoert zum Konto (ON DELETE CASCADE); Protokolleintraege bleiben anonymisiert
-- (akteur_id/ziel_user_id werden beim Loeschen des Profils auf NULL gesetzt, die Namen bleiben als Momentaufnahme).
