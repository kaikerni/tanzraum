-- Kostueme & Requisiten (Vereinslizenz): Inventar mit Kostuemsaetzen, Ausgabe an Mitglieder und Rueckgabe mit Verlauf.
-- Verwalten: Vereinsadmin bzw. Rollen mit Bereich "Kostueme" (Standard: Betreuer, einstellbar in der Vereinsverwaltung).
-- Sehen: zusaetzlich jedes Mitglied seine eigenen / Eltern die ihrer Kinder ausgegebenen Teile.
-- Die TanzRaum-Plattformadministration hat keinen Zugriff (Vereins- und Mitgliederdaten).
-- Beide Tabellen waren leer; es werden keine Daten geloescht.

-- Inventar: Teil kann einem Satz angehoeren und (optional) gerade bei einem Mitglied sein
alter table public.kostueme alter column vereins_mitglied_id drop not null;
alter table public.kostueme alter column kostuem_gruppe_id drop not null;
alter table public.kostueme drop constraint kostueme_vereins_mitglied_id_fkey;
alter table public.kostueme add constraint kostueme_vereins_mitglied_id_fkey
  foreign key (vereins_mitglied_id) references public.vereins_mitglieder(id) on delete set null;
alter table public.kostueme drop constraint kostueme_kostuem_gruppe_id_fkey;
alter table public.kostueme add constraint kostueme_kostuem_gruppe_id_fkey
  foreign key (kostuem_gruppe_id) references public.kostuem_gruppen(id) on delete set null;

alter table public.kostueme
  add column art text not null default 'kostuem' check (art in ('kostuem', 'requisit', 'zubehoer')),
  add column anzahl integer not null default 1 check (anzahl between 1 and 9999),
  add column lagerort text check (char_length(lagerort) <= 120),
  add column ausgegeben_von uuid references auth.users(id) on delete set null,
  add column aktualisiert_am timestamptz not null default now();
alter table public.kostueme add constraint kostueme_teil_laenge check (char_length(btrim(teil)) between 1 and 120);
alter table public.kostueme add constraint kostueme_groesse_laenge check (char_length(groesse) <= 40);
alter table public.kostueme add constraint kostueme_notiz_laenge check (char_length(notiz) <= 1000);
alter table public.kostueme add constraint kostueme_zustand_gueltig check (zustand in ('neu', 'gut', 'gebraucht', 'reparatur', 'defekt'));
comment on column public.kostueme.rueckgabe is 'Rueckgabe bis (bei ausgegebenen Teilen)';
comment on column public.kostueme.vereins_mitglied_id is 'Bei wem das Teil gerade ist (null = im Lager)';

alter table public.kostuem_gruppen add constraint kostuem_gruppen_name_laenge check (char_length(btrim(name)) between 1 and 80);
alter table public.kostuem_gruppen add constraint kostuem_gruppen_beschreibung_laenge check (char_length(beschreibung) <= 500);

create index if not exists kostueme_verein_idx on public.kostueme (verein_id, art);
create index if not exists kostueme_mitglied_idx on public.kostueme (vereins_mitglied_id) where vereins_mitglied_id is not null;
create index if not exists kostueme_gruppe_idx on public.kostueme (kostuem_gruppe_id);

-- Verlauf der Ausgaben (wer hatte wann was)
create table public.kostuem_ausgaben (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  kostuem_id uuid not null references public.kostueme(id) on delete cascade,
  vereins_mitglied_id uuid references public.vereins_mitglieder(id) on delete set null,
  ausgegeben_am timestamptz not null default now(),
  rueckgabe_bis date,
  zurueck_am timestamptz,
  zustand_zurueck text check (zustand_zurueck in ('neu', 'gut', 'gebraucht', 'reparatur', 'defekt')),
  notiz text check (char_length(notiz) <= 500),
  ausgegeben_von uuid references auth.users(id) on delete set null
);
create index kostuem_ausgaben_kostuem_idx on public.kostuem_ausgaben (kostuem_id, ausgegeben_am desc);
create index kostuem_ausgaben_mitglied_idx on public.kostuem_ausgaben (vereins_mitglied_id);
alter table public.kostuem_ausgaben enable row level security;

-- Wer darf Kostueme des Vereins verwalten? (ohne Plattform-Administration)
create or replace function public.darf_kostueme_verwalten(p_verein_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select verein_hat_lizenz(p_verein_id)
     and (is_verein_admin(p_verein_id)
          or exists (select 1 from meine_bereiche() mb where mb.verein_id = p_verein_id and mb.bereich = 'material'));
$$;
revoke all on function public.darf_kostueme_verwalten(uuid) from public, anon;
grant execute on function public.darf_kostueme_verwalten(uuid) to authenticated;

-- Richtlinien neu (bisher u. a. mit Plattform-Administration)
drop policy if exists "Bereich Material verwaltet Kostueme" on public.kostueme;
drop policy if exists "Eigene Kostueme oder Bereich Material" on public.kostueme;
drop policy if exists "Vereinsadmin verwaltet Kostueme (delete)" on public.kostueme;
drop policy if exists "Vereinsadmin verwaltet Kostueme (insert)" on public.kostueme;
drop policy if exists "Vereinsadmin verwaltet Kostueme (update)" on public.kostueme;
drop policy if exists "Bereich Material verwaltet Kostuemgruppen" on public.kostuem_gruppen;
drop policy if exists "Vereinsadmin verwaltet Kostuemgruppen (delete)" on public.kostuem_gruppen;
drop policy if exists "Vereinsadmin verwaltet Kostuemgruppen (insert)" on public.kostuem_gruppen;
drop policy if exists "Vereinsadmin verwaltet Kostuemgruppen (update)" on public.kostuem_gruppen;

create policy "Kostueme: eigene/Kinder oder Verwaltung sehen" on public.kostueme for select to authenticated
  using ((vereins_mitglied_id is not null and ist_eigenes_oder_kind(vereins_mitglied_id)) or darf_kostueme_verwalten(verein_id));
-- Anlegen/Aendern/Loeschen des Inventars; Ausgabe und Ruecknahme nur ueber kostuem_ausgeben/kostuem_zuruecknehmen
create policy "Kostueme: Verwaltung legt an" on public.kostueme for insert to authenticated
  with check (darf_kostueme_verwalten(verein_id) and vereins_mitglied_id is null);
create policy "Kostueme: Verwaltung aendert" on public.kostueme for update to authenticated
  using (darf_kostueme_verwalten(verein_id)) with check (darf_kostueme_verwalten(verein_id));
create policy "Kostueme: Verwaltung loescht" on public.kostueme for delete to authenticated
  using (darf_kostueme_verwalten(verein_id) and vereins_mitglied_id is null);

create policy "Kostuemsaetze: Verwaltung schreibt" on public.kostuem_gruppen for all to authenticated
  using (darf_kostueme_verwalten(verein_id)) with check (darf_kostueme_verwalten(verein_id));

create policy "Kostuem-Ausgaben: eigene/Kinder oder Verwaltung sehen" on public.kostuem_ausgaben for select to authenticated
  using ((vereins_mitglied_id is not null and ist_eigenes_oder_kind(vereins_mitglied_id)) or darf_kostueme_verwalten(verein_id));
grant select on public.kostuem_ausgaben to authenticated;

-- Ausgabe/Ruecknahme an der Tabelle vorbei verhindern (Verlauf bleibt vollstaendig)
create or replace function public.kostueme_schuetzen()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.verein_id is distinct from old.verein_id then
    raise exception 'Der Verein eines Teils kann nicht geändert werden.' using errcode = '42501';
  end if;
  if (new.vereins_mitglied_id is distinct from old.vereins_mitglied_id
      or new.vergabe_datum is distinct from old.vergabe_datum
      or new.ausgegeben_von is distinct from old.ausgegeben_von)
     and coalesce(current_setting('tanzraum.kostuem_ausgabe', true), '') <> 'an' then
    raise exception 'Ausgabe und Rückgabe bitte über „Ausgeben“ bzw. „Zurücknehmen“.' using errcode = '42501';
  end if;
  if new.kostuem_gruppe_id is not null
     and not exists (select 1 from kostuem_gruppen g where g.id = new.kostuem_gruppe_id and g.verein_id = new.verein_id) then
    raise exception 'Kostümsatz gehört zu einem anderen Verein.' using errcode = '42501';
  end if;
  new.aktualisiert_am := now();
  return new;
end;
$$;
create trigger kostueme_schuetzen before update on public.kostueme
  for each row execute function public.kostueme_schuetzen();

create or replace function public.kostueme_neu_pruefen()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.kostuem_gruppe_id is not null
     and not exists (select 1 from kostuem_gruppen g where g.id = new.kostuem_gruppe_id and g.verein_id = new.verein_id) then
    raise exception 'Kostümsatz gehört zu einem anderen Verein.' using errcode = '42501';
  end if;
  new.teil := btrim(new.teil);
  return new;
end;
$$;
create trigger kostueme_neu_pruefen before insert on public.kostueme
  for each row execute function public.kostueme_neu_pruefen();

-- Personen fuer die Ausgabe (nur aktive, aufgenommene Mitglieder des Vereins)
create or replace function public.kostueme_personen(p_verein_id uuid)
returns table(vm_id uuid, name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not darf_kostueme_verwalten(p_verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  return query
  select vm.id, a.anzeige
  from vereins_mitglieder vm
  cross join lateral anzeige_namen(array[vm.user_id]) a
  where vm.verein_id = p_verein_id and coalesce(vm.aktiv, true) and vm.aufnahme_status = 'aufgenommen'
  order by a.anzeige;
end;
$$;
revoke all on function public.kostueme_personen(uuid) from public, anon;
grant execute on function public.kostueme_personen(uuid) to authenticated;

-- Namen der Personen, bei denen Teile des Vereins gerade sind (fuer die Inventarliste)
create or replace function public.kostueme_inhaber(p_verein_id uuid)
returns table(vm_id uuid, name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not darf_kostueme_verwalten(p_verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  return query
  select distinct vm.id, a.anzeige
  from kostueme k
  join vereins_mitglieder vm on vm.id = k.vereins_mitglied_id
  cross join lateral anzeige_namen(array[vm.user_id]) a
  where k.verein_id = p_verein_id
  union
  select distinct vm.id, a.anzeige
  from kostuem_ausgaben ka
  join vereins_mitglieder vm on vm.id = ka.vereins_mitglied_id
  cross join lateral anzeige_namen(array[vm.user_id]) a
  where ka.verein_id = p_verein_id and ka.ausgegeben_am > now() - interval '2 years';
end;
$$;
revoke all on function public.kostueme_inhaber(uuid) from public, anon;
grant execute on function public.kostueme_inhaber(uuid) to authenticated;

create or replace function public.kostuem_ausgeben(p_id uuid, p_vm_id uuid, p_bis date, p_notiz text)
returns void language plpgsql security definer set search_path = public as $$
declare
  k kostueme%rowtype;
  v_user uuid;
begin
  select * into k from kostueme where id = p_id for update;
  if not found or not darf_kostueme_verwalten(k.verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if k.vereins_mitglied_id is not null then
    raise exception 'Das Teil ist bereits ausgegeben – bitte zuerst zurücknehmen.' using errcode = 'P0001';
  end if;
  select vm.user_id into v_user from vereins_mitglieder vm
   where vm.id = p_vm_id and vm.verein_id = k.verein_id and coalesce(vm.aktiv, true) and vm.aufnahme_status = 'aufgenommen';
  if not found then
    raise exception 'Diese Person ist kein aktives Mitglied des Vereins.' using errcode = 'P0001';
  end if;
  if p_bis is not null and p_bis < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'Das Rückgabedatum liegt in der Vergangenheit.' using errcode = 'P0001';
  end if;

  perform set_config('tanzraum.kostuem_ausgabe', 'an', true);
  update kostueme set vereins_mitglied_id = p_vm_id, vergabe_datum = (now() at time zone 'Europe/Berlin')::date,
         rueckgabe = p_bis, ausgegeben_von = auth.uid() where id = p_id;
  perform set_config('tanzraum.kostuem_ausgabe', '', true);
  insert into kostuem_ausgaben (verein_id, kostuem_id, vereins_mitglied_id, rueckgabe_bis, notiz, ausgegeben_von)
  values (k.verein_id, p_id, p_vm_id, p_bis, nullif(btrim(left(coalesce(p_notiz, ''), 500)), ''), auth.uid());

  if v_user is not null and v_user <> auth.uid() then
    insert into benachrichtigungen (user_id, typ, text)
    values (v_user, 'kostuem', 'Kostüme & Requisiten: „' || k.teil || '“' || coalesce(' (Größe ' || k.groesse || ')', '')
            || ' wurde an dich ausgegeben' || coalesce(' – Rückgabe bis ' || to_char(p_bis, 'DD.MM.YYYY'), '') || '.');
  end if;
end;
$$;
revoke all on function public.kostuem_ausgeben(uuid, uuid, date, text) from public, anon;
grant execute on function public.kostuem_ausgeben(uuid, uuid, date, text) to authenticated;

create or replace function public.kostuem_zuruecknehmen(p_id uuid, p_zustand text, p_notiz text)
returns void language plpgsql security definer set search_path = public as $$
declare
  k kostueme%rowtype;
begin
  select * into k from kostueme where id = p_id for update;
  if not found or not darf_kostueme_verwalten(k.verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if k.vereins_mitglied_id is null then
    raise exception 'Das Teil ist nicht ausgegeben.' using errcode = 'P0001';
  end if;
  if p_zustand is not null and p_zustand not in ('neu', 'gut', 'gebraucht', 'reparatur', 'defekt') then
    raise exception 'Ungültiger Zustand.' using errcode = 'P0001';
  end if;

  update kostuem_ausgaben set zurueck_am = now(), zustand_zurueck = coalesce(p_zustand, k.zustand),
         notiz = coalesce(nullif(btrim(left(coalesce(p_notiz, ''), 500)), ''), notiz)
   where id = (select id from kostuem_ausgaben where kostuem_id = p_id and zurueck_am is null order by ausgegeben_am desc limit 1);
  perform set_config('tanzraum.kostuem_ausgabe', 'an', true);
  update kostueme set vereins_mitglied_id = null, vergabe_datum = null, rueckgabe = null, ausgegeben_von = null,
         zustand = coalesce(p_zustand, zustand) where id = p_id;
  perform set_config('tanzraum.kostuem_ausgabe', '', true);
end;
$$;
revoke all on function public.kostuem_zuruecknehmen(uuid, text, text) from public, anon;
grant execute on function public.kostuem_zuruecknehmen(uuid, text, text) to authenticated;

-- Datenexport (Art. 15/20 DSGVO): an mich / meine Kinder ausgegebene Teile
do $$
declare
  d text := pg_get_functiondef('public.meine_daten_export'::regproc);
  alt text := E'  end loop;\n\n  -- Vere';
begin
  if position(alt in d) = 0 then
    raise exception 'meine_daten_export: Stelle nicht gefunden';
  end if;
  d := replace(d, alt, E'  end loop;\n\n  -- Kostueme & Requisiten, die an mich ausgegeben sind bzw. waren\n'
    || E'  v_ergebnis := v_ergebnis || jsonb_build_object(''kostueme_ausgaben'', (select coalesce(jsonb_agg(jsonb_build_object(\n'
    || E'    ''teil'', k.teil, ''art'', k.art, ''groesse'', k.groesse, ''ausgegeben_am'', ka.ausgegeben_am, ''rueckgabe_bis'', ka.rueckgabe_bis,\n'
    || E'    ''zurueck_am'', ka.zurueck_am) order by ka.ausgegeben_am), ''[]''::jsonb)\n'
    || E'    from kostuem_ausgaben ka join kostueme k on k.id = ka.kostuem_id\n'
    || E'    join vereins_mitglieder vm on vm.id = ka.vereins_mitglied_id where vm.user_id = v_user));\n\n  -- Vere');
  execute d;
end $$;
