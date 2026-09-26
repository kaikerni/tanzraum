-- TanzRaum – Baseline-Migration 3/12: Funktionen (244)
-- Exportiert aus dem Produktionsstand (Supabase-Projekt oraiqjulxmohclfixwdq) am 2026-09-25.
-- Nur für den Aufbau einer NEUEN/LEEREN Supabase-Datenbank gedacht.
-- NICHT gegen die Produktions-DB ausführen (dort existiert alles bereits) – siehe README.md.

-- Funktionsrümpfe verweisen gegenseitig aufeinander; Prüfung erst zur Laufzeit.
set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.abo_abgleich_liste()
 RETURNS TABLE(abo_id uuid, anbieter text, anbieter_abo_id text, aktion text, verein_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, a.anbieter, a.anbieter_abo_id, 'pausieren'::text, vereinslizenz_verein_von(a.user_id)
  from abos a
  where a.inhaber = 'person' and a.status in ('active', 'trialing') and a.gekuendigt_zum is null
    and vereinslizenz_verein_von(a.user_id) is not null
    and (a.anbieter = 'manuell' or a.anbieter_abo_id is not null)
  union all
  select a.id, a.anbieter, a.anbieter_abo_id, 'fortsetzen'::text, null::uuid
  from abos a
  where a.inhaber = 'person' and a.status = 'paused_by_organization' and vereinslizenz_verein_von(a.user_id) is null;
$function$
;

CREATE OR REPLACE FUNCTION public.abo_aktualisieren(p_abo_id uuid, p_status text, p_laeuft_bis timestamp with time zone, p_gekuendigt_zum timestamp with time zone, p_anbieter_abo_id text, p_anbieter_kunde_id text, p_grund text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a abos%rowtype;
begin
  select * into a from abos where id = p_abo_id for update;
  if a.id is null then raise exception 'Abo nicht gefunden'; end if;
  if p_status is not null and p_status not in ('pending', 'active', 'trialing', 'past_due', 'cancelled', 'expired', 'paused_by_organization') then
    raise exception 'Ungueltiger Status';
  end if;
  update abos set
    -- eine von TanzRaum veranlasste Pause hebt nur der Abgleich auf, nicht eine Anbieter-Meldung
    status = case when a.status = 'paused_by_organization' and p_status in ('active', 'trialing', 'past_due') then a.status
                  when a.status = 'expired' and p_status is distinct from 'active' then a.status
                  else coalesce(p_status, a.status) end,
    laeuft_bis = coalesce(p_laeuft_bis, a.laeuft_bis),
    gekuendigt_zum = case when p_status = 'active' and p_gekuendigt_zum is null then null else coalesce(p_gekuendigt_zum, a.gekuendigt_zum) end,
    gekuendigt_am = case when p_gekuendigt_zum is not null and a.gekuendigt_zum is null then now() else a.gekuendigt_am end,
    anbieter_abo_id = coalesce(a.anbieter_abo_id, p_anbieter_abo_id),
    anbieter_kunde_id = coalesce(p_anbieter_kunde_id, a.anbieter_kunde_id),
    letzter_fehler = case when p_status = 'past_due' then coalesce(p_grund, 'Zahlung fehlgeschlagen') else null end,
    aktualisiert_am = now()
  where id = a.id;
  if a.status = 'pending' and exists (select 1 from abos x where x.id = a.id and x.status in ('active', 'trialing')) then
    perform kauf_melden(a.id);
  end if;
  if a.inhaber = 'person' then perform tarif_neu_berechnen_person(a.user_id, p_grund);
  else perform tarif_neu_berechnen_verein(a.verein_id, p_grund); end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.abo_anlegen(p_tarif text, p_periode text, p_anbieter text, p_verein_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_preis int;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if p_anbieter not in ('stripe', 'paypal') then raise exception 'Unbekannte Zahlungsart.' using errcode = 'P0001'; end if;
  select preis_cent into v_preis from tarif_preise where tarif = p_tarif and periode = p_periode;
  if v_preis is null then raise exception 'Unbekannter Tarif.' using errcode = 'P0001'; end if;
  delete from abos where status = 'pending' and user_id = auth.uid() and erstellt_am < now() - interval '1 minute';
  if p_tarif = 'basic' then
    if exists (select 1 from abos a where a.inhaber = 'person' and a.user_id = auth.uid() and abo_gilt(a)) then
      raise exception 'Du hast BASIC bereits.' using errcode = 'P0001';
    end if;
    if vereinslizenz_verein_von(auth.uid()) is not null then
      raise exception 'Du bist bereits über die Vereinslizenz deines Vereins freigeschaltet – BASIC brauchst du nicht zusätzlich.' using errcode = 'P0001';
    end if;
    insert into abos (inhaber, user_id, tarif, periode, preis_cent, anbieter) values ('person', auth.uid(), 'basic', p_periode, v_preis, p_anbieter)
    returning id into v_id;
  else
    if p_verein_id is null or not exists (
        select 1 from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
        where vm.verein_id = p_verein_id and vm.user_id = auth.uid() and coalesce(vm.aktiv, true) and rollen_typ(r.name) = 'admin') then
      raise exception 'Die Vereinslizenz kann nur der Vereinsadmin kaufen.' using errcode = '42501';
    end if;
    if exists (select 1 from abos a where a.inhaber = 'verein' and a.verein_id = p_verein_id and abo_gilt(a)) then
      raise exception 'Dieser Verein hat bereits eine aktive Vereinslizenz.' using errcode = 'P0001';
    end if;
    insert into abos (inhaber, user_id, verein_id, tarif, periode, preis_cent, anbieter) values ('verein', auth.uid(), p_verein_id, 'verein', p_periode, v_preis, p_anbieter)
    returning id into v_id;
  end if;
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.abo_darf_verwalten(p_abo_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from abos a where a.id = p_abo_id and (
    (a.inhaber = 'person' and a.user_id = auth.uid())
    or (a.inhaber = 'verein' and exists (select 1 from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
         where vm.verein_id = a.verein_id and vm.user_id = auth.uid() and coalesce(vm.aktiv, true) and rollen_typ(r.name) = 'admin'))));
$function$
;

CREATE OR REPLACE FUNCTION public.abo_gilt(a public.abos)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select a.status in ('active', 'trialing', 'past_due', 'paused_by_organization')
      or (a.status = 'cancelled' and (a.laeuft_bis is null or a.laeuft_bis > now()));
$function$
;

CREATE OR REPLACE FUNCTION public.abo_pause_setzen(p_abo_id uuid, p_pausieren boolean, p_verein_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a abos%rowtype;
begin
  select * into a from abos where id = p_abo_id for update;
  if a.id is null or a.inhaber <> 'person' then raise exception 'Abo nicht gefunden'; end if;
  if p_pausieren then
    update abos set status = 'paused_by_organization', pause_grund = 'Vereinslizenz deckt den Zugang ab',
      pause_verein_id = p_verein_id, pausiert_am = now(), reaktiviert_am = null, aktualisiert_am = now()
    where id = a.id and status in ('active', 'trialing');
  else
    update abos set status = 'active', reaktiviert_am = now(), aktualisiert_am = now()
    where id = a.id and status = 'paused_by_organization';
  end if;
  perform tarif_neu_berechnen_person(a.user_id, case when p_pausieren then 'pausiert_durch_verein' else 'fortgesetzt_nach_verein' end);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.abos_ablaufen()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
begin
  for r in update abos set status = 'expired', aktualisiert_am = now()
           where status = 'cancelled' and laeuft_bis is not null and laeuft_bis <= now()
           returning inhaber, user_id, verein_id loop
    if r.inhaber = 'person' then perform tarif_neu_berechnen_person(r.user_id, 'abgelaufen');
    else perform tarif_neu_berechnen_verein(r.verein_id, 'abgelaufen'); end if;
  end loop;
  delete from abos where status = 'pending' and erstellt_am < now() - interval '2 days';
  insert into vereins_lizenz_abdeckungen (verein_id, user_id, vereins_mitglied_id, status, source, starts_at)
  select vm.verein_id, vm.user_id, vm.id, 'active', 'club_license', now()
  from vereins_mitglieder vm
  where vm.user_id is not null and coalesce(vm.aktiv, true) and verein_hat_lizenz(vm.verein_id)
    and not exists (select 1 from vereins_lizenz_abdeckungen d where d.vereins_mitglied_id = vm.id and d.status = 'active');
  update vereins_lizenz_abdeckungen d set status = 'ended', ended_at = now(), ends_at = now()
  where d.status = 'active' and not exists (
    select 1 from vereins_mitglieder vm where vm.id = d.vereins_mitglied_id and coalesce(vm.aktiv, true) and verein_hat_lizenz(vm.verein_id));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.accept_invite(p_token text, p_user_id uuid)
 RETURNS TABLE(success boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_invite record;
  v_existing_id uuid;
  v_rolle_id uuid;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    return query select false, 'Einladungen koennen nur fuer das eigene Konto angenommen werden';
    return;
  end if;

  select * into v_invite from invite_links
  where token = p_token and used_by is null and expires_at > now();

  if not found then
    return query select false, 'Einladung ungültig oder abgelaufen';
    return;
  end if;

  if v_invite.type = 'verein_beitritt' then
    if not exists (
      select 1 from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
      where vm.user_id = v_invite.created_by and vm.verein_id = v_invite.ziel_verein_id and rollen_typ(r.name) = 'admin') then
      return query select false, 'Einladung ungültig: nur der Vereinsadmin kann in seinen Verein einladen';
      return;
    end if;
    select id into v_rolle_id from rollen where name = v_invite.ziel_rolle limit 1;
    if v_rolle_id is null then
      select id into v_rolle_id from rollen where lower(name) like '%tänzer%' limit 1;
    end if;
    insert into vereins_mitglieder (user_id, verein_id, rolle_id)
    values (p_user_id, v_invite.ziel_verein_id, v_rolle_id)
    on conflict do nothing;
    update invite_links set used_by = p_user_id, used_at = now() where id = v_invite.id;
    return query select true, 'Beigetreten';
    return;
  end if;

  if v_invite.created_by = p_user_id then
    return query select false, 'Eigene Einladung kann nicht angenommen werden';
    return;
  end if;

  select id into v_existing_id from connections
  where (user_id = v_invite.created_by and connected_to = p_user_id)
     or (user_id = p_user_id and connected_to = v_invite.created_by)
  limit 1;

  if v_existing_id is not null then
    update connections set status = 'accepted' where id = v_existing_id;
  else
    insert into connections (user_id, connected_to, status)
    values (v_invite.created_by, p_user_id, 'accepted');
  end if;

  update invite_links set used_by = p_user_id, used_at = now() where id = v_invite.id;

  return query select true, 'Verbunden';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_abmeldungen_heute()
 RETURNS TABLE(name text, gruppe_name text, grund text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from profiles pchk where pchk.id = auth.uid() and pchk.ist_plattform_admin = true) then
    raise exception 'Nur fuer Plattform-Admins';
  end if;

  return query
  select coalesce(p.vorname || ' ' || p.nachname, 'Unbekannt'), g.name, ta.grund
  from trainings_abmeldungen ta
  join vereins_mitglieder vm on vm.id = ta.vereins_mitglied_id
  join profiles p on p.id = vm.user_id
  left join gruppen g on g.id = ta.gruppe_id
  where ta.datum = current_date;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_alle_rechnungen()
 RETURNS TABLE(id uuid, nummer text, typ text, empfaenger_name text, empfaenger_adresse text, empfaenger_email text, leistung text, zeitraum text, betrag numeric, zahlungsweg text, rechnungsdatum date, versendet boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from profiles pchk where pchk.id=auth.uid() and pchk.ist_plattform_admin=true) then
    raise exception 'Nur fuer Plattform-Admins';
  end if;
  return query
  select r.id, r.nummer, r.typ, r.empfaenger_name, r.empfaenger_adresse, r.empfaenger_email,
    r.leistung, r.zeitraum, r.betrag, r.zahlungsweg, r.rechnungsdatum, r.versendet
  from rechnungen r
  order by r.rechnungsdatum desc, r.nummer desc;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_dashboard_kpis()
 RETURNS TABLE(mitglieder_gesamt bigint, vereine_gesamt bigint, turniere_kommende_30_tage bigint, trainingsbeteiligung_prozent numeric, trainingsbeteiligung_vormonat_prozent numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from profiles pchk where pchk.id = auth.uid() and pchk.ist_plattform_admin = true) then
    raise exception 'Nur fuer Plattform-Admins';
  end if;

  return query
  select
    (select count(*) from vereins_mitglieder),
    (select count(*) from vereine),
    (select count(*) from turniere t
       where exists (
         select 1 from jsonb_array_elements(t.tage) tag
         where (tag->>'datum')::date between current_date and current_date + interval '30 days'
       )),
    (select round(100.0 * count(*) filter (where anwesend), 1)
       / nullif(count(*), 0)
     from trainings_anwesenheit
     where datum >= date_trunc('month', current_date)),
    (select round(100.0 * count(*) filter (where anwesend), 1)
       / nullif(count(*), 0)
     from trainings_anwesenheit
     where datum >= date_trunc('month', current_date - interval '1 month')
       and datum < date_trunc('month', current_date));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_naechste_termine(p_anzahl integer DEFAULT 8)
 RETURNS TABLE(typ text, titel text, ort text, datum date, von time without time zone, bis time without time zone, wiederholend boolean, wochentag integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from profiles pchk where pchk.id = auth.uid() and pchk.ist_plattform_admin = true) then
    raise exception 'Nur fuer Plattform-Admins';
  end if;

  return query
  (
    select 'training'::text, coalesce(tt.titel, 'Training'), tt.halle, tt.datum, tt.von, tt.bis,
      tt.ist_wiederholend, tt.wochentag
    from trainingstermine tt
    where tt.ist_wiederholend = true
       or (tt.datum is not null and tt.datum between current_date and current_date + interval '30 days')
  )
  union all
  (
    select 'turnier'::text, t.name, t.ort, (tag->>'datum')::date, null::time, null::time, false, null::int
    from turniere t, jsonb_array_elements(t.tage) tag
    where (tag->>'datum')::date between current_date and current_date + interval '30 days'
  )
  order by wiederholend desc, datum nulls last
  limit p_anzahl;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_offene_beitraege(p_anzahl integer DEFAULT 10)
 RETURNS TABLE(empfaenger text, verein_name text, betrag numeric, faellig date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from profiles pchk where pchk.id = auth.uid() and pchk.ist_plattform_admin = true) then
    raise exception 'Nur fuer Plattform-Admins';
  end if;

  return query
  select coalesce(p.vorname || ' ' || p.nachname, 'Unbekannt'), v.name, b.betrag, b.faellig
  from beitraege b
  join vereine v on v.id = b.verein_id
  left join vereins_mitglieder vm on vm.id = b.vereins_mitglied_id
  left join profiles p on p.id = vm.user_id
  where b.bezahlt = false and b.faellig < current_date
  order by b.faellig asc
  limit p_anzahl;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_offene_rechnungen()
 RETURNS TABLE(id uuid, typ text, name text, email text, tarif text, periode text, betrag numeric, erstellt_am timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from profiles pchk where pchk.id=auth.uid() and pchk.ist_plattform_admin=true) then
    raise exception 'Nur fuer Plattform-Admins';
  end if;
  return query
  select r.id, r.typ,
    coalesce(v.name, (p.vorname || ' ' || p.nachname)) as name,
    coalesce(vu.email::text, u.email::text) as email,
    r.tarif, r.periode, r.betrag, r.erstellt_am
  from ueberweisungs_rechnungen r
  left join profiles p on p.id = r.ziel_user_id
  left join auth.users u on u.id = r.ziel_user_id
  left join vereine v on v.id = r.ziel_verein_id
  left join vereins_mitglieder vm on vm.verein_id = v.id
  left join rollen rr on rr.id = vm.rolle_id and lower(rr.name) like '%admin%'
  left join auth.users vu on vu.id = vm.user_id and rr.id is not null
  where r.status = 'offen'
  order by r.erstellt_am asc;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_personen_uebersicht()
 RETURNS TABLE(id uuid, vorname text, nachname text, handle text, email text, registriert_am timestamp with time zone, tarif text, geschlecht text, telefon text, verein_name text, verein_rolle text, gesperrt boolean, letzte_ip text, letzter_login timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from profiles pchk where pchk.id = auth.uid() and pchk.ist_plattform_admin = true) then
    raise exception 'Nur fuer Plattform-Admins';
  end if;
  return query
  select p.id, p.vorname, p.nachname, p.handle, u.email::text,
    p.created_at, p.tarif, p.geschlecht, p.telefon, v.name, r.name, p.gesperrt,
    li.ip_adresse, li.eingeloggt_am
  from profiles p
  join auth.users u on u.id = p.id
  left join vereins_mitglieder vm on vm.user_id = p.id
  left join vereine v on v.id = vm.verein_id
  left join rollen r on r.id = vm.rolle_id
  left join lateral (
    select ip_adresse, eingeloggt_am from login_ips where user_id = p.id order by eingeloggt_am desc limit 1
  ) li on true
  order by p.created_at desc;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_push_ziele(p_geheimnis text)
 RETURNS TABLE(abo_id uuid, endpoint text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_geheimnis is null or p_geheimnis <> (select decrypted_secret from vault.decrypted_secrets where name = 'chat_push_geheimnis') then
    raise exception 'Nicht berechtigt' using errcode = '42501';
  end if;
  return query select ps.id, ps.endpoint from push_subscriptions ps join profiles p on p.id = ps.user_id where p.ist_plattform_admin;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_rechnung_bestaetigen(p_rechnung_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r ueberweisungs_rechnungen%rowtype; v_neue_rechnung_id uuid;
begin
  if not exists (select 1 from profiles pchk where pchk.id=auth.uid() and pchk.ist_plattform_admin=true) then
    raise exception 'Nur fuer Plattform-Admins';
  end if;
  select * into r from ueberweisungs_rechnungen where id = p_rechnung_id;
  if not found then return jsonb_build_object('success', false, 'error', 'Rechnung nicht gefunden'); end if;

  update ueberweisungs_rechnungen set status='bezahlt', bezahlt_am=now() where id = p_rechnung_id;

  if r.typ = 'basic' then
    update profiles set tarif = r.tarif where id = r.ziel_user_id;
  else
    update vereine set tarif = r.tarif where id = r.ziel_verein_id;
  end if;

  v_neue_rechnung_id := erstelle_rechnung(r.typ, r.ziel_user_id, r.ziel_verein_id, r.tarif, r.periode, r.betrag, 'ueberweisung');

  return jsonb_build_object('success', true, 'rechnung_id', v_neue_rechnung_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_gesperrt(p_typ text, p_ziel_id uuid, p_gesperrt boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from profiles pchk where pchk.id=auth.uid() and pchk.ist_plattform_admin=true) then
    raise exception 'Nur fuer Plattform-Admins';
  end if;
  if p_typ = 'person' then
    update profiles set gesperrt = p_gesperrt where id = p_ziel_id;
  elsif p_typ = 'verein' then
    update vereine set gesperrt = p_gesperrt where id = p_ziel_id;
  else
    return jsonb_build_object('success', false, 'error', 'Unbekannter Typ');
  end if;
  return jsonb_build_object('success', true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_tarif(p_typ text, p_ziel_id uuid, p_neuer_tarif text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  if p_typ = 'person' then
    update abos set status = 'expired', aktualisiert_am = now()
    where inhaber = 'person' and user_id = p_ziel_id and anbieter = 'manuell' and status in ('active', 'paused_by_organization');
    if p_neuer_tarif = 'basic' then
      insert into abos (inhaber, user_id, tarif, periode, anbieter, status) values ('person', p_ziel_id, 'basic', 'unbefristet', 'manuell', 'active');
    end if;
    perform tarif_neu_berechnen_person(p_ziel_id, 'admin');
  elsif p_typ = 'verein' then
    update abos set status = 'expired', aktualisiert_am = now()
    where inhaber = 'verein' and verein_id = p_ziel_id and anbieter = 'manuell' and status = 'active';
    if p_neuer_tarif = 'verein' then
      insert into abos (inhaber, user_id, verein_id, tarif, periode, anbieter, status) values ('verein', auth.uid(), p_ziel_id, 'verein', 'unbefristet', 'manuell', 'active');
    end if;
    perform tarif_neu_berechnen_verein(p_ziel_id, 'admin');
  else
    return jsonb_build_object('success', false, 'error', 'Unbekannter Typ');
  end if;
  return jsonb_build_object('success', true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_tarif_uebersicht()
 RETURNS TABLE(user_id uuid, name text, stufe text, persoenlicher_tarif text, abo_status text, anbieter text, periode text, laeuft_bis timestamp with time zone, gekuendigt_zum timestamp with time zone, pause_grund text, pause_verein text, vereine text, vereinslizenz boolean, effektiv text, registriert_am timestamp with time zone, seit timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  return query
  select p.id, coalesce(nullif(trim(coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')), ''), '@' || p.handle, 'Unbekannt'),
    tarif_stufe(p.id), p.tarif, a.status, a.anbieter, a.periode, a.laeuft_bis, a.gekuendigt_zum, a.pause_grund,
    (select v.name from vereine v where v.id = a.pause_verein_id),
    (select string_agg(v.name || case when verein_hat_lizenz(v.id) then ' (Lizenz)' else '' end, ', ')
     from vereins_mitglieder vm join vereine v on v.id = vm.verein_id where vm.user_id = p.id and coalesce(vm.aktiv, true)),
    vereinslizenz_verein_von(p.id) is not null,
    case when p.tarif in ('basic', 'verein') and vereinslizenz_verein_von(p.id) is not null then upper(p.tarif) || ' + VEREIN'
         when vereinslizenz_verein_von(p.id) is not null then 'FREE + VEREIN'
         else upper(p.tarif) end,
    p.created_at,
    -- "seit": Beginn der aktuellen Stufe (Vereinsbeitritt, Abo-Beginn oder Registrierung)
    case tarif_stufe(p.id)
      when 'verein' then coalesce((select min(vm.created_at) from vereins_mitglieder vm
                                   where vm.user_id = p.id and coalesce(vm.aktiv, true) and verein_hat_lizenz(vm.verein_id)), p.created_at)
      when 'basic' then coalesce(a.erstellt_am, p.created_at)
      else p.created_at end
  from profiles p
  left join lateral (select * from abos x where x.inhaber = 'person' and x.user_id = p.id order by abo_gilt(x) desc, x.erstellt_am desc limit 1) a on true
  where not coalesce(p.ist_plattform_admin, false);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_tarif_zaehler()
 RETURNS TABLE(free bigint, basic bigint, verein bigint, vereine_mit_lizenz bigint, basic_pausiert bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  return query
  with s as (select tarif_stufe(p.id) st from profiles p where not coalesce(p.ist_plattform_admin, false))
  select count(*) filter (where st = 'free'), count(*) filter (where st = 'basic'), count(*) filter (where st = 'verein'),
    (select count(*) from vereine v where verein_hat_lizenz(v.id)),
    (select count(*) from abos a where a.status = 'paused_by_organization')
  from s;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_update_person(p_person_id uuid, p_vorname text, p_nachname text, p_handle text, p_telefon text, p_geschlecht text)
 RETURNS TABLE(success boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from profiles where id = auth.uid() and ist_plattform_admin = true) then
    return query select false, 'Nur TanzRaum-Administratoren dürfen das.';
    return;
  end if;

  update profiles set
    vorname = p_vorname,
    nachname = p_nachname,
    handle = p_handle,
    telefon = p_telefon,
    geschlecht = p_geschlecht
  where id = p_person_id;

  return query select true, 'Gespeichert';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_verein_loeschen(p_verein_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from profiles pchk where pchk.id=auth.uid() and pchk.ist_plattform_admin=true) then
    raise exception 'Nur fuer Plattform-Admins';
  end if;
  delete from vereine where id = p_verein_id;
  return jsonb_build_object('success', true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_verein_mitglieder(p_verein_id uuid)
 RETURNS TABLE(user_id uuid, name text, rolle text, aktiv boolean, beigetreten timestamp with time zone, persoenlicher_tarif text, abo_status text, anbieter text, periode text, effektiv text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  return query
  select vm.user_id,
    coalesce(nullif(trim(coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')), ''), '@' || p.handle, 'Ohne Konto'),
    coalesce(r.name, 'Mitglied'), coalesce(vm.aktiv, true), vm.created_at, p.tarif, a.status, a.anbieter, a.periode,
    case when p.id is null then '–'
         when p.tarif in ('basic', 'verein') and vereinslizenz_verein_von(p.id) is not null then upper(p.tarif) || ' + VEREIN'
         when vereinslizenz_verein_von(p.id) is not null then 'FREE + VEREIN'
         else upper(coalesce(p.tarif, 'free')) end
  from vereins_mitglieder vm
  left join profiles p on p.id = vm.user_id
  left join rollen r on r.id = vm.rolle_id
  left join lateral (select * from abos x where x.inhaber = 'person' and x.user_id = vm.user_id order by abo_gilt(x) desc, x.erstellt_am desc limit 1) a on true
  where vm.verein_id = p_verein_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_vereine_uebersicht()
 RETURNS TABLE(id uuid, name text, registriert_am timestamp with time zone, tarif text, ansprechpartner text, email text, telefon text, ort text, admin_name text, admin_email text, mitglieder_anzahl bigint, gesperrt boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from profiles pchk where pchk.id = auth.uid() and pchk.ist_plattform_admin = true) then
    raise exception 'Nur fuer Plattform-Admins';
  end if;
  return query
  select v.id, v.name, v.created_at, v.tarif, v.ansprechpartner, v.email, v.telefon, v.ort,
    (select (p2.vorname || ' ' || p2.nachname) from vereins_mitglieder vm2
       join profiles p2 on p2.id = vm2.user_id join rollen r2 on r2.id = vm2.rolle_id
       where vm2.verein_id = v.id and lower(r2.name) like '%admin%' limit 1),
    (select u2.email::text from vereins_mitglieder vm2
       join auth.users u2 on u2.id = vm2.user_id join rollen r2 on r2.id = vm2.rolle_id
       where vm2.verein_id = v.id and lower(r2.name) like '%admin%' limit 1),
    (select count(*) from vereins_mitglieder vm3 where vm3.verein_id = v.id),
    v.gesperrt
  from vereine v
  order by v.created_at desc;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_vereinslizenzen()
 RETURNS TABLE(verein_id uuid, name text, ort text, lizenz boolean, bis text, abo_status text, anbieter text, periode text, gekuendigt_zum timestamp with time zone, kaeufer text, abgedeckt bigint, seit timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  return query
  select v.id, v.name, v.ort, verein_hat_lizenz(v.id), v.tarif_aktiv_bis, a.status, a.anbieter, a.periode, a.gekuendigt_zum,
    (select x.anzeige from anzeige_namen(array[a.user_id]) x),
    (select count(distinct vm.user_id) from vereins_mitglieder vm where vm.verein_id = v.id and vm.user_id is not null and coalesce(vm.aktiv, true)),
    coalesce(a.erstellt_am, v.created_at)
  from vereine v
  left join lateral (select * from abos x where x.inhaber = 'verein' and x.verein_id = v.id order by abo_gilt(x) desc, x.erstellt_am desc limit 1) a on true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.anruf_ice_berechtigt(p_anruf_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from anrufe a
    where a.id = p_anruf_id and auth.uid() in (a.anrufer_id, a.angerufener_id)
      and a.status in ('klingelt', 'aktiv')
      and a.erstellt_am > now() - interval '5 hours');
$function$
;

CREATE OR REPLACE FUNCTION public.anruf_push_ausloesen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_geheimnis text;
begin
  select decrypted_secret into v_geheimnis from vault.decrypted_secrets where name = 'chat_push_geheimnis';
  if v_geheimnis is null then return new; end if;
  perform net.http_post(
    url := 'https://oraiqjulxmohclfixwdq.supabase.co/functions/v1/chat-push',
    body := jsonb_build_object('anruf_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tanzraum-geheimnis', v_geheimnis),
    timeout_milliseconds := 5000);
  return new;
exception when others then
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.anruf_push_ziele(p_geheimnis text, p_anruf_id uuid)
 RETURNS TABLE(abo_id uuid, endpoint text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_geheimnis is null or p_geheimnis <> (select decrypted_secret from vault.decrypted_secrets where name = 'chat_push_geheimnis') then
    raise exception 'Nicht berechtigt' using errcode = '42501';
  end if;
  return query
  select ps.id, ps.endpoint from anrufe a join push_subscriptions ps on ps.user_id = a.angerufener_id
  where a.id = p_anruf_id and a.status = 'klingelt';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.anruf_signal(p_anruf_id uuid, p_typ text, p_daten jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a anrufe%rowtype;
begin
  select * into a from anrufe where id = p_anruf_id;
  if a.id is null or auth.uid() not in (a.anrufer_id, a.angerufener_id) or a.status not in ('klingelt', 'aktiv') then
    raise exception 'Anruf nicht aktiv.' using errcode = 'P0001';
  end if;
  if p_typ not in ('angebot', 'antwort', 'kandidat') or octet_length(p_daten::text) > 20000 then
    raise exception 'Ungültiges Signal.' using errcode = 'P0001';
  end if;
  insert into anruf_signale (anruf_id, von, an, typ, daten)
  values (a.id, auth.uid(), case when auth.uid() = a.anrufer_id then a.angerufener_id else a.anrufer_id end, p_typ, p_daten);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.anruf_starten(p_gespraech_id uuid, p_art text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  g gespraeche%rowtype;
  v_partner uuid;
  v_id uuid;
begin
  perform anrufe_aufraeumen();
  select * into g from gespraeche where id = p_gespraech_id;
  if g.id is null or g.typ <> 'dm' then
    raise exception 'Anrufe sind im Privatchat möglich.' using errcode = 'P0001';
  end if;
  if p_art not in ('audio', 'video') then
    raise exception 'Ungültige Anrufart.' using errcode = 'P0001';
  end if;
  -- gleiche Regeln wie beim Schreiben: Vereinsbeziehung/Kontaktanfrage, Minderjaehrigenschutz, Blockierung
  if not darf_im_gespraech_schreiben(g.id) then
    raise exception 'Du kannst diese Person nicht anrufen.' using errcode = 'P0001';
  end if;
  select t.user_id into v_partner from gespraech_teilnehmer t where t.gespraech_id = g.id and t.user_id <> auth.uid() limit 1;
  if exists (select 1 from anrufe a where a.status in ('klingelt', 'aktiv') and (auth.uid() in (a.anrufer_id, a.angerufener_id) or v_partner in (a.anrufer_id, a.angerufener_id))) then
    raise exception 'Gerade läuft schon ein Anruf.' using errcode = 'P0001';
  end if;
  insert into anrufe (gespraech_id, anrufer_id, angerufener_id, art) values (g.id, auth.uid(), v_partner, p_art) returning id into v_id;
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.anruf_status(p_anruf_id uuid, p_aktion text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a anrufe%rowtype;
  v_dauer int;
begin
  select * into a from anrufe where id = p_anruf_id for update;
  if a.id is null or auth.uid() not in (a.anrufer_id, a.angerufener_id) then
    raise exception 'Anruf nicht gefunden.' using errcode = 'P0001';
  end if;
  if p_aktion = 'annehmen' then
    if auth.uid() <> a.angerufener_id or a.status <> 'klingelt' then return; end if;
    update anrufe set status = 'aktiv', angenommen_am = now() where id = a.id;
  elsif p_aktion = 'ablehnen' then
    if auth.uid() <> a.angerufener_id or a.status <> 'klingelt' then return; end if;
    update anrufe set status = 'abgelehnt', beendet_am = now() where id = a.id;
    insert into nachrichten (gespraech_id, sender_id, inhalt)
    values (a.gespraech_id, a.anrufer_id, case a.art when 'video' then '📹 Videoanruf abgelehnt' else '📞 Sprachanruf abgelehnt' end);
  elsif p_aktion = 'beenden' then
    if a.status = 'klingelt' then
      update anrufe set status = case when auth.uid() = a.anrufer_id then 'abgebrochen' else 'abgelehnt' end, beendet_am = now() where id = a.id;
      insert into nachrichten (gespraech_id, sender_id, inhalt)
      values (a.gespraech_id, a.anrufer_id, case a.art when 'video' then '📹 Verpasster Videoanruf' else '📞 Verpasster Sprachanruf' end);
    elsif a.status = 'aktiv' then
      v_dauer := extract(epoch from now() - a.angenommen_am)::int;
      update anrufe set status = 'beendet', beendet_am = now() where id = a.id;
      insert into nachrichten (gespraech_id, sender_id, inhalt)
      values (a.gespraech_id, a.anrufer_id,
        case a.art when 'video' then '📹 Videoanruf' else '📞 Sprachanruf' end || ' · ' || (v_dauer / 60) || ':' || lpad((v_dauer % 60)::text, 2, '0'));
    end if;
  else
    raise exception 'Ungültige Aktion.' using errcode = 'P0001';
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.anrufe_aufraeumen()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a anrufe%rowtype;
begin
  for a in select * from anrufe where status = 'klingelt' and erstellt_am < now() - interval '45 seconds' for update skip locked loop
    update anrufe set status = 'verpasst', beendet_am = now() where id = a.id;
    insert into nachrichten (gespraech_id, sender_id, inhalt)
    values (a.gespraech_id, a.anrufer_id, case a.art when 'video' then '📹 Verpasster Videoanruf' else '📞 Verpasster Sprachanruf' end);
  end loop;
  -- haengengebliebene aktive Anrufe (z. B. Verbindungsabbruch) nach 4 Stunden schliessen
  update anrufe set status = 'beendet', beendet_am = now() where status = 'aktiv' and angenommen_am < now() - interval '4 hours';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.anwesenheit_liste(p_gruppe_id uuid, p_datum date)
 RETURNS TABLE(vm_id uuid, name text, abgemeldet boolean, grund text, anwesend boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_verein uuid;
begin
  select g.verein_id into v_verein from gruppen g where g.id = p_gruppe_id;
  if v_verein is null or not (
    is_verein_admin(v_verein)
    or (ist_gruppen_betreuung_erweitert(p_gruppe_id) and hat_vereinsbereich(v_verein, 'anwesenheit'))) then
    raise exception 'Keine Berechtigung fuer diese Anwesenheitsliste' using errcode = '42501';
  end if;

  return query
  select vm.id, a.anzeige, ab.id is not null, ab.grund, aw.anwesend
  from gruppen_mitglieder gm
  join vereins_mitglieder vm on vm.id = gm.vereins_mitglied_id and coalesce(vm.aktiv, true)
  cross join lateral anzeige_namen(array[vm.user_id]) a
  left join trainings_abmeldungen ab on ab.vereins_mitglied_id = vm.id and ab.gruppe_id = p_gruppe_id and ab.datum = p_datum
  left join trainings_anwesenheit aw on aw.vereins_mitglied_id = vm.id and aw.gruppe_id = p_gruppe_id and aw.datum = p_datum
  where gm.gruppe_id = p_gruppe_id and coalesce(gm.funktion, 'mitglied') = 'mitglied'
  order by a.anzeige;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.anzeige_namen(p_user_ids uuid[])
 RETURNS TABLE(user_id uuid, anzeige text, handle text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id,
    case
      when p.id = auth.uid()
        or ist_plattform_admin_aktuell()
        or coalesce(p.konto_privat, false) = false
        or exists (
          select 1 from vereins_mitglieder ich
          join rollen r on r.id = ich.rolle_id
          join vereins_mitglieder ziel on ziel.verein_id = ich.verein_id and ziel.user_id = p.id
          where ich.user_id = auth.uid() and coalesce(ich.aktiv, true)
            and rollen_typ(r.name) in ('admin', 'trainer', 'betreuer'))
      then coalesce(nullif(trim(coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')), ''), '@' || p.handle, 'Unbekannt')
      else coalesce('@' || p.handle, 'Unbekannt')
    end,
    p.handle
  from profiles p
  where p.id = any(p_user_ids) and auth.uid() is not null;
$function$
;

CREATE OR REPLACE FUNCTION public.beitritt_annehmen(p_antrag_id uuid)
 RETURNS TABLE(success boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_antrag beitritts_anfragen%rowtype;
  v_rolle_id uuid;
begin
  select * into v_antrag from beitritts_anfragen where id = p_antrag_id;
  if v_antrag.id is null then
    return query select false, 'Anfrage nicht gefunden.';
    return;
  end if;
  if not is_verein_admin(v_antrag.verein_id) then
    return query select false, 'Nur der Vereinsadmin darf das.';
    return;
  end if;
  if v_antrag.status <> 'neu' then
    return query select false, 'Anfrage wurde bereits entschieden.';
    return;
  end if;

  select id into v_rolle_id from rollen where name = v_antrag.gewuenschte_rolle limit 1;
  if v_rolle_id is null then
    select id into v_rolle_id from rollen where lower(name) like '%tänzer%' limit 1;
  end if;

  insert into vereins_mitglieder (user_id, verein_id, rolle_id)
  values (v_antrag.user_id, v_antrag.verein_id, v_rolle_id)
  on conflict do nothing;

  update beitritts_anfragen set status = 'angenommen', entschieden_am = now() where id = p_antrag_id;

  return query select true, 'Angenommen';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.benachrichtige_alle_mitglieder(p_verein_id uuid, p_text text)
 RETURNS TABLE(anzahl_gesendet integer, anzahl_ohne_konto integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_gesendet int;
  v_ohne_konto int;
begin
  if not is_verein_admin_oder_trainer(p_verein_id) then
    raise exception 'Nicht berechtigt';
  end if;

  insert into benachrichtigungen (user_id, typ, text)
  select m.user_id, 'vereinsrundschreiben', p_text
  from mitglieder m
  where m.verein_id = p_verein_id and m.user_id is not null;
  get diagnostics v_gesendet = row_count;

  select count(*) into v_ohne_konto from mitglieder where verein_id = p_verein_id and user_id is null;

  return query select v_gesendet, v_ohne_konto;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.benachrichtige_gruppe(p_gruppe_id uuid, p_typ text, p_text text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_anzahl int;
begin
  if not public.ist_gruppen_betreuung(p_gruppe_id) then
    raise exception 'Nicht berechtigt';
  end if;

  insert into benachrichtigungen (user_id, typ, text)
  select vm.user_id, p_typ, p_text
  from gruppen_mitglieder gm
  join vereins_mitglieder vm on vm.id = gm.vereins_mitglied_id
  where gm.gruppe_id = p_gruppe_id;

  get diagnostics v_anzahl = row_count;
  return v_anzahl;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.benachrichtige_mitglieder(p_mitglied_ids uuid[], p_text text)
 RETURNS TABLE(anzahl_gesendet integer, anzahl_ohne_konto integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_verein_ids uuid[];
  v_gesendet int;
  v_ohne_konto int;
begin
  select array_agg(distinct verein_id) into v_verein_ids from mitglieder where id = any(p_mitglied_ids);

  if exists (select 1 from unnest(v_verein_ids) v where not is_verein_admin_oder_trainer(v)) then
    raise exception 'Nicht berechtigt';
  end if;

  insert into benachrichtigungen (user_id, typ, text)
  select m.user_id, 'mitglieder_nachricht', p_text
  from mitglieder m
  where m.id = any(p_mitglied_ids) and m.user_id is not null;
  get diagnostics v_gesendet = row_count;

  select count(*) into v_ohne_konto from mitglieder where id = any(p_mitglied_ids) and user_id is null;

  return query select v_gesendet, v_ohne_konto;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bereiche_fuer_rolle(p_rolle text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case rollen_typ(p_rolle)
    when 'admin' then array['mitglieder','anwesenheit','beitraege','material','trainingsplan','saison','netzwerk','beitritt']
    when 'trainer' then array['mitglieder','anwesenheit','trainingsplan','saison','netzwerk']
    when 'betreuer' then array['mitglieder','anwesenheit','material']
    else array[]::text[]
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_dm_starten(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
begin
  select * into r from kontakt_aufnehmen(p_user_id);
  if r.ergebnis <> 'chat' then
    raise exception 'Für diese Person ist zuerst eine Kontaktanfrage nötig.' using errcode = 'P0001';
  end if;
  return r.gespraech_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_einstellung(p_gespraech_id uuid, p_nur_leitung_schreibt boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not ist_chat_leitung(p_gespraech_id) then
    raise exception 'Das dürfen nur Vorstand, Trainer und Betreuer.' using errcode = 'P0001';
  end if;
  update gespraeche set nur_leitung_schreibt = p_nur_leitung_schreibt where id = p_gespraech_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_gelesen(p_gespraech_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not hat_gespraech_zugriff(p_gespraech_id) then return; end if;
  insert into gespraech_teilnehmer (gespraech_id, user_id, last_read_at)
  values (p_gespraech_id, auth.uid(), now())
  on conflict (gespraech_id, user_id) do update set last_read_at = now();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_ist_stumm(p_gespraech_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from chat_stumm s where s.gespraech_id = p_gespraech_id and s.user_id = auth.uid());
$function$
;

CREATE OR REPLACE FUNCTION public.chat_kontakte()
 RETURNS TABLE(user_id uuid, anzeige text, handle text, avatar_url text, grund text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with k as (
    select du.user_id as uid, coalesce(r.name, 'Mitglied') || ' · ' || v.name as grund,
      case rollen_typ(r.name) when 'trainer' then 1 when 'betreuer' then 2 when 'admin' then 3 else 4 end as prio
    from vereins_mitglieder ich
    join vereine v on v.id = ich.verein_id
    join vereins_mitglieder du on du.verein_id = ich.verein_id and coalesce(du.aktiv, true) and du.user_id is not null
    left join rollen r on r.id = du.rolle_id
    where ich.user_id = auth.uid() and coalesce(ich.aktiv, true) and verein_hat_lizenz(ich.verein_id)
    union all
    select case when c.user_id = auth.uid() then c.connected_to else c.user_id end, 'Kontakt', 5
    from connections c where c.status = 'accepted' and auth.uid() in (c.user_id, c.connected_to)
    union all
    select case when e.user_id = auth.uid() then k.user_id else e.user_id end, 'Familie', 0
    from eltern_kind_zuordnung ekz
    join vereins_mitglieder e on e.id = ekz.eltern_vm_id
    join vereins_mitglieder k on k.id = ekz.kind_vm_id
    where auth.uid() in (e.user_id, k.user_id)
  ),
  eindeutig as (
    select distinct on (k.uid) k.uid, k.grund, k.prio from k
    where k.uid is not null and k.uid <> auth.uid() and darf_direkt_schreiben(k.uid)
    order by k.uid, k.prio
  )
  select e.uid, a.anzeige, a.handle,
    (select p.avatar_url from profiles p where p.id = e.uid and (not coalesce(p.konto_privat, false) or kann_privates_profil_sehen(p.id))),
    e.grund
  from eindeutig e join anzeige_namen(array(select uid from eindeutig)) a on a.user_id = e.uid
  order by e.prio, a.anzeige;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_kopf(p_gespraech_id uuid)
 RETURNS TABLE(id uuid, typ text, name text, untertitel text, partner_id uuid, partner_rolle text, avatar_url text, darf_schreiben boolean, ist_leitung boolean, nur_leitung_schreibt boolean, partner_gelesen_bis timestamp with time zone, ich_habe_blockiert boolean, partner_blockiert boolean, sperrgrund text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.typ, c.name, c.untertitel, c.partner_id, c.partner_rolle, c.avatar_url, c.darf_schreiben, c.ist_leitung, c.nur_leitung_schreibt,
    case when c.typ = 'dm' then (select t.last_read_at from gespraech_teilnehmer t where t.gespraech_id = c.id and t.user_id = c.partner_id) end,
    c.typ = 'dm' and exists (select 1 from blockierungen b where b.blocker_id = auth.uid() and b.blockiert_id = c.partner_id),
    c.typ = 'dm' and exists (select 1 from blockierungen b where b.blocker_id = c.partner_id and b.blockiert_id = auth.uid()),
    case when c.darf_schreiben then null
         when c.typ = 'dm' then schreib_sperrgrund(c.partner_id)
         when eltern_nachrichtensperre(auth.uid()) then 'eltern_sperre_ich'
         else 'nur_leitung' end
  from chat_liste() c where c.id = p_gespraech_id;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_liste()
 RETURNS TABLE(id uuid, typ text, bereich text, name text, untertitel text, partner_id uuid, partner_rolle text, avatar_url text, letzte_nachricht text, letzte_zeit timestamp with time zone, letzter_sender text, ungelesen integer, darf_schreiben boolean, ist_leitung boolean, nur_leitung_schreibt boolean, blockiert boolean, verein_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with kandidaten as (
    select g.* from gespraeche g
    where auth.uid() is not null and (
      (g.typ = 'dm' and exists (select 1 from gespraech_teilnehmer t where t.gespraech_id = g.id and t.user_id = auth.uid()))
      or (g.typ in ('verein', 'trainingsgruppe')
          and g.verein_id in (select vm.verein_id from vereins_mitglieder vm where vm.user_id = auth.uid() and coalesce(vm.aktiv, true))))
  ),
  sichtbar as (select k.* from kandidaten k where hat_gespraech_zugriff(k.id))
  select s.id, s.typ,
    case s.typ when 'verein' then 'verein' when 'trainingsgruppe' then 'gruppe'
                       else case when netzwerk_verbunden(auth.uid(), pt.user_id) then 'netzwerk' else 'privat' end end,
    case s.typ
      when 'dm' then coalesce((select a.anzeige from anzeige_namen(array[pt.user_id]) a), 'Unbekannt')
      when 'verein' then coalesce(s.name, v.name)
      else coalesce(s.name, gr.name)
    end,
    case s.typ when 'dm' then null when 'verein' then 'Vereinschat' else v.name end,
    pt.user_id,
    case when s.typ = 'dm' then (
      select case min(case rollen_typ(r.name) when 'trainer' then 1 when 'betreuer' then 2 else 3 end)
               when 1 then 'Trainer' when 2 then 'Betreuer' else 'Andere Kontakte' end
      from vereins_mitglieder du
      join vereins_mitglieder ich on ich.verein_id = du.verein_id and ich.user_id = auth.uid() and coalesce(ich.aktiv, true)
      left join rollen r on r.id = du.rolle_id
      where du.user_id = pt.user_id and coalesce(du.aktiv, true)) end,
    case when s.typ = 'dm' then (select p.avatar_url from profiles p where p.id = pt.user_id and (not coalesce(p.konto_privat, false) or kann_privates_profil_sehen(p.id))) end,
    case
      when ln.id is null then null
      when ln.geloescht_am is not null then 'Nachricht gelöscht'
      when ln.umfrage is not null then '📊 ' || (ln.umfrage->>'frage')
      when ln.sticker is not null then '🎭 Sticker'
      when ln.standort is not null then '📍 Standort'
      when ln.anhang is not null and ln.anhang->>'art' = 'audio' then '🎤 Sprachnachricht'
      when ln.anhang is not null and ln.anhang->>'art' = 'video' then '🎬 ' || coalesce(nullif(left(ln.inhalt, 100), ''), 'Video')
      when ln.anhang is not null then '📎 ' || (ln.anhang->>'name')
      when ln.bild_pfad is not null then '📷 ' || coalesce(nullif(left(ln.inhalt, 100), ''), 'Foto')
      else left(ln.inhalt, 120)
    end,
    coalesce(ln.gesendet_am, s.created_at),
    case when ln.id is null or s.typ = 'dm' then null
         when ln.sender_id = auth.uid() then 'Du'
         else (select a.anzeige from anzeige_namen(array[ln.sender_id]) a) end,
    least((select count(*) from nachrichten n
           where n.gespraech_id = s.id and n.sender_id <> auth.uid() and n.geloescht_am is null
             and n.gesendet_am > coalesce(ich.last_read_at, now() - interval '14 days')), 99)::int,
    darf_im_gespraech_schreiben(s.id),
    ist_chat_leitung(s.id),
    s.nur_leitung_schreibt,
    s.typ = 'dm' and ist_blockiert(auth.uid(), pt.user_id),
    s.verein_id
  from sichtbar s
  left join vereine v on v.id = s.verein_id
  left join gruppen gr on gr.id = s.gruppe_id
  left join gespraech_teilnehmer ich on ich.gespraech_id = s.id and ich.user_id = auth.uid()
  left join lateral (select t.user_id from gespraech_teilnehmer t where s.typ = 'dm' and t.gespraech_id = s.id and t.user_id <> auth.uid() limit 1) pt on true
  left join lateral (select n.* from nachrichten n where n.gespraech_id = s.id order by n.gesendet_am desc limit 1) ln on true
  order by coalesce(ln.gesendet_am, s.created_at) desc;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_nachrichten(p_gespraech_id uuid, p_vor timestamp with time zone DEFAULT NULL::timestamp with time zone, p_anzahl integer DEFAULT 60)
 RETURNS TABLE(id uuid, sender_id uuid, sender_name text, eigene boolean, inhalt text, bild_pfad text, umfrage jsonb, anhang jsonb, standort jsonb, sticker text, reaktionen jsonb, antwort_auf uuid, antwort_sender text, antwort_text text, antwort_sticker text, gesendet_am timestamp with time zone, geloescht boolean, darf_loeschen boolean, bearbeitet boolean, weitergeleitet boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_leitung boolean;
begin
  if not hat_gespraech_zugriff(p_gespraech_id) then
    return;
  end if;
  v_leitung := ist_chat_leitung(p_gespraech_id);
  return query
  with seite as (
    select n.* from nachrichten n
    where n.gespraech_id = p_gespraech_id and (p_vor is null or n.gesendet_am < p_vor)
    order by n.gesendet_am desc
    limit least(greatest(p_anzahl, 1), 200)
  ),
  namen as (
    select a.user_id, a.anzeige from anzeige_namen(array(
      select distinct x from (select s.sender_id as x from seite s
                              union select o.sender_id from seite s join nachrichten o on o.id = s.antwort_auf) q)) a
  )
  select s.id, s.sender_id, coalesce(nm.anzeige, 'Unbekannt'), s.sender_id = auth.uid(),
    case when s.geloescht_am is null then s.inhalt else '' end,
    case when s.geloescht_am is null then s.bild_pfad end,
    case when s.umfrage is null or s.geloescht_am is not null then null else
      s.umfrage || jsonb_build_object(
        'stimmen', (select coalesce(jsonb_agg(cnt order by i), '[]') from (
                      select i, (select count(*) from umfrage_stimmen us where us.nachricht_id = s.id and us.option = i) cnt
                      from generate_series(0, jsonb_array_length(s.umfrage->'optionen') - 1) i) z),
        'meine', (select coalesce(jsonb_agg(us.option), '[]') from umfrage_stimmen us where us.nachricht_id = s.id and us.user_id = auth.uid()),
        'teilnehmer', (select count(distinct us.user_id) from umfrage_stimmen us where us.nachricht_id = s.id))
    end,
    case when s.geloescht_am is null then s.anhang end,
    case when s.geloescht_am is null then s.standort end,
    case when s.geloescht_am is null then s.sticker end,
    (select coalesce(jsonb_agg(jsonb_build_object('emoji', r.emoji, 'anzahl', r.anzahl, 'ich', r.ich) order by r.anzahl desc), '[]')
     from (select nr.emoji, count(*) as anzahl, bool_or(nr.user_id = auth.uid()) as ich
           from nachricht_reaktionen nr where nr.nachricht_id = s.id group by nr.emoji) r),
    s.antwort_auf,
    case when o.id is null then null when o.sender_id = auth.uid() then 'Du' else (select nm2.anzeige from namen nm2 where nm2.user_id = o.sender_id) end,
    case when o.id is null then null
         when o.geloescht_am is not null then 'Nachricht gelöscht'
         when o.sticker is not null then '🎭 Sticker'
         when o.umfrage is not null then '📊 ' || (o.umfrage->>'frage')
         when o.standort is not null then '📍 Standort'
         when o.anhang is not null and o.anhang->>'art' = 'audio' then '🎤 Sprachnachricht'
         when o.anhang is not null and o.anhang->>'art' = 'video' then '🎬 Video'
         when o.anhang is not null then '📎 ' || (o.anhang->>'name')
         when o.bild_pfad is not null and o.inhalt = '' then '📷 Foto'
         else left(o.inhalt, 140) end,
    case when o.geloescht_am is null then o.sticker end,
    s.gesendet_am,
    s.geloescht_am is not null,
    s.geloescht_am is null and (s.sender_id = auth.uid() or v_leitung),
    s.geloescht_am is null and s.bearbeitet_am is not null,
    s.geloescht_am is null and s.weitergeleitet
  from seite s
  left join namen nm on nm.user_id = s.sender_id
  left join nachrichten o on o.id = s.antwort_auf
  order by s.gesendet_am asc;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_push_ziele(p_geheimnis text, p_nachricht_id uuid)
 RETURNS TABLE(abo_id uuid, endpoint text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n nachrichten%rowtype;
  g gespraeche%rowtype;
  kandidat uuid;
  empfaenger uuid[] := '{}';
begin
  if p_geheimnis is null or p_geheimnis <> (select decrypted_secret from vault.decrypted_secrets where name = 'chat_push_geheimnis') then
    raise exception 'Nicht berechtigt' using errcode = '42501';
  end if;
  select * into n from nachrichten where id = p_nachricht_id;
  if n.id is null or n.geloescht_am is not null then return; end if;
  select * into g from gespraeche where id = n.gespraech_id;
  if g.typ = 'juryraum' then return; end if;

  for kandidat in
    select distinct u from (
      select t.user_id as u from gespraech_teilnehmer t where t.gespraech_id = g.id
      union
      select vm.user_id from vereins_mitglieder vm where g.verein_id is not null and vm.verein_id = g.verein_id and coalesce(vm.aktiv, true)
    ) x
    where u is not null and u <> n.sender_id
      and exists (select 1 from push_subscriptions ps where ps.user_id = x.u)
      and not exists (select 1 from blockierungen b where b.blocker_id = x.u and b.blockiert_id = n.sender_id)
      and (g.nur_leitung_schreibt or not exists (select 1 from chat_stumm s where s.gespraech_id = g.id and s.user_id = x.u))
  loop
    perform set_config('request.jwt.claim.sub', kandidat::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', kandidat, 'role', 'authenticated')::text, true);
    if hat_gespraech_zugriff(g.id) then
      empfaenger := empfaenger || kandidat;
    end if;
  end loop;

  return query select ps.id, ps.endpoint from push_subscriptions ps where ps.user_id = any(empfaenger);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_stumm_setzen(p_gespraech_id uuid, p_stumm boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not hat_gespraech_zugriff(p_gespraech_id) then
    raise exception 'Chat nicht gefunden.' using errcode = 'P0001';
  end if;
  if p_stumm then
    insert into chat_stumm (gespraech_id, user_id) values (p_gespraech_id, auth.uid()) on conflict do nothing;
  else
    delete from chat_stumm where gespraech_id = p_gespraech_id and user_id = auth.uid();
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_suchen(p_gespraech_id uuid, p_suche text)
 RETURNS TABLE(id uuid, inhalt text, sender_name text, eigene boolean, gesendet_am timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  q text := lower(btrim(coalesce(p_suche, '')));
begin
  if not hat_gespraech_zugriff(p_gespraech_id) or char_length(q) < 2 then return; end if;
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  return query
  select n.id, left(n.inhalt, 200), coalesce(a.anzeige, 'Unbekannt'), n.sender_id = auth.uid(), n.gesendet_am
  from nachrichten n
  left join anzeige_namen(array(select distinct x.sender_id from nachrichten x where x.gespraech_id = p_gespraech_id)) a on a.user_id = n.sender_id
  where n.gespraech_id = p_gespraech_id and n.geloescht_am is null and lower(n.inhalt) like '%' || q || '%'
  order by n.gesendet_am desc
  limit 50;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.chat_ungelesen_markieren(p_gespraech_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_letzte timestamptz;
begin
  if not hat_gespraech_zugriff(p_gespraech_id) then raise exception 'Chat nicht gefunden.' using errcode = 'P0001'; end if;
  select max(n.gesendet_am) into v_letzte from nachrichten n
  where n.gespraech_id = p_gespraech_id and n.sender_id <> auth.uid() and n.geloescht_am is null;
  if v_letzte is null then return; end if;
  update gespraech_teilnehmer set last_read_at = v_letzte - interval '1 millisecond'
  where gespraech_id = p_gespraech_id and user_id = auth.uid();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.check_gruppen_thema()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    disziplin_name text;
BEGIN

    SELECT name
    INTO disziplin_name
    FROM public.disziplinen
    WHERE id = NEW.disziplin_id;

    -- Schautanz benötigt zwingend ein Thema
    IF disziplin_name = 'Schautanz'
       AND (NEW.thema IS NULL OR trim(NEW.thema) = '') THEN

        RAISE EXCEPTION
            'Bei Schautanz muss ein Thema angegeben werden.';

    END IF;

    -- Bei anderen Disziplinen darf das Thema leer sein.
    RETURN NEW;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_gesperrt boolean;
  v_verein_gesperrt boolean;
begin
  v_user_id := (event->>'user_id')::uuid;

  select gesperrt into v_gesperrt
  from public.profiles
  where id = v_user_id;

  select exists (
    select 1
    from public.vereins_mitglieder vm
    join public.vereine v on v.id = vm.verein_id
    where vm.user_id = v_user_id and v.gesperrt = true
  ) into v_verein_gesperrt;

  if coalesce(v_gesperrt, false) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Dein Konto wurde gesperrt. Bitte wende dich an den TanzRaum-Support.'
      )
    );
  end if;

  if coalesce(v_verein_gesperrt, false) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Dein Verein wurde gesperrt. Bitte wende dich an den TanzRaum-Support.'
      )
    );
  end if;

  return event;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.darf_direkt_schreiben(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null and p_user_id is not null and p_user_id <> auth.uid()
    and exists (select 1 from profiles p where p.id = p_user_id and not coalesce(p.gesperrt, false))
    and not ist_blockiert(auth.uid(), p_user_id)
    and (
      -- verknuepfte Eltern und Kinder
      ist_elternteil_von(auth.uid(), p_user_id) or ist_elternteil_von(p_user_id, auth.uid())
      or (not eltern_nachrichtensperre(auth.uid()) and not eltern_nachrichtensperre(p_user_id)
          and (
            -- gemeinsamer Verein (mit Vereinslizenz) – auch fuer unter 15
            hat_vereinsbeziehung(auth.uid(), p_user_id)
            -- angenommene Vernetzung: erst ab 15, beide mit Nachrichtenfunktion (ab Basic)
            or (kontakt_angenommen(auth.uid(), p_user_id)
                and not ist_unter_15(auth.uid()) and not ist_unter_15(p_user_id)
                and tarif_von(auth.uid()) in ('basic', 'verein') and tarif_von(p_user_id) in ('basic', 'verein')))));
$function$
;

CREATE OR REPLACE FUNCTION public.darf_im_gespraech_schreiben(p_gespraech_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from gespraeche g
    where g.id = p_gespraech_id and hat_gespraech_zugriff(g.id)
      and case
        when g.typ = 'juryraum' then true
        when g.typ = 'dm' then exists (
          select 1 from gespraech_teilnehmer t where t.gespraech_id = g.id and t.user_id <> auth.uid() and darf_direkt_schreiben(t.user_id))
        -- Elterliche Nachrichtensperre: in Gruppenchats nur noch lesen
        else (not g.nur_leitung_schreibt or ist_chat_leitung(g.id)) and not eltern_nachrichtensperre(auth.uid())
      end);
$function$
;

CREATE OR REPLACE FUNCTION public.darf_netzwerk()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null and tarif_von(auth.uid()) in ('basic', 'verein')
     and not exists (select 1 from profiles p where p.id = auth.uid() and coalesce(p.gesperrt, false));
$function$
;

CREATE OR REPLACE FUNCTION public.darf_spotlight_sehen(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from spotlights s join profiles a on a.id = s.user_id
    where s.id = p_id and auth.uid() is not null and s.entfernt_am is null
      and (s.user_id = auth.uid()
           or (s.ablauf_am > now() and not coalesce(a.gesperrt, false) and not ist_blockiert(auth.uid(), s.user_id)
               and (hat_vereinsbeziehung(auth.uid(), s.user_id) or kontakt_angenommen(auth.uid(), s.user_id)
                    or ist_elternteil_von(auth.uid(), s.user_id) or ist_elternteil_von(s.user_id, auth.uid())
                    or (not spotlight_nur_kontakte(s.id) and konto_aktiv())))));
$function$
;

CREATE OR REPLACE FUNCTION public.darf_vereinstermine_verwalten(p_verein_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from meine_bereiche() mb where mb.verein_id = p_verein_id and mb.bereich in ('saison', 'rolle_admin'));
$function$
;

CREATE OR REPLACE FUNCTION public.dashboard_altersklassen()
 RETURNS TABLE(altersklasse text, anzahl bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_vereine uuid[] := dashboard_vereine('mitglieder');
begin
  if not hat_bereich('mitglieder') then
    return;
  end if;

  return query
  select coalesce(vm.altersklasse, 'Ohne Angabe'), count(*)
  from vereins_mitglieder vm
  where vm.verein_id = any(v_vereine) and ist_relevantes_mitglied(vm.id)
  group by coalesce(vm.altersklasse, 'Ohne Angabe')
  order by count(*) desc;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dashboard_beteiligung_verlauf(p_wochen integer DEFAULT 8)
 RETURNS TABLE(woche_start date, prozent numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_woche date := date_trunc('week', (now() at time zone 'Europe/Berlin'))::date;
  v_vereine uuid[] := dashboard_vereine('anwesenheit');
begin
  if not hat_bereich('anwesenheit') then
    return;
  end if;

  return query
  select ws.w,
    round(100.0 * count(ta.*) filter (where ta.anwesend) / nullif(count(ta.*), 0), 1)
  from (select (v_woche - (i * 7))::date as w from generate_series(least(greatest(p_wochen, 1), 52) - 1, 0, -1) as i) ws
  left join trainings_anwesenheit ta
    on ta.datum >= ws.w and ta.datum < ws.w + 7 and ta.verein_id = any(v_vereine)
  group by ws.w
  order by ws.w;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dashboard_heute()
 RETURNS TABLE(titel text, gruppe_name text, halle text, von time without time zone, bis time without time zone, verein_name text, teilnehmer_erwartet integer, teilnehmer_gesamt integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
  v_isodow int := extract(isodow from (now() at time zone 'Europe/Berlin'))::int;
begin
  return query
  select coalesce(tt.titel, 'Training'), g.name, tt.halle, tt.von, tt.bis, v.name,
    case when g.id is null then null else greatest(
      (select count(*) from gruppen_mitglieder gm where gm.gruppe_id = g.id)
      - (select count(*) from trainings_abmeldungen ab where ab.gruppe_id = g.id and ab.datum = v_heute), 0)::int end,
    case when g.id is null then null else (select count(*) from gruppen_mitglieder gm where gm.gruppe_id = g.id)::int end
  from trainingstermine tt
  join vereine v on v.id = tt.verein_id
  left join gruppen g on g.id = tt.gruppe_id
  where tt.id in (select s.id from sichtbare_trainings() s)
    and ((tt.ist_wiederholend and tt.wochentag = v_isodow)
      or (not tt.ist_wiederholend and tt.datum = v_heute))
  order by tt.von nulls last;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dashboard_kennzahlen()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
  v_isodow int := extract(isodow from (now() at time zone 'Europe/Berlin'))::int;
  v_woche date := date_trunc('week', (now() at time zone 'Europe/Berlin'))::date;
  v_monat date := date_trunc('month', (now() at time zone 'Europe/Berlin'))::date;
  v_mitglieder_vereine uuid[] := dashboard_vereine('mitglieder');
  v_anwesenheit_vereine uuid[] := dashboard_vereine('anwesenheit');
  v_trainings uuid[];
  v_erst_name text;
  v_erst_ort text;
  v_erst_datum date;
  v_wochen date[];
  v_mitglieder jsonb := null;
  v_trainings_heute jsonb := null;
  v_abmeldungen jsonb := null;
  v_turniere jsonb := null;
  v_nachrichten jsonb := null;
  v_beteiligung jsonb := null;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  select array_agg((v_woche - (i * 7))::date order by i desc) into v_wochen from generate_series(0, 7) as i;
  select coalesce(array_agg(s.id), '{}') into v_trainings from sichtbare_trainings() s;

  if hat_bereich('mitglieder') then
    select jsonb_build_object(
      'wert', (select count(*) from vereins_mitglieder where verein_id = any(v_mitglieder_vereine) and ist_relevantes_mitglied(id)),
      'neu_woche', (select count(*) from vereins_mitglieder
                    where verein_id = any(v_mitglieder_vereine) and ist_relevantes_mitglied(id) and created_at >= now() - interval '7 days'),
      'vereine', cardinality(v_mitglieder_vereine),
      'verlauf', (select jsonb_agg((select count(*) from vereins_mitglieder vm
                    where vm.verein_id = any(v_mitglieder_vereine) and ist_relevantes_mitglied(vm.id) and vm.created_at < (w + 7)) order by w)
                  from unnest(v_wochen) w)
    ) into v_mitglieder;
  end if;

  if ist_plattform_admin_aktuell() or mein_tarif() in ('basic', 'verein') then
    select jsonb_build_object(
      'wert', (select count(*) from trainingstermine tt
               where tt.id = any(v_trainings)
                 and ((tt.ist_wiederholend and tt.wochentag = v_isodow)
                   or (not tt.ist_wiederholend and tt.datum = v_heute))),
      'erwartet', (select coalesce(sum(greatest(
                      (select count(*) from gruppen_mitglieder gm where gm.gruppe_id = tt.gruppe_id)
                    - (select count(*) from trainings_abmeldungen ab where ab.gruppe_id = tt.gruppe_id and ab.datum = v_heute), 0)), 0)
                   from trainingstermine tt
                   where tt.id = any(v_trainings) and tt.gruppe_id is not null
                     and ((tt.ist_wiederholend and tt.wochentag = v_isodow)
                       or (not tt.ist_wiederholend and tt.datum = v_heute))),
      'verlauf', (select jsonb_agg((select count(*) from trainingstermine tt
                    where tt.id = any(v_trainings)
                      and ((tt.ist_wiederholend and tt.erstellt_am < (w + 7))
                        or (not tt.ist_wiederholend and tt.datum >= w and tt.datum < w + 7))) order by w)
                  from unnest(v_wochen) w)
    ) into v_trainings_heute;
  end if;

  if hat_bereich('anwesenheit') then
    select jsonb_build_object(
      'wert', (select count(*) from trainings_abmeldungen
               where verein_id = any(v_anwesenheit_vereine) and datum = v_heute),
      'verlauf', (select jsonb_agg((select count(*) from trainings_abmeldungen ab
                    where ab.verein_id = any(v_anwesenheit_vereine) and ab.datum >= w and ab.datum < w + 7) order by w)
                  from unnest(v_wochen) w)
    ) into v_abmeldungen;

    select jsonb_build_object(
      'prozent', (select round(100.0 * count(*) filter (where anwesend) / nullif(count(*), 0), 1)
                  from trainings_anwesenheit
                  where verein_id = any(v_anwesenheit_vereine) and datum >= v_monat),
      'vormonat', (select round(100.0 * count(*) filter (where anwesend) / nullif(count(*), 0), 1)
                   from trainings_anwesenheit
                   where verein_id = any(v_anwesenheit_vereine)
                     and datum >= (v_monat - interval '1 month')::date and datum < v_monat),
      'verlauf', (select jsonb_agg(v.prozent order by v.woche_start) from dashboard_beteiligung_verlauf(8) v)
    ) into v_beteiligung;
  end if;

  select t.name, t.ort, min((tag->>'datum')::date)
    into v_erst_name, v_erst_ort, v_erst_datum
  from turniere t, jsonb_array_elements(t.tage) tag where turnier_sichtbar(t.verein_id) and (tag->>'datum')::date between v_woche and v_woche + 6
  group by t.id, t.name, t.ort
  order by 3
  limit 1;

  select jsonb_build_object(
    'wert', (select count(distinct t.id) from turniere t, jsonb_array_elements(t.tage) tag where turnier_sichtbar(t.verein_id) and (tag->>'datum')::date between v_woche and v_woche + 6),
    'erstes_name', v_erst_name,
    'erstes_ort', v_erst_ort,
    'erstes_datum', v_erst_datum,
    'verlauf', (select jsonb_agg((select count(distinct t.id) from turniere t, jsonb_array_elements(t.tage) tag where turnier_sichtbar(t.verein_id) and (tag->>'datum')::date >= w and (tag->>'datum')::date < w + 7) order by w)
                from unnest(v_wochen) w)
  ) into v_turniere;

  -- Nur eigene Gespraeche -- auch der Plattform-Admin sieht keine fremden Chats.
  select jsonb_build_object(
    'ungelesen', eigene_ungelesene_nachrichten_anzahl(),
    'verlauf', (select jsonb_agg((select count(*) from nachrichten n
                  join gespraech_teilnehmer gt on gt.gespraech_id = n.gespraech_id and gt.user_id = auth.uid()
                  where n.sender_id <> auth.uid()
                    and n.gesendet_am >= w and n.gesendet_am < (w + 7)) order by w)
                from unnest(v_wochen) w)
  ) into v_nachrichten;

  return jsonb_build_object(
    'mitglieder', v_mitglieder,
    'trainings_heute', v_trainings_heute,
    'abmeldungen_heute', v_abmeldungen,
    'turniere_woche', v_turniere,
    'nachrichten', v_nachrichten,
    'beteiligung', v_beteiligung
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dashboard_meine_kinder()
 RETURNS TABLE(kind_vm_id uuid, name text, verein_name text, gruppen text, training_heute text, heute_abgemeldet boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with kinder as (
    select distinct k.id, k.user_id, k.verein_id
    from eltern_kind_zuordnung ekz
    join vereins_mitglieder e on e.id = ekz.eltern_vm_id and e.user_id = auth.uid()
    join vereins_mitglieder k on k.id = ekz.kind_vm_id
  ),
  heute as (
    select (now() at time zone 'Europe/Berlin')::date as d,
           extract(isodow from (now() at time zone 'Europe/Berlin'))::int as dow
  )
  select k.id,
    coalesce((select a.anzeige from anzeige_namen(array[k.user_id]) a), 'Kind'),
    v.name,
    (select string_agg(g.name, ', ' order by g.name) from gruppen_mitglieder gm join gruppen g on g.id = gm.gruppe_id where gm.vereins_mitglied_id = k.id),
    (select string_agg(to_char(tt.von, 'HH24:MI') || coalesce('–' || to_char(tt.bis, 'HH24:MI'), '') || ' ' || g.name, ', ' order by tt.von)
       from trainingstermine tt join gruppen g on g.id = tt.gruppe_id
       join gruppen_mitglieder gm on gm.gruppe_id = tt.gruppe_id and gm.vereins_mitglied_id = k.id, heute h
       where (tt.ist_wiederholend and tt.wochentag = h.dow) or (not tt.ist_wiederholend and tt.datum = h.d)),
    exists (select 1 from trainings_abmeldungen ab, heute h where ab.vereins_mitglied_id = k.id and ab.datum = h.d)
  from kinder k
  join vereine v on v.id = k.verein_id
  order by 2;
$function$
;

CREATE OR REPLACE FUNCTION public.dashboard_naechste_termine(p_anzahl integer DEFAULT 6)
 RETURNS TABLE(typ text, titel text, ort text, datum date, von time without time zone, bis time without time zone, wiederholend boolean, wochentag integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  return query
  (
    select 'training'::text, coalesce(g.name, tt.titel, 'Training'), tt.halle, tt.datum, tt.von, tt.bis,
      tt.ist_wiederholend, tt.wochentag
    from trainingstermine tt
    left join gruppen g on g.id = tt.gruppe_id
    where tt.id in (select s.id from sichtbare_trainings() s)
      and (tt.ist_wiederholend = true
        or (tt.datum is not null and tt.datum between v_heute and v_heute + 30))
  )
  union all
  (
    select case kt.art when 'privat' then 'privat' when 'sitzung' then 'sitzung' else 'termin' end,
      kt.titel, kt.ort, kt.datum, kt.von, kt.bis, false, null::int
    from kalender_termine(v_heute, v_heute + 30) kt
    where coalesce(kt.bis_datum, kt.datum) >= v_heute
  )
  union all
  (
    select 'turnier'::text, t.name, t.ort, (tag->>'datum')::date, null::time, null::time, false, null::int
    from turniere t, jsonb_array_elements(t.tage) tag where turnier_sichtbar(t.verein_id) and auth.uid() is not null
      and (tag->>'datum')::date between v_heute and v_heute + 30
  )
  order by 7 desc, 4 nulls last, 5 nulls first
  limit least(greatest(p_anzahl, 1), 50);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dashboard_naechste_turniere(p_anzahl integer DEFAULT 4)
 RETURNS TABLE(id uuid, name text, ort text, erster_tag date, anzahl_tage integer, neu boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  select t.id, t.name, t.ort,
    min((tag->>'datum')::date),
    count(*)::int,
    t.created_at > now() - interval '7 days'
  from turniere t, jsonb_array_elements(t.tage) tag where turnier_sichtbar(t.verein_id) group by t.id, t.name, t.ort, t.created_at
  having max((tag->>'datum')::date) >= v_heute
  order by min((tag->>'datum')::date)
  limit least(greatest(p_anzahl, 1), 50);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dashboard_radar()
 RETURNS TABLE(typ text, dringlichkeit text, titel text, untertitel text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
  v_beitrags_vereine uuid[] := dashboard_vereine('beitraege');
  v_anwesenheit_vereine uuid[] := dashboard_vereine('anwesenheit');
  v_datei_vereine uuid[] := case when mein_tarif() in ('basic', 'verein') then meine_vereine() else '{}'::uuid[] end;
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  (
    select 'beitrag'::text, 'hoch'::text,
      count(*)::text || ' überfällige' || (case when count(*) = 1 then 'r Beitrag' else ' Beiträge' end),
      'seit Fälligkeit unbezahlt'::text
    from beitraege
    where verein_id = any(v_beitrags_vereine) and bezahlt = false and faellig < v_heute
    having count(*) > 0
  )
  union all
  (
    select 'abmeldung'::text, 'mittel'::text,
      count(*)::text || ' Abmeldung' || (case when count(*) = 1 then '' else 'en' end) || ' für heute',
      '(' || count(distinct gruppe_id)::text || ' Gruppe' || (case when count(distinct gruppe_id) = 1 then '' else 'n' end) || ' betroffen)'
    from trainings_abmeldungen
    where verein_id = any(v_anwesenheit_vereine) and datum = v_heute
    having count(*) > 0
  )
  union all
  (
    select 'turnier'::text, 'info'::text, 'Neue Ausschreibung erkannt'::text,
      t.name || coalesce(' am ' || to_char((select min((tag->>'datum')::date) from jsonb_array_elements(t.tage) tag), 'DD.MM.YYYY'), '')
    from turniere t where t.verein_id is null and t.created_at > now() - interval '7 days'
    order by t.created_at desc
    limit 3
  )
  union all
  (
    select 'datei'::text, 'neu'::text,
      count(*)::text || ' neue Datei' || (case when count(*) = 1 then '' else 'en' end) || ' im Verein',
      'in den letzten 7 Tagen hochgeladen'::text
    from dateien
    where verein_id = any(v_datei_vereine) and hochgeladen_am > now() - interval '7 days'
    having count(*) > 0
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dashboard_vereine(p_bereich text)
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when ist_plattform_admin_aktuell() then coalesce((select array_agg(v.id) from vereine v), '{}')
    else coalesce((select array_agg(distinct mb.verein_id) from meine_bereiche() mb
                   where mb.bereich = p_bereich and mb.verein_id is not null), '{}')
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.effektiver_zugang(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'persoenlicher_tarif', p.tarif,
    'persoenlich_aktiv_bis', p.tarif_aktiv_bis,
    'vereinszugang', vereinslizenz_verein_von(p.id) is not null,
    'verein_id', vereinslizenz_verein_von(p.id),
    'effektiv', tarif_von(p.id),
    'plattform_admin', p.ist_plattform_admin)
  from profiles p where p.id = p_user_id;
$function$
;

CREATE OR REPLACE FUNCTION public.eigene_ungelesene_nachrichten_anzahl()
 RETURNS bigint
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(c.ungelesen), 0)::bigint from chat_liste() c;
$function$
;

CREATE OR REPLACE FUNCTION public.einladung_info(p_token uuid)
 RETURNS TABLE(verein_name text, rolle text, gruppe_name text, eingeladen_von text, gueltig boolean, grund text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select v.name, r.name, g.name,
    (select a.anzeige from anzeige_namen(array[e.created_by]) a),
    (not e.revoked and (e.expires_at is null or e.expires_at > now()) and e.uses < e.max_uses),
    case
      when e.revoked then 'Diese Einladung wurde zurückgezogen.'
      when e.expires_at is not null and e.expires_at <= now() then 'Diese Einladung ist abgelaufen.'
      when e.uses >= e.max_uses then 'Diese Einladung wurde bereits verwendet.'
      else null
    end
  from einladungen e
  join vereine v on v.id = e.verein_id
  left join rollen r on r.id = e.rolle_id
  left join gruppen g on g.id = e.gruppe_id
  where e.token = p_token and auth.uid() is not null;
$function$
;

CREATE OR REPLACE FUNCTION public.eltern_code_erzeugen()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_code text := '';
  v_zeichen text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if not ist_minderjaehrig(auth.uid()) then
    raise exception 'Ein Eltern-Code ist nur für Konten unter 18 Jahren möglich.' using errcode = 'P0001';
  end if;
  for i in 1..8 loop
    v_code := v_code || substr(v_zeichen, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 32), 1);
  end loop;
  insert into eltern_codes (kind_id, code_hash, laeuft_ab)
  values (auth.uid(), encode(extensions.digest(v_code, 'sha256'), 'hex'), now() + interval '30 minutes')
  on conflict (kind_id) do update set code_hash = excluded.code_hash, laeuft_ab = excluded.laeuft_ab;
  return v_code;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.eltern_nachrichtensperre(p_kind uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from kind_einstellungen ke where ke.kind_id = p_kind and not ke.nachrichten_erlaubt)
     and hat_eltern(p_kind) and ist_minderjaehrig(p_kind);
$function$
;

CREATE OR REPLACE FUNCTION public.eltern_verknuepfen(p_code text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_kind uuid;
  v_verein uuid;
  v_name text;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if geburtsdatum_von(auth.uid()) is null or ist_minderjaehrig(auth.uid()) then
    raise exception 'Nur volljährige Konten mit eingetragenem Geburtsdatum können sich als Elternteil verknüpfen.' using errcode = 'P0001';
  end if;
  if (select count(*) from eltern_code_versuche v where v.user_id = auth.uid() and v.am > now() - interval '1 hour') >= 10 then
    raise exception 'Zu viele Versuche. Bitte versuche es in einer Stunde erneut.' using errcode = 'P0001';
  end if;
  insert into eltern_code_versuche (user_id) values (auth.uid());
  select c.kind_id into v_kind from eltern_codes c
  where c.code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex') and c.laeuft_ab > now();
  if v_kind is null then
    raise exception 'Der Code ist ungültig oder abgelaufen.' using errcode = 'P0001';
  end if;
  if v_kind = auth.uid() or ist_blockiert(auth.uid(), v_kind) then
    raise exception 'Diese Verknüpfung ist nicht möglich.' using errcode = 'P0001';
  end if;
  delete from eltern_codes where kind_id = v_kind;
  if exists (select 1 from eltern_verknuepfungen ev where ev.eltern_id = auth.uid() and ev.kind_id = v_kind) then
    return (select ev.status from eltern_verknuepfungen ev where ev.eltern_id = auth.uid() and ev.kind_id = v_kind);
  end if;
  -- Ist das Kind in einem Verein, bestaetigt zusaetzlich der Vereinsadmin
  select vm.verein_id into v_verein from vereins_mitglieder vm
  where vm.user_id = v_kind and coalesce(vm.aktiv, true)
    and exists (select 1 from vereins_mitglieder a join rollen r on r.id = a.rolle_id
                where a.verein_id = vm.verein_id and coalesce(a.aktiv, true) and rollen_typ(r.name) = 'admin')
  order by vm.created_at limit 1;
  v_name := coalesce((select a.anzeige from anzeige_namen(array[auth.uid()]) a), 'Ein Elternteil');
  if v_verein is null then
    insert into eltern_verknuepfungen (eltern_id, kind_id, status, bestaetigt_am)
    values (auth.uid(), v_kind, 'bestaetigt', now());
    insert into benachrichtigungen (user_id, typ, text) values (v_kind, 'eltern', v_name || ' ist jetzt als Elternteil mit deinem Konto verknüpft.');
    return 'bestaetigt';
  end if;
  insert into eltern_verknuepfungen (eltern_id, kind_id, status, verein_id) values (auth.uid(), v_kind, 'wartet_verein', v_verein);
  insert into benachrichtigungen (user_id, typ, text)
  select a.user_id, 'eltern', v_name || ' möchte sich als Elternteil mit '
         || coalesce((select x.anzeige from anzeige_namen(array[v_kind]) x), 'einem Mitglied') || ' verknüpfen. Bitte in der Mitgliederverwaltung bestätigen.'
  from vereins_mitglieder a join rollen r on r.id = a.rolle_id
  where a.verein_id = v_verein and coalesce(a.aktiv, true) and rollen_typ(r.name) = 'admin' and a.user_id is not null;
  return 'wartet_verein';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.eltern_verknuepfung_aufheben(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ev eltern_verknuepfungen%rowtype;
begin
  select * into ev from eltern_verknuepfungen where id = p_id;
  if ev.id is null or not (ev.eltern_id = auth.uid() or ist_plattform_admin_aktuell() or exists (
      select 1 from vereins_mitglieder a join rollen r on r.id = a.rolle_id
      join vereins_mitglieder k on k.verein_id = a.verein_id and k.user_id = ev.kind_id
      where a.user_id = auth.uid() and coalesce(a.aktiv, true) and rollen_typ(r.name) = 'admin')) then
    raise exception 'Diese Verknüpfung kannst du nicht aufheben.' using errcode = '42501';
  end if;
  delete from eltern_verknuepfungen where id = ev.id;
  -- Ohne bestaetigtes Elternteil gelten wieder die Standardeinstellungen
  if not hat_eltern(ev.kind_id) then
    delete from kind_einstellungen where kind_id = ev.kind_id;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.eltern_verknuepfung_entscheiden(p_id uuid, p_annehmen boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ev eltern_verknuepfungen%rowtype;
begin
  select * into ev from eltern_verknuepfungen where id = p_id and status = 'wartet_verein';
  if ev.id is null or not (ist_plattform_admin_aktuell() or exists (
      select 1 from vereins_mitglieder a join rollen r on r.id = a.rolle_id
      where a.verein_id = ev.verein_id and a.user_id = auth.uid() and coalesce(a.aktiv, true) and rollen_typ(r.name) = 'admin')) then
    raise exception 'Diese Anfrage kannst du nicht bearbeiten.' using errcode = '42501';
  end if;
  if p_annehmen then
    update eltern_verknuepfungen set status = 'bestaetigt', bestaetigt_am = now(), bestaetigt_von = auth.uid() where id = ev.id;
    insert into benachrichtigungen (user_id, typ, text) values
      (ev.eltern_id, 'eltern', 'Der Verein hat die Verknüpfung mit deinem Kind bestätigt.'),
      (ev.kind_id, 'eltern', coalesce((select a.anzeige from anzeige_namen(array[ev.eltern_id]) a), 'Ein Elternteil') || ' ist jetzt als Elternteil mit deinem Konto verknüpft.');
  else
    delete from eltern_verknuepfungen where id = ev.id;
    insert into benachrichtigungen (user_id, typ, text) values (ev.eltern_id, 'eltern', 'Der Verein hat die Eltern-Verknüpfung nicht bestätigt.');
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.erstelle_rechnung(p_typ text, p_ziel_user_id uuid, p_ziel_verein_id uuid, p_tarif text, p_periode text, p_betrag numeric, p_zahlungsweg text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_nummer text;
  v_name text;
  v_adresse text;
  v_email text;
  v_leistung text;
  v_rechnung_id uuid;
  v_tarif_label text;
begin
  -- Nur der Service-Role-Kontext (auth.uid() ist dann NULL, z.B. aus Edge Functions)
  -- oder ein echter Plattform-Admin duerfen Rechnungen erzeugen.
  if auth.uid() is not null and not exists (
    select 1 from profiles pchk where pchk.id = auth.uid() and pchk.ist_plattform_admin = true
  ) then
    raise exception 'Nicht berechtigt';
  end if;

  v_tarif_label := case p_tarif when 'basic' then 'Basic' when 'verein' then 'Verein' else initcap(p_tarif) end;
  v_leistung := 'TanzRaum ' || v_tarif_label || '-Tarif – ' || (case p_periode when 'jahr' then 'Jahreslizenz' else 'Monatslizenz' end);

  if p_typ = 'basic' then
    select (vorname || ' ' || nachname) into v_name from profiles where id = p_ziel_user_id;
    select email::text into v_email from auth.users where id = p_ziel_user_id;
    v_adresse := null;
  else
    select name, (strasse || ' ' || hausnummer || ', ' || plz || ' ' || ort) into v_name, v_adresse
      from vereine where id = p_ziel_verein_id;
    select u.email::text into v_email
      from vereins_mitglieder vm join auth.users u on u.id = vm.user_id join rollen r on r.id = vm.rolle_id
      where vm.verein_id = p_ziel_verein_id and lower(r.name) like '%admin%' limit 1;
  end if;

  v_nummer := naechste_rechnungsnummer();

  insert into rechnungen (nummer, typ, ziel_user_id, ziel_verein_id, empfaenger_name, empfaenger_adresse, empfaenger_email, leistung, zeitraum, betrag, zahlungsweg)
  values (v_nummer, p_typ, p_ziel_user_id, p_ziel_verein_id, coalesce(v_name,'—'), v_adresse, coalesce(v_email,''), v_leistung, p_periode, p_betrag, p_zahlungsweg)
  returning id into v_rechnung_id;

  return v_rechnung_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fernwartung_anfordern(p_verein_id uuid, p_typ text, p_beschreibung text, p_fernzugriff boolean)
 RETURNS TABLE(anfrage_id uuid, code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_code text;
  v_verein_name text;
begin
  if not is_verein_admin(p_verein_id) then
    raise exception 'Nicht berechtigt';
  end if;

  if p_fernzugriff then
    v_code := 'TR-' || upper(substr(md5(random()::text),1,4)) || '-' || upper(substr(md5(random()::text),1,4));
  end if;

  insert into fernwartungs_anfragen (verein_id, angefordert_von, typ, beschreibung, fernzugriff_gewuenscht, code, laeuft_ab_am)
  values (p_verein_id, auth.uid(), p_typ, p_beschreibung, p_fernzugriff, v_code, case when p_fernzugriff then now() + interval '24 hours' else null end)
  returning id into v_id;

  select name into v_verein_name from vereine where id = p_verein_id;

  insert into benachrichtigungen (user_id, typ, text)
  select p.id, 'fernwartungs_anfrage',
    'Fernwartungs-Anfrage von ' || coalesce(v_verein_name,'einem Verein') || ' (' || coalesce(p_typ,'Sonstiges') || ')' ||
    case when p_fernzugriff then ' — Zugangscode angefordert.' else '' end
  from profiles p where p.ist_plattform_admin = true;

  return query select v_id, v_code;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fernwartung_widerrufen(p_anfrage_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_verein_id uuid;
begin
  select verein_id into v_verein_id from fernwartungs_anfragen where id = p_anfrage_id;
  if v_verein_id is null then return false; end if;
  if not (is_verein_admin(v_verein_id) or exists(select 1 from profiles where id=auth.uid() and ist_plattform_admin=true)) then
    raise exception 'Nicht berechtigt';
  end if;
  update fernwartungs_anfragen set status='widerrufen', widerrufen_am=now() where id=p_anfrage_id;
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.geburtsdatum_setzen(p_datum date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if p_datum is null or p_datum > (now() at time zone 'Europe/Berlin')::date or p_datum < date '1900-01-01' then
    raise exception 'Bitte gib ein gültiges Geburtsdatum ein.' using errcode = 'P0001';
  end if;
  if (select geburtsdatum from profiles where id = auth.uid()) is not null then
    raise exception 'Dein Geburtsdatum ist bereits eingetragen. Änderungen nur über den TanzRaum-Support.' using errcode = 'P0001';
  end if;
  update profiles set geburtsdatum = p_datum where id = auth.uid();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.geburtsdatum_von(p_user_id uuid)
 RETURNS date
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- das juengste bekannte Datum zaehlt (Profil oder Mitgliederdaten eines Vereins)
  select greatest((select p.geburtsdatum from profiles p where p.id = p_user_id),
                  (select max(m.geburtsdatum) from mitglieder m where m.user_id = p_user_id));
$function$
;

CREATE OR REPLACE FUNCTION public.geburtstage_heute(p_verein_id uuid)
 RETURNS TABLE(vorname text, nachname text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from vereins_mitglieder where verein_id = p_verein_id and user_id = auth.uid()) then
    return;
  end if;
  return query
    select m.vorname, m.nachname
    from mitglieder m
    where m.verein_id = p_verein_id
      and m.geburtsdatum is not null
      and extract(month from m.geburtsdatum) = extract(month from current_date)
      and extract(day from m.geburtsdatum) = extract(day from current_date);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.geburtstage_kommend(p_verein_id uuid, p_anzahl integer DEFAULT 5)
 RETURNS TABLE(vorname text, nachname_initial text, naechstes_datum date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from vereins_mitglieder where verein_id = p_verein_id and user_id = auth.uid()) then
    return;
  end if;
  return query
    select m.vorname, upper(left(coalesce(m.nachname,''),1)) as nachname_initial,
      case
        when to_date(extract(month from m.geburtsdatum)::text || '-' || extract(day from m.geburtsdatum)::text || '-' || extract(year from current_date)::text, 'MM-DD-YYYY') >= current_date
          then to_date(extract(month from m.geburtsdatum)::text || '-' || extract(day from m.geburtsdatum)::text || '-' || extract(year from current_date)::text, 'MM-DD-YYYY')
        else to_date(extract(month from m.geburtsdatum)::text || '-' || extract(day from m.geburtsdatum)::text || '-' || (extract(year from current_date)::int + 1)::text, 'MM-DD-YYYY')
      end as naechstes_datum
    from mitglieder m
    where m.verein_id = p_verein_id and m.geburtsdatum is not null
    order by naechstes_datum
    limit p_anzahl;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.gruppenchat_anlegen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into gespraeche (typ, verein_id, gruppe_id) values ('trainingsgruppe', new.verein_id, new.id) on conflict do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.gueltige_bereiche()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$ select array['mitglieder','anwesenheit','beitraege','material','trainingsplan','saison','netzwerk','beitritt'] $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_geb date;
begin
  begin
    if (new.raw_user_meta_data->>'geburtsdatum') ~ '^\d{4}-\d{2}-\d{2}$' then
      v_geb := (new.raw_user_meta_data->>'geburtsdatum')::date;
      if v_geb > current_date or v_geb < date '1900-01-01' then v_geb := null; end if;
    end if;
  exception when others then v_geb := null;
  end;
  insert into public.profiles (id, vorname, nachname, handle, geschlecht, tarif, konto_privat, geburtsdatum)
  values (
    new.id,
    new.raw_user_meta_data->>'vorname',
    new.raw_user_meta_data->>'nachname',
    new.raw_user_meta_data->>'handle',
    new.raw_user_meta_data->>'gender',
    'free',
    coalesce((new.raw_user_meta_data->>'privat')::boolean, false),
    v_geb
  )
  on conflict (id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.hat_bereich(p_bereich text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ist_plattform_admin_aktuell()
      or exists (select 1 from meine_bereiche() mb where mb.bereich = p_bereich);
$function$
;

CREATE OR REPLACE FUNCTION public.hat_eltern(p_kind uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from eltern_verknuepfungen ev where ev.kind_id = p_kind and ev.status = 'bestaetigt')
      or exists (select 1 from eltern_kind_zuordnung ekz join vereins_mitglieder k on k.id = ekz.kind_vm_id
                 join vereins_mitglieder e on e.id = ekz.eltern_vm_id
                 where k.user_id = p_kind and e.user_id is not null);
$function$
;

CREATE OR REPLACE FUNCTION public.hat_gespraech_zugriff(p_gespraech_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  g gespraeche%rowtype;
begin
  if auth.uid() is null then return false; end if;
  select * into g from gespraeche where id = p_gespraech_id;
  if not found then return false; end if;

  if g.typ = 'dm' then
    return exists (select 1 from gespraech_teilnehmer t where t.gespraech_id = g.id and t.user_id = auth.uid());
  elsif g.typ = 'juryraum' then
    return juryraum_sieht_turnier(g.turnier_id);
  end if;
  if not verein_hat_lizenz(g.verein_id) then return false; end if;
  if g.typ = 'verein' then
    return exists (select 1 from vereins_mitglieder vm where vm.verein_id = g.verein_id and vm.user_id = auth.uid() and coalesce(vm.aktiv, true));
  elsif g.typ = 'trainingsgruppe' then
    return is_verein_admin(g.verein_id)
      or exists (select 1 from gruppen_mitglieder gm join vereins_mitglieder vm on vm.id = gm.vereins_mitglied_id
                 where gm.gruppe_id = g.gruppe_id and vm.user_id = auth.uid() and coalesce(vm.aktiv, true));
  end if;
  return false;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.hat_vereinsbereich(p_verein_id uuid, p_bereich text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ist_plattform_admin_aktuell()
      or is_verein_admin(p_verein_id)
      or exists (select 1 from meine_bereiche() mb where mb.verein_id = p_verein_id and mb.bereich = p_bereich);
$function$
;

CREATE OR REPLACE FUNCTION public.hat_vereinsbeziehung(p_a uuid, p_b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
      select 1 from vereins_mitglieder a
      join vereins_mitglieder b on b.verein_id = a.verein_id and b.user_id = p_b and coalesce(b.aktiv, true)
      where a.user_id = p_a and coalesce(a.aktiv, true) and verein_hat_lizenz(a.verein_id))
    or exists (
      select 1 from eltern_kind_zuordnung ekz
      join vereins_mitglieder e on e.id = ekz.eltern_vm_id
      join vereins_mitglieder k on k.id = ekz.kind_vm_id
      where (e.user_id = p_a and k.user_id = p_b) or (e.user_id = p_b and k.user_id = p_a));
$function$
;

CREATE OR REPLACE FUNCTION public.ical_feed(p_token text, p_inhalt text DEFAULT 'persoenlich'::text)
 RETURNS TABLE(uid text, titel text, ort text, beschreibung text, beginn timestamp with time zone, ende timestamp with time zone, ganztags boolean, start_datum date, end_datum date, kalender_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid;
  v_name text;
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
  v_von date;
  v_ab date;
begin
  if p_token is null or length(p_token) < 32 then
    return;
  end if;
  select p.id, coalesce(nullif(btrim(p.vorname), ''), 'TanzRaum') into v_user, v_name
  from profiles p where p.ical_token = p_token and coalesce(p.gesperrt, false) = false;
  if v_user is null then
    return;
  end if;

  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  if mein_tarif() not in ('basic', 'verein') then
    return;
  end if;

  if p_inhalt = 'turniere' then
    return query
    select 'turnier-' || k.id || '-' || k.datum || '@tanzraum.app', k.name, k.ort,
      concat_ws(E'\n', nullif(concat_ws(' · ', k.kategorie, k.typ), ''),
        case when k.tage_gesamt > 1 then 'Tag ' || k.tag_nr || ' von ' || k.tage_gesamt end,
        k.ausschreibung_url),
      null::timestamptz, null::timestamptz, true, k.datum, k.datum + 1, 'TanzRaum Turniere'
    from kalender_turniere(v_heute - 30, v_heute + 400) k;
    return;
  end if;

  -- Trainings: je 60 Tage, von 2 Wochen zurueck bis 16 Wochen voraus; ganz abgemeldete Trainings entfallen.
  v_von := v_heute - 14;
  while v_von <= v_heute + 112 loop
    return query
    select 'training-' || tk.termin_id || '-' || tk.datum || '@tanzraum.app',
      coalesce(nullif(btrim(tk.titel), ''), 'Training') || ' – ' || tk.gruppe_name
        || coalesce(' (' || (select string_agg(p->>'name', ', ') from jsonb_array_elements(tk.personen) p
                              where not (p->>'ich')::boolean and not (p->>'abgemeldet')::boolean) || ')', ''),
      tk.halle, tk.verein_name,
      (tk.datum + tk.von) at time zone 'Europe/Berlin',
      (tk.datum + coalesce(tk.bis, tk.von + interval '90 minutes')) at time zone 'Europe/Berlin',
      false, tk.datum, tk.datum, 'TanzRaum – ' || v_name
    from training_kalender(v_von, least(v_von + 59, v_heute + 112)) tk
    where tk.von is not null
      and not (jsonb_array_length(tk.personen) > 0
               and not exists (select 1 from jsonb_array_elements(tk.personen) p where not (p->>'abgemeldet')::boolean));
    v_von := v_von + 60;
  end loop;

  -- Vereinstermine und private Termine (abgesagte Termine mit Rueckmeldung nur fuer sich selbst werden ausgelassen).
  return query
  select 'termin-' || kt.id || '@tanzraum.app',
    kt.titel || case when kt.verein_id is not null and kt.art = 'sitzung' then ' (Sitzung)' else '' end,
    kt.ort,
    concat_ws(E'\n', kt.verein_name, kt.beschreibung),
    case when kt.von is null then null else (kt.datum + kt.von) at time zone 'Europe/Berlin' end,
    case when kt.von is null then null
         else (coalesce(kt.bis_datum, kt.datum) + coalesce(kt.bis, kt.von + interval '1 hour')) at time zone 'Europe/Berlin' end,
    kt.von is null, kt.datum, coalesce(kt.bis_datum, kt.datum) + 1, 'TanzRaum – ' || v_name
  from kalender_termine(v_heute - 30, v_heute + 365) kt
  where not (jsonb_array_length(kt.personen) > 0
             and not exists (select 1 from jsonb_array_elements(kt.personen) p where coalesce(p->>'status', '') <> 'abgesagt'));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.interner_aufruf_ok(p_geheimnis text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p_geheimnis is not null and p_geheimnis = (select decrypted_secret from vault.decrypted_secrets where name = 'chat_push_geheimnis');
$function$
;

CREATE OR REPLACE FUNCTION public.invite_einloesen(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row einladungen%rowtype;
  v_verein_name text;
  v_existing_id uuid;
  v_vm_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Bitte zuerst anmelden.');
  end if;
  select * into v_row from einladungen where token = p_token for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Einladungslink ungültig.');
  end if;
  if v_row.revoked then
    return jsonb_build_object('success', false, 'error', 'Dieser Einladungslink wurde zurückgezogen.');
  end if;
  if v_row.expires_at is not null and v_row.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'Dieser Einladungslink ist abgelaufen.');
  end if;
  if v_row.uses >= v_row.max_uses then
    return jsonb_build_object('success', false, 'error', 'Dieser Einladungslink wurde bereits verwendet.');
  end if;

  select id into v_existing_id from vereins_mitglieder where user_id = auth.uid() and verein_id = v_row.verein_id;
  if v_existing_id is not null and v_row.gruppe_id is null then
    return jsonb_build_object('success', false, 'error', 'Du bist bereits Mitglied in diesem Verein.');
  end if;

  if v_existing_id is null then
    insert into vereins_mitglieder (user_id, verein_id, rolle_id) values (auth.uid(), v_row.verein_id, v_row.rolle_id)
    returning id into v_vm_id;
  else
    v_vm_id := v_existing_id;
  end if;
  if v_row.gruppe_id is not null then
    insert into gruppen_mitglieder (gruppe_id, vereins_mitglied_id, funktion) values (v_row.gruppe_id, v_vm_id, 'mitglied')
    on conflict do nothing;
  end if;

  update einladungen set uses = uses + 1 where id = v_row.id;
  select name into v_verein_name from vereine where id = v_row.verein_id;
  return jsonb_build_object('success', true, 'verein_name', v_verein_name, 'verein_id', v_row.verein_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_verein_admin(p_verein_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from vereins_mitglieder vm
    join rollen r on r.id = vm.rolle_id
    where vm.verein_id = p_verein_id
      and vm.user_id = auth.uid()
      and lower(r.name) like '%admin%'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_verein_admin_oder_trainer(p_verein_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from vereins_mitglieder vm
    join rollen r on r.id = vm.rolle_id
    where vm.verein_id = p_verein_id
      and vm.user_id = auth.uid()
      and (lower(r.name) like '%admin%' or lower(r.name) like '%trainer%')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.ist_auf_map(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from profiles p
    where p.id = p_user_id and p.map_sichtbar and p.map_lat is not null
      and not coalesce(p.gesperrt, false) and not coalesce(p.konto_privat, false)
      and not (hat_eltern(p.id) and ist_minderjaehrig(p.id)
               and exists (select 1 from kind_einstellungen ke where ke.kind_id = p.id and not ke.map_erlaubt)));
$function$
;

CREATE OR REPLACE FUNCTION public.ist_blockiert(p_a uuid, p_b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from blockierungen b
                 where (b.blocker_id = p_a and b.blockiert_id = p_b) or (b.blocker_id = p_b and b.blockiert_id = p_a));
$function$
;

CREATE OR REPLACE FUNCTION public.ist_chat_leitung(p_gespraech_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from gespraeche g
    where g.id = p_gespraech_id and g.typ in ('verein', 'trainingsgruppe') and hat_gespraech_zugriff(g.id)
      and (is_verein_admin(g.verein_id)
           or (g.typ = 'verein' and ist_vereinsleitung(g.verein_id))
           or (g.typ = 'trainingsgruppe' and ist_gruppen_betreuung_erweitert(g.gruppe_id))));
$function$
;

CREATE OR REPLACE FUNCTION public.ist_eigenes_oder_kind(p_vm_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from vereins_mitglieder vm where vm.id = p_vm_id and vm.user_id = auth.uid())
      or exists (select 1 from eltern_kind_zuordnung ekz
                 join vereins_mitglieder ve on ve.id = ekz.eltern_vm_id
                 where ekz.kind_vm_id = p_vm_id and ve.user_id = auth.uid());
$function$
;

CREATE OR REPLACE FUNCTION public.ist_elternteil_von(p_eltern uuid, p_kind uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p_eltern is not null and p_kind is not null and (
    exists (select 1 from eltern_verknuepfungen ev where ev.eltern_id = p_eltern and ev.kind_id = p_kind and ev.status = 'bestaetigt')
    or exists (select 1 from eltern_kind_zuordnung ekz
               join vereins_mitglieder e on e.id = ekz.eltern_vm_id
               join vereins_mitglieder k on k.id = ekz.kind_vm_id
               where e.user_id = p_eltern and k.user_id = p_kind));
$function$
;

CREATE OR REPLACE FUNCTION public.ist_endnutzer()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select auth.uid() is not null and not ist_plattform_admin_aktuell(); $function$
;

CREATE OR REPLACE FUNCTION public.ist_gruppen_betreuung(p_gruppe_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from gruppen g where g.id = p_gruppe_id and public.is_verein_admin(g.verein_id)
  ) or exists (
    select 1 from gruppen_mitglieder gm
    join vereins_mitglieder vm on vm.id = gm.vereins_mitglied_id
    where gm.gruppe_id = p_gruppe_id and vm.user_id = auth.uid() and gm.funktion = 'trainer'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.ist_gruppen_betreuung_erweitert(p_gruppe_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from gruppen g where g.id = p_gruppe_id and public.is_verein_admin(g.verein_id)
  ) or exists (
    select 1 from gruppen_mitglieder gm
    join vereins_mitglieder vm on vm.id = gm.vereins_mitglied_id
    where gm.gruppe_id = p_gruppe_id and vm.user_id = auth.uid() and gm.funktion in ('trainer','betreuer')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.ist_minderjaehrig(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (geburtsdatum_von(p_user_id) + interval '18 years')::date > (now() at time zone 'Europe/Berlin')::date,
    exists (select 1 from eltern_kind_zuordnung ekz join vereins_mitglieder k on k.id = ekz.kind_vm_id where k.user_id = p_user_id));
$function$
;

CREATE OR REPLACE FUNCTION public.ist_netzwerk_trainer(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
    where vm.user_id = p_user_id and coalesce(vm.aktiv, true)
      and rollen_typ(r.name) = 'trainer' and verein_hat_lizenz(vm.verein_id));
$function$
;

CREATE OR REPLACE FUNCTION public.ist_plattform_admin_aktuell()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.ist_plattform_admin = true);
$function$
;

CREATE OR REPLACE FUNCTION public.ist_recovery_sitzung()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from auth.mfa_amr_claims c
    where c.session_id = nullif(auth.jwt()->>'session_id', '')::uuid
      and c.authentication_method in ('recovery', 'otp', 'magiclink')
      and c.created_at > now() - interval '30 minutes');
$function$
;

CREATE OR REPLACE FUNCTION public.ist_relevantes_mitglied(p_vm_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from vereins_mitglieder ziel
    where ziel.id = p_vm_id
      and (
        ist_plattform_admin_aktuell()
        or is_verein_admin(ziel.verein_id)
        or ist_eigenes_oder_kind(ziel.id)
        or (exists (select 1 from meine_bereiche() mb where mb.verein_id = ziel.verein_id and mb.bereich = 'mitglieder')
            and exists (
              select 1 from gruppen_mitglieder gz
              join gruppen_mitglieder gi on gi.gruppe_id = gz.gruppe_id
              join vereins_mitglieder ich on ich.id = gi.vereins_mitglied_id and ich.user_id = auth.uid()
              where gz.vereins_mitglied_id = ziel.id))
      ));
$function$
;

CREATE OR REPLACE FUNCTION public.ist_trainer_betreuer_oder_admin(p_verein_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from vereins_mitglieder vm
    join rollen r on r.id = vm.rolle_id
    where vm.verein_id = p_verein_id
      and vm.user_id = auth.uid()
      and (lower(r.name) like '%admin%' or lower(r.name) like '%trainer%' or lower(r.name) like '%betreuer%')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.ist_unter_15(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Jugendschutz fuer direkte Kommunikation bis zum Tag vor dem 15. Geburtstag.
  -- Ohne bekanntes Geburtsdatum gilt der Schutz (ausser fuer die Plattform-Administration).
  select case
    when p_user_id is null then true
    when exists (select 1 from profiles p where p.id = p_user_id and p.ist_plattform_admin) then false
    when geburtsdatum_von(p_user_id) is null then true
    else (geburtsdatum_von(p_user_id) + interval '15 years')::date > (now() at time zone 'Europe/Berlin')::date
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.ist_vereinsleitung(p_verein_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from vereins_mitglieder vm left join rollen r on r.id = vm.rolle_id
    where vm.verein_id = p_verein_id and vm.user_id = auth.uid() and coalesce(vm.aktiv, true)
      and rollen_typ(r.name) in ('admin', 'trainer', 'betreuer'));
$function$
;

CREATE OR REPLACE FUNCTION public.juryraum_eigene_rolle()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select rolle from public.juryraum_mitglieder where user_id = auth.uid() and aktiv = true limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.juryraum_eigener_verband()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select verband_id from public.juryraum_mitglieder where user_id = auth.uid() and aktiv = true limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.juryraum_fernwartung_bestaetigen(p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and ist_plattform_admin = true) then
    raise exception 'Nicht berechtigt';
  end if;

  select id into v_id from public.juryraum_fernwartungs_zugriff
  where ziel_user_id = auth.uid() and status = 'ausstehend' and code = p_code
  limit 1;

  if v_id is null then return false; end if;

  update public.juryraum_fernwartungs_zugriff
  set status = 'aktiv', bestaetigt_am = now(), laeuft_ab_am = now() + interval '24 hours'
  where id = v_id;

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.juryraum_hat_aktive_fernwartung()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.juryraum_fernwartungs_zugriff
    where ziel_user_id = auth.uid() and status = 'aktiv' and laeuft_ab_am > now()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.juryraum_sieht_turnier(p_turnier_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.juryraum_eigene_rolle() is not null and (
    public.juryraum_eigene_rolle() = 'admin'
    or public.juryraum_turnier_verband(p_turnier_id) is null
    or public.juryraum_turnier_verband(p_turnier_id) = public.juryraum_eigener_verband()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.juryraum_sieht_turnier_erweitert(p_turnier_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.juryraum_sieht_turnier(p_turnier_id) or public.juryraum_hat_aktive_fernwartung();
$function$
;

CREATE OR REPLACE FUNCTION public.juryraum_turnier_verband(p_turnier_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select verband_id from public.turniere where id = p_turnier_id;
$function$
;

CREATE OR REPLACE FUNCTION public.juryraum_verwaltet_turnier(p_turnier_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.juryraum_eigene_rolle() = 'admin' or public.juryraum_hat_aktive_fernwartung();
$function$
;

CREATE OR REPLACE FUNCTION public.kalender_termine(p_von date, p_bis date)
 RETURNS TABLE(id uuid, verein_id uuid, verein_name text, art text, titel text, beschreibung text, ort text, datum date, bis_datum date, von time without time zone, bis time without time zone, zielgruppe text, gruppen text[], rueckmeldung boolean, darf_bearbeiten boolean, personen jsonb, zusagen integer, absagen integer, vielleicht integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    return;
  end if;
  return query
  with meine as (
    select vm.id as vm_id, vm.user_id, vm.verein_id, true as ich from vereins_mitglieder vm
    where vm.user_id = auth.uid() and coalesce(vm.aktiv, true)
    union
    select k.id, k.user_id, k.verein_id, false from eltern_kind_zuordnung ekz
    join vereins_mitglieder e on e.id = ekz.eltern_vm_id and e.user_id = auth.uid()
    join vereins_mitglieder k on k.id = ekz.kind_vm_id and coalesce(k.aktiv, true)
  )
  select t.id, t.verein_id, v.name, t.art, t.titel, t.beschreibung, t.ort, t.datum, t.bis_datum, t.von, t.bis,
    t.zielgruppe,
    array(select g.name from gruppen g where g.id = any(t.gruppe_ids) order by g.name),
    t.rueckmeldung,
    case when t.verein_id is null then t.erstellt_von = auth.uid() else darf_vereinstermine_verwalten(t.verein_id) end,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'vm_id', m.vm_id,
        'name', (select a.anzeige from anzeige_namen(array[m.user_id]) a),
        'ich', m.ich,
        'status', r.status) order by m.ich desc)
      from meine m
      left join termin_rueckmeldungen r on r.termin_id = t.id and r.vereins_mitglied_id = m.vm_id
      where t.rueckmeldung and m.verein_id = t.verein_id and vm_eingeladen(t.id, m.vm_id)
    ), '[]'),
    (select count(*) from termin_rueckmeldungen r where r.termin_id = t.id and r.status = 'zugesagt')::int,
    (select count(*) from termin_rueckmeldungen r where r.termin_id = t.id and r.status = 'abgesagt')::int,
    (select count(*) from termin_rueckmeldungen r where r.termin_id = t.id and r.status = 'vielleicht')::int
  from termine t
  left join vereine v on v.id = t.verein_id
  where t.datum <= p_bis and coalesce(t.bis_datum, t.datum) >= p_von
    and (p_bis - p_von) <= 400
    and termin_sichtbar(t.id)
  order by t.datum, t.von nulls first;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.kalender_turniere(p_von date, p_bis date)
 RETURNS TABLE(id uuid, name text, ort text, typ text, kategorie text, ausschreibung_url text, datum date, tag_nr integer, tage_gesamt integer, eigenes boolean, unsere_starts integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select t.id, t.name, t.ort, t.typ, t.kategorie, t.ausschreibung_url, (tag.value->>'datum')::date,
    tag.ordinality::int, jsonb_array_length(t.tage), t.verein_id is not null,
    (select count(*)::int from turnier_starts ts where ts.turnier_id = t.id and ts.status <> 'abgesagt'
       and ts.verein_id = any(meine_vereine()) and verein_hat_lizenz(ts.verein_id)
       and (ts.tag is null or ts.tag = (tag.value->>'datum')::date))
  from turniere t, jsonb_array_elements(t.tage) with ordinality tag
  where auth.uid() is not null
    and turnier_sichtbar(t.verein_id)
    and (tag.value->>'datum') ~ '^\d{4}-\d{2}-\d{2}$'
    and (tag.value->>'datum')::date between p_von and least(p_bis, p_von + 400)
  order by 7, 2;
$function$
;

CREATE OR REPLACE FUNCTION public.kann_privates_profil_sehen(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ist_plattform_admin_aktuell()
      or exists (
        select 1 from vereins_mitglieder ich
        join rollen r on r.id = ich.rolle_id
        join vereins_mitglieder ziel on ziel.verein_id = ich.verein_id and ziel.user_id = p_user_id
        where ich.user_id = auth.uid() and coalesce(ich.aktiv, true)
          and rollen_typ(r.name) in ('admin', 'trainer', 'betreuer'));
$function$
;

CREATE OR REPLACE FUNCTION public.kauf_melden(p_abo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a abos%rowtype;
  v_text text;
  v_geheimnis text;
begin
  select * into a from abos where id = p_abo_id;
  if a.id is null then return; end if;
  v_text := case when a.inhaber = 'verein'
      then 'Neue Vereinslizenz: ' || coalesce((select v.name from vereine v where v.id = a.verein_id), 'Verein')
      else 'Neues BASIC-Abo: ' || coalesce((select x.anzeige from anzeige_namen(array[a.user_id]) x),
                                              (select nullif(trim(coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')), '') from profiles p where p.id = a.user_id), 'Nutzer')
    end
    || ' · ' || case a.periode when 'jahr' then 'jährlich' when 'monat' then 'monatlich' else a.periode end
    || ' · ' || replace(to_char(a.preis_cent / 100.0, 'FM999990.00'), '.', ',') || ' € · ' || case a.anbieter when 'stripe' then 'Karte/Lastschrift' when 'paypal' then 'PayPal' else a.anbieter end;
  insert into benachrichtigungen (user_id, typ, text)
  select p.id, 'tarif_kauf', v_text from profiles p where p.ist_plattform_admin;
  select decrypted_secret into v_geheimnis from vault.decrypted_secrets where name = 'chat_push_geheimnis';
  if v_geheimnis is not null then
    perform net.http_post(
      url := 'https://oraiqjulxmohclfixwdq.supabase.co/functions/v1/chat-push',
      body := jsonb_build_object('admin_push', true),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-tanzraum-geheimnis', v_geheimnis),
      timeout_milliseconds := 5000);
  end if;
exception when others then
  null; -- eine Benachrichtigung darf nie die Tarifaktivierung verhindern
end;
$function$
;

CREATE OR REPLACE FUNCTION public.kind_einstellung_setzen(p_kind uuid, p_feld text, p_wert boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not ist_elternteil_von(auth.uid(), p_kind) or not ist_minderjaehrig(p_kind) then
    raise exception 'Diese Einstellung kann nur ein verknüpftes Elternteil ändern.' using errcode = '42501';
  end if;
  if p_feld not in ('nachrichten_erlaubt', 'map_erlaubt', 'spotlights_nur_kontakte') or p_wert is null then
    raise exception 'Unbekannte Einstellung.' using errcode = 'P0001';
  end if;
  insert into kind_einstellungen (kind_id) values (p_kind) on conflict (kind_id) do nothing;
  execute format('update kind_einstellungen set %I = $1, geaendert_von = $2, geaendert_am = now() where kind_id = $3', p_feld)
    using p_wert, auth.uid(), p_kind;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.kontakt_angenommen(p_a uuid, p_b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from connections c where c.status = 'accepted'
                 and ((c.user_id = p_a and c.connected_to = p_b) or (c.user_id = p_b and c.connected_to = p_a)));
$function$
;

CREATE OR REPLACE FUNCTION public.kontakt_aufnehmen(p_user_id uuid)
 RETURNS TABLE(ergebnis text, gespraech_id uuid, ich_minderjaehrig boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_schluessel text;
  v_id uuid;
  c connections%rowtype;
begin
  if auth.uid() is null or p_user_id is null or p_user_id = auth.uid()
     or not exists (select 1 from profiles p where p.id = p_user_id and not coalesce(p.gesperrt, false))
     or ist_blockiert(auth.uid(), p_user_id) then
    return query select 'nicht_moeglich'::text, null::uuid, ist_minderjaehrig(auth.uid());
    return;
  end if;

  v_schluessel := least(auth.uid(), p_user_id)::text || ':' || greatest(auth.uid(), p_user_id)::text;
  select g.id into v_id from gespraeche g where g.dm_schluessel = v_schluessel;

  if darf_direkt_schreiben(p_user_id) then
    if v_id is null then
      insert into gespraeche (typ, dm_schluessel, erstellt_von) values ('dm', v_schluessel, auth.uid()) returning gespraeche.id into v_id;
      insert into gespraech_teilnehmer (gespraech_id, user_id, last_read_at) values (v_id, auth.uid(), now()), (v_id, p_user_id, now());
    end if;
    return query select 'chat'::text, v_id, ist_minderjaehrig(auth.uid());
    return;
  end if;

  select * into c from connections x
  where (x.user_id = auth.uid() and x.connected_to = p_user_id) or (x.user_id = p_user_id and x.connected_to = auth.uid());
  return query select
    case
      when c.id is null then 'anfrage_noetig'
      when c.status = 'pending' and c.user_id = auth.uid() then 'angefragt'
      when c.status = 'pending' then 'eingehend'
      when c.status = 'rejected' and c.user_id = auth.uid() then 'abgelehnt'
      when c.status = 'rejected' then 'anfrage_noetig'
      else 'nicht_moeglich'
    end,
    v_id,
    ist_minderjaehrig(auth.uid());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.kontaktanfrage_beantworten(p_user_id uuid, p_aktion text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c connections%rowtype;
  v_id uuid;
begin
  select * into c from connections x where x.user_id = p_user_id and x.connected_to = auth.uid() and x.status = 'pending';
  if c.id is null then
    raise exception 'Kontaktanfrage nicht gefunden.' using errcode = 'P0001';
  end if;
  if p_aktion = 'annehmen' then
    update connections set status = 'accepted', beantwortet_am = now() where id = c.id;
    select k.gespraech_id into v_id from kontakt_aufnehmen(p_user_id) k;
    return v_id;
  elsif p_aktion = 'ablehnen' then
    update connections set status = 'rejected', beantwortet_am = now() where id = c.id;
  elsif p_aktion = 'blockieren' then
    update connections set status = 'blocked', beantwortet_am = now() where id = c.id;
    insert into blockierungen (blocker_id, blockiert_id) values (auth.uid(), p_user_id) on conflict do nothing;
  else
    raise exception 'Ungültige Aktion.' using errcode = 'P0001';
  end if;
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.kontaktanfrage_senden(p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c connections%rowtype;
begin
  if auth.uid() is null or p_user_id is null or p_user_id = auth.uid()
     or not exists (select 1 from profiles p where p.id = p_user_id and not coalesce(p.gesperrt, false))
     or ist_blockiert(auth.uid(), p_user_id) then
    raise exception 'Eine Kontaktaufnahme mit dieser Person ist nicht möglich.' using errcode = 'P0001';
  end if;
  if darf_direkt_schreiben(p_user_id) then
    return 'direkt';
  end if;
  if ist_unter_15(auth.uid()) or ist_unter_15(p_user_id) then
    raise exception 'Eine Kontaktanfrage an diese Person ist nicht möglich.' using errcode = 'P0001';
  end if;
  select * into c from connections x
  where (x.user_id = auth.uid() and x.connected_to = p_user_id) or (x.user_id = p_user_id and x.connected_to = auth.uid());
  if c.id is not null then
    if c.status = 'blocked' then
      raise exception 'Eine Kontaktaufnahme mit dieser Person ist nicht möglich.' using errcode = 'P0001';
    elsif c.status = 'pending' and c.user_id = auth.uid() then
      return 'angefragt';
    elsif c.status = 'pending' then
      raise exception 'Diese Person hat dir bereits eine Kontaktanfrage geschickt – du findest sie in deiner Chatliste.' using errcode = 'P0001';
    elsif c.status = 'rejected' and c.user_id = auth.uid() then
      raise exception 'Diese Person hat deine Kontaktanfrage abgelehnt.' using errcode = 'P0001';
    elsif c.status = 'rejected' then
      -- Die Person, die abgelehnt hat, fragt nun selbst an
      update connections set user_id = auth.uid(), connected_to = p_user_id, status = 'pending', created_at = now(), beantwortet_am = null where id = c.id;
    else
      return 'angenommen';
    end if;
  else
    insert into connections (user_id, connected_to, status) values (auth.uid(), p_user_id, 'pending');
  end if;
  insert into benachrichtigungen (user_id, typ, text)
  values (p_user_id, 'kontaktanfrage', 'Neue Kontaktanfrage von ' || coalesce((select a.anzeige from anzeige_namen(array[auth.uid()]) a), 'jemandem') || '.');
  return 'angefragt';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.kontaktanfrage_zurueckziehen(p_user_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from connections where user_id = auth.uid() and connected_to = p_user_id and status = 'pending';
$function$
;

CREATE OR REPLACE FUNCTION public.konto_aktiv()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null and not exists (select 1 from profiles p where p.id = auth.uid() and coalesce(p.gesperrt, false));
$function$
;

CREATE OR REPLACE FUNCTION public.letzten_admin_schuetzen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_war_admin boolean;
  v_bleibt_admin boolean;
begin
  if not ist_endnutzer() then
    return coalesce(new, old);
  end if;
  select rollen_typ(r.name) = 'admin' into v_war_admin from rollen r where r.id = old.rolle_id;
  if not coalesce(v_war_admin, false) then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' then
    select rollen_typ(r.name) = 'admin' into v_bleibt_admin from rollen r where r.id = new.rolle_id;
    if coalesce(v_bleibt_admin, false) and coalesce(new.aktiv, true) and new.verein_id = old.verein_id then
      return new;
    end if;
  end if;
  if not exists (
    select 1 from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
    where vm.verein_id = old.verein_id and vm.id <> old.id and coalesce(vm.aktiv, true) and rollen_typ(r.name) = 'admin') then
    raise exception 'Der Verein braucht mindestens einen aktiven Vereinsadmin. Bitte zuerst eine andere Person zum Vereinsadmin machen.'
      using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mail_darf_rundschreiben(p_verein_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from meine_bereiche() mb where mb.verein_id = p_verein_id and mb.bereich in ('rolle_admin', 'rolle_trainer'));
$function$
;

CREATE OR REPLACE FUNCTION public.mail_darf_spendenbescheinigung(p_spende_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from spenden s where s.id = p_spende_id and is_verein_admin(s.verein_id) and verein_hat_lizenz(s.verein_id));
$function$
;

CREATE OR REPLACE FUNCTION public.mail_einladung_daten(p_einladung_id uuid)
 RETURNS TABLE(token uuid, verein_id uuid, verein_name text, rolle_name text, gruppe_name text, einlader text, gueltig_bis timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select e.token, e.verein_id, v.name, r.name, g.name, (select a.anzeige from anzeige_namen(array[auth.uid()]) a), e.expires_at
  from einladungen e
  join vereine v on v.id = e.verein_id
  left join rollen r on r.id = e.rolle_id
  left join gruppen g on g.id = e.gruppe_id
  where e.id = p_einladung_id
    and is_verein_admin(e.verein_id) and verein_hat_lizenz(e.verein_id)
    and not e.revoked and (e.expires_at is null or e.expires_at > now()) and e.uses < e.max_uses;
$function$
;

CREATE OR REPLACE FUNCTION public.map_einstellungen_setzen(p_sichtbar boolean, p_ort text, p_lat double precision, p_lng double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ort text := nullif(left(btrim(coalesce(p_ort, '')), 80), '');
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if (p_lat is null) <> (p_lng is null) or (p_lat is not null and (abs(p_lat) > 90 or abs(p_lng) > 180)) then
    raise exception 'Der Ort ist ungültig.' using errcode = 'P0001';
  end if;
  update profiles set
    ort = v_ort,
    map_lat = case when v_ort is null then null else round(p_lat::numeric, 2)::double precision end,
    map_lng = case when v_ort is null then null else round(p_lng::numeric, 2)::double precision end,
    map_sichtbar = coalesce(p_sichtbar, false) and v_ort is not null and p_lat is not null
  where id = auth.uid();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mein_eingehender_anruf()
 RETURNS TABLE(id uuid, gespraech_id uuid, art text, anrufer text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, a.gespraech_id, a.art, (select n.anzeige from anzeige_namen(array[a.anrufer_id]) n)
  from anrufe a
  where a.angerufener_id = auth.uid() and a.status = 'klingelt' and a.erstellt_am > now() - interval '45 seconds'
  order by a.erstellt_am desc limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.mein_geburtsdatum()
 RETURNS date
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select geburtsdatum_von(auth.uid()); $function$
;

CREATE OR REPLACE FUNCTION public.mein_ical_token(p_neu boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if mein_tarif() not in ('basic', 'verein') then
    raise exception 'Die Kalender-Synchronisation ist ab dem Tarif BASIC enthalten.' using errcode = 'P0001';
  end if;
  select ical_token into v_token from profiles where id = auth.uid();
  if v_token is null or length(v_token) < 32 or p_neu then
    v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
    update profiles set ical_token = v_token where id = auth.uid();
  end if;
  return v_token;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mein_profil_privat()
 RETURNS TABLE(tarif text, tarif_aktiv_bis timestamp with time zone, telefon text, geschlecht text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select p.tarif, p.tarif_aktiv_bis, p.telefon, p.geschlecht from profiles p where p.id = auth.uid(); $function$
;

CREATE OR REPLACE FUNCTION public.mein_tarif()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when p.ist_plattform_admin then 'verein'
    when exists (
      select 1 from vereins_mitglieder vm
      where vm.user_id = p.id and coalesce(vm.aktiv, true) and verein_hat_lizenz(vm.verein_id)) then 'verein'
    when p.tarif in ('basic', 'verein') and (p.tarif_aktiv_bis is null or p.tarif_aktiv_bis > now()) then p.tarif
    else 'free'
  end
  from profiles p
  where p.id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.mein_tarif_status()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'zugang', effektiver_zugang(auth.uid()),
    'verein_name', (select v.name from vereine v where v.id = vereinslizenz_verein_von(auth.uid())),
    'abos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'tarif', a.tarif, 'periode', a.periode, 'preis_cent', a.preis_cent,
        'anbieter', a.anbieter, 'status', a.status, 'laeuft_bis', a.laeuft_bis, 'gekuendigt_zum', a.gekuendigt_zum,
        'pause_grund', a.pause_grund, 'pausiert_am', a.pausiert_am, 'pause_verein', (select v.name from vereine v where v.id = a.pause_verein_id))
        order by a.erstellt_am desc)
      from abos a where a.inhaber = 'person' and a.user_id = auth.uid() and abo_gilt(a)), '[]'::jsonb),
    'admin_vereine', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'lizenz', verein_hat_lizenz(v.id),
        'lizenz_bis', v.tarif_aktiv_bis,
        'abo', (select jsonb_build_object('id', a.id, 'periode', a.periode, 'preis_cent', a.preis_cent, 'anbieter', a.anbieter, 'status', a.status,
                  'laeuft_bis', a.laeuft_bis, 'gekuendigt_zum', a.gekuendigt_zum)
                from abos a where a.inhaber = 'verein' and a.verein_id = v.id and abo_gilt(a) order by a.erstellt_am desc limit 1))
        order by v.name)
      from vereine v where exists (select 1 from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
        where vm.verein_id = v.id and vm.user_id = auth.uid() and coalesce(vm.aktiv, true) and rollen_typ(r.name) = 'admin')), '[]'::jsonb));
$function$
;

CREATE OR REPLACE FUNCTION public.meine_bereiche()
 RETURNS TABLE(verein_id uuid, bereich text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with m as (
    select vm.verein_id, vm.bereiche, rollen_typ(r.name) as typ, r.name as rolle
    from vereins_mitglieder vm
    left join rollen r on r.id = vm.rolle_id
    where vm.user_id = auth.uid()
      and coalesce(vm.aktiv, true)
      and verein_hat_lizenz(vm.verein_id)
  )
  select m.verein_id, b.bereich
  from m
  cross join lateral unnest(
    case
      when m.typ = 'admin' then bereiche_fuer_rolle(m.rolle)
      when cardinality(array(select x from unnest(m.bereiche) x where x = any(gueltige_bereiche()))) > 0
        then array(select distinct x from unnest(m.bereiche) x where x = any(gueltige_bereiche()))
      else bereiche_fuer_rolle(m.rolle)
    end) as b(bereich)
  union
  select m.verein_id, 'rolle_' || m.typ from m;
$function$
;

CREATE OR REPLACE FUNCTION public.meine_betreuten_gruppen()
 RETURNS TABLE(gruppe_id uuid, gruppe_name text, verein_id uuid, verein_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select g.id, g.name, v.id, v.name
  from gruppen g join vereine v on v.id = g.verein_id
  where auth.uid() is not null and ist_gruppen_betreuung(g.id)
  order by v.name, g.name;
$function$
;

CREATE OR REPLACE FUNCTION public.meine_eltern()
 RETURNS TABLE(verknuepfung_id uuid, eltern_id uuid, anzeige text, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ev.id, ev.eltern_id, a.anzeige, ev.status
  from eltern_verknuepfungen ev join anzeige_namen(array(select x.eltern_id from eltern_verknuepfungen x where x.kind_id = auth.uid())) a on a.user_id = ev.eltern_id
  where ev.kind_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.meine_kind_einstellungen()
 RETURNS TABLE(hat_eltern boolean, unter_15 boolean, nachrichten_erlaubt boolean, map_erlaubt boolean, spotlights_nur_kontakte boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select hat_eltern(auth.uid()), ist_unter_15(auth.uid()),
    coalesce(ke.nachrichten_erlaubt, true), coalesce(ke.map_erlaubt, true), coalesce(ke.spotlights_nur_kontakte, false)
  from (select 1) x left join kind_einstellungen ke on ke.kind_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.meine_kinder()
 RETURNS TABLE(kind_id uuid, anzeige text, verknuepfung_id uuid, status text, quelle text, unter_15 boolean, nachrichten_erlaubt boolean, map_erlaubt boolean, spotlights_nur_kontakte boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with k as (
    select ev.kind_id as kid, ev.id as vid, ev.status, 'code'::text as quelle from eltern_verknuepfungen ev where ev.eltern_id = auth.uid()
    union
    select distinct kvm.user_id, null::uuid, 'bestaetigt', 'verein'
    from eltern_kind_zuordnung ekz join vereins_mitglieder e on e.id = ekz.eltern_vm_id join vereins_mitglieder kvm on kvm.id = ekz.kind_vm_id
    where e.user_id = auth.uid() and kvm.user_id is not null
      and not exists (select 1 from eltern_verknuepfungen x where x.eltern_id = auth.uid() and x.kind_id = kvm.user_id)
  )
  select k.kid, a.anzeige, k.vid, k.status, k.quelle, ist_unter_15(k.kid),
    coalesce(ke.nachrichten_erlaubt, true), coalesce(ke.map_erlaubt, true), coalesce(ke.spotlights_nur_kontakte, false)
  from k join anzeige_namen(array(select kid from k)) a on a.user_id = k.kid
  left join kind_einstellungen ke on ke.kind_id = k.kid
  order by a.anzeige;
$function$
;

CREATE OR REPLACE FUNCTION public.meine_kontaktanfragen()
 RETURNS TABLE(user_id uuid, anzeige text, handle text, avatar_url text, richtung text, erstellt_am timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with v as (
    select c.user_id as uid, 'eingehend' as richtung, c.created_at from connections c where c.connected_to = auth.uid() and c.status = 'pending' and c.art = 'kontakt'
    union all
    select c.connected_to, 'ausgehend', c.created_at from connections c where c.user_id = auth.uid() and c.status = 'pending' and c.art = 'kontakt'
    union all
    select b.blockiert_id, 'blockiert', b.erstellt_am from blockierungen b where b.blocker_id = auth.uid()
  )
  select v.uid, a.anzeige, a.handle,
    (select p.avatar_url from profiles p where p.id = v.uid and (not coalesce(p.konto_privat, false) or kann_privates_profil_sehen(p.id))),
    v.richtung, v.created_at
  from v join anzeige_namen(array(select uid from v)) a on a.user_id = v.uid
  order by case v.richtung when 'eingehend' then 0 when 'ausgehend' then 1 else 2 end, v.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.meine_map_einstellungen()
 RETURNS TABLE(map_sichtbar boolean, ort text, hat_position boolean, unter_15 boolean, eltern_erlauben boolean, wird_angezeigt boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.map_sichtbar, p.ort, p.map_lat is not null, ist_unter_15(p.id),
    not (hat_eltern(p.id) and ist_minderjaehrig(p.id)
         and exists (select 1 from kind_einstellungen ke where ke.kind_id = p.id and not ke.map_erlaubt)),
    ist_auf_map(p.id)
  from profiles p where p.id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.meine_netzwerk_kontakte()
 RETURNS TABLE(user_id uuid, anzeige text, handle text, avatar_url text, vereine text, status text, seit timestamp with time zone, gespraech_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with v as (
    select case when c.user_id = auth.uid() then c.connected_to else c.user_id end as uid,
      case when c.status = 'accepted' then 'verbunden' when c.user_id = auth.uid() then 'ausstehend' else 'eingehend' end as st,
      coalesce(c.beantwortet_am, c.created_at) as seit
    from connections c
    where c.art = 'netzwerk' and c.status in ('accepted', 'pending') and auth.uid() in (c.user_id, c.connected_to)
  )
  select v.uid, (select a.anzeige from anzeige_namen(array[v.uid]) a), p.handle,
    case when not coalesce(p.konto_privat, false) or v.st = 'verbunden' then p.avatar_url end,
    netzwerk_vereine_text(v.uid), v.st, v.seit,
    (select g.id from gespraeche g where g.typ = 'dm'
       and exists (select 1 from gespraech_teilnehmer t where t.gespraech_id = g.id and t.user_id = auth.uid())
       and exists (select 1 from gespraech_teilnehmer t where t.gespraech_id = g.id and t.user_id = v.uid) limit 1)
  from v join profiles p on p.id = v.uid
  where not ist_blockiert(auth.uid(), v.uid)
  order by case v.st when 'eingehend' then 0 when 'ausstehend' then 1 else 2 end, v.seit desc;
$function$
;

CREATE OR REPLACE FUNCTION public.meine_turnierstarts(p_ab date)
 RETURNS TABLE(start_id uuid, turnier_id uuid, turnier_name text, turnier_ort text, erster_tag date, letzter_tag date, tag date, verein_name text, teilnahme text, disziplin text, altersklasse text, status text, vm_id uuid, person text, ich boolean, rueckmeldung text, kommentar text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with meine_vm as (
    select vm.id, vm.user_id, true as ich from vereins_mitglieder vm where vm.user_id = auth.uid()
    union
    select k.id, k.user_id, false from eltern_kind_zuordnung ekz
    join vereins_mitglieder e on e.id = ekz.eltern_vm_id and e.user_id = auth.uid()
    join vereins_mitglieder k on k.id = ekz.kind_vm_id
  ), st as (
    select s.*, t.name as t_name, t.ort as t_ort,
      (select min((e->>'datum')::date) from jsonb_array_elements(t.tage) e) as von_d,
      (select max((e->>'datum')::date) from jsonb_array_elements(t.tage) e) as bis_d
    from turnier_starts s join turniere t on t.id = s.turnier_id
    where s.verein_id = any(meine_vereine()) and verein_hat_lizenz(s.verein_id)
  )
  select st.id, st.turnier_id, st.t_name, st.t_ort, st.von_d, st.bis_d, st.tag, v.name,
    coalesce(g.name, st.bezeichnung, 'Solo'), d.name, ak.name, st.status,
    mv.id, (select a.anzeige from anzeige_namen(array[mv.user_id]) a), mv.ich, r.status, r.kommentar
  from st
  join meine_vm mv on mv.id in (select start_teilnehmer_ids(st.id))
  join vereine v on v.id = st.verein_id
  left join gruppen g on g.id = st.gruppe_id
  left join disziplinen d on d.id = st.disziplin_id
  left join altersklassen ak on ak.id = st.altersklasse_id
  left join turnier_start_rueckmeldungen r on r.start_id = st.id and r.vereins_mitglied_id = mv.id
  where auth.uid() is not null and st.bis_d >= p_ab
  order by st.von_d, st.tag nulls first, mv.ich desc;
$function$
;

CREATE OR REPLACE FUNCTION public.meine_vereine()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when ist_plattform_admin_aktuell() then coalesce((select array_agg(v.id) from vereine v), '{}')
    else coalesce((select array_agg(distinct vm.verein_id)
                   from vereins_mitglieder vm join vereine v on v.id = vm.verein_id
                   where vm.user_id = auth.uid() and coalesce(vm.aktiv, true) and coalesce(v.gesperrt, false) = false), '{}')
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.melden(p_ziel_user_id uuid, p_spotlight_id uuid, p_grund text, p_text text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ziel uuid := p_ziel_user_id;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if p_spotlight_id is not null then
    select s.user_id into v_ziel from spotlights s where s.id = p_spotlight_id;
    if v_ziel is null then raise exception 'Spotlight nicht gefunden.' using errcode = 'P0001'; end if;
  end if;
  if v_ziel is null or v_ziel = auth.uid() or not exists (select 1 from profiles p where p.id = v_ziel) then
    raise exception 'Diese Meldung ist nicht möglich.' using errcode = 'P0001';
  end if;
  if (select count(*) from meldungen m where m.melder_id = auth.uid() and m.erstellt_am > now() - interval '1 day') >= 20 then
    raise exception 'Du hast heute schon sehr viele Meldungen abgeschickt. Bitte versuche es morgen erneut.' using errcode = 'P0001';
  end if;
  insert into meldungen (melder_id, ziel_user_id, spotlight_id, grund, text)
  values (auth.uid(), v_ziel, p_spotlight_id, p_grund, nullif(left(btrim(coalesce(p_text, '')), 1000), ''));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.meldung_bearbeiten(p_id uuid, p_notiz text, p_spotlight_entfernen boolean, p_konto_sperren boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m meldungen%rowtype;
begin
  if not ist_plattform_admin_aktuell() then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  select * into m from meldungen where id = p_id;
  if m.id is null then raise exception 'Meldung nicht gefunden.' using errcode = 'P0001'; end if;
  if coalesce(p_spotlight_entfernen, false) and m.spotlight_id is not null then
    update spotlights set entfernt_am = now(), ablauf_am = least(ablauf_am, now()) where id = m.spotlight_id;
  end if;
  if coalesce(p_konto_sperren, false) and m.ziel_user_id is not null
     and not exists (select 1 from profiles p where p.id = m.ziel_user_id and p.ist_plattform_admin) then
    update profiles set gesperrt = true where id = m.ziel_user_id;
  end if;
  update meldungen set status = 'erledigt', admin_notiz = nullif(left(btrim(coalesce(p_notiz, '')), 2000), ''),
    bearbeitet_von = auth.uid(), bearbeitet_am = now()
  where id = p_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.meldungen_admin(p_status text)
 RETURNS TABLE(id uuid, grund text, text text, status text, erstellt_am timestamp with time zone, melder text, ziel_user_id uuid, ziel text, ziel_gesperrt boolean, spotlight_id uuid, spotlight_typ text, spotlight_text text, spotlight_pfad text, spotlight_entfernt boolean, admin_notiz text, bearbeitet_am timestamp with time zone, anzahl_zum_ziel integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not ist_plattform_admin_aktuell() then
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
  where p_status is null or m.status = p_status
  order by m.status = 'offen' desc, m.erstellt_am desc
  limit 200;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mitglieder_auswahl(p_verein_id uuid)
 RETURNS TABLE(vm_id uuid, name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (is_verein_admin_oder_trainer(p_verein_id) or ist_plattform_admin_aktuell()) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  return query
  select vm.id, a.anzeige
  from vereins_mitglieder vm
  cross join lateral anzeige_namen(array[vm.user_id]) a
  where vm.verein_id = p_verein_id and coalesce(vm.aktiv, true)
  order by a.anzeige;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mitglieder_liste(p_verein_id uuid)
 RETURNS TABLE(vm_id uuid, user_id uuid, name text, handle text, email text, rolle_id uuid, rolle text, aktiv boolean, altersklasse text, seit timestamp with time zone, bereiche text[], gruppen jsonb, eltern jsonb, kinder jsonb, ist_ich boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_admin boolean := is_verein_admin(p_verein_id) or ist_plattform_admin_aktuell();
begin
  if not v_admin and not exists (select 1 from meine_bereiche() mb where mb.verein_id = p_verein_id and mb.bereich = 'mitglieder') then
    raise exception 'Keine Berechtigung fuer die Mitgliederliste' using errcode = '42501';
  end if;

  return query
  select vm.id, vm.user_id, a.anzeige, a.handle,
    case when v_admin then (select u.email::text from auth.users u where u.id = vm.user_id) end,
    vm.rolle_id, r.name, coalesce(vm.aktiv, true), vm.altersklasse, vm.created_at,
    case when v_admin then coalesce(vm.bereiche, '{}') end,
    coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'funktion', gm.funktion) order by g.name)
              from gruppen_mitglieder gm join gruppen g on g.id = gm.gruppe_id where gm.vereins_mitglied_id = vm.id), '[]'),
    coalesce((select jsonb_agg(jsonb_build_object('vm_id', e.id, 'name', ea.anzeige))
              from eltern_kind_zuordnung ekz join vereins_mitglieder e on e.id = ekz.eltern_vm_id
              cross join lateral anzeige_namen(array[e.user_id]) ea where ekz.kind_vm_id = vm.id), '[]'),
    coalesce((select jsonb_agg(jsonb_build_object('vm_id', k.id, 'name', ka.anzeige))
              from eltern_kind_zuordnung ekz join vereins_mitglieder k on k.id = ekz.kind_vm_id
              cross join lateral anzeige_namen(array[k.user_id]) ka where ekz.eltern_vm_id = vm.id), '[]'),
    vm.user_id = auth.uid()
  from vereins_mitglieder vm
  left join rollen r on r.id = vm.rolle_id
  cross join lateral anzeige_namen(array[vm.user_id]) a
  where vm.verein_id = p_verein_id
    and (v_admin or ist_relevantes_mitglied(vm.id))
  order by coalesce(vm.aktiv, true) desc, a.anzeige;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mitgliedsantrag_annehmen(p_antrag_id uuid)
 RETURNS TABLE(success boolean, message text, mitglied_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a record;
  v_mitglied_id uuid;
begin
  select * into a from mitgliedsantraege where id = p_antrag_id;
  if not found then
    return query select false, 'Antrag nicht gefunden.', null::uuid;
    return;
  end if;
  if not is_verein_admin_oder_trainer(a.verein_id) then
    return query select false, 'Keine Berechtigung.', null::uuid;
    return;
  end if;

  if a.user_id is not null then
    select id into v_mitglied_id from mitglieder where verein_id = a.verein_id and user_id = a.user_id;
  end if;

  if v_mitglied_id is null then
    insert into mitglieder (verein_id, user_id, vorname, nachname, geburtsdatum, email, telefon, strasse, hausnummer, plz, ort, gruppe, sepa_kontoinhaber, sepa_iban, sepa_mandatsdatum)
    values (a.verein_id, a.user_id, a.vorname, a.nachname, a.geburtsdatum, a.email, a.telefon, a.strasse, a.hausnummer, a.plz, a.ort, a.gruppe, a.sepa_kontoinhaber, a.sepa_iban, a.sepa_mandatsdatum)
    returning id into v_mitglied_id;
  else
    update mitglieder set
      vorname = a.vorname, nachname = a.nachname, geburtsdatum = coalesce(a.geburtsdatum, geburtsdatum),
      email = coalesce(a.email, email), telefon = coalesce(a.telefon, telefon),
      strasse = coalesce(a.strasse, strasse), hausnummer = coalesce(a.hausnummer, hausnummer),
      plz = coalesce(a.plz, plz), ort = coalesce(a.ort, ort), gruppe = coalesce(a.gruppe, gruppe),
      sepa_kontoinhaber = coalesce(a.sepa_kontoinhaber, sepa_kontoinhaber),
      sepa_iban = coalesce(a.sepa_iban, sepa_iban),
      sepa_mandatsdatum = coalesce(a.sepa_mandatsdatum, sepa_mandatsdatum),
      updated_at = now()
    where id = v_mitglied_id;
  end if;

  update mitgliedsantraege set status = 'angenommen', mitglied_id = v_mitglied_id, entschieden_am = now() where id = p_antrag_id;

  return query select true, 'Übernommen.', v_mitglied_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.nachricht_bearbeiten(p_nachricht_id uuid, p_inhalt text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n nachrichten%rowtype;
  v_text text := btrim(coalesce(p_inhalt, ''));
begin
  select * into n from nachrichten where id = p_nachricht_id;
  if n.id is null or n.sender_id <> auth.uid() or n.geloescht_am is not null
     or n.umfrage is not null or n.standort is not null or n.sticker is not null or (n.anhang is not null and n.anhang->>'art' = 'audio') then
    raise exception 'Diese Nachricht kannst du nicht bearbeiten.' using errcode = 'P0001';
  end if;
  if n.gesendet_am < now() - interval '24 hours' then
    raise exception 'Nachrichten können nur bis 24 Stunden nach dem Senden bearbeitet werden.' using errcode = 'P0001';
  end if;
  if not darf_im_gespraech_schreiben(n.gespraech_id) then
    raise exception 'Du darfst in diesem Chat nicht schreiben.' using errcode = '42501';
  end if;
  if char_length(v_text) > 4000 or (v_text = '' and n.bild_pfad is null and n.anhang is null) then
    raise exception 'Die Nachricht darf nicht leer sein.' using errcode = 'P0001';
  end if;
  update nachrichten set inhalt = v_text, bearbeitet_am = now() where id = n.id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.nachricht_gesendet()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into gespraech_teilnehmer (gespraech_id, user_id, last_read_at)
  values (new.gespraech_id, new.sender_id, now())
  on conflict (gespraech_id, user_id) do update set last_read_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.nachricht_loeschen(p_nachricht_id uuid)
 RETURNS TABLE(bucket text, pfad text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n nachrichten%rowtype;
begin
  select * into n from nachrichten where id = p_nachricht_id;
  if n.id is null or n.geloescht_am is not null or not hat_gespraech_zugriff(n.gespraech_id)
     or not (n.sender_id = auth.uid() or ist_chat_leitung(n.gespraech_id)) then
    raise exception 'Diese Nachricht kannst du nicht löschen.' using errcode = 'P0001';
  end if;
  delete from umfrage_stimmen where nachricht_id = n.id;
  delete from nachricht_reaktionen where nachricht_id = n.id;
  update nachrichten set geloescht_am = now(), inhalt = '', bild_pfad = null, umfrage = null, anhang = null, standort = null, sticker = null where id = n.id;
  return query
    select 'chat-bilder'::text, n.bild_pfad where n.bild_pfad is not null
    union all
    select 'chat-dateien'::text, n.anhang->>'pfad' where n.anhang is not null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.nachricht_push_ausloesen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_geheimnis text;
begin
  select decrypted_secret into v_geheimnis from vault.decrypted_secrets where name = 'chat_push_geheimnis';
  if v_geheimnis is null then return new; end if;
  perform net.http_post(
    url := 'https://oraiqjulxmohclfixwdq.supabase.co/functions/v1/chat-push',
    body := jsonb_build_object('nachricht_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tanzraum-geheimnis', v_geheimnis),
    timeout_milliseconds := 5000);
  return new;
exception when others then
  return new; -- Push darf das Senden nie verhindern
end;
$function$
;

CREATE OR REPLACE FUNCTION public.nachricht_reagieren(p_nachricht_id uuid, p_emoji text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n nachrichten%rowtype;
begin
  select * into n from nachrichten where id = p_nachricht_id;
  if n.id is null or n.geloescht_am is not null or not hat_gespraech_zugriff(n.gespraech_id) then
    raise exception 'Nachricht nicht gefunden.' using errcode = 'P0001';
  end if;
  if p_emoji is null then
    delete from nachricht_reaktionen where nachricht_id = n.id and user_id = auth.uid();
  else
    insert into nachricht_reaktionen (nachricht_id, gespraech_id, user_id, emoji) values (n.id, n.gespraech_id, auth.uid(), p_emoji)
    on conflict (nachricht_id, user_id) do update set emoji = excluded.emoji, erstellt_am = now();
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.nachricht_weiterleiten(p_nachricht_id uuid, p_ziel_gespraech_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n nachrichten%rowtype;
begin
  select * into n from nachrichten where id = p_nachricht_id;
  if n.id is null or n.geloescht_am is not null or not hat_gespraech_zugriff(n.gespraech_id) then
    raise exception 'Nachricht nicht gefunden.' using errcode = 'P0001';
  end if;
  if n.bild_pfad is not null or n.anhang is not null or n.umfrage is not null then
    raise exception 'Fotos, Dateien, Sprachnachrichten und Umfragen können nicht weitergeleitet werden.' using errcode = 'P0001';
  end if;
  if not darf_im_gespraech_schreiben(p_ziel_gespraech_id) then
    raise exception 'In diesem Chat darfst du nicht schreiben.' using errcode = '42501';
  end if;
  insert into nachrichten (gespraech_id, sender_id, inhalt, standort, sticker, weitergeleitet)
  values (p_ziel_gespraech_id, auth.uid(), n.inhalt, n.standort, n.sticker, true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.naechste_rechnungsnummer()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_praefix text; v_nr int; v_nummer text;
begin
  update rechnungs_einstellungen set naechste_nummer = naechste_nummer + 1
  where id = true
  returning nummer_praefix, naechste_nummer - 1 into v_praefix, v_nr;
  v_nummer := v_praefix || lpad(v_nr::text, 4, '0');
  return v_nummer;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.naechste_spendennummer(p_verein_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_nr int; v_jahr text;
begin
  if not is_verein_admin(p_verein_id) then
    raise exception 'Nicht berechtigt';
  end if;
  update vereine set spenden_naechste_nummer = spenden_naechste_nummer + 1
  where id = p_verein_id
  returning spenden_naechste_nummer - 1 into v_nr;
  v_jahr := to_char(current_date, 'YYYY');
  return 'SB-' || v_jahr || '-' || lpad(v_nr::text, 4, '0');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.netzwerk_anfrage_beantworten(p_user_id uuid, p_aktion text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c connections%rowtype;
  v_chat uuid;
begin
  select * into c from connections x where x.user_id = p_user_id and x.connected_to = auth.uid()
    and x.status = 'pending' and x.art = 'netzwerk';
  if c.id is null then
    raise exception 'Anfrage nicht gefunden.' using errcode = 'P0001';
  end if;
  if p_aktion = 'annehmen' then
    update connections set status = 'accepted', beantwortet_am = now() where id = c.id;
    insert into benachrichtigungen (user_id, typ, text)
    values (p_user_id, 'netzwerk', coalesce((select a.anzeige from anzeige_namen(array[auth.uid()]) a), 'Jemand') || ' hat deine Netzwerk-Anfrage angenommen.');
    select k.gespraech_id into v_chat from kontakt_aufnehmen(p_user_id) k;
    return v_chat;
  elsif p_aktion = 'ablehnen' then
    update connections set status = 'rejected', beantwortet_am = now() where id = c.id;
  elsif p_aktion = 'blockieren' then
    update connections set status = 'blocked', beantwortet_am = now() where id = c.id;
    insert into blockierungen (blocker_id, blockiert_id) values (auth.uid(), p_user_id) on conflict do nothing;
  else
    raise exception 'Ungültige Aktion.' using errcode = 'P0001';
  end if;
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.netzwerk_anfrage_senden(p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c connections%rowtype;
begin
  if netzwerk_modus() is null then
    raise exception 'Das Netzwerk ist für dein Konto nicht freigeschaltet.' using errcode = 'P0001';
  end if;
  if ist_unter_15(auth.uid()) or ist_unter_15(p_user_id) then
    raise exception 'Eine Verbindung mit dieser Person ist nicht möglich.' using errcode = 'P0001';
  end if;
  if not netzwerk_sichtbar(p_user_id) then
    raise exception 'Eine Verbindung mit dieser Person ist nicht möglich.' using errcode = 'P0001';
  end if;
  select * into c from connections x
  where least(x.user_id, x.connected_to) = least(auth.uid(), p_user_id) and greatest(x.user_id, x.connected_to) = greatest(auth.uid(), p_user_id);
  if c.id is null then
    insert into connections (user_id, connected_to, status, art) values (auth.uid(), p_user_id, 'pending', 'netzwerk');
  elsif c.status = 'blocked' then
    raise exception 'Eine Verbindung mit dieser Person ist nicht möglich.' using errcode = 'P0001';
  elsif c.status = 'accepted' then
    -- Bereits angenommener Kontakt (Messenger) wird zur Netzwerk-Verbindung
    update connections set art = 'netzwerk' where id = c.id;
    return 'verbunden';
  elsif c.status = 'pending' and c.user_id = auth.uid() then
    update connections set art = 'netzwerk' where id = c.id;
    return 'ausstehend';
  elsif c.status = 'pending' then
    -- Die andere Person hat bereits angefragt -> beide wollen: verbunden
    update connections set status = 'accepted', art = 'netzwerk', beantwortet_am = now() where id = c.id;
    insert into benachrichtigungen (user_id, typ, text)
    values (p_user_id, 'netzwerk', coalesce((select a.anzeige from anzeige_namen(array[auth.uid()]) a), 'Jemand') || ' ist jetzt mit dir im Netzwerk verbunden.');
    return 'verbunden';
  elsif c.status = 'rejected' and c.user_id = auth.uid() and c.beantwortet_am > now() - interval '30 days' then
    raise exception 'Diese Person hat deine Anfrage abgelehnt. Eine neue Anfrage ist frühestens 30 Tage später möglich.' using errcode = 'P0001';
  else
    update connections set user_id = auth.uid(), connected_to = p_user_id, status = 'pending', art = 'netzwerk',
      created_at = now(), beantwortet_am = null where id = c.id;
  end if;
  insert into benachrichtigungen (user_id, typ, text)
  values (p_user_id, 'netzwerk', 'Neue Netzwerk-Anfrage von ' || coalesce((select a.anzeige from anzeige_namen(array[auth.uid()]) a), 'jemandem') || '.');
  return 'ausstehend';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.netzwerk_anfrage_zurueckziehen(p_user_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from connections where user_id = auth.uid() and connected_to = p_user_id and status = 'pending' and art = 'netzwerk';
$function$
;

CREATE OR REPLACE FUNCTION public.netzwerk_auffindbar(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p_user_id <> auth.uid()
    and exists (select 1 from profiles p where p.id = p_user_id and not coalesce(p.gesperrt, false))
    and not ist_blockiert(auth.uid(), p_user_id)
    and (hat_vereinsbeziehung(auth.uid(), p_user_id) or ist_elternteil_von(auth.uid(), p_user_id)
         or (not ist_unter_15(p_user_id)
             and not exists (select 1 from profiles p where p.id = p_user_id and coalesce(p.konto_privat, false))));
$function$
;

CREATE OR REPLACE FUNCTION public.netzwerk_map()
 RETURNS TABLE(art text, id uuid, name text, zeile text, lat double precision, lng double precision, avatar_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select 'verein', v.id, v.name, concat_ws(' · ', nullif(v.ort, ''),
           (select count(*) || ' Mitglieder' from vereins_mitglieder m where m.verein_id = v.id and coalesce(m.aktiv, true) and m.user_id is not null)),
         v.lat, v.lng, v.logo_url
  from vereine v
  where darf_netzwerk() and v.lat is not null and not coalesce(v.gesperrt, false)
  union all
  select 'person', p.id, a.anzeige, concat_ws(' · ', p.ort, vereine_text_von(p.id)), p.map_lat, p.map_lng, p.avatar_url
  from profiles p
  join anzeige_namen(array(select x.id from profiles x where x.map_lat is not null)) a on a.user_id = p.id
  where darf_netzwerk() and ist_auf_map(p.id) and (p.id = auth.uid() or not ist_blockiert(auth.uid(), p.id));
$function$
;

CREATE OR REPLACE FUNCTION public.netzwerk_modus()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when auth.uid() is null then null
    when ist_plattform_admin_aktuell() then 'trainer'
    when ist_netzwerk_trainer(auth.uid()) then 'trainer'
    else null
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.netzwerk_person(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  p profiles%rowtype;
  v_eigener_kontext boolean;
  v_privat_sichtbar boolean;
begin
  select * into p from profiles x where x.id = p_user_id;
  if p.id is null or auth.uid() is null or coalesce(p.gesperrt, false)
     or (p.id <> auth.uid() and ist_blockiert(auth.uid(), p.id))
     or not konto_aktiv() then
    return null;
  end if;
  v_eigener_kontext := p.id = auth.uid() or hat_vereinsbeziehung(auth.uid(), p.id) or ist_elternteil_von(auth.uid(), p.id)
                       or ist_elternteil_von(p.id, auth.uid());
  v_privat_sichtbar := v_eigener_kontext or not coalesce(p.konto_privat, false) or kann_privates_profil_sehen(p.id)
                       or kontakt_angenommen(auth.uid(), p.id);
  return jsonb_build_object(
    'id', p.id,
    'name', (select a.anzeige from anzeige_namen(array[p.id]) a),
    'handle', p.handle,
    'avatar_url', case when v_privat_sichtbar then p.avatar_url end,
    'privat', not v_privat_sichtbar,
    'ich', p.id = auth.uid(),
    'ort', case when v_privat_sichtbar and (v_eigener_kontext or not ist_unter_15(p.id)) then p.ort end,
    'vereine', case when v_privat_sichtbar then coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'ort', v.ort, 'rolle', coalesce(r.name, 'Mitglied')) order by v.name)
      from vereins_mitglieder vm join vereine v on v.id = vm.verein_id left join rollen r on r.id = vm.rolle_id
      where vm.user_id = p.id and coalesce(vm.aktiv, true) and not coalesce(v.gesperrt, false)), '[]'::jsonb) else '[]'::jsonb end,
    'gruppen', case when v_privat_sichtbar then coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'verein', v.name, 'funktion', gm.funktion,
                                          'disziplin', d.name, 'altersklasse', ak.name) order by g.name)
      from gruppen_mitglieder gm join vereins_mitglieder vm on vm.id = gm.vereins_mitglied_id and coalesce(vm.aktiv, true)
      join gruppen g on g.id = gm.gruppe_id join vereine v on v.id = g.verein_id
      left join disziplinen d on d.id = g.disziplin_id left join altersklassen ak on ak.id = g.altersklasse_id
      where vm.user_id = p.id), '[]'::jsonb) else '[]'::jsonb end,
    'status', verbindungs_status(p.id),
    'darf_schreiben', p.id <> auth.uid() and darf_direkt_schreiben(p.id),
    'sperrgrund', case when p.id <> auth.uid() then schreib_sperrgrund(p.id) end,
    'kann_vernetzen', p.id <> auth.uid() and not ist_unter_15(auth.uid()) and not ist_unter_15(p.id)
                      and not ist_blockiert(auth.uid(), p.id),
    'blockiert_von_mir', exists (select 1 from blockierungen b where b.blocker_id = auth.uid() and b.blockiert_id = p.id)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.netzwerk_profil(p_user_id uuid)
 RETURNS TABLE(user_id uuid, anzeige text, handle text, avatar_url text, status text, vereine jsonb, verbunden_seit timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_status text := netzwerk_status(p_user_id);
begin
  if netzwerk_modus() is null or p_user_id is null or ist_blockiert(auth.uid(), p_user_id)
     or not (netzwerk_sichtbar(p_user_id) or v_status in ('verbunden', 'eingehend', 'ausstehend')) then
    return;
  end if;
  return query
  select p.id, (select a.anzeige from anzeige_namen(array[p.id]) a), p.handle, p.avatar_url, v_status,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'verein', v.name, 'ort', v.ort, 'rolle', r.name,
        'gruppen', coalesce((select jsonb_agg(jsonb_build_object('name', g.name, 'altersklasse', ak.name, 'disziplin', d.name) order by g.name)
                             from gruppen_mitglieder gm join gruppen g on g.id = gm.gruppe_id
                             left join disziplinen d on d.id = g.disziplin_id left join altersklassen ak on ak.id = g.altersklasse_id
                             where gm.vereins_mitglied_id = vm.id and gm.funktion in ('trainer', 'betreuer')), '[]'::jsonb))
        order by v.name)
      from vereins_mitglieder vm join vereine v on v.id = vm.verein_id left join rollen r on r.id = vm.rolle_id
      where vm.user_id = p.id and coalesce(vm.aktiv, true) and verein_hat_lizenz(vm.verein_id)
        and rollen_typ(r.name) in ('trainer', 'admin')), '[]'::jsonb),
    (select c.beantwortet_am from connections c where c.art = 'netzwerk' and c.status = 'accepted'
       and least(c.user_id, c.connected_to) = least(auth.uid(), p.id) and greatest(c.user_id, c.connected_to) = greatest(auth.uid(), p.id))
  from profiles p where p.id = p_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.netzwerk_sichtbar(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null and p_user_id <> auth.uid()
    and exists (select 1 from profiles p where p.id = p_user_id and not coalesce(p.gesperrt, false)
                and not coalesce(p.konto_privat, false))
    and not ist_blockiert(auth.uid(), p_user_id)
    and case netzwerk_modus()
          when 'trainer' then ist_netzwerk_trainer(p_user_id)
          when 'tanzraum' then true
          else false end;
$function$
;

CREATE OR REPLACE FUNCTION public.netzwerk_status(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select case
      when c.status = 'accepted' and c.art = 'netzwerk' then 'verbunden'
      when c.status = 'pending' and c.art = 'netzwerk' and c.user_id = auth.uid() then 'ausstehend'
      when c.status = 'pending' and c.art = 'netzwerk' then 'eingehend'
      when c.status = 'rejected' and c.art = 'netzwerk' and c.user_id = auth.uid() then 'abgelehnt'
      else 'keine' end
    from connections c
    where least(c.user_id, c.connected_to) = least(auth.uid(), p_user_id)
      and greatest(c.user_id, c.connected_to) = greatest(auth.uid(), p_user_id)), 'keine');
$function$
;

CREATE OR REPLACE FUNCTION public.netzwerk_suche(p_suche text, p_kategorie text, p_ort text)
 RETURNS TABLE(art text, id uuid, name text, zeile1 text, zeile2 text, avatar_url text, verein_id uuid, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  q text := lower(btrim(ltrim(btrim(coalesce(p_suche, '')), '@')));
  o text := lower(btrim(coalesce(p_ort, '')));
begin
  if not darf_netzwerk() or p_kategorie not in ('mitglieder', 'trainer', 'vereine', 'gruppen') then return; end if;
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  o := replace(replace(replace(o, '\', '\\'), '%', '\%'), '_', '\_');

  if p_kategorie in ('mitglieder', 'trainer') then
    return query
    with kandidaten as (
      select p.id from profiles p
      where p.id <> auth.uid()
        and (q = '' or lower(coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')) like '%' || q || '%' or lower(coalesce(p.handle, '')) like q || '%')
        and (o = '' or lower(coalesce(p.ort, '')) like '%' || o || '%'
             or exists (select 1 from vereins_mitglieder vm join vereine v on v.id = vm.verein_id
                        where vm.user_id = p.id and coalesce(vm.aktiv, true) and lower(coalesce(v.ort, '')) like '%' || o || '%'))
        and (p_kategorie = 'mitglieder' or exists (
              select 1 from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
              where vm.user_id = p.id and coalesce(vm.aktiv, true) and rollen_typ(r.name) = 'trainer')
             or exists (select 1 from gruppen_mitglieder gm join vereins_mitglieder vm on vm.id = gm.vereins_mitglied_id
                        where vm.user_id = p.id and coalesce(vm.aktiv, true) and gm.funktion = 'trainer'))
        and netzwerk_auffindbar(p.id)
      limit 60
    )
    select 'person'::text, k.id, a.anzeige,
      (select string_agg(distinct coalesce(r.name, 'Mitglied'), ', ') from vereins_mitglieder vm left join rollen r on r.id = vm.rolle_id
       where vm.user_id = k.id and coalesce(vm.aktiv, true)),
      concat_ws(' · ', vereine_text_von(k.id), case when not ist_unter_15(k.id) then (select p.ort from profiles p where p.id = k.id) end),
      (select p.avatar_url from profiles p where p.id = k.id), null::uuid, verbindungs_status(k.id)
    from kandidaten k join anzeige_namen(array(select kd.id from kandidaten kd)) a on a.user_id = k.id
    order by a.anzeige;

  elsif p_kategorie = 'vereine' then
    return query
    select 'verein'::text, v.id, v.name,
      concat_ws(' · ', nullif(v.ort, ''), (select count(*) || ' TanzRaum-Mitglieder' from vereins_mitglieder m where m.verein_id = v.id and coalesce(m.aktiv, true) and m.user_id is not null)),
      (select string_agg(g.name, ', ' order by g.name) from gruppen g where g.verein_id = v.id),
      v.logo_url, v.id, null::text
    from vereine v
    where not coalesce(v.gesperrt, false)
      and (q = '' or lower(v.name) like '%' || q || '%' or lower(coalesce(v.kuerzel, '')) like q || '%')
      and (o = '' or lower(coalesce(v.ort, '')) like '%' || o || '%' or coalesce(v.plz, '') like o || '%')
    order by v.name limit 60;

  else
    return query
    select 'gruppe'::text, g.id, g.name,
      concat_ws(' · ', d.name, ak.name),
      concat_ws(' · ', v.name, nullif(v.ort, '')),
      v.logo_url, v.id, null::text
    from gruppen g join vereine v on v.id = g.verein_id
    left join disziplinen d on d.id = g.disziplin_id
    left join altersklassen ak on ak.id = g.altersklasse_id
    where not coalesce(v.gesperrt, false)
      and (q = '' or lower(g.name) like '%' || q || '%' or lower(coalesce(d.name, '')) like '%' || q || '%'
           or lower(coalesce(ak.name, '')) like '%' || q || '%' or lower(v.name) like '%' || q || '%')
      and (o = '' or lower(coalesce(v.ort, '')) like '%' || o || '%' or coalesce(v.plz, '') like o || '%')
    order by v.name, g.name limit 60;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.netzwerk_suchen(p_suche text)
 RETURNS TABLE(user_id uuid, anzeige text, handle text, avatar_url text, vereine text, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  q text := btrim(coalesce(p_suche, ''));
  h text := lower(ltrim(btrim(coalesce(p_suche, '')), '@'));
begin
  if netzwerk_modus() is null or length(q) < 2 then
    return;
  end if;
  return query
  select p.id, (select a.anzeige from anzeige_namen(array[p.id]) a), p.handle, p.avatar_url,
    netzwerk_vereine_text(p.id), netzwerk_status(p.id)
  from profiles p
  where netzwerk_sichtbar(p.id)
    and (
      -- Minderjaehrige nur ueber den exakten @Nutzernamen auffindbar (wie im Messenger)
      (not ist_minderjaehrig(p.id) and (p.handle ilike '%' || h || '%' or p.vorname ilike '%' || q || '%'
         or p.nachname ilike '%' || q || '%' or (coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')) ilike '%' || q || '%'))
      or lower(p.handle) = h)
  order by (lower(p.handle) = h) desc, p.nachname nulls last, p.vorname
  limit 25;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.netzwerk_verbindung_trennen(p_user_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from connections where art = 'netzwerk' and status = 'accepted'
    and least(user_id, connected_to) = least(auth.uid(), p_user_id) and greatest(user_id, connected_to) = greatest(auth.uid(), p_user_id);
$function$
;

CREATE OR REPLACE FUNCTION public.netzwerk_verbunden(p_a uuid, p_b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from connections c where c.art = 'netzwerk' and c.status = 'accepted'
                 and least(c.user_id, c.connected_to) = least(p_a, p_b) and greatest(c.user_id, c.connected_to) = greatest(p_a, p_b));
$function$
;

CREATE OR REPLACE FUNCTION public.netzwerk_verein(p_verein_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v vereine%rowtype;
  v_mitglied boolean;
begin
  select * into v from vereine x where x.id = p_verein_id;
  if v.id is null or coalesce(v.gesperrt, false) or auth.uid() is null then return null; end if;
  v_mitglied := exists (select 1 from vereins_mitglieder m where m.verein_id = v.id and m.user_id = auth.uid() and coalesce(m.aktiv, true));
  if not konto_aktiv() then return null; end if;
  return jsonb_build_object(
    'id', v.id, 'name', v.name, 'kuerzel', v.kuerzel, 'logo_url', v.logo_url, 'beschreibung', v.beschreibung,
    'webseite', v.webseite, 'ort', v.ort, 'plz', v.plz, 'lat', v.lat, 'lng', v.lng, 'ich_mitglied', v_mitglied,
    'mitglieder_anzahl', (select count(*) from vereins_mitglieder m where m.verein_id = v.id and coalesce(m.aktiv, true) and m.user_id is not null),
    'gruppen', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'disziplin', d.name, 'altersklasse', ak.name,
        'trainer', (select string_agg(a.anzeige, ', ') from gruppen_mitglieder gm join vereins_mitglieder vm on vm.id = gm.vereins_mitglied_id
                    join anzeige_namen(array(select vm2.user_id from gruppen_mitglieder gm2 join vereins_mitglieder vm2 on vm2.id = gm2.vereins_mitglied_id
                                             where gm2.gruppe_id = g.id and gm2.funktion = 'trainer')) a on a.user_id = vm.user_id
                    where gm.gruppe_id = g.id and gm.funktion = 'trainer')) order by g.name)
      from gruppen g left join disziplinen d on d.id = g.disziplin_id left join altersklassen ak on ak.id = g.altersklasse_id
      where g.verein_id = v.id), '[]'::jsonb),
    'trainer', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.user_id, 'name', a.anzeige, 'rolle', t.rolle) order by a.anzeige)
      from (select distinct on (vm.user_id) vm.user_id, r.name as rolle from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
            where vm.verein_id = v.id and coalesce(vm.aktiv, true) and vm.user_id is not null and rollen_typ(r.name) in ('trainer', 'admin')) t
      join anzeige_namen(array(select vm.user_id from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
                               where vm.verein_id = v.id and rollen_typ(r.name) in ('trainer', 'admin'))) a on a.user_id = t.user_id
      where t.user_id = auth.uid() or not ist_blockiert(auth.uid(), t.user_id)), '[]'::jsonb),
    'mitglieder', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.user_id, 'name', a.anzeige, 'rolle', m.rolle, 'avatar_url', pr.avatar_url) order by a.anzeige)
      from (select distinct on (vm.user_id) vm.user_id, coalesce(r.name, 'Mitglied') as rolle
            from vereins_mitglieder vm left join rollen r on r.id = vm.rolle_id
            where vm.verein_id = v.id and coalesce(vm.aktiv, true) and vm.user_id is not null) m
      join anzeige_namen(array(select vm.user_id from vereins_mitglieder vm where vm.verein_id = v.id and coalesce(vm.aktiv, true))) a on a.user_id = m.user_id
      join profiles pr on pr.id = m.user_id
      where m.user_id = auth.uid() or (v_mitglied and not ist_blockiert(auth.uid(), m.user_id)) or netzwerk_auffindbar(m.user_id)), '[]'::jsonb)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.netzwerk_vereine_text(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select string_agg(distinct v.name || coalesce(' · ' || r.name, ''), ', ')
  from vereins_mitglieder vm join vereine v on v.id = vm.verein_id left join rollen r on r.id = vm.rolle_id
  where vm.user_id = p_user_id and coalesce(vm.aktiv, true) and verein_hat_lizenz(vm.verein_id)
    and rollen_typ(r.name) in ('trainer', 'admin');
$function$
;

CREATE OR REPLACE FUNCTION public.nutzer_blockieren(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null or p_user_id is null or p_user_id = auth.uid() or not exists (select 1 from profiles where id = p_user_id) then
    raise exception 'Ungültige Auswahl.' using errcode = 'P0001';
  end if;
  insert into blockierungen (blocker_id, blockiert_id) values (auth.uid(), p_user_id) on conflict do nothing;
  update connections set status = 'blocked', beantwortet_am = now()
  where (user_id = auth.uid() and connected_to = p_user_id) or (user_id = p_user_id and connected_to = auth.uid());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.nutzer_freigeben(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from blockierungen where blocker_id = auth.uid() and blockiert_id = p_user_id;
  if not exists (select 1 from blockierungen where blocker_id = p_user_id and blockiert_id = auth.uid()) then
    delete from connections where status = 'blocked'
      and ((user_id = auth.uid() and connected_to = p_user_id) or (user_id = p_user_id and connected_to = auth.uid()));
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.nutzer_suchen(p_suche text)
 RETURNS TABLE(user_id uuid, anzeige text, handle text, avatar_url text, status text, darf_schreiben boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  q text := lower(btrim(ltrim(btrim(coalesce(p_suche, '')), '@')));
begin
  if auth.uid() is null or char_length(q) < 3 then return; end if;
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  return query
  with treffer as (
    select p.id from profiles p
    where p.id <> auth.uid() and not coalesce(p.gesperrt, false)
      and not ist_blockiert(auth.uid(), p.id)
      and (not ist_unter_15(p.id) or hat_vereinsbeziehung(auth.uid(), p.id) or ist_elternteil_von(auth.uid(), p.id))
      and (lower(p.handle) like q || '%'
           or (not coalesce(p.konto_privat, false) and not ist_minderjaehrig(p.id)
               and lower(coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')) like '%' || q || '%'))
    limit 15
  )
  select t.id, a.anzeige, a.handle,
    (select p.avatar_url from profiles p where p.id = t.id and (not coalesce(p.konto_privat, false) or kann_privates_profil_sehen(p.id))),
    (select case
              when c.status = 'accepted' then 'verbunden'
              when c.status = 'pending' and c.user_id = auth.uid() then 'angefragt'
              when c.status = 'pending' then 'eingehend'
              when c.status = 'rejected' and c.user_id = auth.uid() then 'abgelehnt'
            end
     from connections c where (c.user_id = auth.uid() and c.connected_to = t.id) or (c.user_id = t.id and c.connected_to = auth.uid()) limit 1),
    darf_direkt_schreiben(t.id)
  from treffer t join anzeige_namen(array(select id from treffer)) a on a.user_id = t.id
  order by a.anzeige;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.offene_eltern_bestaetigungen(p_verein_id uuid)
 RETURNS TABLE(id uuid, eltern text, kind text, erstellt_am timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ev.id,
    (select a.anzeige from anzeige_namen(array[ev.eltern_id]) a),
    (select a.anzeige from anzeige_namen(array[ev.kind_id]) a),
    ev.erstellt_am
  from eltern_verknuepfungen ev
  where ev.verein_id = p_verein_id and ev.status = 'wartet_verein'
    and (ist_plattform_admin_aktuell() or exists (
      select 1 from vereins_mitglieder a join rollen r on r.id = a.rolle_id
      where a.verein_id = p_verein_id and a.user_id = auth.uid() and coalesce(a.aktiv, true) and rollen_typ(r.name) = 'admin'))
  order by ev.erstellt_am;
$function$
;

CREATE OR REPLACE FUNCTION public.profiles_schuetzen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Tarif-Neuberechnung (tarif_neu_berechnen_*) darf den Tarif setzen; alles andere nur TanzRaum
  if not ist_endnutzer() or exists (select 1 from tarif_system_freigabe t where t.txid = txid_current()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.ist_plattform_admin := false;
    new.tarif := 'free';
    new.tarif_aktiv_bis := null;
    new.gesperrt := false;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.paypal_subscription_id := null;
    return new;
  end if;
  if new.ist_plattform_admin is distinct from old.ist_plattform_admin
     or new.tarif is distinct from old.tarif
     or new.tarif_aktiv_bis is distinct from old.tarif_aktiv_bis
     or new.gesperrt is distinct from old.gesperrt
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.paypal_subscription_id is distinct from old.paypal_subscription_id then
    raise exception 'Tarif, Admin-Status, Sperre und Zahlungsdaten koennen nur von TanzRaum geaendert werden.'
      using errcode = '42501';
  end if;
  -- Geburtsdatum: einmal eintragen, danach nur durch TanzRaum aenderbar (Jugendschutz)
  if old.geburtsdatum is not null and new.geburtsdatum is distinct from old.geburtsdatum then
    raise exception 'Das Geburtsdatum kann nur von TanzRaum geändert werden.' using errcode = '42501';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pruefe_einladung()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.gruppe_id is not null and not exists (select 1 from gruppen g where g.id = new.gruppe_id and g.verein_id = new.verein_id) then
    raise exception 'Die Gruppe gehört nicht zu diesem Verein.' using errcode = 'P0001';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pruefe_gleicher_verein()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_table_name = 'gruppen_mitglieder' then
    if not exists (
      select 1 from gruppen g join vereins_mitglieder vm on vm.verein_id = g.verein_id
      where g.id = new.gruppe_id and vm.id = new.vereins_mitglied_id) then
      raise exception 'Mitglied und Gruppe gehoeren nicht zum selben Verein.' using errcode = '23514';
    end if;
    if new.funktion is not null and new.funktion not in ('mitglied', 'trainer', 'betreuer') then
      raise exception 'Ungueltige Funktion in der Gruppe.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'eltern_kind_zuordnung' then
    if new.eltern_vm_id = new.kind_vm_id then
      raise exception 'Eine Person kann nicht ihr eigenes Kind sein.' using errcode = '23514';
    end if;
    if (select count(*) from vereins_mitglieder vm where vm.id in (new.eltern_vm_id, new.kind_vm_id) and vm.verein_id = new.verein_id) <> 2 then
      raise exception 'Elternteil und Kind muessen Mitglieder dieses Vereins sein.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pruefe_invite_token(p_token text)
 RETURNS TABLE(gueltig boolean, ersteller_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    (id is not null) as gueltig,
    created_by_name
  from invite_links
  where token = p_token
    and used_by is null
    and expires_at > now()
  union all
  select false, null where not exists (
    select 1 from invite_links where token = p_token and used_by is null and expires_at > now()
  )
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.pruefe_nachricht()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.gesendet_am := now();
  new.inhalt := coalesce(new.inhalt, '');
  if new.antwort_auf is not null and not exists (select 1 from nachrichten n where n.id = new.antwort_auf and n.gespraech_id = new.gespraech_id) then
    new.antwort_auf := null;
  end if;
  if new.sticker is not null then
    if new.bild_pfad is not null or new.umfrage is not null or new.anhang is not null or new.standort is not null then
      raise exception 'Ein Sticker wird allein gesendet.' using errcode = 'P0001';
    end if;
    new.inhalt := '';
  end if;
  if new.umfrage is not null then
    if jsonb_typeof(new.umfrage->'optionen') <> 'array'
       or jsonb_array_length(new.umfrage->'optionen') not between 2 and 12
       or char_length(coalesce(new.umfrage->>'frage', '')) not between 1 and 300
       or exists (select 1 from jsonb_array_elements_text(new.umfrage->'optionen') o where char_length(btrim(o)) not between 1 and 100) then
      raise exception 'Eine Umfrage braucht eine Frage und 2 bis 12 Antworten.' using errcode = 'P0001';
    end if;
    new.umfrage := jsonb_build_object('frage', btrim(new.umfrage->>'frage'),
      'optionen', (select jsonb_agg(btrim(o)) from jsonb_array_elements_text(new.umfrage->'optionen') o),
      'mehrfach', coalesce((new.umfrage->>'mehrfach')::boolean, false));
  end if;
  if new.anhang is not null then
    if coalesce(new.anhang->>'art', '') not in ('datei', 'video', 'audio')
       or coalesce(new.anhang->>'pfad', '') not like new.gespraech_id::text || '/%'
       or not exists (select 1 from storage.objects o where o.bucket_id = 'chat-dateien' and o.name = new.anhang->>'pfad') then
      raise exception 'Der Anhang ist ungültig.' using errcode = 'P0001';
    end if;
    new.anhang := jsonb_build_object(
      'art', new.anhang->>'art',
      'pfad', new.anhang->>'pfad',
      'name', left(coalesce(nullif(btrim(new.anhang->>'name'), ''), 'Datei'), 200),
      'groesse', (select (o.metadata->>'size')::bigint from storage.objects o where o.bucket_id = 'chat-dateien' and o.name = new.anhang->>'pfad'),
      'typ', (select o.metadata->>'mimetype' from storage.objects o where o.bucket_id = 'chat-dateien' and o.name = new.anhang->>'pfad'),
      'dauer', case when (new.anhang->>'dauer') ~ '^\d{1,5}$' then (new.anhang->>'dauer')::int end);
  end if;
  if new.standort is not null then
    if (new.standort->>'lat') !~ '^-?\d{1,2}(\.\d+)?$' or (new.standort->>'lng') !~ '^-?\d{1,3}(\.\d+)?$'
       or abs((new.standort->>'lat')::numeric) > 90 or abs((new.standort->>'lng')::numeric) > 180 then
      raise exception 'Der Standort ist ungültig.' using errcode = 'P0001';
    end if;
    new.standort := jsonb_build_object('lat', round((new.standort->>'lat')::numeric, 6), 'lng', round((new.standort->>'lng')::numeric, 6),
      'genauigkeit', case when (new.standort->>'genauigkeit') ~ '^\d+(\.\d+)?$' then round((new.standort->>'genauigkeit')::numeric) end);
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pruefe_termin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.erstellt_von := auth.uid();
    end if;
  else
    if new.verein_id is distinct from old.verein_id or new.erstellt_von is distinct from old.erstellt_von then
      raise exception 'Verein und Ersteller eines Termins können nicht geändert werden.' using errcode = 'P0001';
    end if;
  end if;
  new.titel := btrim(new.titel);
  new.gruppe_ids := array(select distinct x from unnest(new.gruppe_ids) x);
  if cardinality(new.gruppe_ids) > 0 and exists (
      select 1 from unnest(new.gruppe_ids) gid
      where not exists (select 1 from gruppen g where g.id = gid and g.verein_id = new.verein_id)) then
    raise exception 'Die gewählten Gruppen gehören nicht zu diesem Verein.' using errcode = 'P0001';
  end if;
  new.geaendert_am := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pruefe_training_konsistenz()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from gruppen g where g.id = new.gruppe_id and g.verein_id = new.verein_id) then
    raise exception 'Gruppe gehoert nicht zu diesem Verein.' using errcode = '23514';
  end if;
  if tg_table_name = 'trainingstermine' then
    if new.bis <= new.von then
      raise exception 'Das Trainingsende muss nach dem Beginn liegen.' using errcode = '23514';
    end if;
  else
    if not exists (select 1 from gruppen_mitglieder gm where gm.gruppe_id = new.gruppe_id and gm.vereins_mitglied_id = new.vereins_mitglied_id) then
      raise exception 'Diese Person ist nicht in der Trainingsgruppe.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pruefe_turnier()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_tage jsonb := '[]'::jsonb;
  v_datum date;
  v_beginn text;
  r record;
begin
  new.name := btrim(coalesce(new.name, ''));
  new.ort := btrim(coalesce(new.ort, ''));
  if new.name = '' or length(new.name) > 200 then
    raise exception 'Bitte einen Turniernamen angeben (max. 200 Zeichen).' using errcode = 'P0001';
  end if;
  if new.ort = '' or length(new.ort) > 200 then
    raise exception 'Bitte einen Ort angeben (max. 200 Zeichen).' using errcode = 'P0001';
  end if;
  if new.ausschreibung_url is not null and btrim(new.ausschreibung_url) = '' then new.ausschreibung_url := null; end if;
  if new.ausschreibung_url is not null and (new.ausschreibung_url !~* '^https?://' or length(new.ausschreibung_url) > 500) then
    raise exception 'Der Link zur Ausschreibung muss mit http:// oder https:// beginnen.' using errcode = 'P0001';
  end if;
  if length(coalesce(new.adresse, '')) > 300 or length(coalesce(new.ausrichter, '')) > 200 then
    raise exception 'Adresse oder Ausrichter ist zu lang.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(new.tage) <> 'array' or jsonb_array_length(new.tage) not between 1 and 7 then
    raise exception 'Ein Turnier braucht 1 bis 7 Tage.' using errcode = 'P0001';
  end if;
  for r in
    select e->>'datum' as d, (array_agg(nullif(btrim(e->>'beginn'), '')) filter (where nullif(btrim(e->>'beginn'), '') is not null))[1] as b
    from jsonb_array_elements(new.tage) e group by 1 order by 1
  loop
    if r.d is null or r.d !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Ungültiges Datum im Turnier.' using errcode = 'P0001';
    end if;
    v_datum := r.d::date;
    v_beginn := r.b;
    if v_beginn is not null and v_beginn !~ '^([01]\d|2[0-3]):[0-5]\d$' then
      raise exception 'Ungültige Beginnzeit (Format HH:MM).' using errcode = 'P0001';
    end if;
    v_tage := v_tage || jsonb_strip_nulls(jsonb_build_object('datum', r.d, 'wochentag',
      (array['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'])[extract(isodow from v_datum)::int],
      'beginn', v_beginn));
  end loop;
  new.tage := v_tage;
  if tg_op = 'INSERT' and new.verein_id is not null then
    new.erstellt_von := auth.uid();
  end if;
  if tg_op = 'UPDATE' and new.verein_id is distinct from old.verein_id and not ist_plattform_admin_aktuell() then
    raise exception 'Der Verein eines Turniers kann nicht geändert werden.' using errcode = 'P0001';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pruefe_turnier_start()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t turniere;
  v_solisten uuid[];
begin
  if tg_op = 'UPDATE' and (new.verein_id <> old.verein_id or new.turnier_id <> old.turnier_id) then
    raise exception 'Verein und Turnier eines Starts können nicht geändert werden.' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' and not verein_hat_lizenz(new.verein_id) then
    raise exception 'Die Saisonplanung ist mit der Vereinslizenz verfügbar.' using errcode = 'P0001';
  end if;
  select * into t from turniere where id = new.turnier_id;
  if t.id is null or (t.verein_id is not null and t.verein_id <> new.verein_id) then
    raise exception 'Turnier nicht gefunden.' using errcode = 'P0001';
  end if;
  if new.gruppe_id is not null and not exists (select 1 from gruppen g where g.id = new.gruppe_id and g.verein_id = new.verein_id) then
    raise exception 'Die Gruppe gehört nicht zu diesem Verein.' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(distinct s), '{}') into v_solisten from unnest(coalesce(new.solisten, '{}')) s;
  if cardinality(v_solisten) > 20 then
    raise exception 'Zu viele Solisten (max. 20).' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(v_solisten) s where not exists
      (select 1 from vereins_mitglieder vm where vm.id = s and vm.verein_id = new.verein_id)) then
    raise exception 'Solisten müssen Mitglieder des Vereins sein.' using errcode = 'P0001';
  end if;
  new.solisten := v_solisten;
  new.bezeichnung := nullif(btrim(coalesce(new.bezeichnung, '')), '');
  if new.gruppe_id is null and new.bezeichnung is null and cardinality(new.solisten) = 0 then
    raise exception 'Bitte eine Gruppe oder Solisten/Bezeichnung angeben.' using errcode = 'P0001';
  end if;
  if length(coalesce(new.bezeichnung, '')) > 120 or length(coalesce(new.notiz, '')) > 1000
     or length(coalesce(new.startnummer, '')) > 20 or length(coalesce(new.ergebnis_notiz, '')) > 300 then
    raise exception 'Ein Text ist zu lang.' using errcode = 'P0001';
  end if;
  if new.tag is not null and not exists (select 1 from jsonb_array_elements(t.tage) e where e->>'datum' = new.tag::text) then
    raise exception 'Der gewählte Tag gehört nicht zum Turnier.' using errcode = 'P0001';
  end if;
  new.notiz := nullif(btrim(coalesce(new.notiz, '')), '');
  new.startnummer := nullif(btrim(coalesce(new.startnummer, '')), '');
  new.ergebnis_notiz := nullif(btrim(coalesce(new.ergebnis_notiz, '')), '');
  if tg_op = 'INSERT' then
    new.erstellt_von := auth.uid();
    new.erstellt_am := now();
  end if;
  new.geaendert_am := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.push_vapid_holen()
 RETURNS TABLE(oeffentlich text, privat text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public'),
         (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private');
$function$
;

CREATE OR REPLACE FUNCTION public.push_vapid_speichern(p_oeffentlich text, p_privat text)
 RETURNS TABLE(oeffentlich text, privat text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform pg_advisory_xact_lock(hashtext('tanzraum_vapid'));
  if not exists (select 1 from vault.secrets where name = 'vapid_public') then
    perform vault.create_secret(p_oeffentlich, 'vapid_public', 'Web-Push VAPID (oeffentlich)');
    perform vault.create_secret(p_privat, 'vapid_private', 'Web-Push VAPID (privat)');
  end if;
  return query select * from push_vapid_holen();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rollen_typ(p_rolle text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case
    when lower(coalesce(p_rolle, '')) like '%admin%' then 'admin'
    when lower(coalesce(p_rolle, '')) like '%trainer%' then 'trainer'
    when lower(coalesce(p_rolle, '')) like '%betreuer%' then 'betreuer'
    when lower(coalesce(p_rolle, '')) like 'tänzer%' then 'mitglied'
    when lower(coalesce(p_rolle, '')) in ('eltern', 'vater', 'mutter') then 'eltern'
    else 'sonstige'
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.schreib_sperrgrund(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Gruende, die die ANDERE Person betreffen (unter 15, Elternsperre), werden nicht verraten
  select case
    when auth.uid() is null or p_user_id is null or p_user_id = auth.uid() then 'nicht_moeglich'
    when darf_direkt_schreiben(p_user_id) then null
    when not exists (select 1 from profiles p where p.id = p_user_id and not coalesce(p.gesperrt, false)) then 'nicht_moeglich'
    when ist_blockiert(auth.uid(), p_user_id) then 'blockiert'
    when eltern_nachrichtensperre(auth.uid()) then 'eltern_sperre_ich'
    when ist_unter_15(auth.uid()) then 'jugendschutz'
    when eltern_nachrichtensperre(p_user_id) or ist_unter_15(p_user_id) then 'nicht_moeglich'
    when not kontakt_angenommen(auth.uid(), p_user_id) then 'kontakt_noetig'
    when tarif_von(auth.uid()) not in ('basic', 'verein') then 'tarif_ich'
    when tarif_von(p_user_id) not in ('basic', 'verein') then 'tarif_partner'
    else 'nicht_moeglich'
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.server_geheimnis_gueltig(p_geheimnis text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p_geheimnis is not null
     and p_geheimnis = (select decrypted_secret from vault.decrypted_secrets where name = 'chat_push_geheimnis');
$function$
;

CREATE OR REPLACE FUNCTION public.sichtbare_trainings()
 RETURNS TABLE(id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with meine_vm as (
    select vm.id, vm.verein_id from vereins_mitglieder vm
    join vereine v on v.id = vm.verein_id and coalesce(v.gesperrt, false) = false
    where vm.user_id = auth.uid() and coalesce(vm.aktiv, true)
  ),
  gruppen as (
    select gm.gruppe_id from gruppen_mitglieder gm where gm.vereins_mitglied_id in (select mv.id from meine_vm mv)
    union
    select gm.gruppe_id from eltern_kind_zuordnung ekz
    join gruppen_mitglieder gm on gm.vereins_mitglied_id = ekz.kind_vm_id
    where ekz.eltern_vm_id in (select mv.id from meine_vm mv)
  )
  select tt.id from trainingstermine tt
  where ist_plattform_admin_aktuell()
     or (mein_tarif() in ('basic', 'verein') and (
          tt.verein_id = any(dashboard_vereine('anwesenheit'))
          or (tt.verein_id in (select mv.verein_id from meine_vm mv)
              and (tt.gruppe_id is null or tt.gruppe_id in (select g.gruppe_id from gruppen g)))));
$function$
;

CREATE OR REPLACE FUNCTION public.spotlight_erstellen(p_media_path text, p_media_typ text, p_text text, p_hintergrund text, p_sticker text, p_sichtbarkeit text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_text text := nullif(btrim(coalesce(p_text, '')), '');
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  -- PAUSE: Spotlights sind derzeit ausgeschaltet
  raise exception 'Spotlights sind derzeit nicht verfügbar.' using errcode = 'P0001';
  -- Spotlights nur als Foto
  if p_media_typ <> 'foto' then
    raise exception 'Spotlights gibt es nur als Foto.' using errcode = 'P0001';
  end if;
  if not konto_aktiv() then raise exception 'Dein Konto ist gesperrt.' using errcode = '42501'; end if;
  -- Free: Spotlights nur ansehen
  if tarif_von(auth.uid()) not in ('basic', 'verein') then
    raise exception 'Spotlights erstellen gibt es ab dem Basic-Tarif oder über einen Verein mit Vereinslizenz. Ansehen kannst du sie auch mit Free.' using errcode = 'P0001';
  end if;
  if p_media_typ not in ('foto', 'video', 'text') or p_sichtbarkeit not in ('netzwerk', 'kontakte') then
    raise exception 'Ungültiges Spotlight.' using errcode = 'P0001';
  end if;
  if char_length(v_text) > 500 then raise exception 'Der Text darf höchstens 500 Zeichen haben.' using errcode = 'P0001'; end if;
  if p_media_typ = 'text' then
    if v_text is null and p_sticker is null then raise exception 'Schreib etwas oder wähle einen TanzRaum-Smiley.' using errcode = 'P0001'; end if;
    p_media_path := null;
  elsif coalesce(p_media_path, '') not like auth.uid()::text || '/%'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'spotlights' and o.name = p_media_path) then
    raise exception 'Die Datei wurde nicht gefunden. Bitte lade sie erneut hoch.' using errcode = 'P0001';
  end if;
  if p_hintergrund is not null and p_hintergrund not in ('rot', 'gold', 'navy', 'lila', 'gruen', 'rosa') then p_hintergrund := 'rot'; end if;
  if (select count(*) from spotlights s where s.user_id = auth.uid() and s.erstellt_am > now() - interval '1 day') >= 30 then
    raise exception 'Du hast heute schon 30 Spotlights geteilt – morgen geht es weiter.' using errcode = 'P0001';
  end if;
  insert into spotlights (user_id, media_path, media_typ, text_overlay, hintergrund, sticker, sichtbarkeit, erstellt_am, ablauf_am)
  values (auth.uid(), p_media_path, p_media_typ, v_text, coalesce(p_hintergrund, 'rot'), p_sticker, p_sichtbarkeit, now(), now() + interval '24 hours')
  returning id into v_id;
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.spotlight_gesehen(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if darf_spotlight_sehen(p_id) then
    insert into spotlight_views (spotlight_id, viewer_user_id, viewed_am) values (p_id, auth.uid(), now()) on conflict do nothing;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.spotlight_leiste()
 RETURNS TABLE(user_id uuid, name text, avatar_url text, anzahl integer, ungesehen integer, neuestes timestamp with time zone, ich boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with sichtbar as (
    select s.id, s.user_id, s.erstellt_am,
      exists (select 1 from spotlight_views v where v.spotlight_id = s.id and v.viewer_user_id = auth.uid()) as gesehen
    from spotlights s
    where s.ablauf_am > now() and s.entfernt_am is null and darf_spotlight_sehen(s.id)
  ),
  je as (
    select x.user_id, count(*)::int as anzahl, count(*) filter (where not x.gesehen and x.user_id <> auth.uid())::int as ungesehen,
           max(x.erstellt_am) as neuestes
    from sichtbar x group by x.user_id
  )
  select je.user_id, a.anzeige, p.avatar_url, je.anzahl, je.ungesehen, je.neuestes, je.user_id = auth.uid()
  from je join anzeige_namen(array(select j2.user_id from je j2)) a on a.user_id = je.user_id
  join profiles p on p.id = je.user_id
  order by je.user_id = auth.uid() desc, (je.ungesehen > 0) desc, je.neuestes desc
  limit 100;
$function$
;

CREATE OR REPLACE FUNCTION public.spotlight_loeschen(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from spotlights s where s.id = p_id and (s.user_id = auth.uid() or ist_plattform_admin_aktuell())) then
    raise exception 'Dieses Spotlight kannst du nicht löschen.' using errcode = '42501';
  end if;
  -- sofort unsichtbar; Datei und Eintrag raeumt der stuendliche Job auf
  update spotlights set entfernt_am = now(), ablauf_am = least(ablauf_am, now()) where id = p_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.spotlight_medium_sichtbar(p_pfad text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from spotlights s where s.media_path = p_pfad and (darf_spotlight_sehen(s.id) or ist_plattform_admin_aktuell()));
$function$
;

CREATE OR REPLACE FUNCTION public.spotlight_nur_kontakte(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.sichtbarkeit = 'kontakte' or coalesce(a.konto_privat, false)
      or (coalesce((select ke.spotlights_nur_kontakte from kind_einstellungen ke where ke.kind_id = s.user_id), false)
          and hat_eltern(s.user_id) and ist_minderjaehrig(s.user_id))
  from spotlights s join profiles a on a.id = s.user_id where s.id = p_id;
$function$
;

CREATE OR REPLACE FUNCTION public.spotlight_reagieren(p_id uuid, p_sticker text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_autor uuid;
begin
  select s.user_id into v_autor from spotlights s where s.id = p_id;
  if v_autor is null or v_autor = auth.uid() or not darf_spotlight_sehen(p_id) then
    raise exception 'Reaktion nicht möglich.' using errcode = 'P0001';
  end if;
  if p_sticker is null then
    delete from spotlight_reactions where spotlight_id = p_id and user_id = auth.uid();
    return;
  end if;
  insert into spotlight_reactions (spotlight_id, user_id, emoji) values (p_id, auth.uid(), p_sticker)
  on conflict (spotlight_id, user_id) do update set emoji = excluded.emoji, erstellt_am = now();
  insert into benachrichtigungen (user_id, typ, text)
  values (v_autor, 'spotlight', coalesce((select a.anzeige from anzeige_namen(array[auth.uid()]) a), 'Jemand') || ' hat auf dein Spotlight reagiert.');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.spotlights_von(p_user_id uuid)
 RETURNS TABLE(id uuid, media_path text, media_typ text, text text, hintergrund text, sticker text, sichtbarkeit text, erstellt_am timestamp with time zone, ablauf_am timestamp with time zone, gesehen boolean, meine_reaktion text, ansichten integer, reaktionen jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, s.media_path, s.media_typ, s.text_overlay, s.hintergrund, s.sticker, s.sichtbarkeit, s.erstellt_am, s.ablauf_am,
    exists (select 1 from spotlight_views v where v.spotlight_id = s.id and v.viewer_user_id = auth.uid()),
    (select r.emoji from spotlight_reactions r where r.spotlight_id = s.id and r.user_id = auth.uid()),
    case when s.user_id = auth.uid() then (select count(*)::int from spotlight_views v where v.spotlight_id = s.id and v.viewer_user_id <> auth.uid()) end,
    case when s.user_id = auth.uid() then (
      select coalesce(jsonb_agg(jsonb_build_object('name', a.anzeige, 'sticker', r.emoji) order by r.erstellt_am desc), '[]'::jsonb)
      from spotlight_reactions r join anzeige_namen(array(select r2.user_id from spotlight_reactions r2 where r2.spotlight_id = s.id)) a on a.user_id = r.user_id
      where r.spotlight_id = s.id) end
  from spotlights s
  where s.user_id = p_user_id and s.ablauf_am > now() and s.entfernt_am is null and darf_spotlight_sehen(s.id)
  order by s.erstellt_am;
$function$
;

CREATE OR REPLACE FUNCTION public.spotlights_zum_loeschen()
 RETURNS TABLE(id uuid, media_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, s.media_path from spotlights s
  where s.ablauf_am < now()
    and not exists (select 1 from meldungen m where m.spotlight_id = s.id and m.status = 'offen')
  limit 500;
$function$
;

CREATE OR REPLACE FUNCTION public.start_teilnehmer_ids(p_start_id uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select gm.vereins_mitglied_id from turnier_starts s
  join gruppen_mitglieder gm on gm.gruppe_id = s.gruppe_id
  where s.id = p_start_id and coalesce(gm.funktion, 'mitglied') = 'mitglied'
  union
  select unnest(s.solisten) from turnier_starts s where s.id = p_start_id;
$function$
;

CREATE OR REPLACE FUNCTION public.suche_netzwerk_trainer(suchbegriff text, anfragender_id uuid)
 RETURNS TABLE(id uuid, anzeigename text, handle text, verein_name text, verein_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct on (p.id) p.id,
    coalesce(nullif(trim(coalesce(p.vorname,'') || ' ' || coalesce(p.nachname,'')), ''), '@' || p.handle) as anzeigename,
    p.handle, v.name, v.id
  from profiles p
  join vereins_mitglieder vm on vm.user_id = p.id
  join rollen r on r.id = vm.rolle_id
  join vereine v on v.id = vm.verein_id
  where auth.uid() is not null
    and length(btrim(coalesce(suchbegriff, ''))) >= 2
    and r.name in ('Trainer','Trainerin','Vereins-Admin') and v.tarif = 'verein'
    and p.id <> auth.uid()
    and coalesce(p.konto_privat, false) = false
    and (p.handle ilike '%'||suchbegriff||'%' or p.vorname ilike '%'||suchbegriff||'%' or p.nachname ilike '%'||suchbegriff||'%')
  order by p.id limit 10;
$function$
;

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
  v_neu text;
begin
  select tarif into v_alt from profiles where id = p_user_id;
  if v_alt is null then return; end if;
  -- persoenlicher VEREIN-Tarif aus der Zeit vor den Abos bleibt unangetastet (Fall C)
  if v_alt = 'verein' and not exists (select 1 from abos a where a.inhaber = 'person' and a.user_id = p_user_id) then
    return;
  end if;
  select count(*), max(case when a.periode = 'unbefristet' or a.status = 'paused_by_organization' then null else a.laeuft_bis end)
    into v_anzahl, v_bis
  from abos a where a.inhaber = 'person' and a.user_id = p_user_id and abo_gilt(a);
  v_neu := case when v_anzahl > 0 then 'basic' else 'free' end;
  insert into tarif_system_freigabe (txid) values (txid_current()) on conflict do nothing;
  update profiles set tarif = v_neu, tarif_aktiv_bis = case when v_neu = 'free' then null else v_bis end where id = p_user_id;
  delete from tarif_system_freigabe where txid = txid_current();
  if v_alt is distinct from v_neu then
    insert into tarif_ereignisse (user_id, previous_plan, new_plan, reason) values (p_user_id, v_alt, v_neu, coalesce(p_grund, 'abo'));
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tarif_neu_berechnen_verein(p_verein_id uuid, p_grund text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_alt text;
  v_anzahl int;
  v_unbefristet boolean;
  v_bis timestamptz;
  v_kaeufer uuid;
  v_neu text;
begin
  select tarif into v_alt from vereine where id = p_verein_id;
  if v_alt is null then return; end if;
  select count(*), coalesce(bool_or(a.periode = 'unbefristet'), false), max(a.laeuft_bis), (array_agg(a.user_id order by a.erstellt_am desc))[1]
    into v_anzahl, v_unbefristet, v_bis, v_kaeufer
  from abos a where a.inhaber = 'verein' and a.verein_id = p_verein_id and abo_gilt(a);
  v_neu := case when v_anzahl > 0 then 'verein' else 'free' end;
  insert into tarif_system_freigabe (txid) values (txid_current()) on conflict do nothing;
  update vereine set
    tarif = v_neu,
    tarif_aktiv_bis = case when v_neu = 'free' or v_unbefristet or v_bis is null then null
                           else to_char(v_bis at time zone 'Europe/Berlin', 'YYYY-MM-DD') end
  where id = p_verein_id;
  delete from tarif_system_freigabe where txid = txid_current();
  if v_alt is distinct from v_neu then
    insert into tarif_ereignisse (user_id, verein_id, previous_plan, new_plan, reason)
    values (coalesce(v_kaeufer, (select a.user_id from abos a where a.inhaber = 'verein' and a.verein_id = p_verein_id order by a.aktualisiert_am desc limit 1)), p_verein_id, v_alt, v_neu, coalesce(p_grund, 'vereinslizenz'));
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tarif_stufe(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when vereinslizenz_verein_von(p.id) is not null or p.tarif = 'verein' then 'verein'
              when p.tarif = 'basic' then 'basic' else 'free' end
  from profiles p where p.id = p_user_id;
$function$
;

CREATE OR REPLACE FUNCTION public.tarif_von(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when p.ist_plattform_admin then 'verein'
    when exists (select 1 from vereins_mitglieder vm
                 where vm.user_id = p.id and coalesce(vm.aktiv, true) and verein_hat_lizenz(vm.verein_id)) then 'verein'
    when p.tarif in ('basic', 'verein') and (p.tarif_aktiv_bis is null or p.tarif_aktiv_bis > now()) then p.tarif
    else 'free'
  end
  from profiles p where p.id = p_user_id;
$function$
;

CREATE OR REPLACE FUNCTION public.termin_benachrichtigen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.verein_id is null then
    return new;
  end if;
  insert into benachrichtigungen (user_id, typ, text)
  select distinct u.user_id, 'termin',
    'Neuer Termin: ' || new.titel || ' am ' || to_char(new.datum, 'DD.MM.YYYY')
      || case when new.rueckmeldung then ' – bitte zu- oder absagen.' else '' end
  from (
    select vm.user_id from vereins_mitglieder vm
    where vm.verein_id = new.verein_id and vm_eingeladen_zu(new.verein_id, new.zielgruppe, new.gruppe_ids, vm.id)
    union
    select e.user_id from vereins_mitglieder k
    join eltern_kind_zuordnung ekz on ekz.kind_vm_id = k.id
    join vereins_mitglieder e on e.id = ekz.eltern_vm_id
    where k.verein_id = new.verein_id and vm_eingeladen_zu(new.verein_id, new.zielgruppe, new.gruppe_ids, k.id)
  ) u
  where u.user_id is not null and u.user_id is distinct from new.erstellt_von;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.termin_erinnerungen_senden()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_morgen date := (now() at time zone 'Europe/Berlin')::date + 1;
begin
  insert into benachrichtigungen (user_id, typ, text)
  select distinct u.user_id, 'termin_erinnerung',
    'Morgen: ' || t.titel || coalesce(' um ' || to_char(t.von, 'HH24:MI') || ' Uhr', '') || coalesce(' – ' || t.ort, '')
  from termine t
  cross join lateral (
    select t.erstellt_von as user_id where t.verein_id is null
    union
    select vm.user_id from vereins_mitglieder vm
    where t.verein_id is not null and vm.verein_id = t.verein_id and coalesce(vm.aktiv, true) and vm_eingeladen(t.id, vm.id)
    union
    select e.user_id from vereins_mitglieder k
    join eltern_kind_zuordnung ekz on ekz.kind_vm_id = k.id
    join vereins_mitglieder e on e.id = ekz.eltern_vm_id
    where t.verein_id is not null and k.verein_id = t.verein_id and coalesce(k.aktiv, true) and vm_eingeladen(t.id, k.id)
  ) u
  where t.datum = v_morgen
    and u.user_id is not null
    and (t.verein_id is null or verein_hat_lizenz(t.verein_id));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.termin_rueckmelden(p_termin_id uuid, p_vm_id uuid, p_status text, p_kommentar text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t termine;
begin
  select * into t from termine where id = p_termin_id;
  if t.id is null or not termin_sichtbar(t.id) then
    raise exception 'Termin nicht gefunden.' using errcode = 'P0001';
  end if;
  if not t.rueckmeldung then
    raise exception 'Für diesen Termin sind keine Rückmeldungen vorgesehen.' using errcode = 'P0001';
  end if;
  if coalesce(t.bis_datum, t.datum) < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'Der Termin liegt in der Vergangenheit.' using errcode = 'P0001';
  end if;
  if not ist_eigenes_oder_kind(p_vm_id) or not vm_eingeladen(t.id, p_vm_id) then
    raise exception 'Für diese Person kannst du nicht zu- oder absagen.' using errcode = 'P0001';
  end if;
  if p_status is null then
    delete from termin_rueckmeldungen where termin_id = t.id and vereins_mitglied_id = p_vm_id;
    return;
  end if;
  if p_status not in ('zugesagt', 'abgesagt', 'vielleicht') then
    raise exception 'Ungültige Rückmeldung.' using errcode = 'P0001';
  end if;
  insert into termin_rueckmeldungen (termin_id, vereins_mitglied_id, status, kommentar, geaendert_von, geaendert_am)
  values (t.id, p_vm_id, p_status, nullif(btrim(left(p_kommentar, 300)), ''), auth.uid(), now())
  on conflict (termin_id, vereins_mitglied_id)
  do update set status = excluded.status, kommentar = excluded.kommentar, geaendert_von = auth.uid(), geaendert_am = now();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.termin_sichtbar(p_termin_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select termin_zeile_sichtbar(t.verein_id, t.erstellt_von, t.zielgruppe, t.gruppe_ids) from termine t where t.id = p_termin_id), false);
$function$
;

CREATE OR REPLACE FUNCTION public.termin_teilnehmer(p_termin_id uuid)
 RETURNS TABLE(vm_id uuid, name text, status text, kommentar text, geaendert_am timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_verein uuid;
begin
  select t.verein_id into v_verein from termine t where t.id = p_termin_id;
  if v_verein is null or not darf_vereinstermine_verwalten(v_verein) then
    return;
  end if;
  return query
  select vm.id, (select a.anzeige from anzeige_namen(array[vm.user_id]) a), r.status, r.kommentar, r.geaendert_am
  from vereins_mitglieder vm
  left join termin_rueckmeldungen r on r.termin_id = p_termin_id and r.vereins_mitglied_id = vm.id
  where vm.verein_id = v_verein and vm_eingeladen(p_termin_id, vm.id)
  order by case r.status when 'zugesagt' then 1 when 'vielleicht' then 2 when 'abgesagt' then 3 else 4 end, 2;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.termin_zeile_sichtbar(p_verein_id uuid, p_erstellt_von uuid, p_zielgruppe text, p_gruppe_ids uuid[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when p_verein_id is null then p_erstellt_von = auth.uid()
    else verein_hat_lizenz(p_verein_id) and (
      darf_vereinstermine_verwalten(p_verein_id)
      or exists (
        select 1 from vereins_mitglieder vm
        where vm.user_id = auth.uid() and vm.verein_id = p_verein_id and coalesce(vm.aktiv, true)
          and (vm_eingeladen_zu(p_verein_id, p_zielgruppe, p_gruppe_ids, vm.id)
               or exists (select 1 from eltern_kind_zuordnung ekz
                          where ekz.eltern_vm_id = vm.id and vm_eingeladen_zu(p_verein_id, p_zielgruppe, p_gruppe_ids, ekz.kind_vm_id)))))
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.trainer_profil_info(p_user_id uuid)
 RETURNS TABLE(verein_name text, verein_id uuid, mitglieder_anzahl integer, gruppen jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select v.name, v.id,
    case when v.mitgliederzahl_oeffentlich then (select count(*)::int from vereins_mitglieder vm2 where vm2.verein_id = v.id) else null end,
    coalesce((select jsonb_agg(distinct jsonb_build_object('name', g.name, 'altersklasse', ak.name, 'disziplin', d.name))
              from gruppen_mitglieder gm join gruppen g on g.id = gm.gruppe_id
              left join disziplinen d on d.id = g.disziplin_id left join altersklassen ak on ak.id = g.altersklasse_id
              where gm.vereins_mitglied_id = vm.id and gm.funktion in ('trainer','betreuer')), '[]'::jsonb)
  from vereins_mitglieder vm join vereine v on v.id = vm.verein_id join rollen r on r.id = vm.rolle_id
  where auth.uid() is not null and vm.user_id = p_user_id
    and r.name in ('Trainer','Trainerin','Vereins-Admin') and v.tarif = 'verein'
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.training_kalender(p_von date, p_bis date)
 RETURNS TABLE(termin_id uuid, verein_id uuid, verein_name text, gruppe_id uuid, gruppe_name text, datum date, von time without time zone, bis time without time zone, halle text, titel text, wiederholend boolean, darf_verwalten boolean, darf_anwesenheit boolean, personen jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bis date := least(p_bis, p_von + 62);
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  with sichtbar as (
    select tt.* from trainingstermine tt
    where is_verein_admin(tt.verein_id)
       or ist_gruppen_betreuung_erweitert(tt.gruppe_id)
       or tt.id in (select s.id from sichtbare_trainings() s)
  ),
  tage as (
    select s.id as tid, d::date as tag
    from sichtbar s, generate_series(p_von, v_bis, interval '1 day') d
    where (s.ist_wiederholend and extract(isodow from d) = s.wochentag)
       or (not s.ist_wiederholend and s.datum = d::date)
  ),
  meine as (
    select vm.id as vm_id, vm.user_id, true as ich from vereins_mitglieder vm where vm.user_id = auth.uid()
    union
    select k.id, k.user_id, false from eltern_kind_zuordnung ekz
    join vereins_mitglieder e on e.id = ekz.eltern_vm_id and e.user_id = auth.uid()
    join vereins_mitglieder k on k.id = ekz.kind_vm_id
  )
  select s.id, s.verein_id, v.name, s.gruppe_id, g.name, t.tag, s.von, s.bis, s.halle, s.titel, s.ist_wiederholend,
    ist_gruppen_betreuung(s.gruppe_id),
    is_verein_admin(s.verein_id) or (ist_gruppen_betreuung_erweitert(s.gruppe_id) and hat_vereinsbereich(s.verein_id, 'anwesenheit')),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'vm_id', m.vm_id,
        'name', (select a.anzeige from anzeige_namen(array[m.user_id]) a),
        'ich', m.ich,
        'abgemeldet', ab.id is not null,
        'grund', ab.grund) order by m.ich desc)
      from meine m
      join gruppen_mitglieder gm on gm.vereins_mitglied_id = m.vm_id and gm.gruppe_id = s.gruppe_id
        and coalesce(gm.funktion, 'mitglied') = 'mitglied'
      left join trainings_abmeldungen ab on ab.vereins_mitglied_id = m.vm_id and ab.gruppe_id = s.gruppe_id and ab.datum = t.tag
    ), '[]')
  from tage t
  join sichtbar s on s.id = t.tid
  join gruppen g on g.id = s.gruppe_id
  join vereine v on v.id = s.verein_id
  order by t.tag, s.von;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.turnier_sichtbar(p_verein_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p_verein_id is null or p_verein_id = any(meine_vereine());
$function$
;

CREATE OR REPLACE FUNCTION public.turnier_start_rueckmelden(p_start_id uuid, p_vm_id uuid, p_status text, p_kommentar text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s turnier_starts;
  v_letzter date;
begin
  select * into s from turnier_starts where id = p_start_id;
  if s.id is null or not (s.verein_id = any(meine_vereine()) and verein_hat_lizenz(s.verein_id)) then
    raise exception 'Start nicht gefunden.' using errcode = 'P0001';
  end if;
  if s.status = 'abgesagt' then
    raise exception 'Dieser Start wurde abgesagt.' using errcode = 'P0001';
  end if;
  select max((e->>'datum')::date) into v_letzter from turniere t, jsonb_array_elements(t.tage) e where t.id = s.turnier_id;
  if v_letzter < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'Das Turnier liegt in der Vergangenheit.' using errcode = 'P0001';
  end if;
  if not ist_eigenes_oder_kind(p_vm_id) or p_vm_id not in (select start_teilnehmer_ids(s.id)) then
    raise exception 'Für diese Person kannst du keine Rückmeldung geben.' using errcode = 'P0001';
  end if;
  if p_status is null then
    delete from turnier_start_rueckmeldungen where start_id = s.id and vereins_mitglied_id = p_vm_id;
    return;
  end if;
  if p_status not in ('dabei', 'nicht_dabei', 'unsicher') then
    raise exception 'Ungültige Rückmeldung.' using errcode = 'P0001';
  end if;
  insert into turnier_start_rueckmeldungen (start_id, vereins_mitglied_id, status, kommentar, geaendert_von, geaendert_am)
  values (s.id, p_vm_id, p_status, nullif(btrim(left(p_kommentar, 300)), ''), auth.uid(), now())
  on conflict (start_id, vereins_mitglied_id)
  do update set status = excluded.status, kommentar = excluded.kommentar, geaendert_von = auth.uid(), geaendert_am = now();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.turnier_start_teilnehmer(p_start_id uuid)
 RETURNS TABLE(vm_id uuid, name text, status text, kommentar text, geaendert_am timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s turnier_starts;
begin
  select * into s from turnier_starts where id = p_start_id;
  if s.id is null or not (darf_vereinstermine_verwalten(s.verein_id) or (s.gruppe_id is not null and ist_gruppen_betreuung(s.gruppe_id))) then
    return;
  end if;
  return query
  select vm.id, (select a.anzeige from anzeige_namen(array[vm.user_id]) a), r.status, r.kommentar, r.geaendert_am
  from vereins_mitglieder vm
  left join turnier_start_rueckmeldungen r on r.start_id = s.id and r.vereins_mitglied_id = vm.id
  where vm.id in (select start_teilnehmer_ids(s.id))
  order by case r.status when 'dabei' then 1 when 'unsicher' then 2 when 'nicht_dabei' then 3 else 4 end, 2;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.turniere_uebersicht(p_von date, p_bis date)
 RETURNS TABLE(id uuid, name text, typ text, kategorie text, ort text, adresse text, ausrichter text, ausschreibung_url text, verband text, erster_tag date, letzter_tag date, tage jsonb, meldeschluss date, beginn_samstag text, beginn_sonntag text, verein_id uuid, verein_name text, gemerkt boolean, unsere_starts integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with sichtbar as (
    select t.*, (select min((e->>'datum')::date) from jsonb_array_elements(t.tage) e) as von_d,
                (select max((e->>'datum')::date) from jsonb_array_elements(t.tage) e) as bis_d
    from turniere t
    where auth.uid() is not null and turnier_sichtbar(t.verein_id)
  )
  select s.id, s.name, s.typ, s.kategorie, s.ort, s.adresse, s.ausrichter, s.ausschreibung_url,
    coalesce(vb.kuerzel, vb.name), s.von_d, s.bis_d, s.tage, s.meldeschluss, s.beginn_samstag, s.beginn_sonntag,
    s.verein_id, v.name,
    exists (select 1 from turnier_merkliste m where m.turnier_id = s.id and m.user_id = auth.uid()),
    (select count(*)::int from turnier_starts ts where ts.turnier_id = s.id and ts.status <> 'abgesagt'
       and ts.verein_id = any(meine_vereine()) and verein_hat_lizenz(ts.verein_id))
  from sichtbar s
  left join verbaende vb on vb.id = s.verband_id
  left join vereine v on v.id = s.verein_id
  where s.bis_d >= p_von and s.von_d <= least(p_bis, p_von + 1500)
  order by s.von_d, s.name;
$function$
;

CREATE OR REPLACE FUNCTION public.umfrage_abstimmen(p_nachricht_id uuid, p_optionen integer[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n nachrichten%rowtype;
  v_anzahl int;
begin
  select * into n from nachrichten where id = p_nachricht_id;
  if n.id is null or n.umfrage is null or n.geloescht_am is not null or not hat_gespraech_zugriff(n.gespraech_id) then
    raise exception 'Umfrage nicht gefunden.' using errcode = 'P0001';
  end if;
  v_anzahl := jsonb_array_length(n.umfrage->'optionen');
  p_optionen := array(select distinct o from unnest(coalesce(p_optionen, '{}')) o);
  if exists (select 1 from unnest(p_optionen) o where o < 0 or o >= v_anzahl) then
    raise exception 'Ungültige Antwort.' using errcode = 'P0001';
  end if;
  if cardinality(p_optionen) > 1 and not coalesce((n.umfrage->>'mehrfach')::boolean, false) then
    raise exception 'Hier ist nur eine Antwort möglich.' using errcode = 'P0001';
  end if;
  delete from umfrage_stimmen where nachricht_id = n.id and user_id = auth.uid();
  insert into umfrage_stimmen (nachricht_id, user_id, option) select n.id, auth.uid(), o from unnest(p_optionen) o;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.verbindungs_status(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when c.status = 'accepted' then 'verbunden'
    when c.status = 'pending' and c.user_id = auth.uid() then 'angefragt'
    when c.status = 'pending' then 'eingehend'
    when c.status = 'rejected' and c.user_id = auth.uid() then 'abgelehnt'
  end
  from connections c
  where (c.user_id = auth.uid() and c.connected_to = p_user_id) or (c.user_id = p_user_id and c.connected_to = auth.uid())
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.verein_anlegen(p_name text, p_kuerzel text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_admin_rolle uuid;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Bitte einen Vereinsnamen angeben.';
  end if;
  select id into v_admin_rolle from rollen where rollen_typ(name) = 'admin' order by name limit 1;
  insert into vereine(name, kuerzel) values (trim(p_name), nullif(trim(coalesce(p_kuerzel, '')), '')) returning id into v_id;
  insert into vereins_mitglieder(user_id, verein_id, rolle_id) values (auth.uid(), v_id, v_admin_rolle);
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.verein_beitritts_info(p_verein_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  result json;
begin
  select json_build_object(
    'id', v.id,
    'name', v.name,
    'strasse', v.strasse,
    'hausnummer', v.hausnummer,
    'plz', v.plz,
    'ort', v.ort,
    'satzung_pfad', v.satzung_pfad,
    'sepa_glaeubiger_id', v.sepa_glaeubiger_id,
    'beitragsordnung_text', coalesce(v.beitragsordnung_text, 'Der Beitrag ist gemäß der Beitragsordnung des Vereins fällig und wird per SEPA-Lastschrift eingezogen.'),
    'datenschutz_text', coalesce(v.datenschutz_text, 'Ich stimme der Verarbeitung meiner Daten gemäß DSGVO durch den Verein zu. Meine Daten werden ausschließlich für Vereinszwecke genutzt.'),
    'sepa_aktiv', v.beitritt_sepa_aktiv,
    'foto_aktiv', v.beitritt_foto_aktiv,
    'gruppen', coalesce((select json_agg(a.name order by a.sortierung) from altersklassen a), '[]'::json)
  ) into result
  from vereine v
  where v.id = p_verein_id;
  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.verein_hat_lizenz(p_verein_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from vereine v
    where v.id = p_verein_id
      and v.tarif = 'verein'
      and coalesce(v.gesperrt, false) = false
      and case
            when v.tarif_aktiv_bis is null or v.tarif_aktiv_bis !~ '^\d{4}-\d{2}-\d{2}' then true
            else left(v.tarif_aktiv_bis, 10)::date >= (now() at time zone 'Europe/Berlin')::date
          end);
$function$
;

CREATE OR REPLACE FUNCTION public.verein_standort_setzen(p_verein_id uuid, p_lat double precision, p_lng double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (ist_plattform_admin_aktuell() or exists (
      select 1 from vereins_mitglieder a join rollen r on r.id = a.rolle_id
      where a.verein_id = p_verein_id and a.user_id = auth.uid() and coalesce(a.aktiv, true) and rollen_typ(r.name) = 'admin')) then
    raise exception 'Nur der Vereinsadmin kann den Standort ändern.' using errcode = '42501';
  end if;
  update vereine set lat = round(p_lat::numeric, 5)::double precision, lng = round(p_lng::numeric, 5)::double precision where id = p_verein_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.verein_uebersicht(p_verein_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ich uuid;
  v_ergebnis jsonb;
begin
  select vm.id into v_ich from vereins_mitglieder vm where vm.verein_id = p_verein_id and vm.user_id = auth.uid();
  if v_ich is null and not ist_plattform_admin_aktuell() then
    raise exception 'Kein Mitglied dieses Vereins' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'meine_rolle', (select r.name from vereins_mitglieder vm left join rollen r on r.id = vm.rolle_id where vm.id = v_ich),
    'meine_gruppen', coalesce((select jsonb_agg(g.name order by g.name) from gruppen_mitglieder gm join gruppen g on g.id = gm.gruppe_id where gm.vereins_mitglied_id = v_ich), '[]'),
    'lizenz', verein_hat_lizenz(p_verein_id),
    'mitglieder_anzahl', (select count(*) from vereins_mitglieder vm where vm.verein_id = p_verein_id and coalesce(vm.aktiv, true)),
    'gruppen', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'altersklasse_id', g.altersklasse_id,
        'altersklasse', ak.name,
        'disziplin_id', g.disziplin_id,
        'disziplin', d.name,
        'thema', g.thema,
        'anzahl', (select count(*) from gruppen_mitglieder gm where gm.gruppe_id = g.id and coalesce(gm.funktion, '') not in ('trainer', 'betreuer')),
        'trainer', coalesce((select jsonb_agg(a.anzeige order by a.anzeige)
                             from gruppen_mitglieder gm
                             join vereins_mitglieder vm on vm.id = gm.vereins_mitglied_id
                             cross join lateral anzeige_namen(array[vm.user_id]) a
                             where gm.gruppe_id = g.id and gm.funktion = 'trainer'), '[]'),
        'betreuer', coalesce((select jsonb_agg(a.anzeige order by a.anzeige)
                             from gruppen_mitglieder gm
                             join vereins_mitglieder vm on vm.id = gm.vereins_mitglied_id
                             cross join lateral anzeige_namen(array[vm.user_id]) a
                             where gm.gruppe_id = g.id and gm.funktion = 'betreuer'), '[]')
      ) order by g.name)
      from gruppen g
      left join altersklassen ak on ak.id = g.altersklasse_id
      left join disziplinen d on d.id = g.disziplin_id
      where g.verein_id = p_verein_id), '[]'),
    'ansprechpartner', coalesce((
      select jsonb_agg(jsonb_build_object('name', a.anzeige, 'rolle', r.name) order by rollen_typ(r.name), a.anzeige)
      from vereins_mitglieder vm
      join rollen r on r.id = vm.rolle_id
      cross join lateral anzeige_namen(array[vm.user_id]) a
      where vm.verein_id = p_verein_id and coalesce(vm.aktiv, true) and rollen_typ(r.name) in ('admin', 'trainer')), '[]')
  ) into v_ergebnis;

  return v_ergebnis;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.vereine_schuetzen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Tarif-Neuberechnung (tarif_neu_berechnen_*) darf den Tarif setzen; alles andere nur TanzRaum
  if not ist_endnutzer() or exists (select 1 from tarif_system_freigabe t where t.txid = txid_current()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.tarif := 'free';
    new.tarif_aktiv_bis := null;
    new.gesperrt := false;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.paypal_subscription_id := null;
    return new;
  end if;
  if new.tarif is distinct from old.tarif
     or new.tarif_aktiv_bis is distinct from old.tarif_aktiv_bis
     or new.gesperrt is distinct from old.gesperrt
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.paypal_subscription_id is distinct from old.paypal_subscription_id then
    raise exception 'Lizenz, Sperre und Zahlungsdaten des Vereins koennen nur von TanzRaum geaendert werden.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.vereine_text_von(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select string_agg(distinct v.name, ', ')
  from vereins_mitglieder vm join vereine v on v.id = vm.verein_id
  where vm.user_id = p_user_id and coalesce(vm.aktiv, true) and not coalesce(v.gesperrt, false);
$function$
;

CREATE OR REPLACE FUNCTION public.vereins_starts(p_verein_id uuid, p_von date, p_bis date, p_turnier_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, turnier_id uuid, turnier_name text, turnier_ort text, erster_tag date, letzter_tag date, turnier_tage jsonb, meldeschluss date, eigenes_turnier boolean, gruppe_id uuid, gruppe_name text, bezeichnung text, solisten uuid[], solisten_namen text, disziplin_id uuid, disziplin text, altersklasse_id uuid, altersklasse text, tag date, startnummer text, status text, notiz text, platz integer, punkte numeric, ergebnis_notiz text, dabei integer, nicht_dabei integer, unsicher integer, teilnehmer integer, darf_bearbeiten boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not ((p_verein_id = any(meine_vereine()) and verein_hat_lizenz(p_verein_id)) or ist_plattform_admin_aktuell()) then
    return;
  end if;
  return query
  with st as (
    select s.*, t.name as t_name, t.ort as t_ort, t.tage as t_tage, t.meldeschluss as t_meldeschluss, t.verein_id as t_verein,
      (select min((e->>'datum')::date) from jsonb_array_elements(t.tage) e) as von_d,
      (select max((e->>'datum')::date) from jsonb_array_elements(t.tage) e) as bis_d
    from turnier_starts s join turniere t on t.id = s.turnier_id
    where s.verein_id = p_verein_id and (p_turnier_id is null or s.turnier_id = p_turnier_id)
  )
  select st.id, st.turnier_id, st.t_name, st.t_ort, st.von_d, st.bis_d, st.t_tage, st.t_meldeschluss, st.t_verein is not null,
    st.gruppe_id, g.name, st.bezeichnung, st.solisten,
    (select string_agg(a.anzeige, ', ' order by a.anzeige) from anzeige_namen(
        (select array_agg(vm.user_id) from vereins_mitglieder vm where vm.id = any(st.solisten))) a),
    st.disziplin_id, d.name, st.altersklasse_id, ak.name, st.tag, st.startnummer, st.status, st.notiz,
    st.platz, st.punkte, st.ergebnis_notiz,
    (select count(*)::int from turnier_start_rueckmeldungen r where r.start_id = st.id and r.status = 'dabei'),
    (select count(*)::int from turnier_start_rueckmeldungen r where r.start_id = st.id and r.status = 'nicht_dabei'),
    (select count(*)::int from turnier_start_rueckmeldungen r where r.start_id = st.id and r.status = 'unsicher'),
    (select count(*)::int from start_teilnehmer_ids(st.id)),
    darf_vereinstermine_verwalten(p_verein_id)
  from st
  left join gruppen g on g.id = st.gruppe_id
  left join disziplinen d on d.id = st.disziplin_id
  left join altersklassen ak on ak.id = st.altersklasse_id
  where st.bis_d >= p_von and st.von_d <= p_bis
  order by st.von_d, st.t_name, st.tag nulls first, g.name nulls last, st.bezeichnung;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.vereinschat_anlegen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into gespraeche (typ, verein_id) values ('verein', new.id) on conflict do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.vereinslizenz_status(p_verein_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when is_verein_admin(p_verein_id) or ist_plattform_admin_aktuell() then jsonb_build_object(
    'aktiv', verein_hat_lizenz(p_verein_id),
    'bis', (select v.tarif_aktiv_bis from vereine v where v.id = p_verein_id),
    'abo', (select jsonb_build_object('periode', a.periode, 'preis_cent', a.preis_cent, 'anbieter', a.anbieter, 'status', a.status,
              'laeuft_bis', a.laeuft_bis, 'gekuendigt_zum', a.gekuendigt_zum, 'id', a.id,
              'kaeufer', (select x.anzeige from anzeige_namen(array[a.user_id]) x))
            from abos a where a.inhaber = 'verein' and a.verein_id = p_verein_id and abo_gilt(a) order by a.erstellt_am desc limit 1),
    'abgedeckt', (select count(distinct vm.user_id) from vereins_mitglieder vm
                  where vm.verein_id = p_verein_id and vm.user_id is not null and coalesce(vm.aktiv, true) and verein_hat_lizenz(p_verein_id)),
    'basic_pausiert', (select count(*) from abos a where a.status = 'paused_by_organization' and a.pause_verein_id = p_verein_id))
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.vereinslizenz_verein_von(p_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select vm.verein_id from vereins_mitglieder vm
  where vm.user_id = p_user_id and coalesce(vm.aktiv, true) and verein_hat_lizenz(vm.verein_id)
  order by vm.created_at limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.vereinswechsel_ausfuehren()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'offen'
     and new.quell_verein_bestaetigt_at is not null
     and new.mitglied_bestaetigt_at is not null then

    delete from public.vereins_mitglieder
      where user_id = new.mitglied_user_id and verein_id = new.quell_verein_id;

    insert into public.vereins_mitglieder (user_id, verein_id, rolle_id)
      values (new.mitglied_user_id, new.ziel_verein_id, new.vorgeschlagene_rolle_id)
      on conflict do nothing;

    new.status := 'abgeschlossen';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.vm_eingeladen(p_termin_id uuid, p_vm_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from termine t where t.id = p_termin_id and t.verein_id is not null
                 and vm_eingeladen_zu(t.verein_id, t.zielgruppe, t.gruppe_ids, p_vm_id));
$function$
;

CREATE OR REPLACE FUNCTION public.vm_eingeladen_zu(p_verein_id uuid, p_zielgruppe text, p_gruppe_ids uuid[], p_vm_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from vereins_mitglieder vm
    left join rollen r on r.id = vm.rolle_id
    where vm.id = p_vm_id and vm.verein_id = p_verein_id and coalesce(vm.aktiv, true)
      and case p_zielgruppe
            when 'verein' then true
            when 'leitung' then rollen_typ(r.name) in ('admin', 'trainer')
            else exists (select 1 from gruppen_mitglieder gm where gm.vereins_mitglied_id = vm.id and gm.gruppe_id = any(p_gruppe_ids))
          end);
$function$
;
