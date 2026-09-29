-- Rechnungen als vollstaendige PDF-Rechnung (Logo, Aussteller, Empfaenger, Leistungszeitraum)
-- - leistung_von/leistung_bis: Leistungszeitraum (Pflichtangabe), bei Stripe/PayPal aus dem Abrechnungszeitraum
-- - aussteller: Stand der Anbieterangaben bei Erstellung (spaetere Adressaenderungen aendern alte Rechnungen nicht)
-- - Rechnungsnummer fortlaufend je Jahr: TR-<Jahr>-0001 (neues Jahr beginnt wieder bei 0001)
-- Alles bleibt waehrend der Aufbewahrungsfrist unveraenderlich (rechnung_unveraenderlich).

alter table public.rechnungen
  add column if not exists leistung_von date,
  add column if not exists leistung_bis date,
  add column if not exists aussteller jsonb;

alter table public.rechnungs_einstellungen add column if not exists nummer_jahr int;
update public.rechnungs_einstellungen set nummer_jahr = 2026 where nummer_jahr is null;
update public.rechnungs_einstellungen set nummer_praefix = 'TR-' where nummer_praefix = 'TR-2026-';
alter table public.rechnungs_einstellungen alter column nummer_praefix set default 'TR-';

-- Anbieterangaben zum Zeitpunkt der Rechnung
create or replace function public.rechnung_aussteller_stand()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'name', a.name, 'unternehmen', a.unternehmen, 'strasse', a.strasse, 'plz', a.plz, 'ort', a.ort, 'land', a.land,
    'email', a.email, 'telefon', a.telefon, 'steuernummer', a.steuernummer, 'ust_id', a.ust_id,
    'kleinunternehmer', a.kleinunternehmer, 'kleinunternehmer_hinweis', a.kleinunternehmer_hinweis
  )
  from plattform_anbieter a where a.id = true;
$$;
revoke all on function public.rechnung_aussteller_stand() from public, anon, authenticated;

-- Bestand nachtragen (vor der erweiterten Unveraenderlichkeit)
update public.rechnungen
   set leistung_von = rechnungsdatum,
       leistung_bis = (rechnungsdatum + case zeitraum when 'jahr' then interval '1 year' else interval '1 month' end - interval '1 day')::date
 where leistung_von is null;
update public.rechnungen set aussteller = public.rechnung_aussteller_stand() where aussteller is null;

-- Fortlaufende Nummer je Jahr (Zeile gesperrt durch UPDATE -> keine doppelten Nummern)
create or replace function public.naechste_rechnungsnummer()
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_jahr int := extract(year from (now() at time zone 'Europe/Berlin'))::int;
  v_praefix text;
  v_nr int;
begin
  update rechnungs_einstellungen
     set naechste_nummer = case when nummer_jahr = v_jahr then naechste_nummer + 1 else 2 end,
         nummer_jahr = v_jahr
   where id = true
  returning nummer_praefix, naechste_nummer - 1 into v_praefix, v_nr;
  return coalesce(v_praefix, 'TR-') || v_jahr || '-' || lpad(v_nr::text, 4, '0');
end;
$$;

drop function if exists public.erstelle_rechnung(text, uuid, uuid, text, text, numeric, text);

create or replace function public.erstelle_rechnung(
  p_typ text, p_ziel_user_id uuid, p_ziel_verein_id uuid, p_tarif text, p_periode text, p_betrag numeric, p_zahlungsweg text,
  p_leistung_von date default null, p_leistung_bis date default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
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
$$;
revoke all on function public.erstelle_rechnung(text, uuid, uuid, text, text, numeric, text, date, date) from public, anon;
grant execute on function public.erstelle_rechnung(text, uuid, uuid, text, text, numeric, text, date, date) to authenticated, service_role;

-- Unveraenderlichkeit auch fuer Leistungszeitraum und Ausstellerangaben
create or replace function public.rechnung_unveraenderlich()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_setting('tanzraum.rechnung_anonymisieren', true) = 'an' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Rechnungen unterliegen der gesetzlichen Aufbewahrungspflicht und können nicht gelöscht werden.' using errcode = '42501';
  end if;
  if (new.nummer, new.typ, new.ziel_verein_id, new.empfaenger_name, new.empfaenger_adresse, new.empfaenger_email, new.leistung,
      new.zeitraum, new.betrag, new.zahlungsweg, new.rechnungsdatum, new.erstellt_am, new.anonymisiert_am,
      new.leistung_von, new.leistung_bis, new.aussteller)
     is distinct from
     (old.nummer, old.typ, old.ziel_verein_id, old.empfaenger_name, old.empfaenger_adresse, old.empfaenger_email, old.leistung,
      old.zeitraum, old.betrag, old.zahlungsweg, old.rechnungsdatum, old.erstellt_am, old.anonymisiert_am,
      old.leistung_von, old.leistung_bis, old.aussteller) then
    raise exception 'Rechnungsdaten bleiben während der Aufbewahrungsfrist unverändert.' using errcode = '42501';
  end if;
  return new;
end;
$$;
