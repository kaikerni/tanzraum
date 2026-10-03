-- TanzRaum – Gesamterweiterung (03.10.2026)
--   A) Kostenlose Sonderfreischaltung per E-Mail-Einladung (nur TanzRaum-Admin): BASIC oder VEREIN, unbefristet oder befristet.
--      Baut auf den bestehenden Lizenzen (abos, freischaltung = 'manual_free'), tarif_neu_berechnen_person, abos_ablaufen
--      und admin_protokoll auf. VEREIN ist hier eine persoenliche Freischaltung – kein Verein, keine Mitgliedschaft,
--      keine Vereinslizenz.
--   B) Vereinswechsel (bestehend: vereinswechsel_anfragen + freigabe_entscheiden) mit ausdruecklicher Zustimmung der Person.
--      Der bisherige Verein entscheidet erst nach der Zustimmung. Ein Verein kann niemanden ohne Zustimmung uebernehmen.
--   C) Administrativer Vereinswechsel durch den TanzRaum-Admin, wenn die Person zugestimmt hat, der neue Verein die
--      Aufnahme angefragt hat und der bisherige Verein nicht freigibt (abgelehnt oder offen). Protokoll in admin_protokoll.
--   D) Mitgliederimport: neutraler Hinweis auf bestehende TanzRaum-Konten (kein Konto, kein Wechsel wird erzeugt).
-- Bestehende Daten werden nicht geaendert.

-- =============================================================================================
-- A) Persoenliche VEREIN-Freischaltung in abos zulassen (nur manuell + kostenlos)
-- =============================================================================================
alter table public.abos drop constraint if exists abos_check;
alter table public.abos add constraint abos_check check (
  (inhaber = 'person' and tarif = 'basic' and user_id is not null)
  or (inhaber = 'person' and tarif = 'verein' and user_id is not null and anbieter = 'manuell' and freischaltung = 'manual_free')
  or (inhaber = 'verein' and tarif = 'verein' and verein_id is not null));

-- Tarif einer Person: eine gueltige persoenliche VEREIN-Freischaltung ergibt VEREIN, sonst wie bisher BASIC/FREE
CREATE OR REPLACE FUNCTION public.tarif_neu_berechnen_person(p_user_id uuid, p_grund text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_alt text;
  v_anzahl int;
  v_verein boolean;
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
  select count(*), coalesce(bool_or(a.tarif = 'verein'), false),
         coalesce(bool_or(a.periode = 'unbefristet' or a.status = 'paused_by_organization'), false),
         max(a.laeuft_bis)
    into v_anzahl, v_verein, v_offen, v_bis
  from abos a where a.inhaber = 'person' and a.user_id = p_user_id and abo_gilt(a);
  v_neu := case when v_verein then 'verein' when v_anzahl > 0 then 'basic' else 'free' end;
  insert into tarif_system_freigabe (txid) values (txid_current()) on conflict do nothing;
  update profiles set tarif = v_neu, tarif_aktiv_bis = case when v_neu = 'free' or v_offen then null else v_bis end where id = p_user_id;
  delete from tarif_system_freigabe where txid = txid_current();
  if v_alt is distinct from v_neu then
    insert into tarif_ereignisse (user_id, previous_plan, new_plan, reason) values (p_user_id, v_alt, v_neu, coalesce(p_grund, 'abo'));
  end if;
end;
$function$;

-- Einladungen fuer kostenlose Sonderfreischaltungen (Zugriff ausschliesslich ueber die Funktionen unten)
create table if not exists public.freischaltung_einladungen (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  tarif text not null check (tarif in ('basic', 'verein')),
  bis date,
  notiz text check (char_length(notiz) <= 500),
  status text not null default 'offen' check (status in ('offen', 'angenommen', 'widerrufen')),
  gueltig_bis timestamptz not null default now() + interval '30 days',
  erstellt_von uuid references public.profiles(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  gesendet_am timestamptz,
  angenommen_von uuid references public.profiles(id) on delete set null,
  angenommen_am timestamptz,
  abo_id uuid references public.abos(id) on delete set null,
  widerrufen_am timestamptz
);
create index if not exists freischaltung_einladungen_email on public.freischaltung_einladungen (lower(email));
comment on table public.freischaltung_einladungen is 'Kostenlose Sonderfreischaltung (BASIC/VEREIN) per E-Mail-Einladung – nur TanzRaum-Admin; aktiv erst nach Annahme';
alter table public.freischaltung_einladungen enable row level security;
revoke all on public.freischaltung_einladungen from public, anon, authenticated;
grant all on public.freischaltung_einladungen to service_role;

-- Einladung anlegen (nur TanzRaum-Admin). Aktiviert noch nichts.
create or replace function public.admin_freischaltung_einladen(p_email text, p_tarif text, p_bis date, p_notiz text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v_email) > 254 then
    raise exception 'Bitte gib eine gültige E-Mail-Adresse ein.' using errcode = 'P0001';
  end if;
  if p_tarif not in ('basic', 'verein') then raise exception 'Bitte BASIC oder VEREIN wählen.' using errcode = 'P0001'; end if;
  if p_bis is not null and p_bis < v_heute then raise exception 'Das Enddatum liegt in der Vergangenheit.' using errcode = 'P0001'; end if;
  if p_bis is not null and p_bis > v_heute + 3660 then raise exception 'Bitte ein Enddatum innerhalb von 10 Jahren wählen.' using errcode = 'P0001'; end if;
  if exists (select 1 from freischaltung_einladungen f where lower(f.email) = v_email and f.status = 'offen' and f.gueltig_bis > now()) then
    raise exception 'Für diese E-Mail-Adresse gibt es bereits eine offene Einladung. Widerrufe sie zuerst oder sende sie erneut.' using errcode = 'P0001';
  end if;
  if exists (select 1 from profiles p join auth.users u on u.id = p.id where lower(u.email) = v_email and p.ist_plattform_admin) then
    raise exception 'Der TanzRaum-Admin hat ohnehin vollen Zugang.' using errcode = 'P0001';
  end if;
  insert into freischaltung_einladungen (email, tarif, bis, notiz, erstellt_von)
  values (v_email, p_tarif, p_bis, nullif(left(btrim(coalesce(p_notiz, '')), 500), ''), auth.uid())
  returning id into v_id;
  perform protokollieren('freischaltung_eingeladen', null,
    jsonb_build_object('einladung_id', v_id, 'email', v_email, 'zugang', p_tarif, 'bis', p_bis));
  return jsonb_build_object('id', v_id);
end;
$function$;
revoke all on function public.admin_freischaltung_einladen(text, text, date, text) from public, anon;
grant execute on function public.admin_freischaltung_einladen(text, text, date, text) to authenticated;

-- Daten fuer den Mailversand (Edge Function send-beitritt-einladung, als Nutzer aufgerufen): nur TanzRaum-Admin, nur offene Einladungen
create or replace function public.mail_freischaltung_daten(p_id uuid)
 returns table(email text, token uuid, tarif text, bis date, gueltig_bis timestamptz)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  return query select f.email, f.token, f.tarif, f.bis, f.gueltig_bis from freischaltung_einladungen f
  where f.id = p_id and f.status = 'offen' and f.gueltig_bis > now();
end;
$function$;
revoke all on function public.mail_freischaltung_daten(uuid) from public, anon;
grant execute on function public.mail_freischaltung_daten(uuid) to authenticated;

create or replace function public.admin_freischaltung_gesendet(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  update freischaltung_einladungen set gesendet_am = now() where id = p_id and status = 'offen';
end;
$function$;
revoke all on function public.admin_freischaltung_gesendet(uuid) from public, anon;
grant execute on function public.admin_freischaltung_gesendet(uuid) to authenticated;

-- Uebersicht fuer den TanzRaum-Admin
create or replace function public.admin_freischaltung_einladungen()
 returns table(id uuid, email text, nutzer text, user_id uuid, tarif text, bis date, notiz text, erstellt_am timestamptz,
               gesendet_am timestamptz, angenommen boolean, angenommen_am timestamptz, status text, abo_id uuid)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  return query
  select f.id, f.email,
    profil_name(coalesce(f.angenommen_von, (select u.id from auth.users u where lower(u.email) = lower(f.email) limit 1))),
    coalesce(f.angenommen_von, (select u.id from auth.users u where lower(u.email) = lower(f.email) limit 1)),
    f.tarif, f.bis, f.notiz, f.erstellt_am, f.gesendet_am, f.status = 'angenommen', f.angenommen_am,
    case
      when f.status = 'widerrufen' then 'widerrufen'
      when f.status = 'offen' and f.gueltig_bis <= now() then 'abgelaufen'
      when f.status = 'offen' then 'ausstehend'
      when exists (select 1 from abos a where a.id = f.abo_id and abo_gilt(a)) then 'aktiv'
      else 'abgelaufen'
    end,
    f.abo_id
  from freischaltung_einladungen f
  order by f.erstellt_am desc
  limit 300;
end;
$function$;
revoke all on function public.admin_freischaltung_einladungen() from public, anon;
grant execute on function public.admin_freischaltung_einladungen() to authenticated;

-- Widerrufen: offene Einladung wird ungueltig; eine angenommene Freischaltung endet (bestehende Logik admin_freischaltung_beenden)
create or replace function public.admin_freischaltung_einladung_widerrufen(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  f freischaltung_einladungen%rowtype;
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  select * into f from freischaltung_einladungen where id = p_id for update;
  if f.id is null or f.status = 'widerrufen' then raise exception 'Einladung nicht gefunden oder bereits widerrufen.' using errcode = 'P0001'; end if;
  if f.status = 'angenommen' and f.abo_id is not null and exists (select 1 from abos a where a.id = f.abo_id and abo_gilt(a)) then
    perform admin_freischaltung_beenden(f.abo_id);
  end if;
  update freischaltung_einladungen set status = 'widerrufen', widerrufen_am = now() where id = p_id;
  perform protokollieren('freischaltung_widerrufen', f.angenommen_von, jsonb_build_object('einladung_id', f.id, 'email', f.email, 'zugang', f.tarif));
end;
$function$;
revoke all on function public.admin_freischaltung_einladung_widerrufen(uuid) from public, anon;
grant execute on function public.admin_freischaltung_einladung_widerrufen(uuid) to authenticated;

-- Vorschau fuer die Einladungsseite (auch ohne Anmeldung): keine E-Mail-Adresse im Klartext
create or replace function public.freischaltung_einladung_vorschau(p_token uuid)
 returns table(tarif text, bis date, email_maskiert text, gueltig boolean, grund text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select f.tarif, f.bis,
    left(split_part(f.email, '@', 1), 2) || '***@' || split_part(f.email, '@', 2),
    f.status = 'offen' and f.gueltig_bis > now(),
    case when f.status = 'widerrufen' then 'Diese Einladung wurde zurückgezogen.'
         when f.status = 'angenommen' then 'Diese Einladung wurde bereits angenommen.'
         when f.gueltig_bis <= now() then 'Diese Einladung ist abgelaufen.' end
  from freischaltung_einladungen f where f.token = p_token;
$function$;
revoke all on function public.freischaltung_einladung_vorschau(uuid) from public;
grant execute on function public.freischaltung_einladung_vorschau(uuid) to anon, authenticated;

-- Annahme: nur angemeldet, nur mit der eingeladenen (bestaetigten) E-Mail-Adresse, nur einmal. Erst jetzt wird freigeschaltet.
create or replace function public.freischaltung_einladung_annehmen(p_token uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  f freischaltung_einladungen%rowtype;
  v_email text;
  v_bestaetigt timestamptz;
  v_abo uuid;
  v_bis timestamptz;
begin
  if auth.uid() is null then raise exception 'Bitte zuerst anmelden.' using errcode = '42501'; end if;
  select * into f from freischaltung_einladungen where token = p_token for update;
  if f.id is null then raise exception 'Einladungslink ungültig.' using errcode = 'P0001'; end if;
  if f.status = 'widerrufen' then raise exception 'Diese Einladung wurde zurückgezogen.' using errcode = 'P0001'; end if;
  if f.status = 'angenommen' then raise exception 'Diese Einladung wurde bereits angenommen.' using errcode = 'P0001'; end if;
  if f.gueltig_bis <= now() then raise exception 'Diese Einladung ist abgelaufen. Bitte frag nach einer neuen Einladung.' using errcode = 'P0001'; end if;
  select lower(u.email), u.email_confirmed_at into v_email, v_bestaetigt from auth.users u where u.id = auth.uid();
  if v_email is distinct from lower(f.email) then
    raise exception 'Diese Einladung gilt für eine andere E-Mail-Adresse. Bitte melde dich mit der eingeladenen Adresse an.' using errcode = '42501';
  end if;
  if v_bestaetigt is null then
    raise exception 'Bitte bestätige zuerst deine E-Mail-Adresse.' using errcode = 'P0001';
  end if;
  if exists (select 1 from profiles p where p.id = auth.uid() and (p.ist_plattform_admin or coalesce(p.gesperrt, false))) then
    raise exception 'Für dieses Konto ist keine Freischaltung möglich.' using errcode = 'P0001';
  end if;
  v_bis := case when f.bis is null then null else tagesende_berlin(f.bis) end;
  if f.bis is not null and v_bis <= now() then raise exception 'Die Freischaltung ist bereits abgelaufen.' using errcode = 'P0001'; end if;
  insert into abos (inhaber, user_id, tarif, periode, preis_cent, anbieter, status, laeuft_bis, freischaltung, notiz, erteilt_von)
  values ('person', auth.uid(), f.tarif, case when v_bis is null then 'unbefristet' else 'befristet' end, 0, 'manuell', 'active', v_bis,
          'manual_free', f.notiz, f.erstellt_von)
  returning id into v_abo;
  update freischaltung_einladungen set status = 'angenommen', angenommen_von = auth.uid(), angenommen_am = now(), abo_id = v_abo where id = f.id;
  perform tarif_neu_berechnen_person(auth.uid(), 'freischaltung_einladung');
  perform protokollieren('freischaltung_angenommen', auth.uid(),
    jsonb_build_object('einladung_id', f.id, 'zugang', f.tarif, 'bis', f.bis, 'abo_id', v_abo));
  return jsonb_build_object('ok', true, 'tarif', tarif_von(auth.uid()), 'zugang', f.tarif, 'bis', f.bis);
end;
$function$;
revoke all on function public.freischaltung_einladung_annehmen(uuid) from public, anon;
grant execute on function public.freischaltung_einladung_annehmen(uuid) to authenticated;

-- Ablaufhinweis: persoenliche Lizenz mit richtigem Tarifnamen (BASIC bzw. VEREIN)
do $$
declare
  d text := pg_get_functiondef('public.lizenz_ablauf_hinweise_senden()'::regprocedure);
  alt text := $a$'Deine BASIC-Lizenz ist noch '$a$;
begin
  if position(alt in d) = 0 then raise exception 'lizenz_ablauf_hinweise_senden: Stelle nicht gefunden'; end if;
  d := replace(d, 'select a.id, a.inhaber, a.user_id, a.verein_id, a.laeuft_bis from abos a', 'select a.id, a.inhaber, a.user_id, a.verein_id, a.laeuft_bis, a.tarif from abos a');
  d := replace(d, alt, $n$'Deine ' || upper(r.tarif) || '-Lizenz ist noch '$n$);
  execute d;
end $$;

-- =============================================================================================
-- B) Vereinswechsel nur mit ausdruecklicher Zustimmung der Person
-- =============================================================================================
alter table public.vereinswechsel_anfragen add column if not exists art text not null default 'normal';
alter table public.vereinswechsel_anfragen drop constraint if exists vereinswechsel_anfragen_art_check;
alter table public.vereinswechsel_anfragen add constraint vereinswechsel_anfragen_art_check check (art in ('normal', 'administrativ'));
alter table public.vereinswechsel_anfragen add column if not exists abgeschlossen_am timestamptz;
alter table public.vereinswechsel_anfragen add column if not exists admin_id uuid references public.profiles(id) on delete set null;
alter table public.vereinswechsel_anfragen add column if not exists admin_grund text check (char_length(admin_grund) <= 1000);
alter table public.vereinswechsel_anfragen add column if not exists quell_verein_abgelehnt_at timestamptz;
comment on column public.vereinswechsel_anfragen.mitglied_bestaetigt_at is 'Zeitpunkt der ausdruecklichen Zustimmung der Person zum Wechsel (Voraussetzung fuer jede Durchfuehrung)';

-- Gemeinsame Durchfuehrung (bisherige Logik aus freigabe_entscheiden): alte Zuordnung endet, neue entsteht,
-- Mitgliedsantrag nach den Einstellungen des neuen Vereins. Nur intern aufrufbar.
create or replace function public.vereinswechsel_vollziehen(p_anfrage_id uuid, p_art text, p_grund text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  w vereinswechsel_anfragen%rowtype;
  v_vm uuid;
  v_antrag uuid;
begin
  select * into w from vereinswechsel_anfragen where id = p_anfrage_id for update;
  if w.id is null or w.mitglied_bestaetigt_at is null then
    raise exception 'Ohne Zustimmung der Person ist kein Vereinswechsel möglich.' using errcode = '42501';
  end if;
  if exists (select 1 from vereins_mitglieder vm where vm.user_id = w.mitglied_user_id and vm.verein_id = w.ziel_verein_id) then
    raise exception 'Die Person ist bereits Mitglied des neuen Vereins.' using errcode = 'P0001';
  end if;
  if exists (select 1 from vereins_mitglieder vm where vm.user_id = w.mitglied_user_id and vm.verein_id <> w.quell_verein_id) then
    raise exception 'Die Person ist inzwischen einem anderen Verein zugeordnet.' using errcode = 'P0001';
  end if;
  -- bisherige Zuordnung endet wie beim Entfernen eines Mitglieds; Vereinsdaten von A bleiben bei A
  delete from vereins_mitglieder where user_id = w.mitglied_user_id and verein_id = w.quell_verein_id;
  insert into vereins_mitglieder (user_id, verein_id, rolle_id, hinzugefuegt_von)
  values (w.mitglied_user_id, w.ziel_verein_id, w.vorgeschlagene_rolle_id, w.angefragt_von)
  returning id into v_vm;
  update vereinswechsel_anfragen set status = 'abgeschlossen', art = p_art, abgeschlossen_am = now(),
    quell_verein_bestaetigt_at = case when p_art = 'normal' then now() else quell_verein_bestaetigt_at end,
    admin_id = case when p_art = 'administrativ' then auth.uid() else admin_id end,
    admin_grund = case when p_art = 'administrativ' then p_grund else admin_grund end
  where id = w.id;
  update vereinswechsel_anfragen set status = 'abgelehnt', abgelehnt_von = 'system'
  where mitglied_user_id = w.mitglied_user_id and status = 'offen' and id <> w.id;
  v_antrag := vereinsbeitritt_vorbereiten(v_vm, w.angefragt_von);
  return jsonb_build_object('vm', v_vm, 'antrag_id', v_antrag, 'ziel_verein_id', w.ziel_verein_id);
end;
$function$;
revoke all on function public.vereinswechsel_vollziehen(uuid, text, text) from public, anon, authenticated;

-- Wechselanfrage anlegen (intern): Person wird um Zustimmung gebeten (bzw. hat beim Einloesen einer Einladung schon zugestimmt)
create or replace function public.vereinswechsel_anfragen_anlegen(p_user uuid, p_quelle uuid, p_ziel uuid, p_rolle uuid, p_von uuid, p_zugestimmt boolean)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_ziel_name text := (select name from vereine where id = p_ziel);
  v_name text := (select a.anzeige from anzeige_namen(array[p_user]) a);
begin
  select w.id into v_id from vereinswechsel_anfragen w where w.mitglied_user_id = p_user and w.ziel_verein_id = p_ziel and w.status = 'offen';
  if v_id is null then
    insert into vereinswechsel_anfragen (quell_verein_id, ziel_verein_id, mitglied_user_id, vorgeschlagene_rolle_id, angefragt_von, status,
                                         mitglied_bestaetigt_at)
    values (p_quelle, p_ziel, p_user, p_rolle, p_von, 'offen', case when p_zugestimmt then now() end)
    returning id into v_id;
  elsif p_zugestimmt then
    update vereinswechsel_anfragen set mitglied_bestaetigt_at = coalesce(mitglied_bestaetigt_at, now()) where id = v_id;
  end if;
  if p_zugestimmt then
    perform antrag_verwaltung_benachrichtigen(p_quelle,
      'Freigabe angefragt: ' || coalesce(v_name, 'Eine Person') || ' möchte zum Verein ' || coalesce(v_ziel_name, '')
      || ' wechseln und hat zugestimmt. Bitte unter „Mitgliedsanträge“ freigeben oder ablehnen.');
  else
    insert into benachrichtigungen (user_id, typ, text, link)
    values (p_user, 'vereinswechsel', left('Der Verein ' || coalesce(v_ziel_name, '') || ' möchte dich als Mitglied aufnehmen. Bitte bestätige oder lehne die Anfrage im Dashboard ab.', 500), '/dashboard');
  end if;
  return v_id;
end;
$function$;
revoke all on function public.vereinswechsel_anfragen_anlegen(uuid, uuid, uuid, uuid, uuid, boolean) from public, anon, authenticated;

-- Person hinzufuegen (Verein B): bei bestehender Vereinszuordnung nur Anfrage an die Person – kein Wechsel ohne Zustimmung
do $mig$
declare
  d text := pg_get_functiondef('public.verein_person_hinzufuegen(uuid, text, uuid, uuid)'::regprocedure);
  ende text := $x$    return jsonb_build_object('status', 'freigabe_angefragt', 'name', v_name);
  end if;$x$;
  a int := position('  if v_bisher is not null then' in d);
  b int := position(ende in d);
begin
  if a = 0 or b = 0 or b < a then raise exception 'verein_person_hinzufuegen: Stelle nicht gefunden'; end if;
  d := substr(d, 1, a - 1) || $neu$  if v_bisher is not null then
    -- Kein erzwungener Wechsel: die Person entscheidet selbst; danach entscheidet der bisherige Verein
    perform vereinswechsel_anfragen_anlegen(v_user, v_bisher, p_verein_id, v_rolle, auth.uid(), false);
    return jsonb_build_object('status', 'zustimmung_angefragt', 'name', v_name);
  end if;$neu$ || substr(d, b + length(ende));
  execute d;
end
$mig$;

-- Einladung einloesen: mit p_wechsel_bestaetigt = true hat die Person dem Wechsel auf der Einladungsseite ausdruecklich zugestimmt
do $mig$
declare
  d text := pg_get_functiondef('public.invite_einloesen(uuid)'::regprocedure);
  alt text;
begin
  alt := $a$      if not exists (select 1 from vereinswechsel_anfragen w where w.mitglied_user_id = auth.uid() and w.ziel_verein_id = v_row.verein_id and w.status = 'offen') then
        insert into vereinswechsel_anfragen (quell_verein_id, ziel_verein_id, mitglied_user_id, vorgeschlagene_rolle_id, angefragt_von, status)
        values (v_bisher, v_row.verein_id, auth.uid(), v_row.rolle_id, v_row.created_by, 'offen');
        perform antrag_verwaltung_benachrichtigen(v_bisher,
          'Freigabe angefragt: Der Verein ' || coalesce(v_verein_name, '') || ' möchte '
          || coalesce((select a.anzeige from anzeige_namen(array[auth.uid()]) a), 'eine Person')
          || ' aufnehmen. Bitte unter „Mitgliedsanträge“ freigeben oder ablehnen.');
      end if;$a$;
  if position(alt in d) = 0 then raise exception 'invite_einloesen: Wechselblock nicht gefunden'; end if;
  d := replace(d, alt, $n$      perform vereinswechsel_anfragen_anlegen(auth.uid(), v_bisher, v_row.verein_id, v_row.rolle_id, v_row.created_by, p_wechsel_bestaetigt);$n$);
  alt := $a$        'Du bist noch einem anderen Verein zugeordnet. Wir haben deinen bisherigen Verein um Freigabe gebeten – danach wirst du ' ||
        coalesce(v_verein_name, 'dem neuen Verein') || ' hinzugefügt.');$a$;
  if position(alt in d) = 0 then raise exception 'invite_einloesen: Meldung nicht gefunden'; end if;
  d := replace(d, alt, $n$        case when p_wechsel_bestaetigt
          then 'Danke! Dein bisheriger Verein wurde um Freigabe gebeten – danach wirst du ' || coalesce(v_verein_name, 'dem neuen Verein') || ' zugeordnet.'
          else 'Du bist noch einem anderen Verein zugeordnet. Bitte bestätige den Vereinswechsel im Dashboard.' end);$n$);
  d := replace(d, 'FUNCTION public.invite_einloesen(p_token uuid)', 'FUNCTION public.invite_einloesen(p_token uuid, p_wechsel_bestaetigt boolean)');
  execute d;
end
$mig$;
revoke all on function public.invite_einloesen(uuid, boolean) from public, anon;
grant execute on function public.invite_einloesen(uuid, boolean) to authenticated;
-- bisherige Signatur bleibt erhalten (ohne Zustimmung → Bestaetigung im Dashboard)
create or replace function public.invite_einloesen(p_token uuid)
 returns jsonb
 language sql
 security definer
 set search_path to 'public'
as $function$ select invite_einloesen(p_token, false); $function$;

-- Hinweis fuer die Einladungsseite: ist die angemeldete Person einem anderen Verein zugeordnet?
create or replace function public.einladung_wechsel_noetig(p_token uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from einladungen e join vereins_mitglieder vm on vm.user_id = auth.uid() and vm.verein_id <> e.verein_id
                 where e.token = p_token) and auth.uid() is not null;
$function$;
revoke all on function public.einladung_wechsel_noetig(uuid) from public, anon;
grant execute on function public.einladung_wechsel_noetig(uuid) to authenticated;

-- Offene Wechselanfragen der angemeldeten Person (Dashboard-Hinweis)
create or replace function public.meine_vereinswechsel()
 returns table(id uuid, ziel_verein text, bestaetigt boolean, bisheriger_verein_abgelehnt boolean, erstellt_am timestamptz)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select w.id, v.name, w.mitglied_bestaetigt_at is not null, w.quell_verein_abgelehnt_at is not null, w.created_at
  from vereinswechsel_anfragen w join vereine v on v.id = w.ziel_verein_id
  where w.mitglied_user_id = auth.uid()
    and (w.status = 'offen' or (w.status = 'abgelehnt' and w.abgelehnt_von = 'quellverein' and w.mitglied_bestaetigt_at is not null
                                and w.created_at > now() - interval '60 days'))
  order by w.created_at desc limit 5;
$function$;
revoke all on function public.meine_vereinswechsel() from public, anon;
grant execute on function public.meine_vereinswechsel() to authenticated;

-- Zustimmen / Ablehnen durch die Person selbst
create or replace function public.vereinswechsel_bestaetigen(p_anfrage_id uuid, p_annehmen boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  w vereinswechsel_anfragen%rowtype;
  v_bisher uuid;
  v_name text := (select a.anzeige from anzeige_namen(array[auth.uid()]) a);
  v_ergebnis jsonb;
begin
  select * into w from vereinswechsel_anfragen where id = p_anfrage_id for update;
  if w.id is null or w.mitglied_user_id is distinct from auth.uid() then
    raise exception 'Anfrage nicht gefunden.' using errcode = '42501';
  end if;
  if w.status <> 'offen' then raise exception 'Diese Anfrage ist nicht mehr offen.' using errcode = 'P0001'; end if;
  if not coalesce(p_annehmen, false) then
    update vereinswechsel_anfragen set status = 'abgelehnt', abgelehnt_von = 'mitglied' where id = w.id;
    perform antrag_verwaltung_benachrichtigen(w.ziel_verein_id, coalesce(v_name, 'Die Person') || ' hat den Vereinswechsel abgelehnt.');
    return jsonb_build_object('status', 'abgelehnt');
  end if;
  select vm.verein_id into v_bisher from vereins_mitglieder vm where vm.user_id = auth.uid();
  update vereinswechsel_anfragen set mitglied_bestaetigt_at = now() where id = w.id;
  if v_bisher is null then
    -- inzwischen ohne Verein: keine Freigabe noetig
    v_ergebnis := vereinswechsel_vollziehen(w.id, 'normal', null);
    perform antrag_verwaltung_benachrichtigen(w.ziel_verein_id, coalesce(v_name, 'Die Person') || ' hat zugestimmt und ist eurem Verein beigetreten.');
    return jsonb_build_object('status', 'abgeschlossen') || v_ergebnis;
  end if;
  if v_bisher = w.ziel_verein_id then
    update vereinswechsel_anfragen set status = 'abgeschlossen', abgeschlossen_am = now() where id = w.id;
    return jsonb_build_object('status', 'abgeschlossen');
  end if;
  if v_bisher <> w.quell_verein_id then
    update vereinswechsel_anfragen set quell_verein_id = v_bisher where id = w.id;
  end if;
  perform antrag_verwaltung_benachrichtigen(v_bisher,
    'Freigabe angefragt: ' || coalesce(v_name, 'Eine Person') || ' möchte zum Verein ' || coalesce((select name from vereine where id = w.ziel_verein_id), '')
    || ' wechseln und hat zugestimmt. Bitte unter „Mitgliedsanträge“ freigeben oder ablehnen.');
  return jsonb_build_object('status', 'freigabe_angefragt');
end;
$function$;
revoke all on function public.vereinswechsel_bestaetigen(uuid, boolean) from public, anon;
grant execute on function public.vereinswechsel_bestaetigen(uuid, boolean) to authenticated;

-- Liste fuer die Vereine: der bisherige Verein sieht nur Wechsel, denen die Person zugestimmt hat; der neue Verein sieht
-- den Stand, aber nicht, welchem Verein die Person bisher angehoert (keine unnoetige Offenlegung)
drop function if exists public.freigabe_anfragen(uuid);
create function public.freigabe_anfragen(p_verein_id uuid)
 returns table(id uuid, richtung text, person text, anderer_verein text, erstellt_am timestamptz, stand text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select w.id,
    case when w.quell_verein_id = p_verein_id then 'eingehend' else 'ausgehend' end,
    (select a.anzeige from anzeige_namen(array[w.mitglied_user_id]) a),
    case when w.quell_verein_id = p_verein_id then (select v.name from vereine v where v.id = w.ziel_verein_id) else null end,
    w.created_at,
    case when w.mitglied_bestaetigt_at is null then 'wartet_auf_person' else 'wartet_auf_freigabe' end
  from vereinswechsel_anfragen w
  where w.status = 'offen'
    and ((w.quell_verein_id = p_verein_id and is_verein_admin(p_verein_id) and w.mitglied_bestaetigt_at is not null)
      or (w.ziel_verein_id = p_verein_id and darf_antraege(p_verein_id)))
  order by w.created_at desc;
$function$;
revoke all on function public.freigabe_anfragen(uuid) from public, anon;
grant execute on function public.freigabe_anfragen(uuid) to authenticated;

-- Freigabe durch den bisherigen Verein – erst nach Zustimmung der Person; Durchfuehrung ueber vereinswechsel_vollziehen
CREATE OR REPLACE FUNCTION public.freigabe_entscheiden(p_anfrage_id uuid, p_freigeben boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  w vereinswechsel_anfragen%rowtype;
  v_name text;
  v_quelle text;
  v_erg jsonb;
begin
  select * into w from vereinswechsel_anfragen where id = p_anfrage_id for update;
  if not found or w.status <> 'offen' then
    raise exception 'Diese Anfrage ist nicht mehr offen.' using errcode = 'P0001';
  end if;
  if not is_verein_admin(w.quell_verein_id) then
    raise exception 'Nur der bisherige Verein kann die Person freigeben.' using errcode = '42501';
  end if;
  if w.mitglied_bestaetigt_at is null then
    raise exception 'Die Person hat dem Wechsel noch nicht zugestimmt.' using errcode = 'P0001';
  end if;
  select a.anzeige into v_name from anzeige_namen(array[w.mitglied_user_id]) a;
  select name into v_quelle from vereine where id = w.quell_verein_id;

  if not p_freigeben then
    update vereinswechsel_anfragen set status = 'abgelehnt', abgelehnt_von = 'quellverein', quell_verein_abgelehnt_at = now() where id = p_anfrage_id;
    perform antrag_verwaltung_benachrichtigen(w.ziel_verein_id,
      'Freigabe abgelehnt: Der bisherige Verein hat ' || coalesce(v_name, 'die Person') || ' nicht freigegeben.');
    insert into benachrichtigungen (user_id, typ, text, link)
    values (w.mitglied_user_id, 'vereinswechsel',
      'Dein bisheriger Verein hat den Wechsel nicht freigegeben. Wenn du trotzdem wechseln möchtest, wende dich an den TanzRaum-Support.', '/dashboard');
    return jsonb_build_object('status', 'abgelehnt');
  end if;

  v_erg := vereinswechsel_vollziehen(p_anfrage_id, 'normal', null);
  perform antrag_verwaltung_benachrichtigen(w.ziel_verein_id,
    'Freigabe erteilt: ' || coalesce(v_name, 'Die Person') || ' wurde vom bisherigen Verein freigegeben und eurem Verein hinzugefügt.');
  return jsonb_build_object('status', 'freigegeben', 'antrag_id', v_erg ->> 'antrag_id', 'ziel_verein_id', w.ziel_verein_id,
    'benachrichtigung', antrag_einstellung(w.ziel_verein_id, 'hinzufuegen_benachrichtigung', 'app_email'));
end;
$function$;

-- =============================================================================================
-- C) Administrativer Vereinswechsel (nur TanzRaum-Admin; nur mit Zustimmung der Person)
-- =============================================================================================
create or replace function public.admin_vereinswechsel_liste()
 returns table(id uuid, person text, user_id uuid, bisheriger_verein text, neuer_verein text, angefragt_von text,
               zugestimmt_am timestamptz, stand text, erstellt_am timestamptz)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  return query
  select w.id, profil_name(w.mitglied_user_id), w.mitglied_user_id,
    (select v.name from vereine v where v.id = w.quell_verein_id), (select v.name from vereine v where v.id = w.ziel_verein_id),
    profil_name(w.angefragt_von), w.mitglied_bestaetigt_at,
    case when w.status = 'abgelehnt' then 'abgelehnt' else 'offen' end, w.created_at
  from vereinswechsel_anfragen w
  where w.mitglied_bestaetigt_at is not null and w.angefragt_von is not null
    and (w.status = 'offen' or (w.status = 'abgelehnt' and w.abgelehnt_von = 'quellverein'))
    and exists (select 1 from vereins_mitglieder vm where vm.user_id = w.mitglied_user_id and vm.verein_id = w.quell_verein_id)
  order by w.created_at desc
  limit 200;
end;
$function$;
revoke all on function public.admin_vereinswechsel_liste() from public, anon;
grant execute on function public.admin_vereinswechsel_liste() to authenticated;

create or replace function public.admin_vereinswechsel_durchfuehren(p_anfrage_id uuid, p_grund text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  w vereinswechsel_anfragen%rowtype;
  v_grund text := nullif(left(btrim(coalesce(p_grund, '')), 1000), '');
  v_erg jsonb;
  v_quelle text;
  v_ziel text;
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  if v_grund is null or char_length(v_grund) < 5 then raise exception 'Bitte gib den Anlass bzw. Grund an.' using errcode = 'P0001'; end if;
  select * into w from vereinswechsel_anfragen where id = p_anfrage_id for update;
  if w.id is null then raise exception 'Anfrage nicht gefunden.' using errcode = 'P0001'; end if;
  if w.mitglied_bestaetigt_at is null then
    raise exception 'Die Person hat dem Wechsel nicht zugestimmt. Ohne ihren Wechselwunsch ist kein Vereinswechsel möglich.' using errcode = '42501';
  end if;
  if w.angefragt_von is null then raise exception 'Der neue Verein hat die Aufnahme nicht angefragt.' using errcode = 'P0001'; end if;
  if not (w.status = 'offen' or (w.status = 'abgelehnt' and w.abgelehnt_von = 'quellverein')) then
    raise exception 'Diese Anfrage kann nicht mehr durchgeführt werden.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from vereins_mitglieder vm where vm.user_id = w.mitglied_user_id and vm.verein_id = w.quell_verein_id) then
    raise exception 'Die Person ist dem bisherigen Verein nicht mehr zugeordnet.' using errcode = 'P0001';
  end if;
  select name into v_quelle from vereine where id = w.quell_verein_id;
  select name into v_ziel from vereine where id = w.ziel_verein_id;
  update vereinswechsel_anfragen set status = 'offen' where id = w.id;
  v_erg := vereinswechsel_vollziehen(w.id, 'administrativ', v_grund);
  perform protokollieren('vereinswechsel_administrativ', w.mitglied_user_id, jsonb_build_object(
    'anfrage_id', w.id, 'bisheriger_verein_id', w.quell_verein_id, 'bisheriger_verein', v_quelle,
    'neuer_verein_id', w.ziel_verein_id, 'neuer_verein', v_ziel, 'grund', v_grund,
    'zustimmung_person_am', w.mitglied_bestaetigt_at, 'aufnahme_angefragt_von', profil_name(w.angefragt_von),
    'bisheriger_verein_abgelehnt_am', w.quell_verein_abgelehnt_at, 'art', 'administrativ'));
  perform antrag_verwaltung_benachrichtigen(w.quell_verein_id,
    'Vereinswechsel durch die TanzRaum-Administration: ' || coalesce(profil_name(w.mitglied_user_id), 'Eine Person')
    || ' ist auf eigenen Wunsch einem anderen Verein zugeordnet worden.');
  perform antrag_verwaltung_benachrichtigen(w.ziel_verein_id,
    coalesce(profil_name(w.mitglied_user_id), 'Die Person') || ' wurde von der TanzRaum-Administration eurem Verein zugeordnet.');
  insert into benachrichtigungen (user_id, typ, text, link)
  values (w.mitglied_user_id, 'vereinswechsel', left('Dein Vereinswechsel zu ' || coalesce(v_ziel, 'deinem neuen Verein') || ' wurde durchgeführt.', 500), '/dashboard');
  return jsonb_build_object('ok', true) || v_erg;
end;
$function$;
revoke all on function public.admin_vereinswechsel_durchfuehren(uuid, text) from public, anon;
grant execute on function public.admin_vereinswechsel_durchfuehren(uuid, text) to authenticated;

-- =============================================================================================
-- D) Mitgliederimport: neutrale Hinweise zu bestehenden TanzRaum-Konten (erstellt nichts, wechselt nichts)
-- =============================================================================================
create or replace function public.mitglieder_import_konto_hinweise(p_verein_id uuid, p_emails text[])
 returns table(email text, art text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not is_verein_admin(p_verein_id) then
    raise exception 'Nur Vereinsadmins dürfen Mitglieder importieren.' using errcode = '42501';
  end if;
  if coalesce(array_length(p_emails, 1), 0) > 3000 then raise exception 'Höchstens 3000 Mitglieder pro Import.' using errcode = 'P0001'; end if;
  return query
  select lower(u.email)::text,
    case when exists (select 1 from vereins_mitglieder vm where vm.user_id = u.id and vm.verein_id <> p_verein_id) then 'anderer_verein'
         when exists (select 1 from vereins_mitglieder vm where vm.user_id = u.id and vm.verein_id = p_verein_id) then 'eigener_verein'
         else 'konto' end
  from auth.users u
  where lower(u.email) in (select lower(btrim(x)) from unnest(p_emails) x);
end;
$function$;
revoke all on function public.mitglieder_import_konto_hinweise(uuid, text[]) from public, anon;
grant execute on function public.mitglieder_import_konto_hinweise(uuid, text[]) to authenticated;
