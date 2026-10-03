-- Finanzen (Vereinslizenz): Kassenbuch mit Belegen, Beitragsarten, Beiträge je Mitglied (Sollstellung, bezahlt,
-- Erinnerung). Verwalten: Vereinsadmin und Rollen mit Bereich "Finanzen" (Vereinsverwaltung, Standard: nur Admin).
-- Mitglieder/Eltern sehen nur ihre eigenen Beiträge. Die TanzRaum-Plattformadministration hat keinen Zugriff.
-- Alle drei Tabellen waren leer; es werden keine Daten geloescht.

create or replace function public.darf_finanzen(p_verein_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select verein_hat_lizenz(p_verein_id)
     and (is_verein_admin(p_verein_id)
          or exists (select 1 from meine_bereiche() mb where mb.verein_id = p_verein_id and mb.bereich = 'beitraege'));
$$;
revoke all on function public.darf_finanzen(uuid) from public, anon;
grant execute on function public.darf_finanzen(uuid) to authenticated;

-- Spalten und Pruefungen
alter table public.beitragstypen add constraint beitragstypen_name_laenge check (char_length(btrim(name)) between 1 and 80);
alter table public.beitragstypen add constraint beitragstypen_betrag_gueltig check (betrag >= 0 and betrag <= 100000);
alter table public.beitragstypen add constraint beitragstypen_rhythmus_gueltig check (rhythmus in ('monatlich', 'vierteljährlich', 'halbjährlich', 'jährlich', 'einmalig'));
alter table public.beitragstypen add column aktiv boolean not null default true;

alter table public.beitraege add constraint beitraege_betrag_gueltig check (betrag >= 0 and betrag <= 100000);
alter table public.beitraege add constraint beitraege_notiz_laenge check (char_length(notiz) <= 500);
alter table public.beitraege add column erinnert_am timestamptz;
alter table public.beitraege add column erstellt_von uuid references auth.users(id) on delete set null;
-- Bankverbindungen gehoeren nicht in die Beitragsliste (SEPA-Mandate liegen beim Mitgliedsantrag)
comment on column public.beitraege.iban is 'Nicht verwendet – Bankverbindungen nicht hier speichern';
create unique index if not exists beitraege_einmal_je_faelligkeit on public.beitraege (vereins_mitglied_id, beitragstyp_id, faellig) where beitragstyp_id is not null;
create index if not exists beitraege_verein_idx on public.beitraege (verein_id, bezahlt, faellig);

alter table public.kassenbuch_eintraege add constraint kassenbuch_betrag_max check (betrag <= 10000000);
alter table public.kassenbuch_eintraege add constraint kassenbuch_texte check (char_length(kategorie) <= 60 and char_length(beschreibung) <= 300 and char_length(zahlungsart) <= 40);
alter table public.kassenbuch_eintraege add column beitrag_id uuid references public.beitraege(id) on delete set null;
alter table public.kassenbuch_eintraege add column beleg_name text check (char_length(beleg_name) <= 160);
alter table public.kassenbuch_eintraege add column aktualisiert_am timestamptz not null default now();
alter table public.kassenbuch_eintraege alter column erstellt_von set default auth.uid();
create index if not exists kassenbuch_verein_datum_idx on public.kassenbuch_eintraege (verein_id, datum desc);

-- Richtlinien neu (bisher u. a. mit Plattform-Administration ueber hat_vereinsbereich)
drop policy if exists "Bereich Beitraege verwaltet Beitraege" on public.beitraege;
drop policy if exists "Vereinsadmin sieht Beitraege" on public.beitraege;
drop policy if exists "Vereinsadmin verwaltet Beitraege (delete)" on public.beitraege;
drop policy if exists "Vereinsadmin verwaltet Beitraege (insert)" on public.beitraege;
drop policy if exists "Vereinsadmin verwaltet Beitraege (update)" on public.beitraege;
drop policy if exists "Bereich Beitraege verwaltet Beitragstypen" on public.beitragstypen;
drop policy if exists "Vereinsadmin sieht Beitragstypen" on public.beitragstypen;
drop policy if exists "Vereinsadmin verwaltet Beitragstypen (delete)" on public.beitragstypen;
drop policy if exists "Vereinsadmin verwaltet Beitragstypen (insert)" on public.beitragstypen;
drop policy if exists "Vereinsadmin verwaltet Beitragstypen (update)" on public.beitragstypen;
drop policy if exists "Bereich Beitraege verwaltet Kassenbuch" on public.kassenbuch_eintraege;
drop policy if exists "Vereinsadmin verwaltet Kassenbuch" on public.kassenbuch_eintraege;

create policy "Beitragsarten: Finanzen verwaltet" on public.beitragstypen for all to authenticated
  using (darf_finanzen(verein_id)) with check (darf_finanzen(verein_id));
create policy "Beitraege: Finanzen verwaltet" on public.beitraege for all to authenticated
  using (darf_finanzen(verein_id)) with check (darf_finanzen(verein_id));
create policy "Beitraege: eigene bzw. der Kinder sehen" on public.beitraege for select to authenticated
  using (ist_eigenes_oder_kind(vereins_mitglied_id));
create policy "Kassenbuch: Finanzen verwaltet" on public.kassenbuch_eintraege for all to authenticated
  using (darf_finanzen(verein_id)) with check (darf_finanzen(verein_id));

create or replace function public.kassenbuch_pruefen()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.verein_id is distinct from old.verein_id then
    raise exception 'Der Verein eines Eintrags kann nicht geändert werden.' using errcode = '42501';
  end if;
  if new.beleg_pfad is not null and split_part(new.beleg_pfad, '/', 1) <> new.verein_id::text then
    raise exception 'Beleg gehört zu einem anderen Verein.' using errcode = '42501';
  end if;
  if new.beitrag_id is not null and not exists (select 1 from beitraege b where b.id = new.beitrag_id and b.verein_id = new.verein_id) then
    raise exception 'Beitrag gehört zu einem anderen Verein.' using errcode = '42501';
  end if;
  new.aktualisiert_am := now();
  return new;
end;
$$;
create trigger kassenbuch_pruefen before insert or update on public.kassenbuch_eintraege
  for each row execute function public.kassenbuch_pruefen();

create or replace function public.beitraege_pruefen()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (new.verein_id is distinct from old.verein_id or new.vereins_mitglied_id is distinct from old.vereins_mitglied_id) then
    raise exception 'Verein und Person eines Beitrags können nicht geändert werden.' using errcode = '42501';
  end if;
  if not exists (select 1 from vereins_mitglieder vm where vm.id = new.vereins_mitglied_id and vm.verein_id = new.verein_id) then
    raise exception 'Diese Person gehört nicht zum Verein.' using errcode = '42501';
  end if;
  if new.beitragstyp_id is not null and not exists (select 1 from beitragstypen t where t.id = new.beitragstyp_id and t.verein_id = new.verein_id) then
    raise exception 'Beitragsart gehört zu einem anderen Verein.' using errcode = '42501';
  end if;
  new.iban := null;
  if new.bezahlt and new.bezahlt_am is null then new.bezahlt_am := (now() at time zone 'Europe/Berlin')::date; end if;
  if not new.bezahlt then new.bezahlt_am := null; end if;
  return new;
end;
$$;
create trigger beitraege_pruefen before insert or update on public.beitraege
  for each row execute function public.beitraege_pruefen();

-- Personen (aktive, aufgenommene Mitglieder) fuer Beitraege
create or replace function public.finanzen_personen(p_verein_id uuid)
returns table(vm_id uuid, name text, rolle text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not darf_finanzen(p_verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  return query
  select vm.id, a.anzeige, coalesce(r.name, 'Mitglied')
  from vereins_mitglieder vm
  left join rollen r on r.id = vm.rolle_id
  cross join lateral anzeige_namen(array[vm.user_id]) a
  where vm.verein_id = p_verein_id and coalesce(vm.aktiv, true) and vm.aufnahme_status = 'aufgenommen'
  order by a.anzeige;
end;
$$;

-- Namen zu allen Beitraegen des Vereins (auch ehemalige Mitglieder mit offenen Posten)
create or replace function public.finanzen_namen(p_verein_id uuid)
returns table(vm_id uuid, name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not darf_finanzen(p_verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  return query
  select distinct vm.id, a.anzeige
  from beitraege b join vereins_mitglieder vm on vm.id = b.vereins_mitglied_id
  cross join lateral anzeige_namen(array[vm.user_id]) a
  where b.verein_id = p_verein_id;
end;
$$;

-- Sollstellung: Beitraege fuer eine Beitragsart und Faelligkeit anlegen (ohne Doppelte)
create or replace function public.beitraege_erzeugen(p_typ uuid, p_faellig date, p_vm_ids uuid[] default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  t beitragstypen%rowtype;
  n integer;
begin
  select * into t from beitragstypen where id = p_typ;
  if not found or not darf_finanzen(t.verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if p_faellig is null then
    raise exception 'Bitte ein Fälligkeitsdatum angeben.' using errcode = 'P0001';
  end if;
  insert into beitraege (verein_id, vereins_mitglied_id, beitragstyp_id, beitragstyp_name, betrag, faellig, bezahlt, zahlungsweg, erstellt_von)
  select t.verein_id, vm.id, t.id, t.name, t.betrag, p_faellig, false, 'Überweisung', auth.uid()
  from vereins_mitglieder vm
  left join rollen r on r.id = vm.rolle_id
  where vm.verein_id = t.verein_id and coalesce(vm.aktiv, true) and vm.aufnahme_status = 'aufgenommen'
    and (case when p_vm_ids is null then rollen_typ(r.name) <> 'eltern' else vm.id = any(p_vm_ids) end)
  on conflict (vereins_mitglied_id, beitragstyp_id, faellig) where beitragstyp_id is not null do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Bezahlt markieren (optional mit Einnahme im Kassenbuch) bzw. zuruecksetzen
create or replace function public.beitrag_bezahlt(p_id uuid, p_bezahlt boolean, p_datum date default null, p_zahlungsweg text default null, p_kassenbuch boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare
  b beitraege%rowtype;
  v_name text;
begin
  select * into b from beitraege where id = p_id for update;
  if not found or not darf_finanzen(b.verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if p_bezahlt then
    update beitraege set bezahlt = true, bezahlt_am = coalesce(p_datum, (now() at time zone 'Europe/Berlin')::date),
           zahlungsweg = coalesce(nullif(left(btrim(coalesce(p_zahlungsweg, '')), 40), ''), zahlungsweg) where id = p_id;
    if p_kassenbuch and b.betrag > 0 and not exists (select 1 from kassenbuch_eintraege k where k.beitrag_id = p_id) then
      select a.anzeige into v_name from vereins_mitglieder vm cross join lateral anzeige_namen(array[vm.user_id]) a where vm.id = b.vereins_mitglied_id;
      insert into kassenbuch_eintraege (verein_id, datum, typ, kategorie, betrag, beschreibung, zahlungsart, beitrag_id, erstellt_von)
      values (b.verein_id, coalesce(p_datum, (now() at time zone 'Europe/Berlin')::date), 'einnahme', 'Mitgliedsbeiträge', b.betrag,
              left(b.beitragstyp_name || ' – ' || coalesce(v_name, 'Mitglied'), 300),
              coalesce(nullif(left(btrim(coalesce(p_zahlungsweg, '')), 40), ''), b.zahlungsweg), p_id, auth.uid());
    end if;
  else
    update beitraege set bezahlt = false, bezahlt_am = null where id = p_id;
    delete from kassenbuch_eintraege where beitrag_id = p_id;
  end if;
end;
$$;

-- Erinnerung an einen offenen Beitrag (Person bzw. verknuepfte Eltern), hoechstens alle 3 Tage
create or replace function public.beitrag_erinnern(p_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  b beitraege%rowtype;
  v_vname text;
  n integer;
begin
  select * into b from beitraege where id = p_id for update;
  if not found or not darf_finanzen(b.verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if b.bezahlt then
    raise exception 'Der Beitrag ist bereits bezahlt.' using errcode = 'P0001';
  end if;
  if b.erinnert_am is not null and b.erinnert_am > now() - interval '3 days' then
    raise exception 'Erinnerung wurde gerade erst verschickt.' using errcode = 'P0001';
  end if;
  select name into v_vname from vereine where id = b.verein_id;
  insert into benachrichtigungen (user_id, typ, text)
  select distinct u, 'beitrag', 'Beitrag offen bei ' || coalesce(v_vname, 'deinem Verein') || ': ' || b.beitragstyp_name || ' – '
         || to_char(b.betrag, 'FM999G990D00') || ' €' || coalesce(', fällig ' || to_char(b.faellig, 'DD.MM.YYYY'), '') || '.'
  from (
    select vm.user_id u from vereins_mitglieder vm where vm.id = b.vereins_mitglied_id
    union
    select ve.user_id from eltern_kind_zuordnung ekz join vereins_mitglieder ve on ve.id = ekz.eltern_vm_id where ekz.kind_vm_id = b.vereins_mitglied_id
  ) x where u is not null;
  get diagnostics n = row_count;
  update beitraege set erinnert_am = now() where id = p_id;
  return n;
end;
$$;

-- Eigene Beitraege (und die der Kinder) fuer die Mitgliederansicht
create or replace function public.meine_beitraege()
returns table(id uuid, verein_name text, person text, art text, betrag numeric, faellig date, bezahlt boolean, bezahlt_am date)
language sql stable security definer set search_path = public as $$
  select b.id, v.name, a.anzeige, b.beitragstyp_name, b.betrag, b.faellig, b.bezahlt, b.bezahlt_am
  from beitraege b
  join vereine v on v.id = b.verein_id
  join vereins_mitglieder vm on vm.id = b.vereins_mitglied_id
  cross join lateral anzeige_namen(array[vm.user_id]) a
  where ist_eigenes_oder_kind(b.vereins_mitglied_id)
  order by b.bezahlt, b.faellig desc nulls last
  limit 200;
$$;

revoke all on function public.finanzen_personen(uuid), public.finanzen_namen(uuid), public.beitraege_erzeugen(uuid, date, uuid[]),
  public.beitrag_bezahlt(uuid, boolean, date, text, boolean), public.beitrag_erinnern(uuid), public.meine_beitraege() from public, anon;
grant execute on function public.finanzen_personen(uuid), public.finanzen_namen(uuid), public.beitraege_erzeugen(uuid, date, uuid[]),
  public.beitrag_bezahlt(uuid, boolean, date, text, boolean), public.beitrag_erinnern(uuid), public.meine_beitraege() to authenticated;

-- Belege: privater Bucket, Pfad <verein_id>/<eintrag>/<datei>, nur Finanzen des Vereins
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
where id = 'kassenbuch-belege';
drop policy if exists "Vereinsadmin verwaltet eigene Belege" on storage.objects;
create policy "Belege: Finanzen des Vereins" on storage.objects for all to authenticated
  using (bucket_id = 'kassenbuch-belege' and public.darf_finanzen(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'kassenbuch-belege' and public.darf_finanzen(((storage.foldername(name))[1])::uuid));

-- Datenexport (Art. 15/20 DSGVO): eigene Beitraege und eigene Musik
do $$
declare
  d text := pg_get_functiondef('public.meine_daten_export'::regproc);
  alt text := E'  -- Kostueme & Requisiten, die an mich ausgegeben sind bzw. waren\n';
begin
  if position(alt in d) = 0 then
    raise exception 'meine_daten_export: Stelle nicht gefunden';
  end if;
  d := replace(d, alt, E'  -- Beitraege (Finanzen des Vereins) und eigene Musik\n'
    || E'  v_ergebnis := v_ergebnis || jsonb_build_object(''beitraege'', (select coalesce(jsonb_agg(jsonb_build_object(\n'
    || E'    ''art'', b.beitragstyp_name, ''betrag'', b.betrag, ''faellig'', b.faellig, ''bezahlt'', b.bezahlt, ''bezahlt_am'', b.bezahlt_am)\n'
    || E'    order by b.faellig), ''[]''::jsonb) from beitraege b join vereins_mitglieder vm on vm.id = b.vereins_mitglied_id where vm.user_id = v_user),\n'
    || E'    ''musik'', (select coalesce(jsonb_agg(jsonb_build_object(''titel'', m.titel, ''interpret'', m.interpret, ''datei'', m.datei_name,\n'
    || E'    ''groesse_bytes'', m.groesse_bytes, ''erstellt_am'', m.erstellt_am) order by m.erstellt_am), ''[]''::jsonb) from musik_titel m where m.user_id = v_user));\n\n'
    || alt);
  execute d;
end $$;
