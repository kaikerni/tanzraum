-- Ehrungen & Orden – Grundlage (Datenmodell, Rechte, Historie, Berechnung)
--
-- Zugriff ausschliesslich fuer Vereinsadmins des jeweiligen Vereins mit Vereinslizenz (ehrungen_berechtigt). Kein Zugriff fuer Mitglieder,
-- Trainer, Betreuer oder Eltern ohne Admin-Rolle. Der zentrale Verbandskatalog wird nur vom TanzRaum-Admin gepflegt
-- und ist fuer Vereinsadmins lesbar. Bestehende Tabellen werden nicht veraendert.
--
-- Automatische Vorschlaege sind nur "moegliche Ehrungen aufgrund der in TanzRaum hinterlegten Kriterien" –
-- kein Anspruch. Die Pruefung vor einer Bestellung liegt beim Verein (Bestaetigung wird erzwungen).

-- ---------------------------------------------------------------------------------------------
-- Hilfsfunktion: ist die angemeldete Person Admin in irgendeinem Verein?
-- ---------------------------------------------------------------------------------------------
create or replace function public.ist_irgendein_vereinsadmin()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
    where vm.user_id = auth.uid() and lower(r.name) like '%admin%');
$function$;

-- Ehrungen nur fuer Vereinsadmins von Vereinen mit Vereinslizenz (Mitglieder mit TanzRaum-Konto)
create or replace function public.ehrungen_berechtigt(p_verein_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select is_verein_admin(p_verein_id) and verein_hat_lizenz(p_verein_id);
$function$;

-- ---------------------------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------------------------
create table public.ehrungs_organisationen (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kuerzel text,
  art text not null default 'regionalverband'
    check (art in ('dachverband', 'regionalverband', 'traditionsverband', 'sonstige')),
  uebergeordnet_id uuid references public.ehrungs_organisationen(id) on delete set null,
  verband_id uuid references public.verbaende(id) on delete set null,
  beschreibung text,
  aktiv boolean not null default true,
  pruefstatus text not null default 'nicht_geprueft' check (pruefstatus in ('nicht_geprueft', 'geprueft', 'bestaetigt')),
  geprueft_am date,
  geprueft_von uuid references public.profiles(id) on delete set null,
  quelle text,
  quelle_url text,
  pruef_bemerkung text,
  naechste_pruefung date,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Welchen Organisationen gehoert ein Verein an? (bestimmt, welche Verbandsauszeichnungen vorgeschlagen werden)
create table public.verein_ehrungs_organisationen (
  verein_id uuid not null references public.vereine(id) on delete cascade,
  organisation_id uuid not null references public.ehrungs_organisationen(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (verein_id, organisation_id)
);

create table public.ehrungsarten (
  id uuid primary key default gen_random_uuid(),
  typ text not null check (typ in ('verband', 'verein')),
  organisation_id uuid references public.ehrungs_organisationen(id) on delete restrict,
  verein_id uuid references public.vereine(id) on delete cascade,
  serie text,
  name text not null,
  kurz text,
  beschreibung text,
  kategorie text,
  stufe text,
  stufe_nr integer,
  voraussetzungen text,
  regel_verknuepfung text not null default 'eine' check (regel_verknuepfung in ('eine', 'alle')),
  automatische_vorschlaege boolean not null default true,
  antrag_erforderlich boolean,
  bestellung_erforderlich boolean not null default true,
  symbol text,
  bemerkung text,
  aktiv boolean not null default true,
  pruefstatus text not null default 'nicht_geprueft' check (pruefstatus in ('nicht_geprueft', 'geprueft', 'bestaetigt')),
  geprueft_am date,
  geprueft_von uuid references public.profiles(id) on delete set null,
  quelle text,
  quelle_url text,
  pruef_bemerkung text,
  naechste_pruefung date,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  -- Verbandsauszeichnung und vereinsinterne Auszeichnung strikt getrennt
  constraint ehrungsarten_typ_zuordnung check (
    (typ = 'verband' and organisation_id is not null and verein_id is null)
    or (typ = 'verein' and verein_id is not null and organisation_id is null))
);
create index ehrungsarten_verein_idx on public.ehrungsarten (verein_id) where verein_id is not null;
create index ehrungsarten_organisation_idx on public.ehrungsarten (organisation_id) where organisation_id is not null;

create table public.ehrungs_regeln (
  id uuid primary key default gen_random_uuid(),
  ehrungsart_id uuid not null references public.ehrungsarten(id) on delete cascade,
  berechnung text not null check (berechnung in ('mitgliedschaft', 'aktiv', 'funktion', 'ehrenamt', 'punkte', 'manuell')),
  jahre numeric(5, 2) check (jahre is null or jahre > 0),
  funktion text,
  -- Punktesystem: {"aktiv": 0.5, "funktion:Vorstand": 1} = Punkte je vollendetem Jahr
  punkte_min numeric(7, 2) check (punkte_min is null or punkte_min > 0),
  punkte_gewichte jsonb,
  ununterbrochen boolean not null default false,
  bemerkung text,
  sortierung integer not null default 0,
  created_at timestamptz not null default now(),
  constraint ehrungs_regeln_werte check (
    (berechnung in ('mitgliedschaft', 'aktiv', 'ehrenamt') and jahre is not null)
    or (berechnung = 'funktion' and jahre is not null and nullif(trim(funktion), '') is not null)
    or (berechnung = 'punkte' and punkte_min is not null and jsonb_typeof(punkte_gewichte) = 'object')
    or berechnung = 'manuell')
);
create index ehrungs_regeln_art_idx on public.ehrungs_regeln (ehrungsart_id);

-- Mitglieds- und Taetigkeitszeiten (mehrere Zeitraeume je Art moeglich)
create table public.mitglied_zeitraeume (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  vereins_mitglied_id uuid not null references public.vereins_mitglieder(id) on delete cascade,
  art text not null check (art in ('mitgliedschaft', 'aktiv', 'funktion', 'ehrenamt')),
  funktion text,
  von date not null,
  bis date,
  bemerkung text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint mitglied_zeitraeume_bis check (bis is null or bis >= von),
  constraint mitglied_zeitraeume_funktion check (art <> 'funktion' or nullif(trim(funktion), '') is not null)
);
create index mitglied_zeitraeume_vm_idx on public.mitglied_zeitraeume (vereins_mitglied_id);
create index mitglied_zeitraeume_verein_idx on public.mitglied_zeitraeume (verein_id);

create table public.ehrungs_bestellungen (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  bezeichnung text not null,
  status text not null default 'vorbereitet' check (status in ('vorbereitet', 'bestellt', 'erhalten', 'storniert')),
  bestellt_am date,
  geliefert_am date,
  bestellnummer text,
  anbieter text,
  bemerkung text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index ehrungs_bestellungen_verein_idx on public.ehrungs_bestellungen (verein_id);

-- Konkreter Ehrungsvorgang (Auszeichnung != Verleihung)
create table public.mitglied_ehrungen (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  vereins_mitglied_id uuid references public.vereins_mitglieder(id) on delete set null,
  person_name text not null default '',
  ehrungsart_id uuid not null references public.ehrungsarten(id) on delete restrict,
  herkunft text not null default 'manuell_angelegt' check (herkunft in ('automatisch', 'manuell_geaendert', 'manuell_angelegt')),
  -- urspruengliche automatische Berechnung (bleibt bei manuellen Aenderungen erhalten)
  auto_ehrungsart_id uuid references public.ehrungsarten(id) on delete set null,
  auto_faellig_am date,
  auto_grundlage jsonb,
  -- aktueller Stand dieses Vorgangs
  faellig_am date,
  faellig_jahr integer,
  grundlage jsonb,
  grundlage_text text,
  korrektur jsonb,
  status text not null default 'moeglich' check (status in
    ('moeglich', 'geprueft', 'vorgemerkt', 'bestellt', 'erhalten', 'eingeplant', 'verliehen', 'nicht_vorgesehen', 'abgelehnt')),
  begruendung text,
  interne_notiz text,
  wunsch_datum date,
  anlass text,
  veranstaltung text,
  bestellung_id uuid references public.ehrungs_bestellungen(id) on delete set null,
  bestellung_geprueft_am timestamptz,
  bestellung_geprueft_von uuid references public.profiles(id) on delete set null,
  bestellt_am date,
  erhalten_am date,
  eingeplant_am date,
  verliehen_am date,
  verliehen_durch text,
  verleihung_bemerkung text,
  snapshot jsonb,
  -- nur fuer die Historie: wird beim Speichern uebernommen und geleert
  aenderungs_begruendung text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint mitglied_ehrungen_verliehen check (status <> 'verliehen' or verliehen_am is not null)
);
create unique index mitglied_ehrungen_auto_eindeutig on public.mitglied_ehrungen (vereins_mitglied_id, auto_ehrungsart_id)
  where auto_ehrungsart_id is not null;
create index mitglied_ehrungen_verein_idx on public.mitglied_ehrungen (verein_id, status);
create index mitglied_ehrungen_vm_idx on public.mitglied_ehrungen (vereins_mitglied_id);

create table public.ehrungs_historie (
  id bigint generated always as identity primary key,
  verein_id uuid not null references public.vereine(id) on delete cascade,
  mitglied_ehrung_id uuid not null references public.mitglied_ehrungen(id) on delete cascade deferrable initially deferred,
  aktion text not null,
  alt jsonb,
  neu jsonb,
  begruendung text,
  von uuid default auth.uid(),
  am timestamptz not null default now()
);
create index ehrungs_historie_vorgang_idx on public.ehrungs_historie (mitglied_ehrung_id, am);

-- ---------------------------------------------------------------------------------------------
-- Trigger: Stammdaten-Zeitstempel, Vereinszugehoerigkeit, Schutz verliehener Ehrungen, Historie
-- ---------------------------------------------------------------------------------------------
create or replace function public.ehrungen_zeitstempel()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$function$;

create trigger ehrungs_organisationen_zeitstempel before update on public.ehrungs_organisationen
  for each row execute function public.ehrungen_zeitstempel();
create trigger ehrungsarten_zeitstempel before update on public.ehrungsarten
  for each row execute function public.ehrungen_zeitstempel();
create trigger mitglied_zeitraeume_zeitstempel before update on public.mitglied_zeitraeume
  for each row execute function public.ehrungen_zeitstempel();
create trigger ehrungs_bestellungen_zeitstempel before update on public.ehrungs_bestellungen
  for each row execute function public.ehrungen_zeitstempel();

-- Zeitraeume: Mitglied muss zum Verein gehoeren
create or replace function public.mitglied_zeitraeume_pruefen()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from vereins_mitglieder vm where vm.id = new.vereins_mitglied_id and vm.verein_id = new.verein_id) then
    raise exception 'Das Mitglied gehört nicht zu diesem Verein.' using errcode = 'P0001';
  end if;
  return new;
end;
$function$;
create trigger mitglied_zeitraeume_pruefen before insert or update on public.mitglied_zeitraeume
  for each row execute function public.mitglied_zeitraeume_pruefen();

-- Regeln: Verbandsregeln nur durch TanzRaum-Admin (RLS), hier zusaetzlich keine Regeln an fremden Vereinsauszeichnungen
create or replace function public.mitglied_ehrungen_pruefen()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a ehrungsarten%rowtype;
  v_felder text[] := array['ehrungsart_id', 'status', 'faellig_am', 'faellig_jahr', 'grundlage_text', 'korrektur', 'herkunft',
                           'wunsch_datum', 'anlass', 'veranstaltung', 'bestellung_id', 'bestellt_am', 'erhalten_am', 'eingeplant_am',
                           'verliehen_am', 'verliehen_durch', 'interne_notiz', 'begruendung'];
  v_alt jsonb := '{}';
  v_neu jsonb := '{}';
  f text;
  v_aktion text;
begin
  if tg_op = 'DELETE' then
    if old.status = 'verliehen' then
      raise exception 'Verliehene Ehrungen bleiben dauerhaft in der Historie und können nicht gelöscht werden.' using errcode = 'P0001';
    end if;
    return old;
  end if;

  select * into a from ehrungsarten where id = new.ehrungsart_id;
  if a.typ = 'verein' and a.verein_id <> new.verein_id then
    raise exception 'Diese Auszeichnung gehört zu einem anderen Verein.' using errcode = 'P0001';
  end if;
  if new.vereins_mitglied_id is not null
     and not exists (select 1 from vereins_mitglieder vm where vm.id = new.vereins_mitglied_id and vm.verein_id = new.verein_id) then
    raise exception 'Das Mitglied gehört nicht zu diesem Verein.' using errcode = 'P0001';
  end if;
  if new.vereins_mitglied_id is not null and (tg_op = 'INSERT' or new.vereins_mitglied_id is distinct from old.vereins_mitglied_id) then
    new.person_name := coalesce((select an.anzeige from vereins_mitglieder vm cross join lateral anzeige_namen(array[vm.user_id]) an
                                 where vm.id = new.vereins_mitglied_id), new.person_name);
  end if;
  if new.faellig_am is not null then new.faellig_jahr := extract(year from new.faellig_am)::int; end if;

  if tg_op = 'UPDATE' then
    -- Verliehene Ehrungen: nur Notizen/Bemerkungen duerfen noch ergaenzt werden
    if old.status = 'verliehen' and (
         new.status is distinct from old.status or new.ehrungsart_id is distinct from old.ehrungsart_id
         or new.verliehen_am is distinct from old.verliehen_am or new.snapshot is distinct from old.snapshot
         or new.vereins_mitglied_id is distinct from old.vereins_mitglied_id and new.vereins_mitglied_id is not null
         or new.verein_id is distinct from old.verein_id) then
      raise exception 'Diese Ehrung ist bereits verliehen und kann nicht mehr verändert werden.' using errcode = 'P0001';
    end if;
    -- Bestellung nur nach ausdruecklicher Pruefbestaetigung
    if new.status = 'bestellt' and old.status <> 'bestellt' and new.bestellung_geprueft_am is null then
      raise exception 'Bitte bestätigen Sie vor der Bestellung, dass Sie die Angaben geprüft haben.' using errcode = 'P0001';
    end if;
    new.updated_at := now();
    new.updated_by := auth.uid();
  elsif new.status = 'bestellt' and new.bestellung_geprueft_am is null then
    raise exception 'Bitte bestätigen Sie vor der Bestellung, dass Sie die Angaben geprüft haben.' using errcode = 'P0001';
  end if;

  -- Snapshot bei der Verleihung: damaliger Stand der Auszeichnung bleibt nachvollziehbar
  if new.status = 'verliehen' and (tg_op = 'INSERT' or old.status <> 'verliehen') then
    if new.verliehen_am > (now() at time zone 'Europe/Berlin')::date then
      raise exception 'Das Verleihungsdatum liegt in der Zukunft. Planen Sie die Verleihung mit dem Status „Eingeplant“.' using errcode = 'P0001';
    end if;
    new.snapshot := jsonb_build_object(
      'auszeichnung', a.name, 'serie', a.serie, 'stufe', a.stufe, 'kategorie', a.kategorie, 'typ', a.typ,
      'organisation', (select o.name from ehrungs_organisationen o where o.id = a.organisation_id),
      'person', new.person_name, 'grund', coalesce(new.grundlage_text, new.begruendung), 'grundlage', new.grundlage,
      'verliehen_am', new.verliehen_am, 'verliehen_durch', new.verliehen_durch, 'erfasst_von', auth.uid(), 'erfasst_am', now());
  end if;

  -- Historie
  if tg_op = 'INSERT' then
    v_aktion := case new.herkunft when 'automatisch' then 'automatisch_erkannt' else 'manuell_angelegt' end;
    v_neu := jsonb_build_object('ehrungsart', a.name, 'status', new.status, 'faellig_am', new.faellig_am, 'grund', new.grundlage_text);
  else
    foreach f in array v_felder loop
      if (to_jsonb(old) -> f) is distinct from (to_jsonb(new) -> f) then
        v_alt := v_alt || jsonb_build_object(f, to_jsonb(old) -> f);
        v_neu := v_neu || jsonb_build_object(f, to_jsonb(new) -> f);
      end if;
    end loop;
    if v_neu = '{}'::jsonb and new.aenderungs_begruendung is null then
      return new;
    end if;
    if v_neu ? 'ehrungsart_id' then
      v_alt := v_alt || jsonb_build_object('ehrungsart', (select x.name from ehrungsarten x where x.id = old.ehrungsart_id));
      v_neu := v_neu || jsonb_build_object('ehrungsart', a.name);
    end if;
    v_aktion := case
      when v_neu ? 'status' then 'status'
      when v_neu ? 'ehrungsart_id' or v_neu ? 'faellig_am' or v_neu ? 'korrektur' or v_neu ? 'herkunft' then 'geaendert'
      else 'bearbeitet' end;
  end if;
  insert into ehrungs_historie (verein_id, mitglied_ehrung_id, aktion, alt, neu, begruendung)
  values (new.verein_id, new.id, v_aktion, nullif(v_alt, '{}'::jsonb), nullif(v_neu, '{}'::jsonb), nullif(trim(new.aenderungs_begruendung), ''));
  new.aenderungs_begruendung := null;
  return new;
end;
$function$;
create trigger mitglied_ehrungen_pruefen before insert or update or delete on public.mitglied_ehrungen
  for each row execute function public.mitglied_ehrungen_pruefen();

-- ---------------------------------------------------------------------------------------------
-- Berechnung
-- ---------------------------------------------------------------------------------------------
-- Dauer einer Taetigkeitsart bis zu einem Stichtag (ueberlappende Zeitraeume werden zusammengefasst).
-- p_korrektur_von: abweichender Beginn nur fuer einen konkreten Ehrungsvorgang (Stammdaten bleiben unveraendert).
create or replace function public.ehrung_dauer(p_vm uuid, p_art text, p_funktion text, p_ununterbrochen boolean,
                                               p_korrektur_von date, p_stichtag date)
 returns interval
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  v_mr datemultirange;
  v_min date;
  r daterange;
  v_summe interval;
  v_monate integer := 0;
  v_tage integer := 0;
begin
  select range_agg(daterange(z.von, case when z.bis is null then null else z.bis + 1 end, '[)')), min(z.von)
    into v_mr, v_min
  from mitglied_zeitraeume z
  where z.vereins_mitglied_id = p_vm and z.art = p_art
    and (p_art <> 'funktion' or lower(trim(z.funktion)) = lower(trim(p_funktion)));
  if v_mr is null then return interval '0'; end if;
  if p_korrektur_von is not null then
    if p_korrektur_von < v_min then
      v_mr := v_mr + datemultirange(daterange(p_korrektur_von, v_min, '[)'));
    else
      v_mr := v_mr * datemultirange(daterange(p_korrektur_von, null, '[)'));
    end if;
  end if;
  v_mr := v_mr * datemultirange(daterange(null, p_stichtag, '[)'));
  if p_ununterbrochen then
    -- nur der Zeitraum, der bis zum Stichtag reicht
    select x into r from unnest(v_mr) x where upper(x) = p_stichtag order by lower(x) desc limit 1;
    if r is null then return interval '0'; end if;
    return age(upper(r), lower(r));
  end if;
  -- Monate und Tage getrennt summieren (kein pauschales Aufrunden von 30 Tagen auf einen Monat)
  for r in select x from unnest(v_mr) x loop
    v_summe := age(upper(r), lower(r));
    v_monate := v_monate + (extract(year from v_summe) * 12 + extract(month from v_summe))::int;
    v_tage := v_tage + extract(day from v_summe)::int;
  end loop;
  return make_interval(months => v_monate + v_tage / 31, days => v_tage % 31);
end;
$function$;

-- Punkte bis zum Stichtag: Summe(vollendete Jahre je Kriterium * Gewicht)
create or replace function public.ehrung_punkte(p_vm uuid, p_gewichte jsonb, p_korrektur_von date, p_stichtag date)
 returns numeric
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  k text;
  g numeric;
  v_summe numeric := 0;
  v_art text;
  v_funktion text;
begin
  for k, g in select key, value::numeric from jsonb_each_text(p_gewichte) loop
    if k like 'funktion:%' then v_art := 'funktion'; v_funktion := substr(k, 10); else v_art := k; v_funktion := null; end if;
    if v_art not in ('mitgliedschaft', 'aktiv', 'funktion', 'ehrenamt') then continue; end if;
    v_summe := v_summe + g * extract(year from ehrung_dauer(p_vm, v_art, v_funktion, false, p_korrektur_von, p_stichtag));
  end loop;
  return v_summe;
end;
$function$;

create or replace function public.ehrung_regel_erfuellt(p_vm uuid, p_regel ehrungs_regeln, p_korrektur_von date, p_stichtag date)
 returns boolean
 language sql
 stable
 set search_path to 'public'
as $function$
  select case p_regel.berechnung
    when 'punkte' then ehrung_punkte(p_vm, p_regel.punkte_gewichte, p_korrektur_von, p_stichtag) >= p_regel.punkte_min
    when 'manuell' then false
    -- exakter Vergleich in Monaten (Tage nur als Bruchteil, damit z. B. 9 J. 11 M. 30 T. < 10 J.)
    else (select extract(year from d) * 12 + extract(month from d) + extract(day from d) / 31.0
          from (select ehrung_dauer(p_vm, p_regel.berechnung, p_regel.funktion, p_regel.ununterbrochen, p_korrektur_von, p_stichtag) as d) x)
         >= round(p_regel.jahre * 12)
  end;
$function$;

-- Fruehester Tag, an dem die Regel erfuellt ist (Binaersuche, Werte steigen mit der Zeit nur an).
-- null = mit den hinterlegten Daten nicht erreichbar (z. B. Taetigkeit beendet) oder manuelle Regel.
create or replace function public.ehrung_regel_faellig(p_vm uuid, p_regel ehrungs_regeln, p_korrektur_von date)
 returns date
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  v_lo date;
  v_hi date := (now() at time zone 'Europe/Berlin')::date + interval '60 years';
  v_mid date;
begin
  if p_regel.berechnung = 'manuell' then return null; end if;
  select least(min(z.von), p_korrektur_von) into v_lo from mitglied_zeitraeume z where z.vereins_mitglied_id = p_vm;
  if v_lo is null then return null; end if;
  if not ehrung_regel_erfuellt(p_vm, p_regel, p_korrektur_von, v_hi) then return null; end if;
  while v_lo < v_hi loop
    v_mid := v_lo + ((v_hi - v_lo) / 2);
    if ehrung_regel_erfuellt(p_vm, p_regel, p_korrektur_von, v_mid) then v_hi := v_mid; else v_lo := v_mid + 1; end if;
  end loop;
  return v_hi;
end;
$function$;

-- Nachvollziehbare Berechnung einer Auszeichnung fuer ein Mitglied
create or replace function public.ehrung_berechnen(p_vm uuid, p_ehrungsart_id uuid, p_korrektur_von date default null)
 returns jsonb
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  a ehrungsarten%rowtype;
  r ehrungs_regeln%rowtype;
  v_regeln jsonb := '[]';
  v_faellig date;
  v_gesamt date;
  v_alle_da boolean := true;
  v_auto boolean := false;
  v_beginn date;
begin
  select * into a from ehrungsarten where id = p_ehrungsart_id;
  for r in select * from ehrungs_regeln where ehrungsart_id = p_ehrungsart_id order by sortierung, created_at loop
    if r.berechnung = 'manuell' then
      v_regeln := v_regeln || jsonb_build_array(jsonb_build_object('berechnung', 'manuell', 'bemerkung', r.bemerkung));
      continue;
    end if;
    v_auto := true;
    v_faellig := ehrung_regel_faellig(p_vm, r, p_korrektur_von);
    select min(z.von) into v_beginn from mitglied_zeitraeume z
      where z.vereins_mitglied_id = p_vm
        and (r.berechnung = 'punkte' or (z.art = r.berechnung
             and (r.berechnung <> 'funktion' or lower(trim(z.funktion)) = lower(trim(r.funktion)))));
    v_regeln := v_regeln || jsonb_build_array(jsonb_build_object(
      'berechnung', r.berechnung, 'jahre', r.jahre, 'funktion', r.funktion, 'punkte_min', r.punkte_min,
      'punkte_gewichte', r.punkte_gewichte, 'ununterbrochen', r.ununterbrochen,
      'beginn', case when p_korrektur_von is not null then least(p_korrektur_von, v_beginn) else v_beginn end,
      'korrektur_von', p_korrektur_von, 'faellig_am', v_faellig));
    if v_faellig is null then
      v_alle_da := false;
    elsif a.regel_verknuepfung = 'alle' then
      v_gesamt := greatest(v_gesamt, v_faellig);
    else
      v_gesamt := least(v_gesamt, v_faellig);
    end if;
  end loop;
  if a.regel_verknuepfung = 'alle' and not v_alle_da then v_gesamt := null; end if;
  if not v_auto then v_gesamt := null; end if;
  return jsonb_build_object('verknuepfung', a.regel_verknuepfung, 'regeln', v_regeln, 'faellig_am', v_gesamt,
                            'berechnet_am', (now() at time zone 'Europe/Berlin')::date);
end;
$function$;

-- Moegliche Ehrungen eines Vereins (nur Vereinsadmin). Je Serie: hoechste bereits erreichte Stufe und naechste Stufe
-- innerhalb des Horizonts; Auszeichnungen mit bestehendem Vorgang werden nicht erneut vorgeschlagen.
create or replace function public.ehrungs_vorschlaege(p_verein_id uuid, p_horizont_monate integer default 24)
 returns table(vereins_mitglied_id uuid, ehrungsart_id uuid, faellig_am date, grundlage jsonb)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  if not ehrungen_berechtigt(p_verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  return query
  with arten as (
    select ea.* from ehrungsarten ea
    where ea.aktiv and ea.automatische_vorschlaege
      and ((ea.typ = 'verein' and ea.verein_id = p_verein_id)
        or (ea.typ = 'verband' and exists (select 1 from verein_ehrungs_organisationen vo
                                           join ehrungs_organisationen o on o.id = vo.organisation_id and o.aktiv
                                           where vo.verein_id = p_verein_id and vo.organisation_id = ea.organisation_id)))
      and exists (select 1 from ehrungs_regeln rg where rg.ehrungsart_id = ea.id and rg.berechnung <> 'manuell')
  ),
  berechnet as (
    select vm.id as vm_id, ar.id as art_id, coalesce(ar.serie, ar.id::text) as serie_schluessel,
           coalesce(ar.stufe_nr, 0) as stufe_nr, ehrung_berechnen(vm.id, ar.id) as g
    from vereins_mitglieder vm cross join arten ar
    where vm.verein_id = p_verein_id and coalesce(vm.aktiv, true)
      and exists (select 1 from mitglied_zeitraeume z where z.vereins_mitglied_id = vm.id)
  ),
  kandidaten as (
    select b.*, (b.g ->> 'faellig_am')::date as faellig
    from berechnet b
    where b.g ->> 'faellig_am' is not null
      and (b.g ->> 'faellig_am')::date <= v_heute + make_interval(months => p_horizont_monate)
      and not exists (select 1 from mitglied_ehrungen me
                      where me.vereins_mitglied_id = b.vm_id
                        and (me.ehrungsart_id = b.art_id or me.auto_ehrungsart_id = b.art_id))
  ),
  bewertet as (
    select k.*,
           row_number() over (partition by k.vm_id, k.serie_schluessel, (k.faellig <= v_heute) order by
             case when k.faellig <= v_heute then -k.stufe_nr else k.stufe_nr end, k.faellig) as rang
    from kandidaten k
  )
  select bw.vm_id, bw.art_id, bw.faellig, bw.g
  from bewertet bw
  where bw.rang = 1
    -- keine niedrigere Stufe vorschlagen, wenn eine hoehere Stufe derselben Serie bereits vergeben/erfasst ist
    and not exists (
      select 1 from mitglied_ehrungen me join ehrungsarten x on x.id = me.ehrungsart_id
      where me.vereins_mitglied_id = bw.vm_id and me.status not in ('nicht_vorgesehen', 'abgelehnt')
        and coalesce(x.serie, x.id::text) = bw.serie_schluessel and coalesce(x.stufe_nr, 0) >= bw.stufe_nr);
end;
$function$;

-- Vorschlaege als Vorgaenge uebernehmen bzw. unveraenderte automatische Vorgaenge aktualisieren.
create or replace function public.ehrungen_aktualisieren(p_verein_id uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_neu integer := 0;
  v record;
begin
  if not ehrungen_berechtigt(p_verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  -- unveraenderte automatische Vorschlaege an geaenderte Stammdaten anpassen
  for v in select me.id, me.vereins_mitglied_id, me.ehrungsart_id from mitglied_ehrungen me
           where me.verein_id = p_verein_id and me.herkunft = 'automatisch' and me.status = 'moeglich'
             and me.vereins_mitglied_id is not null loop
    update mitglied_ehrungen me set
      auto_grundlage = x.g, grundlage = x.g, auto_faellig_am = (x.g ->> 'faellig_am')::date, faellig_am = (x.g ->> 'faellig_am')::date,
      aenderungs_begruendung = 'Automatisch neu berechnet (Mitglieds- oder Tätigkeitszeiten geändert)'
    from (select ehrung_berechnen(v.vereins_mitglied_id, v.ehrungsart_id) as g) x
    where me.id = v.id and me.faellig_am is distinct from (x.g ->> 'faellig_am')::date;
  end loop;
  insert into mitglied_ehrungen (verein_id, vereins_mitglied_id, ehrungsart_id, herkunft, auto_ehrungsart_id, auto_faellig_am,
                                 auto_grundlage, faellig_am, grundlage, status)
  select p_verein_id, s.vereins_mitglied_id, s.ehrungsart_id, 'automatisch', s.ehrungsart_id, s.faellig_am, s.grundlage,
         s.faellig_am, s.grundlage, 'moeglich'
  from ehrungs_vorschlaege(p_verein_id) s
  on conflict do nothing;
  get diagnostics v_neu = row_count;
  return v_neu;
end;
$function$;

-- Vorgang mit Korrektur (abweichender Beginn) neu berechnen – Stammdaten bleiben unveraendert
create or replace function public.ehrung_neu_berechnen(p_id uuid, p_korrektur_von date, p_begruendung text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  me mitglied_ehrungen%rowtype;
  v_g jsonb;
begin
  select * into me from mitglied_ehrungen where id = p_id;
  if me.id is null or not ehrungen_berechtigt(me.verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if me.vereins_mitglied_id is null then
    raise exception 'Für diesen Vorgang ist kein Mitglied mehr hinterlegt.' using errcode = 'P0001';
  end if;
  v_g := ehrung_berechnen(me.vereins_mitglied_id, me.ehrungsart_id, p_korrektur_von);
  update mitglied_ehrungen set
    korrektur = case when p_korrektur_von is null then null else jsonb_build_object('beginn', p_korrektur_von) end,
    grundlage = v_g, faellig_am = (v_g ->> 'faellig_am')::date,
    herkunft = case when herkunft = 'manuell_angelegt' then herkunft else 'manuell_geaendert' end,
    aenderungs_begruendung = p_begruendung
  where id = p_id;
end;
$function$;

-- Auf die urspruengliche automatische Berechnung zuruecksetzen (Aenderungen bleiben in der Historie)
create or replace function public.ehrung_zuruecksetzen(p_id uuid, p_begruendung text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  me mitglied_ehrungen%rowtype;
begin
  select * into me from mitglied_ehrungen where id = p_id;
  if me.id is null or not ehrungen_berechtigt(me.verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if me.auto_ehrungsart_id is null then
    raise exception 'Für diesen Vorgang gibt es keine automatische Berechnung.' using errcode = 'P0001';
  end if;
  update mitglied_ehrungen set
    ehrungsart_id = auto_ehrungsart_id, faellig_am = auto_faellig_am, grundlage = auto_grundlage,
    grundlage_text = null, korrektur = null, herkunft = 'automatisch',
    aenderungs_begruendung = coalesce(nullif(trim(p_begruendung), ''), 'Auf automatische Berechnung zurückgesetzt')
  where id = p_id;
end;
$function$;

-- ---------------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------------
alter table public.ehrungs_organisationen enable row level security;
alter table public.verein_ehrungs_organisationen enable row level security;
alter table public.ehrungsarten enable row level security;
alter table public.ehrungs_regeln enable row level security;
alter table public.mitglied_zeitraeume enable row level security;
alter table public.ehrungs_bestellungen enable row level security;
alter table public.mitglied_ehrungen enable row level security;
alter table public.ehrungs_historie enable row level security;

create policy "Ehrungen: Organisationen lesen" on public.ehrungs_organisationen for select to authenticated
  using (ist_plattform_admin_aktuell() or ist_irgendein_vereinsadmin());
create policy "Ehrungen: Organisationen pflegen (TanzRaum-Admin)" on public.ehrungs_organisationen for all to authenticated
  using (ist_plattform_admin_aktuell()) with check (ist_plattform_admin_aktuell());

create policy "Ehrungen: Vereinsorganisationen (Vereinsadmin)" on public.verein_ehrungs_organisationen for all to authenticated
  using (ehrungen_berechtigt(verein_id)) with check (ehrungen_berechtigt(verein_id));

create policy "Ehrungen: Auszeichnungen lesen" on public.ehrungsarten for select to authenticated
  using ((typ = 'verband' and (ist_plattform_admin_aktuell() or ist_irgendein_vereinsadmin()))
      or (typ = 'verein' and ehrungen_berechtigt(verein_id)));
create policy "Ehrungen: Auszeichnungen pflegen" on public.ehrungsarten for all to authenticated
  using ((typ = 'verband' and ist_plattform_admin_aktuell()) or (typ = 'verein' and ehrungen_berechtigt(verein_id)))
  with check ((typ = 'verband' and ist_plattform_admin_aktuell()) or (typ = 'verein' and ehrungen_berechtigt(verein_id)));

create policy "Ehrungen: Regeln lesen" on public.ehrungs_regeln for select to authenticated
  using (exists (select 1 from ehrungsarten a where a.id = ehrungs_regeln.ehrungsart_id));
create policy "Ehrungen: Regeln pflegen" on public.ehrungs_regeln for all to authenticated
  using (exists (select 1 from ehrungsarten a where a.id = ehrungs_regeln.ehrungsart_id
                 and ((a.typ = 'verband' and ist_plattform_admin_aktuell()) or (a.typ = 'verein' and ehrungen_berechtigt(a.verein_id)))))
  with check (exists (select 1 from ehrungsarten a where a.id = ehrungs_regeln.ehrungsart_id
                 and ((a.typ = 'verband' and ist_plattform_admin_aktuell()) or (a.typ = 'verein' and ehrungen_berechtigt(a.verein_id)))));

create policy "Ehrungen: Zeitraeume (Vereinsadmin)" on public.mitglied_zeitraeume for all to authenticated
  using (ehrungen_berechtigt(verein_id)) with check (ehrungen_berechtigt(verein_id));
create policy "Ehrungen: Bestellungen (Vereinsadmin)" on public.ehrungs_bestellungen for all to authenticated
  using (ehrungen_berechtigt(verein_id)) with check (ehrungen_berechtigt(verein_id));
create policy "Ehrungen: Vorgaenge (Vereinsadmin)" on public.mitglied_ehrungen for all to authenticated
  using (ehrungen_berechtigt(verein_id)) with check (ehrungen_berechtigt(verein_id));
create policy "Ehrungen: Historie lesen (Vereinsadmin)" on public.ehrungs_historie for select to authenticated
  using (ehrungen_berechtigt(verein_id));

-- ---------------------------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------------------------
revoke all on table public.ehrungs_organisationen, public.verein_ehrungs_organisationen, public.ehrungsarten,
  public.ehrungs_regeln, public.mitglied_zeitraeume, public.ehrungs_bestellungen, public.mitglied_ehrungen,
  public.ehrungs_historie from public, anon, authenticated;
grant select, insert, update, delete on table public.ehrungs_organisationen, public.verein_ehrungs_organisationen,
  public.ehrungsarten, public.ehrungs_regeln, public.mitglied_zeitraeume, public.ehrungs_bestellungen,
  public.mitglied_ehrungen to authenticated;
grant select on table public.ehrungs_historie to authenticated;
grant all on table public.ehrungs_organisationen, public.verein_ehrungs_organisationen, public.ehrungsarten,
  public.ehrungs_regeln, public.mitglied_zeitraeume, public.ehrungs_bestellungen, public.mitglied_ehrungen,
  public.ehrungs_historie to service_role;

revoke all on function public.ist_irgendein_vereinsadmin() from public, anon;
revoke all on function public.ehrungen_berechtigt(uuid) from public, anon;
grant execute on function public.ehrungen_berechtigt(uuid) to authenticated, service_role;
grant execute on function public.ist_irgendein_vereinsadmin() to authenticated, service_role;
revoke all on function public.ehrungen_zeitstempel() from public, anon, authenticated;
revoke all on function public.mitglied_zeitraeume_pruefen() from public, anon, authenticated;
revoke all on function public.mitglied_ehrungen_pruefen() from public, anon, authenticated;
-- Berechnungsfunktionen nur intern (ueber die Admin-Funktionen) nutzbar
revoke all on function public.ehrung_dauer(uuid, text, text, boolean, date, date) from public, anon, authenticated;
revoke all on function public.ehrung_punkte(uuid, jsonb, date, date) from public, anon, authenticated;
revoke all on function public.ehrung_regel_erfuellt(uuid, ehrungs_regeln, date, date) from public, anon, authenticated;
revoke all on function public.ehrung_regel_faellig(uuid, ehrungs_regeln, date) from public, anon, authenticated;
revoke all on function public.ehrung_berechnen(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.ehrung_dauer(uuid, text, text, boolean, date, date), public.ehrung_punkte(uuid, jsonb, date, date),
  public.ehrung_regel_erfuellt(uuid, ehrungs_regeln, date, date), public.ehrung_regel_faellig(uuid, ehrungs_regeln, date),
  public.ehrung_berechnen(uuid, uuid, date) to service_role;
revoke all on function public.ehrungs_vorschlaege(uuid, integer) from public, anon;
revoke all on function public.ehrungen_aktualisieren(uuid) from public, anon;
revoke all on function public.ehrung_neu_berechnen(uuid, date, text) from public, anon;
revoke all on function public.ehrung_zuruecksetzen(uuid, text) from public, anon;
grant execute on function public.ehrungs_vorschlaege(uuid, integer), public.ehrungen_aktualisieren(uuid),
  public.ehrung_neu_berechnen(uuid, date, text), public.ehrung_zuruecksetzen(uuid, text) to authenticated, service_role;
