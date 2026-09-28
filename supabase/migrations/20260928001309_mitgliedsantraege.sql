-- Mitgliedsantraege (digitale Beitrittserklaerung je Verein) und genau eine Vereinszuordnung je Person.
--
-- Ablauf:
--   1. Der Verein fuegt eine Person mit TanzRaum-Konto hinzu (E-Mail oder @handle) bzw. laedt sie per Link ein.
--      Ist sie einem anderen Verein zugeordnet, geht eine Freigabe-Anfrage an diesen Verein; erst nach dessen
--      Freigabe wird die Person umgehaengt.
--   2. Beim neuen Verein ist die Person "neu" (aufnahme_status = 'neu', nicht aktiv) und bekommt – je nach
--      Vereinseinstellung – eine Benachrichtigung. Sie (bzw. ein verknuepftes Elternteil) fuellt den Antrag aus.
--   3. Der Verein prueft, bearbeitet, druckt und nimmt an (aufgenommen, ggf. freigeschaltet) oder lehnt ab
--      (Vereinszuordnung wird geloest, der Antrag bleibt als abgelehnt dokumentiert).
-- Vereinsmitgliedschaft ist unabhaengig vom TanzRaum-Tarif (Free/Basic).
-- Antraege sehen nur der Antragsteller, verknuepfte Eltern und Vereinsadmins bzw. Personen mit dem Bereich
-- "Mitgliedsantraege" (beitritt) – nicht die Plattform-Administration.

-- ---------------------------------------------------------------------------------------------
-- 1. Genau eine Vereinszuordnung je Person
-- ---------------------------------------------------------------------------------------------
alter table public.vereins_mitglieder
  add column if not exists aufnahme_status text not null default 'aufgenommen',
  add column if not exists hinzugefuegt_von uuid references public.profiles(id) on delete set null;
alter table public.vereins_mitglieder
  add constraint vereins_mitglieder_aufnahme_status check (aufnahme_status in ('neu', 'aufgenommen'));
comment on column public.vereins_mitglieder.aufnahme_status is
  'neu = vom Verein hinzugefuegt, Mitgliedsantrag noch nicht angenommen; aufgenommen = Vereinsmitglied';

create unique index if not exists vereins_mitglieder_ein_verein_je_person on public.vereins_mitglieder (user_id);

create or replace function public.pruefe_ein_verein()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if exists (select 1 from vereins_mitglieder vm where vm.user_id = new.user_id and vm.id <> new.id and vm.verein_id <> new.verein_id) then
    raise exception 'Diese Person ist bereits einem anderen Verein zugeordnet. Der bisherige Verein muss sie zuerst in TanzRaum freigeben.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

drop trigger if exists vereins_mitglieder_ein_verein on public.vereins_mitglieder;
create trigger vereins_mitglieder_ein_verein
  before insert or update of user_id, verein_id on public.vereins_mitglieder
  for each row execute function public.pruefe_ein_verein();

-- Vereinsadmin nur, wenn die Mitgliedschaft aktiv und aufgenommen ist (hinzugefuegte Personen mit Admin-Rolle
-- bekommen die Rechte erst mit der Annahme des Antrags)
create or replace function public.is_verein_admin(p_verein_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from vereins_mitglieder vm
    join rollen r on r.id = vm.rolle_id
    where vm.verein_id = p_verein_id
      and vm.user_id = auth.uid()
      and lower(r.name) like '%admin%'
      and coalesce(vm.aktiv, true)
      and vm.aufnahme_status = 'aufgenommen'
  );
$function$;

-- ---------------------------------------------------------------------------------------------
-- 2. Vorlage (Formular) und Einstellungen je Verein
-- ---------------------------------------------------------------------------------------------
create table if not exists public.antrag_vorlagen (
  verein_id uuid primary key references public.vereine(id) on delete cascade,
  inhalt jsonb not null default '{}'::jsonb,
  einstellungen jsonb not null default '{}'::jsonb,
  geaendert_am timestamptz not null default now(),
  geaendert_von uuid references public.profiles(id) on delete set null,
  constraint antrag_vorlagen_objekte check (jsonb_typeof(inhalt) = 'object' and jsonb_typeof(einstellungen) = 'object'),
  constraint antrag_vorlagen_inhalt_groesse check (octet_length(inhalt::text) <= 80000),
  constraint antrag_vorlagen_einstellungen_groesse check (octet_length(einstellungen::text) <= 20000)
);
comment on table public.antrag_vorlagen is
  'Mitgliedsantrag je Verein: inhalt = Kopf, Vorstand, Bankverbindungen, Texte, Felder; einstellungen = Unterschriftsverfahren, Empfaenger, Benachrichtigungen';
alter table public.antrag_vorlagen enable row level security;

-- Wer darf Antraege eines Vereins sehen/bearbeiten: Vereinsadmin oder Bereich "beitritt" (mit Vereinslizenz)
create or replace function public.darf_antraege(p_verein_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select auth.uid() is not null and (
    is_verein_admin(p_verein_id)
    or exists (select 1 from meine_bereiche() mb where mb.verein_id = p_verein_id and mb.bereich = 'beitritt'));
$function$;

-- Einstellung mit Standardwert (intern)
create or replace function public.antrag_einstellung(p_verein_id uuid, p_schluessel text, p_standard text)
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((select nullif(av.einstellungen ->> p_schluessel, '') from antrag_vorlagen av where av.verein_id = p_verein_id), p_standard);
$function$;

drop policy if exists "Antragsvorlage sehen" on public.antrag_vorlagen;
drop policy if exists "Antragsvorlage anlegen" on public.antrag_vorlagen;
drop policy if exists "Antragsvorlage aendern" on public.antrag_vorlagen;
create policy "Antragsvorlage sehen" on public.antrag_vorlagen for select to authenticated using (darf_antraege(verein_id));
create policy "Antragsvorlage anlegen" on public.antrag_vorlagen for insert to authenticated with check (darf_antraege(verein_id));
create policy "Antragsvorlage aendern" on public.antrag_vorlagen for update to authenticated
  using (darf_antraege(verein_id)) with check (darf_antraege(verein_id));

create or replace function public.antrag_vorlage_stempeln()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  new.geaendert_am := now();
  new.geaendert_von := auth.uid();
  return new;
end;
$function$;
drop trigger if exists antrag_vorlagen_stempeln on public.antrag_vorlagen;
create trigger antrag_vorlagen_stempeln before insert or update on public.antrag_vorlagen
  for each row execute function public.antrag_vorlage_stempeln();

-- ---------------------------------------------------------------------------------------------
-- 3. Antraege
-- ---------------------------------------------------------------------------------------------
create table if not exists public.beitrittsantraege (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  vereins_mitglied_id uuid references public.vereins_mitglieder(id) on delete set null,
  status text not null default 'offen',
  daten jsonb not null default '{}'::jsonb,
  vorlage jsonb,
  unterschrift_verfahren text,
  unterschriften jsonb not null default '{}'::jsonb,
  papier_datei text,
  papier_vorliegend boolean not null default false,
  mitgliedsnummer text,
  familiennummer text,
  notiz_intern text,
  ablehnungsgrund text,
  aufnahme_pdf text,
  erstellt_am timestamptz not null default now(),
  erstellt_von uuid references public.profiles(id) on delete set null,
  eingereicht_am timestamptz,
  eingereicht_von uuid references public.profiles(id) on delete set null,
  bearbeitet_am timestamptz,
  bearbeitet_von uuid references public.profiles(id) on delete set null,
  entschieden_am timestamptz,
  entschieden_von uuid references public.profiles(id) on delete set null,
  constraint beitrittsantraege_status check (status in ('offen', 'eingereicht', 'angenommen', 'abgelehnt')),
  constraint beitrittsantraege_verfahren check (unterschrift_verfahren is null or unterschrift_verfahren in ('bildschirm', 'bestaetigung', 'papier')),
  constraint beitrittsantraege_objekte check (jsonb_typeof(daten) = 'object' and jsonb_typeof(unterschriften) = 'object'),
  constraint beitrittsantraege_daten_groesse check (octet_length(daten::text) <= 30000),
  constraint beitrittsantraege_unterschriften_groesse check (octet_length(unterschriften::text) <= 600000),
  constraint beitrittsantraege_vorlage_groesse check (vorlage is null or octet_length(vorlage::text) <= 120000),
  constraint beitrittsantraege_nummern check (char_length(mitgliedsnummer) <= 40 and char_length(familiennummer) <= 40),
  constraint beitrittsantraege_texte check (char_length(notiz_intern) <= 2000 and char_length(ablehnungsgrund) <= 1000)
);
comment on table public.beitrittsantraege is
  'Mitgliedsantraege: daten = ausgefuellte Felder, vorlage = Formularstand bei Einreichung (was bestaetigt wurde), unterschriften = Unterschriften mit Zeitpunkt';
create unique index if not exists beitrittsantraege_ein_offener on public.beitrittsantraege (verein_id, user_id) where status in ('offen', 'eingereicht');
create index if not exists beitrittsantraege_verein_idx on public.beitrittsantraege (verein_id, status, erstellt_am desc);
create index if not exists beitrittsantraege_user_idx on public.beitrittsantraege (user_id);
alter table public.beitrittsantraege enable row level security;

-- Antrag fuer mich: eigener Antrag oder Antrag eines verknuepften Kindes
create or replace function public.antrag_fuer_mich(p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select auth.uid() is not null and p_user_id is not null and (
    p_user_id = auth.uid()
    or exists (select 1 from eltern_verknuepfungen ev where ev.eltern_id = auth.uid() and ev.kind_id = p_user_id and ev.status = 'bestaetigt')
    or exists (
      select 1 from eltern_kind_zuordnung ekz
      join vereins_mitglieder e on e.id = ekz.eltern_vm_id
      join vereins_mitglieder k on k.id = ekz.kind_vm_id
      where e.user_id = auth.uid() and k.user_id = p_user_id));
$function$;

drop policy if exists "Antraege sehen" on public.beitrittsantraege;
create policy "Antraege sehen" on public.beitrittsantraege for select to authenticated
  using (darf_antraege(verein_id) or antrag_fuer_mich(user_id));
-- Schreiben ausschliesslich ueber die Funktionen unten
revoke insert, update, delete, truncate on public.beitrittsantraege from anon, authenticated;
revoke all on public.beitrittsantraege from anon;
revoke all on public.antrag_vorlagen from anon;

-- Benachrichtigung an Vereinsadmins und Bereich "beitritt" (intern)
create or replace function public.antrag_verwaltung_benachrichtigen(p_verein_id uuid, p_text text)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  insert into benachrichtigungen (user_id, typ, text)
  select distinct vm.user_id, 'mitgliedsantrag', left(p_text, 500)
  from vereins_mitglieder vm
  left join rollen r on r.id = vm.rolle_id
  where vm.verein_id = p_verein_id
    and coalesce(vm.aktiv, true) and vm.aufnahme_status = 'aufgenommen'
    and (rollen_typ(r.name) = 'admin' or 'beitritt' = any(coalesce(vm.bereiche, '{}')))
    and vm.user_id is distinct from auth.uid();
$function$;

-- Person (und verknuepfte Eltern) benachrichtigen (intern)
create or replace function public.antrag_person_benachrichtigen(p_user_id uuid, p_text text)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  insert into benachrichtigungen (user_id, typ, text)
  select x.uid, 'mitgliedsantrag', left(p_text, 500)
  from (
    select p_user_id as uid
    union
    select ev.eltern_id from eltern_verknuepfungen ev where ev.kind_id = p_user_id and ev.status = 'bestaetigt'
  ) x
  where x.uid is not null;
$function$;

-- Hinzugefuegte Person als "neu" fuehren und Antrag anlegen (intern). Ohne Antragspflicht bleibt sie direkt aufgenommen.
create or replace function public.vereinsbeitritt_vorbereiten(p_vm_id uuid, p_von uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v vereins_mitglieder%rowtype;
  v_antrag uuid;
  v_name text;
begin
  select * into v from vereins_mitglieder where id = p_vm_id;
  if not found then
    return null;
  end if;
  if antrag_einstellung(v.verein_id, 'antrag_erforderlich', 'true') <> 'true' then
    return null;
  end if;
  update vereins_mitglieder set aufnahme_status = 'neu', aktiv = false, hinzugefuegt_von = coalesce(p_von, hinzugefuegt_von)
  where id = p_vm_id;

  select a.id into v_antrag from beitrittsantraege a
  where a.verein_id = v.verein_id and a.user_id = v.user_id and a.status in ('offen', 'eingereicht');
  if v_antrag is null then
    insert into beitrittsantraege (verein_id, user_id, vereins_mitglied_id, erstellt_von)
    values (v.verein_id, v.user_id, p_vm_id, p_von)
    returning id into v_antrag;
  else
    update beitrittsantraege set vereins_mitglied_id = p_vm_id where id = v_antrag;
  end if;

  if antrag_einstellung(v.verein_id, 'hinzufuegen_benachrichtigung', 'app_email') <> 'keine' then
    select name into v_name from vereine where id = v.verein_id;
    perform antrag_person_benachrichtigen(v.user_id, replace(
      antrag_einstellung(v.verein_id, 'hinzufuegen_text',
        'Der Verein {verein} hat dich als neues Mitglied hinzugefügt. Bitte fülle unter „Mitgliedsantrag“ den Antrag aus.'),
      '{verein}', coalesce(v_name, 'Verein')));
  end if;
  return v_antrag;
end;
$function$;

-- ---------------------------------------------------------------------------------------------
-- 4. Hinzufuegen, Freigabe durch den bisherigen Verein
-- ---------------------------------------------------------------------------------------------
create or replace function public.verein_person_hinzufuegen(p_verein_id uuid, p_suche text, p_rolle_id uuid default null, p_gruppe_id uuid default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_suche text := btrim(coalesce(p_suche, ''));
  v_user uuid;
  v_bisher uuid;
  v_rolle uuid;
  v_vm uuid;
  v_antrag uuid;
  v_name text;
begin
  if not darf_antraege(p_verein_id) then
    raise exception 'Personen hinzufügen dürfen Vereinsadmins und Personen mit dem Bereich „Mitgliedsanträge“.' using errcode = '42501';
  end if;
  if not verein_hat_lizenz(p_verein_id) then
    raise exception 'Personen hinzufügen ist mit der Vereinslizenz möglich.' using errcode = '42501';
  end if;
  if char_length(v_suche) < 2 or char_length(v_suche) > 200 then
    return jsonb_build_object('status', 'nicht_gefunden');
  end if;
  if position('@' in ltrim(v_suche, '@')) > 0 then
    select u.id into v_user from auth.users u where lower(u.email) = lower(v_suche);
  else
    select p.id into v_user from profiles p where lower(p.handle) = lower(ltrim(v_suche, '@'));
  end if;
  if v_user is null or exists (select 1 from profiles p where p.id = v_user and coalesce(p.gesperrt, false)) then
    return jsonb_build_object('status', 'nicht_gefunden');
  end if;

  select vm.verein_id into v_bisher from vereins_mitglieder vm where vm.user_id = v_user;
  if v_bisher = p_verein_id then
    return jsonb_build_object('status', 'schon_mitglied');
  end if;
  if p_rolle_id is not null and not exists (select 1 from rollen r where r.id = p_rolle_id) then
    raise exception 'Unbekannte Rolle.' using errcode = 'P0001';
  end if;
  v_rolle := coalesce(p_rolle_id, (select r.id from rollen r where rollen_typ(r.name) = 'mitglied' order by r.name limit 1));
  if p_gruppe_id is not null and not exists (select 1 from gruppen g where g.id = p_gruppe_id and g.verein_id = p_verein_id) then
    raise exception 'Die Gruppe gehört nicht zu diesem Verein.' using errcode = 'P0001';
  end if;
  select a.anzeige into v_name from anzeige_namen(array[v_user]) a;

  if v_bisher is not null then
    if not exists (select 1 from vereinswechsel_anfragen w where w.mitglied_user_id = v_user and w.ziel_verein_id = p_verein_id and w.status = 'offen') then
      insert into vereinswechsel_anfragen (quell_verein_id, ziel_verein_id, mitglied_user_id, vorgeschlagene_rolle_id, angefragt_von, status)
      values (v_bisher, p_verein_id, v_user, v_rolle, auth.uid(), 'offen');
      perform antrag_verwaltung_benachrichtigen(v_bisher,
        'Freigabe angefragt: Der Verein ' || (select name from vereine where id = p_verein_id) || ' möchte ' || coalesce(v_name, 'eine Person')
        || ' aufnehmen. Bitte unter „Mitgliedsanträge“ freigeben oder ablehnen.');
    end if;
    return jsonb_build_object('status', 'freigabe_angefragt', 'name', v_name);
  end if;

  insert into vereins_mitglieder (user_id, verein_id, rolle_id, hinzugefuegt_von)
  values (v_user, p_verein_id, v_rolle, auth.uid())
  returning id into v_vm;
  if p_gruppe_id is not null then
    insert into gruppen_mitglieder (gruppe_id, vereins_mitglied_id, funktion) values (p_gruppe_id, v_vm, 'mitglied') on conflict do nothing;
  end if;
  v_antrag := vereinsbeitritt_vorbereiten(v_vm, auth.uid());
  return jsonb_build_object('status', 'hinzugefuegt', 'name', v_name, 'antrag_id', v_antrag,
    'benachrichtigung', antrag_einstellung(p_verein_id, 'hinzufuegen_benachrichtigung', 'app_email'));
end;
$function$;

-- Freigabe-Anfragen nur noch ueber freigabe_entscheiden (kein direktes Schreiben, kein Selbst-Umhaengen)
drop policy if exists "Mitglied bestaetigt oder lehnt ab" on public.vereinswechsel_anfragen;
drop policy if exists "Quellverein-Admin bestaetigt oder lehnt ab" on public.vereinswechsel_anfragen;
drop policy if exists "Vereinsadmin kann Wechsel anfragen" on public.vereinswechsel_anfragen;
drop trigger if exists trg_vereinswechsel_ausfuehren on public.vereinswechsel_anfragen;
revoke insert, update, delete, truncate on public.vereinswechsel_anfragen from anon, authenticated;

create or replace function public.freigabe_entscheiden(p_anfrage_id uuid, p_freigeben boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  w vereinswechsel_anfragen%rowtype;
  v_vm uuid;
  v_antrag uuid;
  v_name text;
  v_quelle text;
begin
  select * into w from vereinswechsel_anfragen where id = p_anfrage_id for update;
  if not found or w.status <> 'offen' then
    raise exception 'Diese Anfrage ist nicht mehr offen.' using errcode = 'P0001';
  end if;
  if not is_verein_admin(w.quell_verein_id) then
    raise exception 'Nur der bisherige Verein kann die Person freigeben.' using errcode = '42501';
  end if;
  select a.anzeige into v_name from anzeige_namen(array[w.mitglied_user_id]) a;
  select name into v_quelle from vereine where id = w.quell_verein_id;

  if not p_freigeben then
    update vereinswechsel_anfragen set status = 'abgelehnt', abgelehnt_von = 'quellverein' where id = p_anfrage_id;
    perform antrag_verwaltung_benachrichtigen(w.ziel_verein_id,
      'Freigabe abgelehnt: Der bisherige Verein hat ' || coalesce(v_name, 'die Person') || ' nicht freigegeben.');
    return jsonb_build_object('status', 'abgelehnt');
  end if;

  delete from vereins_mitglieder where user_id = w.mitglied_user_id and verein_id = w.quell_verein_id;
  insert into vereins_mitglieder (user_id, verein_id, rolle_id, hinzugefuegt_von)
  values (w.mitglied_user_id, w.ziel_verein_id, w.vorgeschlagene_rolle_id, w.angefragt_von)
  returning id into v_vm;
  update vereinswechsel_anfragen set status = 'abgeschlossen', quell_verein_bestaetigt_at = now() where id = p_anfrage_id;
  -- andere offene Anfragen fuer dieselbe Person sind damit hinfaellig
  update vereinswechsel_anfragen set status = 'abgelehnt', abgelehnt_von = 'system'
  where mitglied_user_id = w.mitglied_user_id and status = 'offen' and id <> p_anfrage_id;
  v_antrag := vereinsbeitritt_vorbereiten(v_vm, w.angefragt_von);
  perform antrag_verwaltung_benachrichtigen(w.ziel_verein_id,
    'Freigabe erteilt: ' || coalesce(v_name, 'Die Person') || ' wurde vom Verein ' || coalesce(v_quelle, '') || ' freigegeben und eurem Verein hinzugefügt.');
  return jsonb_build_object('status', 'freigegeben', 'antrag_id', v_antrag, 'ziel_verein_id', w.ziel_verein_id,
    'benachrichtigung', antrag_einstellung(w.ziel_verein_id, 'hinzufuegen_benachrichtigung', 'app_email'));
end;
$function$;

-- Offene Freigabe-Anfragen eines Vereins: eingehend (wir sollen freigeben) und ausgehend (wir warten)
create or replace function public.freigabe_anfragen(p_verein_id uuid)
 returns table(id uuid, richtung text, person text, anderer_verein text, erstellt_am timestamptz)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select w.id,
    case when w.quell_verein_id = p_verein_id then 'eingehend' else 'ausgehend' end,
    (select a.anzeige from anzeige_namen(array[w.mitglied_user_id]) a),
    (select v.name from vereine v where v.id = case when w.quell_verein_id = p_verein_id then w.ziel_verein_id else w.quell_verein_id end),
    w.created_at
  from vereinswechsel_anfragen w
  where w.status = 'offen'
    and ((w.quell_verein_id = p_verein_id and is_verein_admin(p_verein_id))
      or (w.ziel_verein_id = p_verein_id and darf_antraege(p_verein_id)))
  order by w.created_at desc;
$function$;

-- Einladungslink einloesen: Person kommt als "neu" in den Verein (Antrag), bei anderer Vereinszuordnung Freigabe-Anfrage
create or replace function public.invite_einloesen(p_token uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_row einladungen%rowtype;
  v_verein_name text;
  v_existing_id uuid;
  v_bisher uuid;
  v_vm_id uuid;
  v_antrag uuid;
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
  select name into v_verein_name from vereine where id = v_row.verein_id;

  select id into v_existing_id from vereins_mitglieder where user_id = auth.uid() and verein_id = v_row.verein_id;
  if v_existing_id is not null and v_row.gruppe_id is null then
    return jsonb_build_object('success', false, 'error', 'Du bist bereits Mitglied in diesem Verein.');
  end if;

  if v_existing_id is null then
    select verein_id into v_bisher from vereins_mitglieder where user_id = auth.uid();
    if v_bisher is not null then
      if not exists (select 1 from vereinswechsel_anfragen w where w.mitglied_user_id = auth.uid() and w.ziel_verein_id = v_row.verein_id and w.status = 'offen') then
        insert into vereinswechsel_anfragen (quell_verein_id, ziel_verein_id, mitglied_user_id, vorgeschlagene_rolle_id, angefragt_von, status)
        values (v_bisher, v_row.verein_id, auth.uid(), v_row.rolle_id, v_row.created_by, 'offen');
        perform antrag_verwaltung_benachrichtigen(v_bisher,
          'Freigabe angefragt: Der Verein ' || coalesce(v_verein_name, '') || ' möchte '
          || coalesce((select a.anzeige from anzeige_namen(array[auth.uid()]) a), 'eine Person')
          || ' aufnehmen. Bitte unter „Mitgliedsanträge“ freigeben oder ablehnen.');
      end if;
      update einladungen set uses = uses + 1 where id = v_row.id;
      return jsonb_build_object('success', false, 'error',
        'Du bist noch einem anderen Verein zugeordnet. Wir haben deinen bisherigen Verein um Freigabe gebeten – danach wirst du ' ||
        coalesce(v_verein_name, 'dem neuen Verein') || ' hinzugefügt.');
    end if;
    insert into vereins_mitglieder (user_id, verein_id, rolle_id, hinzugefuegt_von)
    values (auth.uid(), v_row.verein_id, v_row.rolle_id, v_row.created_by)
    returning id into v_vm_id;
    v_antrag := vereinsbeitritt_vorbereiten(v_vm_id, v_row.created_by);
  else
    v_vm_id := v_existing_id;
  end if;
  if v_row.gruppe_id is not null then
    insert into gruppen_mitglieder (gruppe_id, vereins_mitglied_id, funktion) values (v_row.gruppe_id, v_vm_id, 'mitglied')
    on conflict do nothing;
  end if;

  update einladungen set uses = uses + 1 where id = v_row.id;
  return jsonb_build_object('success', true, 'verein_name', v_verein_name, 'verein_id', v_row.verein_id, 'antrag_id', v_antrag);
end;
$function$;

-- Beitrittsanfrage (Netzwerk) annehmen: ebenfalls ueber den Mitgliedsantrag
create or replace function public.beitritt_annehmen(p_antrag_id uuid)
 returns table(success boolean, message text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_antrag beitritts_anfragen%rowtype;
  v_rolle_id uuid;
  v_vm uuid;
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
  if exists (select 1 from vereins_mitglieder vm where vm.user_id = v_antrag.user_id and vm.verein_id <> v_antrag.verein_id) then
    return query select false, 'Diese Person ist noch einem anderen Verein zugeordnet. Der bisherige Verein muss sie zuerst freigeben.';
    return;
  end if;

  select id into v_rolle_id from rollen where name = v_antrag.gewuenschte_rolle limit 1;
  if v_rolle_id is null then
    select id into v_rolle_id from rollen where lower(name) like '%tänzer%' limit 1;
  end if;

  insert into vereins_mitglieder (user_id, verein_id, rolle_id, hinzugefuegt_von)
  values (v_antrag.user_id, v_antrag.verein_id, v_rolle_id, auth.uid())
  on conflict do nothing
  returning id into v_vm;
  if v_vm is not null then
    perform vereinsbeitritt_vorbereiten(v_vm, auth.uid());
  end if;

  update beitritts_anfragen set status = 'angenommen', entschieden_am = now() where id = p_antrag_id;
  return query select true, 'Angenommen';
end;
$function$;

-- Verein anlegen nur ohne bestehende Vereinszuordnung
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

-- ---------------------------------------------------------------------------------------------
-- 5. Antrag ausfuellen, bearbeiten, entscheiden
-- ---------------------------------------------------------------------------------------------
create or replace function public.antrag_vereinsdaten(p_verein_id uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object('id', v.id, 'name', v.name, 'logo_url', v.logo_url, 'strasse', v.strasse, 'hausnummer', v.hausnummer,
    'plz', v.plz, 'ort', v.ort, 'email', v.email, 'telefon', v.telefon, 'webseite', v.webseite, 'sepa_glaeubiger_id', v.sepa_glaeubiger_id)
  from vereine v where v.id = p_verein_id;
$function$;

-- Alles, was das Formular braucht (Antrag, Vorlage, Vereinsdaten; Vorbelegung nur fuer Antragsteller/Eltern)
create or replace function public.antrag_formular(p_antrag_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  a beitrittsantraege%rowtype;
  av antrag_vorlagen%rowtype;
  v_verwaltung boolean;
  v_person jsonb;
begin
  select * into a from beitrittsantraege where id = p_antrag_id;
  if not found then
    return null;
  end if;
  v_verwaltung := darf_antraege(a.verein_id);
  if not (v_verwaltung or antrag_fuer_mich(a.user_id)) then
    return null;
  end if;
  select * into av from antrag_vorlagen where verein_id = a.verein_id;
  if antrag_fuer_mich(a.user_id) then
    select jsonb_build_object('vorname', p.vorname, 'nachname', p.nachname, 'geburtsdatum', p.geburtsdatum, 'telefon', p.telefon,
      'email', (select u.email from auth.users u where u.id = a.user_id))
    into v_person from profiles p where p.id = a.user_id;
  end if;
  return jsonb_build_object(
    'antrag', case when v_verwaltung then to_jsonb(a) else to_jsonb(a) - 'notiz_intern' end,
    'verein', antrag_vereinsdaten(a.verein_id),
    'inhalt', coalesce(av.inhalt, '{}'::jsonb),
    'verfahren', coalesce(av.einstellungen -> 'verfahren', '["bildschirm", "papier"]'::jsonb),
    'gruppen', coalesce((select jsonb_agg(g.name order by g.name) from gruppen g where g.verein_id = a.verein_id and g.name is not null), '[]'::jsonb),
    'person', v_person,
    'person_name', (select x.anzeige from anzeige_namen(array[a.user_id]) x),
    'darf_verwalten', v_verwaltung,
    'fuer_mich', antrag_fuer_mich(a.user_id));
end;
$function$;

-- Antragsteller (oder verknuepftes Elternteil): speichern bzw. einreichen
create or replace function public.antrag_einreichen(p_antrag_id uuid, p_daten jsonb, p_verfahren text, p_unterschriften jsonb, p_einreichen boolean default true)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a beitrittsantraege%rowtype;
  v_erlaubt jsonb;
  v_name text;
begin
  select * into a from beitrittsantraege where id = p_antrag_id for update;
  if not found or not antrag_fuer_mich(a.user_id) then
    raise exception 'Antrag nicht gefunden.' using errcode = '42501';
  end if;
  if a.status <> 'offen' then
    raise exception 'Dieser Antrag wurde bereits eingereicht.' using errcode = 'P0001';
  end if;
  if p_daten is null or jsonb_typeof(p_daten) <> 'object' then
    raise exception 'Ungültige Angaben.' using errcode = 'P0001';
  end if;

  if not p_einreichen then
    update beitrittsantraege set daten = p_daten where id = p_antrag_id;
    return jsonb_build_object('status', 'offen');
  end if;

  select coalesce(av.einstellungen -> 'verfahren', '["bildschirm", "papier"]'::jsonb) into v_erlaubt from antrag_vorlagen av where av.verein_id = a.verein_id;
  v_erlaubt := coalesce(v_erlaubt, '["bildschirm", "papier"]'::jsonb);
  if p_verfahren is null or not (v_erlaubt ? p_verfahren) then
    raise exception 'Dieses Unterschriftsverfahren ist für den Verein nicht freigegeben.' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_daten ->> 'vorname'), '') = '' or coalesce(btrim(p_daten ->> 'nachname'), '') = '' then
    raise exception 'Bitte Vor- und Nachnamen angeben.' using errcode = 'P0001';
  end if;
  if p_verfahren = 'bildschirm' and coalesce(p_unterschriften -> 'mitglied' ->> 'bild', '') not like 'data:image/png;base64,%' then
    raise exception 'Bitte im Feld „Unterschrift“ unterschreiben.' using errcode = 'P0001';
  end if;
  if p_verfahren = 'bestaetigung' and coalesce(btrim(p_unterschriften -> 'mitglied' ->> 'name'), '') = '' then
    raise exception 'Bitte zur Bestätigung deinen Namen eintragen.' using errcode = 'P0001';
  end if;

  update beitrittsantraege set
    daten = p_daten,
    unterschrift_verfahren = p_verfahren,
    unterschriften = case when p_verfahren = 'papier' then '{}'::jsonb else coalesce(p_unterschriften, '{}'::jsonb) end,
    vorlage = jsonb_build_object(
      'inhalt', coalesce((select av.inhalt from antrag_vorlagen av where av.verein_id = a.verein_id), '{}'::jsonb),
      'verein', antrag_vereinsdaten(a.verein_id),
      'stand', now()),
    status = 'eingereicht',
    eingereicht_am = now(),
    eingereicht_von = auth.uid()
  where id = p_antrag_id;

  v_name := btrim(coalesce(p_daten ->> 'vorname', '') || ' ' || coalesce(p_daten ->> 'nachname', ''));
  perform antrag_verwaltung_benachrichtigen(a.verein_id, 'Neuer Mitgliedsantrag: ' || v_name
    || case when p_verfahren = 'papier' then ' (Unterschrift folgt auf Papier)' else '' end);
  return jsonb_build_object('status', 'eingereicht', 'verein_id', a.verein_id);
end;
$function$;

-- Verein: Angaben bearbeiten, Nummern, interne Notiz, Papier-Unterschrift vermerken
create or replace function public.antrag_verwaltung_speichern(p_antrag_id uuid, p_daten jsonb, p_mitgliedsnummer text, p_familiennummer text,
  p_notiz text, p_papier_vorliegend boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a beitrittsantraege%rowtype;
begin
  select * into a from beitrittsantraege where id = p_antrag_id for update;
  if not found or not darf_antraege(a.verein_id) then
    raise exception 'Antrag nicht gefunden.' using errcode = '42501';
  end if;
  if p_daten is not null and jsonb_typeof(p_daten) <> 'object' then
    raise exception 'Ungültige Angaben.' using errcode = 'P0001';
  end if;
  update beitrittsantraege set
    daten = coalesce(p_daten, daten),
    mitgliedsnummer = nullif(btrim(coalesce(p_mitgliedsnummer, '')), ''),
    familiennummer = nullif(btrim(coalesce(p_familiennummer, '')), ''),
    notiz_intern = nullif(btrim(coalesce(p_notiz, '')), ''),
    papier_vorliegend = coalesce(p_papier_vorliegend, papier_vorliegend),
    bearbeitet_am = now(),
    bearbeitet_von = auth.uid()
  where id = p_antrag_id;
end;
$function$;

-- Hochgeladene Datei (unterschriebenes Papier) am Antrag vermerken
create or replace function public.antrag_papier_setzen(p_antrag_id uuid, p_pfad text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a beitrittsantraege%rowtype;
begin
  select * into a from beitrittsantraege where id = p_antrag_id for update;
  if not found or not (darf_antraege(a.verein_id) or (antrag_fuer_mich(a.user_id) and a.status in ('offen', 'eingereicht'))) then
    raise exception 'Antrag nicht gefunden.' using errcode = '42501';
  end if;
  if p_pfad is null or p_pfad !~ ('^' || a.verein_id || '/' || a.id || '/papier-[A-Za-z0-9_.-]{1,80}$') then
    raise exception 'Ungültige Datei.' using errcode = 'P0001';
  end if;
  update beitrittsantraege set papier_datei = p_pfad, papier_vorliegend = true,
    bearbeitet_am = now(), bearbeitet_von = auth.uid()
  where id = p_antrag_id;
  if not darf_antraege(a.verein_id) then
    perform antrag_verwaltung_benachrichtigen(a.verein_id, 'Unterschriebener Mitgliedsantrag hochgeladen: '
      || coalesce(btrim(coalesce(a.daten ->> 'vorname', '') || ' ' || coalesce(a.daten ->> 'nachname', '')), 'Antrag'));
  end if;
end;
$function$;

-- Annehmen oder ablehnen (Folgen je nach Vereinseinstellung)
create or replace function public.antrag_entscheiden(p_antrag_id uuid, p_annehmen boolean, p_grund text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a beitrittsantraege%rowtype;
  v_verein text;
  v_art text;
begin
  select * into a from beitrittsantraege where id = p_antrag_id for update;
  if not found or not darf_antraege(a.verein_id) then
    raise exception 'Antrag nicht gefunden.' using errcode = '42501';
  end if;
  if a.status not in ('offen', 'eingereicht') then
    raise exception 'Über diesen Antrag wurde bereits entschieden.' using errcode = 'P0001';
  end if;
  select name into v_verein from vereine where id = a.verein_id;

  if p_annehmen then
    if a.vereins_mitglied_id is null or not exists (select 1 from vereins_mitglieder vm where vm.id = a.vereins_mitglied_id) then
      raise exception 'Die Person ist dem Verein nicht mehr zugeordnet.' using errcode = 'P0001';
    end if;
    update vereins_mitglieder set
      aufnahme_status = 'aufgenommen',
      aktiv = antrag_einstellung(a.verein_id, 'auto_freischalten', 'true') = 'true'
    where id = a.vereins_mitglied_id;
    update beitrittsantraege set status = 'angenommen', entschieden_am = now(), entschieden_von = auth.uid(), ablehnungsgrund = null
    where id = p_antrag_id;
    v_art := antrag_einstellung(a.verein_id, 'annahme_benachrichtigung', 'app_email');
    if v_art <> 'keine' then
      perform antrag_person_benachrichtigen(a.user_id, replace(
        antrag_einstellung(a.verein_id, 'annahme_text', 'Willkommen im Verein {verein}! Dein Mitgliedsantrag wurde angenommen.'),
        '{verein}', coalesce(v_verein, '')));
    end if;
  else
    delete from vereins_mitglieder where id = a.vereins_mitglied_id and aufnahme_status = 'neu';
    update beitrittsantraege set status = 'abgelehnt', entschieden_am = now(), entschieden_von = auth.uid(),
      ablehnungsgrund = nullif(btrim(coalesce(p_grund, '')), '')
    where id = p_antrag_id;
    v_art := antrag_einstellung(a.verein_id, 'ablehnung_benachrichtigung', 'app');
    if v_art <> 'keine' then
      perform antrag_person_benachrichtigen(a.user_id, replace(
        antrag_einstellung(a.verein_id, 'ablehnung_text', 'Dein Mitgliedsantrag beim Verein {verein} wurde leider nicht angenommen.'),
        '{verein}', coalesce(v_verein, '')));
    end if;
  end if;
  return jsonb_build_object('status', case when p_annehmen then 'angenommen' else 'abgelehnt' end, 'benachrichtigung', v_art,
    'aufnahme_pdf', p_annehmen and antrag_einstellung(a.verein_id, 'aufnahme_pdf_speichern', 'true') = 'true');
end;
$function$;

-- Listen
create or replace function public.antraege_liste(p_verein_id uuid)
 returns table(id uuid, status text, name text, erstellt_am timestamptz, eingereicht_am timestamptz, entschieden_am timestamptz,
   unterschrift_verfahren text, papier_vorliegend boolean, mitgliedsnummer text, minderjaehrig boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select a.id, a.status,
    coalesce(nullif(btrim(coalesce(a.daten ->> 'vorname', '') || ' ' || coalesce(a.daten ->> 'nachname', '')), ''),
      (select x.anzeige from anzeige_namen(array[a.user_id]) x), 'Unbekannt'),
    a.erstellt_am, a.eingereicht_am, a.entschieden_am, a.unterschrift_verfahren, a.papier_vorliegend, a.mitgliedsnummer,
    case when (a.daten ->> 'geburtsdatum') ~ '^\d{4}-\d{2}-\d{2}$'
      then (a.daten ->> 'geburtsdatum')::date > (now() at time zone 'Europe/Berlin')::date - interval '18 years' else null end
  from beitrittsantraege a
  where a.verein_id = p_verein_id and darf_antraege(p_verein_id)
  order by case a.status when 'eingereicht' then 0 when 'offen' then 1 else 2 end, coalesce(a.eingereicht_am, a.erstellt_am) desc;
$function$;

create or replace function public.meine_mitgliedsantraege()
 returns table(id uuid, verein_id uuid, verein_name text, status text, fuer_mich_selbst boolean, name text,
   erstellt_am timestamptz, eingereicht_am timestamptz, entschieden_am timestamptz, aufnahme_pdf boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select a.id, a.verein_id, v.name, a.status, a.user_id = auth.uid(),
    (select x.anzeige from anzeige_namen(array[a.user_id]) x),
    a.erstellt_am, a.eingereicht_am, a.entschieden_am, a.aufnahme_pdf is not null
  from beitrittsantraege a
  join vereine v on v.id = a.verein_id
  where antrag_fuer_mich(a.user_id)
  order by case a.status when 'offen' then 0 when 'eingereicht' then 1 else 2 end, a.erstellt_am desc;
$function$;

-- ---------------------------------------------------------------------------------------------
-- 6. Ablage: unterschriebene Papierantraege und Aufnahmedokumente (privat)
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mitgliedsantraege', 'mitgliedsantraege', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.antrag_datei_erlaubt(p_name text, p_schreiben boolean)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from beitrittsantraege a
    where a.verein_id::text = split_part(p_name, '/', 1)
      and a.id::text = split_part(p_name, '/', 2)
      and (darf_antraege(a.verein_id)
        or (antrag_fuer_mich(a.user_id)
            and (not p_schreiben or (a.status in ('offen', 'eingereicht') and split_part(p_name, '/', 3) like 'papier-%')))));
$function$;

drop policy if exists "Mitgliedsantraege Dateien lesen" on storage.objects;
drop policy if exists "Mitgliedsantraege Dateien hochladen" on storage.objects;
drop policy if exists "Mitgliedsantraege Dateien loeschen" on storage.objects;
create policy "Mitgliedsantraege Dateien lesen" on storage.objects for select to authenticated
  using (bucket_id = 'mitgliedsantraege' and antrag_datei_erlaubt(name, false));
create policy "Mitgliedsantraege Dateien hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'mitgliedsantraege' and antrag_datei_erlaubt(name, true));
create policy "Mitgliedsantraege Dateien loeschen" on storage.objects for delete to authenticated
  using (bucket_id = 'mitgliedsantraege' and exists (
    select 1 from beitrittsantraege a where a.id::text = split_part(name, '/', 2) and darf_antraege(a.verein_id)));

-- ---------------------------------------------------------------------------------------------
-- 7. Altbestand: ungenutzte, leere Antragstabelle mit offener Einfuege-Regel entfernen
-- ---------------------------------------------------------------------------------------------
drop function if exists public.mitgliedsantrag_annehmen(uuid);
drop table if exists public.mitgliedsantraege;

-- ---------------------------------------------------------------------------------------------
-- 8. Rechte
-- ---------------------------------------------------------------------------------------------
revoke execute on function public.pruefe_ein_verein() from public, anon, authenticated;
revoke execute on function public.antrag_vorlage_stempeln() from public, anon, authenticated;
revoke execute on function public.antrag_einstellung(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.antrag_verwaltung_benachrichtigen(uuid, text) from public, anon, authenticated;
revoke execute on function public.antrag_person_benachrichtigen(uuid, text) from public, anon, authenticated;
revoke execute on function public.vereinsbeitritt_vorbereiten(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.antrag_vereinsdaten(uuid) from public, anon, authenticated;
revoke execute on function public.antrag_datei_erlaubt(text, boolean) from public, anon;

revoke execute on function public.darf_antraege(uuid) from public, anon;
revoke execute on function public.antrag_fuer_mich(uuid) from public, anon;
revoke execute on function public.verein_person_hinzufuegen(uuid, text, uuid, uuid) from public, anon;
revoke execute on function public.freigabe_entscheiden(uuid, boolean) from public, anon;
revoke execute on function public.freigabe_anfragen(uuid) from public, anon;
revoke execute on function public.antrag_formular(uuid) from public, anon;
revoke execute on function public.antrag_einreichen(uuid, jsonb, text, jsonb, boolean) from public, anon;
revoke execute on function public.antrag_verwaltung_speichern(uuid, jsonb, text, text, text, boolean) from public, anon;
revoke execute on function public.antrag_papier_setzen(uuid, text) from public, anon;
revoke execute on function public.antrag_entscheiden(uuid, boolean, text) from public, anon;
revoke execute on function public.antraege_liste(uuid) from public, anon;
revoke execute on function public.meine_mitgliedsantraege() from public, anon;
grant execute on function public.darf_antraege(uuid), public.antrag_fuer_mich(uuid), public.verein_person_hinzufuegen(uuid, text, uuid, uuid),
  public.freigabe_entscheiden(uuid, boolean), public.freigabe_anfragen(uuid), public.antrag_formular(uuid),
  public.antrag_einreichen(uuid, jsonb, text, jsonb, boolean), public.antrag_verwaltung_speichern(uuid, jsonb, text, text, text, boolean),
  public.antrag_papier_setzen(uuid, text), public.antrag_entscheiden(uuid, boolean, text), public.antraege_liste(uuid),
  public.meine_mitgliedsantraege(), public.antrag_datei_erlaubt(text, boolean)
  to authenticated;
grant select on public.beitrittsantraege to authenticated;
grant select, insert, update on public.antrag_vorlagen to authenticated;
