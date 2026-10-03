-- Konto loeschen: kostenlose/manuelle Freischaltung blockiert nicht mehr, endgueltiges Loeschen mit (alten) Abos repariert
--
-- Fehler 1: konto_loeschung_hindernisse wertete JEDES laufende Abo als "laufende BASIC-Lizenz" – auch eine kostenlose
--           manuelle Freischaltung (anbieter 'manuell', MANUAL_FREE/TEAM_FREE/manuell bezahlt). Die laesst sich nicht
--           "kuendigen", das Konto war damit dauerhaft nicht loeschbar (Admin und Selbstloeschung).
--           Jetzt: manuelle Freischaltungen blockieren nicht; sie enden mit der Loeschung. Bezahlte, laufende Abos
--           (Stripe/PayPal/Ueberweisung) blockieren weiterhin, bis sie gekuendigt sind.
-- Fehler 2: konto_endgueltig_loeschen loeschte auth.users; abos.user_id wird dabei auf NULL gesetzt – das verletzt
--           abos_check (persoenliche Abos brauchen eine Person). Das Loeschen schlug fuer JEDE Person fehl, die je ein
--           BASIC-Abo hatte (auch abgelaufen/gekuendigt). Jetzt werden die persoenlichen Abos (und eine nicht bezahlte
--           Vereinsgruendung) der Person vorher entfernt. Rechnungen bleiben unveraendert erhalten (Aufbewahrungspflicht,
--           nur der Kontobezug ziel_user_id wird wie bisher geleert).
-- Neu: admin_konto_loeschung_pruefen – zeigt der Administration VOR dem Loeschen, was entgegensteht bzw. was mit
--      geloescht wird (z. B. "Die kostenlose Freischaltung endet mit der Loeschung").
-- Keine Tabellen, Regeln (RLS) oder Daten werden geaendert.

create or replace function public.konto_loeschung_hindernisse(p_user uuid)
 returns table(grund text, text text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_vereine text;
begin
  select string_agg(v.name, ', ' order by v.name) into v_vereine
  from vereins_mitglieder vm join vereine v on v.id = vm.verein_id where vm.user_id = p_user;
  if v_vereine is not null then
    return query select 'verein'::text,
      format('Du bist noch Mitglied in: %s. Bitte tritt zuerst aus bzw. lass dich vom Vereinsadmin entfernen. Bist du Vereinsadmin, übergib die Administration vorher an eine andere Person.', v_vereine);
  end if;
  -- nur bezahlte, laufende Abos (Karte/Lastschrift, PayPal, Ueberweisung); manuelle Freischaltungen enden mit der Loeschung
  if exists (select 1 from abos a where a.user_id = p_user and a.anbieter <> 'manuell'
             and a.status in ('pending', 'active', 'trialing', 'past_due', 'paused_by_organization')
             and a.gekuendigt_zum is null) then
    return query select 'lizenz'::text, 'Bitte kündige zuerst deine BASIC-Lizenz unter „Mein Tarif“.'::text;
  end if;
  if exists (select 1 from ueberweisungs_rechnungen u where u.ziel_user_id = p_user and u.status = 'offen') then
    return query select 'offene_zahlung'::text, 'Es gibt noch eine offene Zahlung per Überweisung. Bitte begleiche oder storniere sie zuerst (Support).'::text;
  end if;
  if exists (select 1 from profiles p where p.id = p_user and p.ist_plattform_admin) then
    return query select 'plattformadmin'::text, 'Konten der TanzRaum-Administration können nicht selbst gelöscht werden.'::text;
  end if;
  if exists (select 1 from juryraum_besetzungen where created_by = p_user)
     or exists (select 1 from juryraum_einladungen where eingeladen_von = p_user)
     or exists (select 1 from juryraum_einsatz_zusagen where eingeladen_von = p_user)
     or exists (select 1 from juryraum_fahrgemeinschaften where created_by = p_user)
     or exists (select 1 from juryraum_fernwartungs_zugriff where gewaehrt_von = p_user)
     or exists (select 1 from juryraum_unterkuenfte where created_by = p_user) then
    return query select 'juryraum'::text, 'Du hast im JuryRaum noch Einträge angelegt. Bitte melde dich beim Support, damit sie übergeben werden.'::text;
  end if;
end;
$function$;

create or replace function public.konto_endgueltig_loeschen(p_geheimnis text, p_user uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not interner_aufruf_ok(p_geheimnis) then
    raise exception 'Nicht berechtigt' using errcode = '42501';
  end if;
  if not exists (select 1 from konto_loeschungen k where k.user_id = p_user and k.loeschen_ab <= now())
     or exists (select 1 from konto_loeschung_hindernisse(p_user)) then
    return false;
  end if;
  -- persoenliche Abos (beendet/gekuendigt oder manuelle Freischaltung) und eine nicht bezahlte Vereinsgruendung gehoeren
  -- zum Konto; ohne Person waeren sie ungueltig (abos_check). Rechnungen bleiben erhalten.
  delete from abos where user_id = p_user and (inhaber = 'person' or verein_id is null);
  delete from auth.users where id = p_user;
  insert into konto_loeschung_protokoll (anzahl) values (1);
  return true;
end;
$function$;

-- Vorab-Pruefung fuer die Administration: was steht entgegen, was endet mit der Loeschung
create or replace function public.admin_konto_loeschung_pruefen(p_user uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_hindernisse text[] := '{}';
  v_hinweise text[] := '{}';
  h record;
  a abos;
begin
  if not ist_plattform_admin_aktuell() then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    v_hindernisse := v_hindernisse || 'Das eigene Konto kann hier nicht gelöscht werden.'::text;
  end if;
  if not exists (select 1 from profiles p where p.id = p_user) then
    v_hindernisse := v_hindernisse || 'Konto nicht gefunden.'::text;
  end if;
  -- gleiche Texte wie admin_konto_loeschen
  for h in select * from konto_loeschung_hindernisse(p_user) loop
    v_hindernisse := v_hindernisse || case h.grund
      when 'verein' then 'Die Person ist noch Mitglied in einem Verein. Der Verein muss sie zuerst entfernen (Vereinsdaten verwaltet der Verein).'
      when 'lizenz' then 'Die Person hat noch eine laufende, bezahlte BASIC-Lizenz. Bitte zuerst kündigen (Tarife & Lizenzen).'
      when 'offene_zahlung' then 'Es gibt noch eine offene Überweisung dieser Person. Bitte zuerst begleichen oder stornieren.'
      when 'plattformadmin' then 'Konten der TanzRaum-Administration können nicht gelöscht werden.'
      when 'juryraum' then 'Die Person hat im JuryRaum noch Einträge angelegt. Bitte zuerst übergeben.'
      else h.text end;
  end loop;
  for a in select x.* from abos x where x.user_id = p_user and x.inhaber = 'person' and x.anbieter = 'manuell' and abo_gilt(x) loop
    v_hinweise := v_hinweise || format('Die %s (%s, %s) endet mit der Löschung automatisch.',
      case abo_lizenzart(a) when 'TEAM_FREE' then 'kostenlose Team-Freischaltung' when 'MANUAL_FREE' then 'kostenlose manuelle Freischaltung' else 'manuelle Freischaltung' end,
      upper(a.tarif),
      case when a.laeuft_bis is null then 'unbefristet' else 'bis ' || to_char(a.laeuft_bis at time zone 'Europe/Berlin', 'DD.MM.YYYY') end);
  end loop;
  if exists (select 1 from rechnungen r where r.ziel_user_id = p_user) then
    v_hinweise := v_hinweise || 'Rechnungen bleiben wegen der Aufbewahrungspflicht erhalten (ohne Verknüpfung zum Konto).'::text;
  end if;
  return jsonb_build_object('hindernisse', to_jsonb(v_hindernisse), 'hinweise', to_jsonb(v_hinweise));
end;
$function$;

revoke all on function public.admin_konto_loeschung_pruefen(uuid) from public, anon;
grant execute on function public.admin_konto_loeschung_pruefen(uuid) to authenticated;
