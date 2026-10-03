-- Vereinsgruendung nur mit bestaetigter Vereinslizenz (Verein und Lizenz entstehen gemeinsam)
--
-- Bisher: verein_anlegen legte fuer jede angemeldete Person sofort einen Verein an (man wurde Vereinsadmin),
-- die Vereinslizenz konnte erst danach fuer diesen Verein gekauft werden. FREE/BASIC-Nutzer konnten so Vereine ohne Lizenz anlegen.
--
-- Jetzt:
--   1) Normale Nutzer koennen ueber verein_anlegen KEINEN Verein mehr anlegen (serverseitig, auch bei direktem Aufruf).
--      Der TanzRaum-Admin ist ausgenommen (verein_anlegen, admin_verein_anlegen, admin_vereinslizenz_setzen bleiben).
--   2) "Verein gruenden": Die Person speichert nur eine BESTELLUNG (vereinsgruendungen: Vereinsname, Kuerzel) und bezahlt
--      die Vereinslizenz (Lastschrift/Karte ueber Stripe, PayPal, Ueberweisung). Bis zur bestaetigten Zahlung gibt es
--      KEINEN Verein, keine Vereins-ID, keine aktive Lizenz und keine Vereinsadmin-Zuordnung – nur eine ausstehende Zahlung.
--   3) Erst wenn die Zahlung bestaetigt ist (Webhook -> abo_aktualisieren, bzw. TanzRaum-Admin bestaetigt die Ueberweisung),
--      legt die Datenbank in EINEM Schritt den Verein an, ordnet die Lizenz zu, macht die Person zum Vereinsadmin und
--      schaltet die Vereinslizenz frei (vereinsgruendung_abschliessen).
--   4) Eine Vereinslizenz ohne Verein kann nie aktiv sein (abos_check: verein_id darf nur bei ausstehend/abgebrochen leer sein).
--   5) TanzRaum-Admin: Verein endgueltig loeschen mit Pruefung (Rechnungen, laufende bezahlte Lizenz, offene Ueberweisung),
--      Namensbestaetigung und Protokoll. Es wird nie automatisch geloescht.
--   6) Fix: Ausstehende Abos, deren Zahlung beim Anbieter bereits laeuft (SEPA-Lastschrift: 3–5 Werktage), wurden nach
--      2 Tagen bzw. bei einem neuen Kaufversuch geloescht – die spaetere Zahlungsbestaetigung fand ihr Abo dann nicht mehr.
--      Geloescht werden jetzt nur noch ausstehende Abos ohne Anbieter-Abo (Kauf nie abgeschlossen).
-- Bestehende Vereine, Lizenzen, Abos, Mitglieder und Daten werden nicht veraendert.

-- 1) Bestellungen "Verein gruenden" (noch kein Verein)
create table if not exists public.vereinsgruendungen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  verein_name text not null,
  kuerzel text,
  status text not null default 'offen',
  abo_id uuid references public.abos(id) on delete set null,
  verein_id uuid references public.vereine(id) on delete set null,
  hinweis text,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  abgeschlossen_am timestamptz,
  constraint vereinsgruendungen_name_check check (char_length(btrim(verein_name)) between 2 and 120),
  constraint vereinsgruendungen_kuerzel_check check (kuerzel is null or char_length(kuerzel) <= 20),
  constraint vereinsgruendungen_status_check check (status in ('offen', 'abgeschlossen', 'abgebrochen'))
);
create unique index if not exists vereinsgruendungen_offen_je_person on public.vereinsgruendungen (user_id) where status = 'offen';
create unique index if not exists vereinsgruendungen_abo on public.vereinsgruendungen (abo_id) where abo_id is not null;
alter table public.vereinsgruendungen enable row level security;
revoke all on public.vereinsgruendungen from public, anon, authenticated;
grant select on public.vereinsgruendungen to authenticated;
drop policy if exists "Eigene Vereinsgruendung lesen" on public.vereinsgruendungen;
create policy "Eigene Vereinsgruendung lesen" on public.vereinsgruendungen for select to authenticated
  using (user_id = auth.uid() or ist_plattform_admin_aktuell());
comment on table public.vereinsgruendungen is
  'Bestellung "Verein gruenden": nur Name/Kuerzel und die laufende Zahlung. Der Verein entsteht erst nach bestaetigter Zahlung (vereinsgruendung_abschliessen).';

-- 2) Eine Vereinslizenz ohne Verein ist nur als ausstehende/abgebrochene Bestellung erlaubt – nie aktiv
alter table public.abos drop constraint if exists abos_check;
alter table public.abos add constraint abos_check check (
  ((inhaber = 'person') and (tarif = 'basic') and (user_id is not null))
  or ((inhaber = 'person') and (tarif = 'verein') and (user_id is not null) and (anbieter = 'manuell') and (freischaltung = 'manual_free'))
  or ((inhaber = 'verein') and (tarif = 'verein') and (verein_id is not null))
  or ((inhaber = 'verein') and (tarif = 'verein') and (verein_id is null) and (user_id is not null) and (status in ('pending', 'cancelled', 'expired')))
);

-- Ueberweisung fuer eine Gruendung: der Verein existiert erst nach dem Zahlungseingang
alter table public.zahlungsaufforderungen alter column verein_id drop not null;
drop policy if exists "Vereinsadmin und Plattform-Admin lesen" on public.zahlungsaufforderungen;
create policy "Vereinsadmin und Plattform-Admin lesen" on public.zahlungsaufforderungen for select to authenticated
  using (is_verein_admin(verein_id) or ist_plattform_admin_aktuell()
         or (verein_id is null and exists (select 1 from vereinsgruendungen g where g.abo_id = zahlungsaufforderungen.abo_id and g.user_id = auth.uid())));

-- 3) Verein anlegen: nur noch TanzRaum-Admin (normale Nutzer gruenden ueber die Vereinslizenz)
create or replace function public.verein_anlegen(p_name text, p_kuerzel text default null::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_admin_rolle uuid;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  -- Ein Verein entsteht fuer normale Nutzer nur zusammen mit einer bezahlten Vereinslizenz (vereinsgruendung_abschliessen)
  if not ist_plattform_admin_aktuell() then
    raise exception 'Um einen Verein in TanzRaum zu gründen und zu verwalten, benötigst du eine aktive Vereinslizenz.'
      using errcode = 'P0001', hint = 'vereinslizenz_erforderlich';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Bitte einen Vereinsnamen angeben.';
  end if;
  if exists (select 1 from vereins_mitglieder vm where vm.user_id = auth.uid()) then
    raise exception 'Du bist bereits einem Verein zugeordnet. In TanzRaum ist jede Person genau einem Verein zugeordnet.' using errcode = 'P0001';
  end if;
  select id into v_admin_rolle from rollen where rollen_typ(name) = 'admin' order by name limit 1;
  insert into vereine(name, kuerzel) values (trim(p_name), nullif(trim(coalesce(p_kuerzel, '')), '')) returning id into v_id;
  insert into vereins_mitglieder(user_id, verein_id, rolle_id) values (auth.uid(), v_id, v_admin_rolle);
  return v_id;
end;
$function$;

-- 4) Bestellung speichern / aendern (noch kein Verein)
create or replace function public.vereinsgruendung_vorbereiten(p_name text, p_kuerzel text default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_kuerzel text := nullif(btrim(coalesce(p_kuerzel, '')), '');
  g vereinsgruendungen%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Bitte gib den Namen deines Vereins an (2 bis 120 Zeichen).' using errcode = 'P0001';
  end if;
  if v_kuerzel is not null and char_length(v_kuerzel) > 20 then
    raise exception 'Das Kürzel darf höchstens 20 Zeichen lang sein.' using errcode = 'P0001';
  end if;
  if exists (select 1 from vereins_mitglieder vm where vm.user_id = auth.uid()) then
    raise exception 'Du bist bereits einem Verein zugeordnet. In TanzRaum ist jede Person genau einem Verein zugeordnet – einen eigenen Verein kannst du erst gründen, wenn du dort nicht mehr Mitglied bist.'
      using errcode = 'P0001';
  end if;
  select * into g from vereinsgruendungen where user_id = auth.uid() and status = 'offen' for update;
  if g.id is not null then
    if exists (select 1 from abos a where a.id = g.abo_id and a.status = 'pending' and (a.anbieter = 'ueberweisung' or a.anbieter_abo_id is not null)) then
      raise exception 'Für deine Vereinsgründung läuft bereits eine Zahlung. Dein Verein wird angelegt, sobald sie bestätigt ist.' using errcode = 'P0001';
    end if;
    update vereinsgruendungen set verein_name = v_name, kuerzel = v_kuerzel, aktualisiert_am = now() where id = g.id;
    return g.id;
  end if;
  insert into vereinsgruendungen (user_id, verein_name, kuerzel) values (auth.uid(), v_name, v_kuerzel) returning id into v_id;
  return v_id;
end;
$function$;

-- Bestellung zuruecknehmen (nur solange keine Zahlung laeuft; eine beauftragte Ueberweisung wird mit storniert)
create or replace function public.vereinsgruendung_abbrechen()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  g vereinsgruendungen%rowtype;
  a abos%rowtype;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  select * into g from vereinsgruendungen where user_id = auth.uid() and status = 'offen' for update;
  if g.id is null then return; end if;
  select * into a from abos where id = g.abo_id for update;
  if a.id is not null and a.status = 'pending' and a.anbieter <> 'ueberweisung' and a.anbieter_abo_id is not null then
    raise exception 'Die Zahlung läuft bereits beim Zahlungsanbieter und kann hier nicht mehr abgebrochen werden.' using errcode = 'P0001';
  end if;
  update zahlungsaufforderungen set status = 'storniert', storniert_am = now() where abo_id = g.abo_id and status = 'offen';
  delete from abos where id = g.abo_id and status = 'pending' and verein_id is null;
  update vereinsgruendungen set status = 'abgebrochen', aktualisiert_am = now() where id = g.id;
end;
$function$;

-- Stand der eigenen Vereinsgruendung (fuer "Verein gruenden" und "Mein Tarif")
create or replace function public.vereinsgruendung_status()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with g as (
    select * from vereinsgruendungen where user_id = auth.uid() and status = 'offen' limit 1
  ), z as (
    select z.* from zahlungsaufforderungen z join g on g.abo_id = z.abo_id where z.status = 'offen' order by z.erstellt_am desc limit 1
  )
  select jsonb_build_object(
    'im_verein', exists (select 1 from vereins_mitglieder vm where vm.user_id = auth.uid()),
    'bestellung', (select jsonb_build_object(
        'id', g.id, 'name', g.verein_name, 'kuerzel', g.kuerzel, 'erstellt_am', g.erstellt_am,
        'zahlung', (select jsonb_build_object('anbieter', a.anbieter, 'status', a.status, 'periode', a.periode, 'preis_cent', a.preis_cent,
                                              'laeuft', a.status = 'pending' and (a.anbieter = 'ueberweisung' or a.anbieter_abo_id is not null))
                    from abos a where a.id = g.abo_id),
        'ueberweisung', (select jsonb_build_object('id', z.id, 'art', z.art, 'betrag_cent', z.betrag_cent, 'referenz', z.referenz,
                                                   'faellig_am', z.faellig_am, 'erstellt_am', z.erstellt_am, 'empfaenger_email', z.empfaenger_email) from z))
      from g),
    'gegruendet', (select jsonb_build_object('verein_id', x.verein_id, 'name', x.verein_name, 'am', x.abgeschlossen_am, 'hinweis', x.hinweis)
                   from vereinsgruendungen x where x.user_id = auth.uid() and x.status = 'abgeschlossen' and x.abgeschlossen_am > now() - interval '14 days'
                   order by x.abgeschlossen_am desc limit 1),
    'bank', case when exists (select 1 from z) then
      (select jsonb_build_object('inhaber', p.bank_inhaber, 'iban', p.iban, 'bic', p.bic, 'bank', p.bank_name) from plattform_anbieter p where p.id = true)
    end,
    'ueberweisung_moeglich', exists (select 1 from plattform_anbieter p where p.id = true and p.iban is not null and p.bank_inhaber is not null));
$function$;

-- 5) Nach bestaetigter Zahlung: Verein + Lizenz + Vereinsadmin in einem Schritt (nur intern, aus abo_aktualisieren)
create or replace function public.vereinsgruendung_abschliessen(p_abo_id uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a abos%rowtype;
  g vereinsgruendungen%rowtype;
  v_id uuid;
  v_rolle uuid;
  v_name text;
  v_hinweis text;
begin
  select * into a from abos where id = p_abo_id for update;
  if a.id is null or a.inhaber <> 'verein' or a.verein_id is not null then return a.verein_id; end if;
  select * into g from vereinsgruendungen where abo_id = a.id for update;
  if g.id is null then
    select * into g from vereinsgruendungen where user_id = a.user_id and status = 'offen' for update;
  end if;
  v_name := coalesce(nullif(btrim(g.verein_name), ''), 'Neuer Verein');
  insert into vereine (name, kuerzel) values (v_name, g.kuerzel) returning id into v_id;
  update abos set verein_id = v_id, aktualisiert_am = now() where id = a.id;
  update zahlungsaufforderungen set verein_id = v_id where abo_id = a.id and verein_id is null;
  select id into v_rolle from rollen where rollen_typ(name) = 'admin' order by name limit 1;
  begin
    insert into vereins_mitglieder (user_id, verein_id, rolle_id) values (a.user_id, v_id, v_rolle);
  exception when others then
    -- z. B. Person inzwischen in einem anderen Verein: Zahlung und Verein bleiben erhalten, TanzRaum setzt den Vereinsadmin
    v_hinweis := 'Der Vereinsadmin konnte nicht automatisch gesetzt werden (die Person ist bereits einem anderen Verein zugeordnet). Bitte über die TanzRaum-Administration einen Vereinsadmin einladen.';
    insert into benachrichtigungen (user_id, typ, text)
    select p.id, 'tarif_kauf', 'Vereinsgründung „' || v_name || '“: ' || v_hinweis from profiles p where p.ist_plattform_admin;
  end;
  if g.id is not null then
    update vereinsgruendungen set status = 'abgeschlossen', verein_id = v_id, abo_id = a.id, hinweis = v_hinweis,
      abgeschlossen_am = now(), aktualisiert_am = now() where id = g.id;
  end if;
  if v_hinweis is null then
    insert into benachrichtigungen (user_id, typ, text, link)
    values (a.user_id, 'tarif_kauf', 'Dein Verein „' || v_name || '“ ist angelegt – die Vereinslizenz ist aktiv und du bist Vereinsadmin.', '/dashboard/verein');
  end if;
  return v_id;
end;
$function$;

-- 6) Kauf starten: Vereinslizenz fuer einen bestehenden Verein (wie bisher) oder fuer die eigene Gruendungsbestellung
create or replace function public.abo_anlegen(p_tarif text, p_periode text, p_anbieter text, p_verein_id uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_preis int;
  v_id uuid;
  g vereinsgruendungen%rowtype;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if p_anbieter not in ('stripe', 'paypal') then raise exception 'Unbekannte Zahlungsart.' using errcode = 'P0001'; end if;
  select preis_cent into v_preis from tarif_preise where tarif = p_tarif and periode = p_periode;
  if v_preis is null then raise exception 'Unbekannter Tarif.' using errcode = 'P0001'; end if;
  -- abgebrochene Kaufversuche aufraeumen (nur ohne Anbieter-Abo; laufende Zahlungen bleiben)
  delete from abos where status = 'pending' and user_id = auth.uid() and anbieter <> 'ueberweisung' and anbieter_abo_id is null
    and erstellt_am < now() - interval '1 minute';
  if p_tarif = 'basic' then
    if exists (select 1 from abos a where a.inhaber = 'person' and a.user_id = auth.uid() and abo_gilt(a)) then
      raise exception 'Du hast BASIC bereits.' using errcode = 'P0001';
    end if;
    if vereinslizenz_verein_von(auth.uid()) is not null then
      raise exception 'Du bist bereits über die Vereinslizenz deines Vereins freigeschaltet – BASIC brauchst du nicht zusätzlich.' using errcode = 'P0001';
    end if;
    insert into abos (inhaber, user_id, tarif, periode, preis_cent, anbieter) values ('person', auth.uid(), 'basic', p_periode, v_preis, p_anbieter)
    returning id into v_id;
  elsif p_verein_id is null then
    -- Verein gruenden: Lizenz und Verein entstehen erst nach bestaetigter Zahlung (vereinsgruendung_abschliessen)
    select * into g from vereinsgruendungen where user_id = auth.uid() and status = 'offen' for update;
    if g.id is null then raise exception 'Bitte gib zuerst den Namen deines Vereins an.' using errcode = 'P0001'; end if;
    if exists (select 1 from vereins_mitglieder vm where vm.user_id = auth.uid()) then
      raise exception 'Du bist bereits einem Verein zugeordnet. In TanzRaum ist jede Person genau einem Verein zugeordnet.' using errcode = 'P0001';
    end if;
    if exists (select 1 from abos a where a.id = g.abo_id and a.status = 'pending' and (a.anbieter = 'ueberweisung' or a.anbieter_abo_id is not null)) then
      raise exception 'Für deine Vereinsgründung läuft bereits eine Zahlung. Dein Verein wird angelegt, sobald sie bestätigt ist.' using errcode = 'P0001';
    end if;
    insert into abos (inhaber, user_id, verein_id, tarif, periode, preis_cent, anbieter) values ('verein', auth.uid(), null, 'verein', p_periode, v_preis, p_anbieter)
    returning id into v_id;
    update vereinsgruendungen set abo_id = v_id, aktualisiert_am = now() where id = g.id;
  else
    if not exists (
        select 1 from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
        where vm.verein_id = p_verein_id and vm.user_id = auth.uid() and coalesce(vm.aktiv, true) and rollen_typ(r.name) = 'admin') then
      raise exception 'Die Vereinslizenz kann nur der Vereinsadmin kaufen.' using errcode = '42501';
    end if;
    if exists (select 1 from zahlungsaufforderungen z where z.verein_id = p_verein_id and z.status = 'offen' and z.art = 'neu') then
      raise exception 'Für diesen Verein ist bereits eine Überweisung beauftragt – zieh sie unter „Mein Tarif“ zuerst zurück.' using errcode = 'P0001';
    end if;
    if exists (select 1 from abos a where a.inhaber = 'verein' and a.verein_id = p_verein_id and abo_gilt(a)) then
      raise exception 'Dieser Verein hat bereits eine aktive Vereinslizenz.' using errcode = 'P0001';
    end if;
    insert into abos (inhaber, user_id, verein_id, tarif, periode, preis_cent, anbieter) values ('verein', auth.uid(), p_verein_id, 'verein', p_periode, v_preis, p_anbieter)
    returning id into v_id;
  end if;
  return v_id;
end;
$function$;

-- 7) Zahlungsbestaetigung (Webhooks, Ueberweisung): bei einer Gruendungsbestellung zuerst den Verein anlegen
create or replace function public.abo_aktualisieren(p_abo_id uuid, p_status text, p_laeuft_bis timestamp with time zone, p_gekuendigt_zum timestamp with time zone, p_anbieter_abo_id text, p_anbieter_kunde_id text, p_grund text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a abos%rowtype;
begin
  select * into a from abos where id = p_abo_id for update;
  if a.id is null then raise exception 'Abo nicht gefunden'; end if;
  if p_status is not null and p_status not in ('pending', 'active', 'trialing', 'past_due', 'cancelled', 'expired', 'paused_by_organization') then
    raise exception 'Ungueltiger Status';
  end if;
  -- Gruendungsbestellung: ohne bestaetigte Zahlung kein Verein und keine aktive Lizenz
  if a.inhaber = 'verein' and a.verein_id is null then
    if p_status in ('active', 'trialing') and not (a.status = 'expired' and p_status <> 'active') then
      perform vereinsgruendung_abschliessen(a.id);
      select * into a from abos where id = p_abo_id for update;
    elsif p_status in ('past_due', 'paused_by_organization') then
      p_status := 'pending';
    end if;
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
$function$;

-- 8) Ueberweisung: fuer einen bestehenden Verein (wie bisher) oder fuer die eigene Gruendungsbestellung
create or replace function public.ueberweisung_beantragen(p_verein_id uuid, p_leistungsbeginn_version text, p_leistungsbeginn_text text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_preis int;
  v_abo uuid;
  v_id uuid;
  v_email text;
  g vereinsgruendungen%rowtype;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if p_verein_id is null then
    -- Verein gruenden: Verein und Lizenz erst nach bestaetigtem Zahlungseingang
    select * into g from vereinsgruendungen where user_id = auth.uid() and status = 'offen' for update;
    if g.id is null then raise exception 'Bitte gib zuerst den Namen deines Vereins an.' using errcode = 'P0001'; end if;
    if exists (select 1 from vereins_mitglieder vm where vm.user_id = auth.uid()) then
      raise exception 'Du bist bereits einem Verein zugeordnet. In TanzRaum ist jede Person genau einem Verein zugeordnet.' using errcode = 'P0001';
    end if;
    if exists (select 1 from abos a where a.id = g.abo_id and a.status = 'pending' and (a.anbieter = 'ueberweisung' or a.anbieter_abo_id is not null)) then
      raise exception 'Für deine Vereinsgründung läuft bereits eine Zahlung. Dein Verein wird angelegt, sobald sie bestätigt ist.' using errcode = 'P0001';
    end if;
  else
    if not exists (
        select 1 from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
        where vm.verein_id = p_verein_id and vm.user_id = auth.uid() and coalesce(vm.aktiv, true) and rollen_typ(r.name) = 'admin') then
      raise exception 'Die Vereinslizenz kann nur der Vereinsadmin beantragen.' using errcode = '42501';
    end if;
    if exists (select 1 from abos a where a.inhaber = 'verein' and a.verein_id = p_verein_id and abo_gilt(a)) then
      raise exception 'Dieser Verein hat bereits eine aktive Vereinslizenz.' using errcode = 'P0001';
    end if;
    if exists (select 1 from zahlungsaufforderungen z where z.verein_id = p_verein_id and z.status = 'offen') then
      raise exception 'Für diesen Verein ist bereits eine Überweisung beauftragt.' using errcode = 'P0001';
    end if;
  end if;
  if not exists (select 1 from plattform_anbieter where id = true and iban is not null and bank_inhaber is not null) then
    raise exception 'Die Zahlung per Überweisung ist gerade nicht verfügbar. Bitte wähle eine andere Zahlart.' using errcode = 'P0001';
  end if;
  if coalesce(p_leistungsbeginn_version, '') = '' or coalesce(p_leistungsbeginn_text, '') = '' then
    raise exception 'Bitte bestätige zuerst den Beginn der Leistung.' using errcode = 'P0001';
  end if;
  select preis_cent into v_preis from tarif_preise where tarif = 'verein' and periode = 'jahr';
  if v_preis is null then raise exception 'Unbekannter Tarif.' using errcode = 'P0001'; end if;
  select email::text into v_email from auth.users where id = auth.uid();

  insert into abos (inhaber, user_id, verein_id, tarif, periode, preis_cent, anbieter, status)
  values ('verein', auth.uid(), p_verein_id, 'verein', 'jahr', v_preis, 'ueberweisung', 'pending')
  returning id into v_abo;
  if g.id is not null then
    update vereinsgruendungen set abo_id = v_abo, aktualisiert_am = now() where id = g.id;
  end if;
  insert into zahlungsaufforderungen (abo_id, verein_id, art, betrag_cent, referenz, empfaenger_email, faellig_am, erstellt_von)
  values (v_abo, p_verein_id, 'neu', v_preis, zahlungsreferenz_neu(), v_email, (now() at time zone 'Europe/Berlin')::date + 14, auth.uid())
  returning id into v_id;
  insert into einwilligungen (user_id, art, version, erteilt, quelle, erteilt_von, details)
  values (auth.uid(), 'vorzeitiger_leistungsbeginn', left(p_leistungsbeginn_version, 40), true, 'kauf', auth.uid(),
          jsonb_build_object('abo_id', v_abo, 'tarif', 'verein', 'periode', 'jahr', 'anbieter', 'ueberweisung', 'text', left(p_leistungsbeginn_text, 2000)));
  return v_id;
end;
$function$;

create or replace function public.ueberweisung_zurueckziehen(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  z zahlungsaufforderungen%rowtype;
begin
  select * into z from zahlungsaufforderungen where id = p_id for update;
  if z.id is null or not (is_verein_admin(z.verein_id) or ist_plattform_admin_aktuell()
     or (z.verein_id is null and exists (select 1 from vereinsgruendungen g where g.abo_id = z.abo_id and g.user_id = auth.uid()))) then
    raise exception 'Nicht berechtigt.' using errcode = '42501';
  end if;
  if z.status <> 'offen' or z.art <> 'neu' then
    raise exception 'Diese Überweisung kann nicht mehr zurückgezogen werden.' using errcode = 'P0001';
  end if;
  update zahlungsaufforderungen set status = 'storniert', storniert_am = now() where id = z.id;
  delete from abos where id = z.abo_id and status = 'pending' and anbieter = 'ueberweisung';
end;
$function$;

-- Zahlungseingang bestaetigen: bei einer Gruendung entsteht der Verein in abo_aktualisieren, die Rechnung geht an ihn
create or replace function public.admin_ueberweisung_bestaetigen(p_id uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  z zahlungsaufforderungen%rowtype;
  a abos%rowtype;
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
  v_von date;
  v_bis timestamptz;
  v_rechnung uuid;
  v_verein uuid;
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nicht berechtigt.' using errcode = '42501'; end if;
  select * into z from zahlungsaufforderungen where id = p_id for update;
  if z.id is null then raise exception 'Zahlungsaufforderung nicht gefunden.' using errcode = 'P0001'; end if;
  if z.status <> 'offen' then raise exception 'Diese Zahlungsaufforderung ist nicht mehr offen.' using errcode = 'P0001'; end if;
  select * into a from abos where id = z.abo_id for update;
  if a.id is null then raise exception 'Zur Zahlungsaufforderung gibt es keine Lizenz mehr.' using errcode = 'P0001'; end if;
  -- Verlaengerung schliesst nahtlos an, sonst ab heute
  v_von := case when a.status in ('active', 'cancelled') and a.laeuft_bis > now()
                then greatest(v_heute, (a.laeuft_bis at time zone 'Europe/Berlin')::date) else v_heute end;
  v_bis := lizenz_ende(v_von);
  perform abo_aktualisieren(a.id, 'active', v_bis, null, null, null, 'ueberweisung_eingegangen');
  update abos set gekuendigt_zum = null, gekuendigt_am = null where id = a.id;
  select verein_id into v_verein from abos where id = a.id;
  v_rechnung := erstelle_rechnung('verein', null, v_verein, 'verein', 'jahr', z.betrag_cent / 100.0, 'ueberweisung',
                                  v_von, (v_bis at time zone 'Europe/Berlin')::date - 1);
  update zahlungsaufforderungen set status = 'bezahlt', bezahlt_am = now(), bestaetigt_von = auth.uid(), rechnung_id = v_rechnung,
    verein_id = coalesce(verein_id, v_verein)
  where id = z.id;
  return v_rechnung;
end;
$function$;

-- Ueberweisungen in der Administration: Gruendungen zeigen den bestellten Vereinsnamen
create or replace function public.admin_ueberweisungen()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nicht berechtigt.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', z.id, 'art', z.art, 'status', z.status, 'betrag_cent', z.betrag_cent, 'referenz', z.referenz,
      'verein_id', z.verein_id, 'verein_name', coalesce(v.name, g.verein_name, 'Neuer Verein'), 'gruendung', z.verein_id is null,
      'empfaenger_email', z.empfaenger_email,
      'faellig_am', z.faellig_am, 'erstellt_am', z.erstellt_am, 'versendet_am', z.versendet_am, 'bezahlt_am', z.bezahlt_am,
      'rechnung_id', z.rechnung_id, 'lizenz_bis', a.laeuft_bis)
      order by (z.status = 'offen') desc, z.faellig_am, z.erstellt_am desc)
    from zahlungsaufforderungen z
    left join vereine v on v.id = z.verein_id
    left join abos a on a.id = z.abo_id
    left join vereinsgruendungen g on g.abo_id = z.abo_id
    where z.status = 'offen' or z.erstellt_am > now() - interval '180 days'), '[]'::jsonb);
end;
$function$;

-- 9) Rechnungen: Gruendungsbestellung ohne Verein (sollte nicht vorkommen) faellt auf die Person zurueck
create or replace function public.erstelle_rechnung(p_typ text, p_ziel_user_id uuid, p_ziel_verein_id uuid, p_tarif text, p_periode text, p_betrag numeric, p_zahlungsweg text, p_leistung_von date default null::date, p_leistung_bis date default null::date)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_nummer text;
  v_name text;
  v_adresse text;
  v_email text;
  v_leistung text;
  v_rechnung_id uuid;
  v_tarif_label text;
  v_von date;
  v_bis date;
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

  if p_typ = 'basic' or (p_ziel_verein_id is null and p_ziel_user_id is not null) then
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

  v_von := coalesce(p_leistung_von, (now() at time zone 'Europe/Berlin')::date);
  v_bis := coalesce(p_leistung_bis, (v_von + case p_periode when 'jahr' then interval '1 year' else interval '1 month' end - interval '1 day')::date);

  v_nummer := naechste_rechnungsnummer();
  insert into rechnungen (nummer, typ, ziel_user_id, ziel_verein_id, empfaenger_name, empfaenger_adresse, empfaenger_email, leistung, zeitraum,
                          betrag, zahlungsweg, leistung_von, leistung_bis, aussteller)
  values (v_nummer, p_typ, p_ziel_user_id, p_ziel_verein_id, coalesce(v_name,'—'), v_adresse, coalesce(v_email,''), v_leistung, p_periode,
          p_betrag, p_zahlungsweg, v_von, v_bis, rechnung_aussteller_stand())
  returning id into v_rechnung_id;

  return v_rechnung_id;
end;
$function$;

-- 10) Nachtlauf: ausstehende Abos nur loeschen, wenn der Kauf nie abgeschlossen wurde (laufende Lastschrift bleibt erhalten)
create or replace function public.abos_ablaufen()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
  delete from abos where status = 'pending' and anbieter <> 'ueberweisung' and anbieter_abo_id is null and erstellt_am < now() - interval '2 days';
  insert into vereins_lizenz_abdeckungen (verein_id, user_id, vereins_mitglied_id, status, source, starts_at)
  select vm.verein_id, vm.user_id, vm.id, 'active', 'club_license', now()
  from vereins_mitglieder vm
  where vm.user_id is not null and coalesce(vm.aktiv, true) and verein_hat_lizenz(vm.verein_id)
    and not exists (select 1 from vereins_lizenz_abdeckungen d where d.vereins_mitglied_id = vm.id and d.status = 'active');
  update vereins_lizenz_abdeckungen d set status = 'ended', ended_at = now(), ends_at = now()
  where d.status = 'active' and not exists (
    select 1 from vereins_mitglieder vm where vm.id = d.vereins_mitglied_id and coalesce(vm.aktiv, true) and verein_hat_lizenz(vm.verein_id));
end;
$function$;

-- 11) TanzRaum-Admin: offene und abgeschlossene Vereinsgruendungen
create or replace function public.admin_vereinsgruendungen()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id, 'name', g.verein_name, 'kuerzel', g.kuerzel, 'status', g.status,
      'person', (select x.anzeige from anzeige_namen(array[g.user_id]) x),
      'anbieter', a.anbieter, 'zahlung_status', a.status, 'periode', a.periode,
      'verein_id', g.verein_id, 'hinweis', g.hinweis, 'erstellt_am', g.erstellt_am, 'abgeschlossen_am', g.abgeschlossen_am)
      order by (g.status = 'offen') desc, coalesce(g.abgeschlossen_am, g.erstellt_am) desc)
    from vereinsgruendungen g left join abos a on a.id = g.abo_id
    where g.status = 'offen' or coalesce(g.abgeschlossen_am, g.aktualisiert_am) > now() - interval '90 days'), '[]'::jsonb);
end;
$function$;

-- 12) TanzRaum-Admin: Verein endgueltig loeschen (Pruefung, Namensbestaetigung, Protokoll)
--     Nur zusammengefasste Zahlen – keine Namen oder Daten von Vereinsmitgliedern.
create or replace function public.admin_verein_loeschen_pruefen(p_verein_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v vereine%rowtype;
  v_hindernisse text[] := '{}';
  v_anzahl int;
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  select * into v from vereine where id = p_verein_id;
  if v.id is null then raise exception 'Verein nicht gefunden.' using errcode = 'P0001'; end if;
  select count(*) into v_anzahl from rechnungen r where r.ziel_verein_id = v.id;
  if v_anzahl > 0 then
    v_hindernisse := v_hindernisse || format('Für diesen Verein gibt es %s Rechnung(en). Rechnungen müssen aufbewahrt werden – der Verein kann deshalb nicht gelöscht werden.', v_anzahl);
  end if;
  if exists (select 1 from ueberweisungs_rechnungen u where u.ziel_verein_id = v.id) then
    v_hindernisse := v_hindernisse || 'Für diesen Verein gibt es Rechnungen per Überweisung. Diese müssen aufbewahrt werden.'::text;
  end if;
  if exists (select 1 from abos a where a.inhaber = 'verein' and a.verein_id = v.id and a.anbieter in ('stripe', 'paypal', 'ueberweisung')
             and (a.status in ('pending', 'active', 'trialing', 'past_due') or (a.status = 'cancelled' and (a.laeuft_bis is null or a.laeuft_bis > now())))) then
    v_hindernisse := v_hindernisse || 'Der Verein hat eine laufende bezahlte Vereinslizenz. Bitte die Lizenz zuerst kündigen bzw. beenden.'::text;
  end if;
  if exists (select 1 from zahlungsaufforderungen z where z.verein_id = v.id and z.status = 'offen') then
    v_hindernisse := v_hindernisse || 'Es gibt eine offene Überweisung. Bitte sie zuerst stornieren.'::text;
  end if;
  return jsonb_build_object(
    'id', v.id, 'name', v.name, 'angelegt', v.created_at, 'lizenz', verein_hat_lizenz(v.id),
    'konten', (select count(*) from vereins_mitglieder x where x.verein_id = v.id),
    'mitglieder', (select count(*) from mitglieder x where x.verein_id = v.id),
    'gruppen', (select count(*) from gruppen x where x.verein_id = v.id),
    'trainings', (select count(*) from trainingstermine x where x.verein_id = v.id),
    'termine', (select count(*) from termine x where x.verein_id = v.id),
    'dateien', (select count(*) from dateien x where x.verein_id = v.id),
    'musik', (select count(*) from musik_titel x where x.verein_id = v.id),
    'news', (select count(*) from news x where x.verein_id = v.id),
    'kostueme', (select count(*) from kostueme x where x.verein_id = v.id),
    'kassenbuch', (select count(*) from kassenbuch_eintraege x where x.verein_id = v.id),
    'chats', (select count(*) from gespraeche x where x.verein_id = v.id),
    'hindernisse', to_jsonb(v_hindernisse));
end;
$function$;

create or replace function public.admin_verein_endgueltig_loeschen(p_verein_id uuid, p_name_bestaetigung text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_pruefung jsonb;
  v_name text;
  v_personen uuid[];
  u uuid;
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  v_pruefung := admin_verein_loeschen_pruefen(p_verein_id);
  v_name := v_pruefung->>'name';
  if lower(btrim(coalesce(p_name_bestaetigung, ''))) <> lower(btrim(v_name)) then
    raise exception 'Bitte zur Bestätigung den Vereinsnamen genau eingeben.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(v_pruefung->'hindernisse') > 0 then
    raise exception '%', v_pruefung->'hindernisse'->>0 using errcode = 'P0001';
  end if;
  select coalesce(array_agg(distinct vm.user_id), '{}') into v_personen from vereins_mitglieder vm where vm.verein_id = p_verein_id and vm.user_id is not null;
  perform protokollieren('verein_geloescht', null, (v_pruefung - 'hindernisse') || jsonb_build_object('verein_id', p_verein_id));
  delete from vereine where id = p_verein_id;
  -- bisherige Mitglieder: Tarif neu berechnen (eine pausierte BASIC-Lizenz setzt der Abgleich fort)
  foreach u in array v_personen loop
    perform tarif_neu_berechnen_person(u, 'verein_geloescht');
  end loop;
  return jsonb_build_object('success', true, 'name', v_name);
end;
$function$;

-- bestehende Funktion bleibt erhalten, laeuft aber jetzt ueber dieselben Pruefungen und das Protokoll
create or replace function public.admin_verein_loeschen(p_verein_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  return admin_verein_endgueltig_loeschen(p_verein_id, (select v.name from vereine v where v.id = p_verein_id));
end;
$function$;

-- Rechte
revoke all on function public.vereinsgruendung_vorbereiten(text, text) from public, anon;
grant execute on function public.vereinsgruendung_vorbereiten(text, text) to authenticated;
revoke all on function public.vereinsgruendung_abbrechen() from public, anon;
grant execute on function public.vereinsgruendung_abbrechen() to authenticated;
revoke all on function public.vereinsgruendung_status() from public, anon;
grant execute on function public.vereinsgruendung_status() to authenticated;
revoke all on function public.vereinsgruendung_abschliessen(uuid) from public, anon, authenticated;
grant execute on function public.vereinsgruendung_abschliessen(uuid) to service_role;
revoke all on function public.admin_vereinsgruendungen() from public, anon;
grant execute on function public.admin_vereinsgruendungen() to authenticated;
revoke all on function public.admin_verein_loeschen_pruefen(uuid) from public, anon;
grant execute on function public.admin_verein_loeschen_pruefen(uuid) to authenticated;
revoke all on function public.admin_verein_endgueltig_loeschen(uuid, text) from public, anon;
grant execute on function public.admin_verein_endgueltig_loeschen(uuid, text) to authenticated;
