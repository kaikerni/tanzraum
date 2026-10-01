-- Mitgliederimport + persoenliche Einladungen.
-- Verwendet die bestehende Mitglieder-Stammdatentabelle public.mitglieder (user_id optional = Vereinsmitglied ohne
-- TanzRaum-Konto) und die bestehenden public.einladungen (Token, Gueltigkeit, einmalig, widerrufbar).
-- Ein Import erstellt KEINE Konten: Mitglieder registrieren sich selbst ueber ihren persoenlichen Link,
-- beim Einloesen wird das Konto mit dem vorhandenen Stammdatensatz verbunden.

-- ── Stammdaten erweitern ──────────────────────────────────────────────────────────────────────────────
alter table public.mitglieder
  add column if not exists mitgliedsnummer text,
  add column if not exists geschlecht text,
  add column if not exists eintrittsdatum date,
  add column if not exists mitgliedsstatus text,
  add column if not exists gruppe_id uuid references public.gruppen(id) on delete set null,
  add column if not exists vereins_mitglied_id uuid references public.vereins_mitglieder(id) on delete set null,
  add column if not exists quelle text not null default 'manuell',
  add column if not exists importiert_am timestamptz;

alter table public.mitglieder drop constraint if exists mitglieder_geschlecht_check;
alter table public.mitglieder add constraint mitglieder_geschlecht_check check (geschlecht is null or geschlecht in ('weiblich', 'männlich', 'divers'));
alter table public.mitglieder drop constraint if exists mitglieder_quelle_check;
alter table public.mitglieder add constraint mitglieder_quelle_check check (quelle in ('manuell', 'import'));
alter table public.mitglieder drop constraint if exists mitglieder_laengen_check;
alter table public.mitglieder add constraint mitglieder_laengen_check check (
  char_length(vorname) between 1 and 100 and char_length(nachname) between 1 and 100
  and coalesce(char_length(email), 0) <= 254 and coalesce(char_length(mitgliedsnummer), 0) <= 50
  and coalesce(char_length(telefon), 0) <= 50 and coalesce(char_length(strasse), 0) <= 150
  and coalesce(char_length(hausnummer), 0) <= 20 and coalesce(char_length(plz), 0) <= 20
  and coalesce(char_length(ort), 0) <= 100 and coalesce(char_length(mitgliedsstatus), 0) <= 60
) not valid;

create index if not exists mitglieder_verein_idx on public.mitglieder (verein_id);
create index if not exists mitglieder_verein_email_idx on public.mitglieder (verein_id, lower(email)) where email is not null;
create unique index if not exists mitglieder_vm_eindeutig on public.mitglieder (vereins_mitglied_id) where vereins_mitglied_id is not null;

-- ── Persoenliche Einladungen ──────────────────────────────────────────────────────────────────────────
alter table public.einladungen
  add column if not exists mitglied_id uuid references public.mitglieder(id) on delete cascade,
  add column if not exists gesendet_am timestamptz,
  add column if not exists gesendet_anzahl integer not null default 0;
create index if not exists einladungen_mitglied_idx on public.einladungen (mitglied_id) where mitglied_id is not null;

create or replace function public.pruefe_einladung()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.gruppe_id is not null and not exists (select 1 from gruppen g where g.id = new.gruppe_id and g.verein_id = new.verein_id) then
    raise exception 'Die Gruppe gehört nicht zu diesem Verein.' using errcode = 'P0001';
  end if;
  if new.mitglied_id is not null and not exists (select 1 from mitglieder m where m.id = new.mitglied_id and m.verein_id = new.verein_id) then
    raise exception 'Das Mitglied gehört nicht zu diesem Verein.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Offene persoenliche Einladung (nicht widerrufen, nicht verbraucht, nicht abgelaufen)
create or replace function public.mitglied_offene_einladung(p_mitglied_id uuid)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select e.id from einladungen e
  where e.mitglied_id = p_mitglied_id and not e.revoked and e.uses < e.max_uses
    and (e.expires_at is null or e.expires_at > now())
  order by e.created_at desc limit 1;
$$;
revoke all on function public.mitglied_offene_einladung(uuid) from public, anon, authenticated;

-- ── Liste der Stammdaten inkl. TanzRaum-Kontostatus (nur Vereinsadmin) ───────────────────────────────
create or replace function public.mitglieder_register(p_verein_id uuid)
returns table(id uuid, vorname text, nachname text, email text, mitgliedsnummer text, geschlecht text, geburtsdatum date,
              telefon text, strasse text, hausnummer text, plz text, ort text, eintrittsdatum date, mitgliedsstatus text,
              gruppe_id uuid, gruppe_name text, vereins_mitglied_id uuid, quelle text, erstellt_am timestamptz,
              status text, einladung_id uuid, einladung_token uuid, einladung_erstellt timestamptz, gesendet_am timestamptz,
              gueltig_bis timestamptz, einladung_abgelaufen boolean)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not is_verein_admin(p_verein_id) then
    raise exception 'Nur Vereinsadmins sehen die Mitglieder-Stammdaten.' using errcode = '42501';
  end if;
  return query
  select m.id, m.vorname, m.nachname, m.email, m.mitgliedsnummer, m.geschlecht, m.geburtsdatum,
         m.telefon, m.strasse, m.hausnummer, m.plz, m.ort, m.eintrittsdatum, m.mitgliedsstatus,
         m.gruppe_id, g.name, m.vereins_mitglied_id, m.quelle, m.created_at,
         case when m.vereins_mitglied_id is not null then 'konto' when e.id is not null then 'eingeladen' else 'ohne' end,
         e.id, e.token, e.created_at, e.gesendet_am, e.expires_at,
         (e.id is null and exists (select 1 from einladungen x where x.mitglied_id = m.id and not x.revoked
                                   and x.uses < x.max_uses and x.expires_at <= now()))
  from mitglieder m
  left join gruppen g on g.id = m.gruppe_id
  left join einladungen e on e.id = (case when m.vereins_mitglied_id is null then mitglied_offene_einladung(m.id) end)
  where m.verein_id = p_verein_id
  order by m.nachname, m.vorname;
end;
$$;
revoke all on function public.mitglieder_register(uuid) from public, anon;
grant execute on function public.mitglieder_register(uuid) to authenticated;

-- ── Hilfsfunktionen fuer Import/Pruefung ──────────────────────────────────────────────────────────────
create or replace function public.import_text(p jsonb, p_feld text, p_max integer)
returns text language sql immutable set search_path to 'public' as $$
  select nullif(left(btrim(regexp_replace(coalesce(p ->> p_feld, ''), '\s+', ' ', 'g')), p_max), '');
$$;

create or replace function public.import_datum(p jsonb, p_feld text)
returns date language plpgsql immutable set search_path to 'public' as $$
declare v text := p ->> p_feld; d date;
begin
  if v is null or v !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  begin d := v::date; exception when others then return null; end;
  if d < date '1900-01-01' or d > date '2100-12-31' then return null; end if;
  return d;
end;
$$;

create or replace function public.import_email(p jsonb)
returns text language sql immutable set search_path to 'public' as $$
  select case when lower(btrim(coalesce(p ->> 'email', ''))) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
              and char_length(btrim(p ->> 'email')) <= 254
         then lower(btrim(p ->> 'email')) end;
$$;

-- Vergleich einer Importzeile mit vorhandenen Mitgliedern (nur lesen – speichert nichts).
-- Prioritaet: 1. E-Mail, 2. Mitgliedsnummer, 3. Vorname + Nachname (Geburtsdatum darf nicht widersprechen).
create or replace function public.mitglieder_import_pruefen(p_verein_id uuid, p_zeilen jsonb)
returns table(idx integer, treffer text, ziel_art text, ziel_id uuid, ziel_name text, aenderungen jsonb)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  z record;
  v_email text; v_nr text; v_vn text; v_nn text; v_geb date;
  r mitglieder%rowtype;
  v_vm uuid; v_vm_name text;
  v_art text;
  v_aend jsonb;
  f text;
  v_neu text; v_alt text;
begin
  if not is_verein_admin(p_verein_id) then
    raise exception 'Nur Vereinsadmins dürfen Mitglieder importieren.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_zeilen) <> 'array' or jsonb_array_length(p_zeilen) > 3000 then
    raise exception 'Höchstens 3000 Mitglieder pro Import.' using errcode = 'P0001';
  end if;

  for z in select e.value as d, (e.ordinality - 1)::int as i from jsonb_array_elements(p_zeilen) with ordinality e loop
    v_email := import_email(z.d);
    v_nr := import_text(z.d, 'mitgliedsnummer', 50);
    v_vn := lower(import_text(z.d, 'vorname', 100));
    v_nn := lower(import_text(z.d, 'nachname', 100));
    v_geb := import_datum(z.d, 'geburtsdatum');
    r := null; v_vm := null; v_art := null;

    -- Stammdaten des Vereins
    if v_email is not null then
      select * into r from mitglieder m where m.verein_id = p_verein_id and lower(m.email) = v_email order by m.created_at limit 1;
      if found then v_art := 'email'; end if;
    end if;
    if v_art is null and v_nr is not null then
      select * into r from mitglieder m where m.verein_id = p_verein_id and m.mitgliedsnummer = v_nr order by m.created_at limit 1;
      if found then v_art := 'mitgliedsnummer'; end if;
    end if;
    if v_art is null and v_vn is not null and v_nn is not null then
      select * into r from mitglieder m where m.verein_id = p_verein_id and lower(m.vorname) = v_vn and lower(m.nachname) = v_nn
        and (v_geb is null or m.geburtsdatum is null or m.geburtsdatum = v_geb) order by m.created_at limit 1;
      if found then v_art := 'name'; end if;
    end if;

    if v_art is not null then
      v_aend := '{}'::jsonb;
      foreach f in array array['vorname', 'nachname', 'email', 'mitgliedsnummer', 'geburtsdatum', 'geschlecht', 'telefon',
                               'strasse', 'hausnummer', 'plz', 'ort', 'eintrittsdatum', 'mitgliedsstatus'] loop
        v_neu := case f when 'email' then v_email
                        when 'geburtsdatum' then import_datum(z.d, f)::text
                        when 'eintrittsdatum' then import_datum(z.d, f)::text
                        when 'geschlecht' then geschlecht_normal(z.d ->> f)
                        else import_text(z.d, f, 150) end;
        v_alt := to_jsonb(r) ->> f;
        if v_neu is not null and v_neu is distinct from v_alt and not (f in ('vorname', 'nachname') and lower(v_neu) = lower(v_alt)) then
          v_aend := v_aend || jsonb_build_object(f, jsonb_build_object('alt', v_alt, 'neu', v_neu));
        end if;
      end loop;
      idx := z.i; treffer := v_art; ziel_art := 'register'; ziel_id := r.id;
      ziel_name := r.vorname || ' ' || r.nachname; aenderungen := v_aend;
      return next;
      continue;
    end if;

    -- Mitglieder mit TanzRaum-Konto, die noch keinen Stammdatensatz haben
    if v_email is not null then
      select vm.id into v_vm from vereins_mitglieder vm join auth.users u on u.id = vm.user_id
      where vm.verein_id = p_verein_id and lower(u.email) = v_email
        and not exists (select 1 from mitglieder m where m.vereins_mitglied_id = vm.id) limit 1;
      if v_vm is not null then v_art := 'email'; end if;
    end if;
    if v_vm is null and v_vn is not null and v_nn is not null then
      select vm.id into v_vm from vereins_mitglieder vm join profiles p on p.id = vm.user_id
      where vm.verein_id = p_verein_id and lower(btrim(p.vorname)) = v_vn and lower(btrim(p.nachname)) = v_nn
        and (v_geb is null or p.geburtsdatum is null or p.geburtsdatum = v_geb)
        and not exists (select 1 from mitglieder m where m.vereins_mitglied_id = vm.id) limit 1;
      if v_vm is not null then v_art := 'name'; end if;
    end if;
    if v_vm is not null then
      select a.anzeige into v_vm_name from vereins_mitglieder vm cross join lateral anzeige_namen(array[vm.user_id]) a where vm.id = v_vm;
      idx := z.i; treffer := v_art; ziel_art := 'konto'; ziel_id := v_vm; ziel_name := v_vm_name; aenderungen := '{}'::jsonb;
      return next;
    end if;
  end loop;
end;
$$;
revoke all on function public.mitglieder_import_pruefen(uuid, jsonb) from public, anon;
grant execute on function public.mitglieder_import_pruefen(uuid, jsonb) to authenticated;

-- Import bestaetigen. p_zeilen: [{vorname, nachname, email?, …, gruppe?, aktion: 'neu'|'vorhanden', ziel_art?, ziel_id?, uebernehmen?}]
-- p_gruppen: {"<Gruppenname aus Datei>": {"aktion": "vorhanden", "gruppe_id": "…"} | {"aktion": "neu"} | {"aktion": "keine"}} oder null
create or replace function public.mitglieder_importieren(p_verein_id uuid, p_zeilen jsonb, p_gruppen jsonb default null, p_quelle text default 'import')
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  z jsonb;
  v_gruppen jsonb := '{}'::jsonb;   -- Dateiname -> gruppe_id (aufgeloest)
  v_g jsonb; v_gname text; v_gid uuid;
  v_id uuid; v_vm uuid; v_user uuid;
  v_vn text; v_nn text;
  n_neu int := 0; n_akt int := 0; n_verk int := 0; n_gleich int := 0; n_gneu int := 0; n_gzu int := 0;
  v_quelle text := case when p_quelle = 'manuell' then 'manuell' else 'import' end;
  v_ret mitglieder%rowtype;
  v_uebernehmen boolean;
begin
  if not is_verein_admin(p_verein_id) then
    raise exception 'Nur Vereinsadmins dürfen Mitglieder importieren.' using errcode = '42501';
  end if;
  if not verein_hat_lizenz(p_verein_id) then
    raise exception 'Der Mitgliederimport gehört zur Vereinslizenz.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_zeilen) <> 'array' or jsonb_array_length(p_zeilen) = 0 then
    raise exception 'Keine Mitglieder zum Importieren.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_zeilen) > 3000 then
    raise exception 'Höchstens 3000 Mitglieder pro Import.' using errcode = 'P0001';
  end if;

  -- Gruppen aufloesen: nur ausdruecklich gewaehlte neue Gruppen werden angelegt (ueber die normale Gruppenlogik)
  if p_gruppen is not null and jsonb_typeof(p_gruppen) = 'object' then
    for v_gname, v_g in select key, value from jsonb_each(p_gruppen) loop
      v_gid := null;
      if v_g ->> 'aktion' = 'vorhanden' then
        select g.id into v_gid from gruppen g where g.id = (v_g ->> 'gruppe_id')::uuid and g.verein_id = p_verein_id;
        if v_gid is null then raise exception 'Gruppe „%“ nicht gefunden.', v_gname using errcode = 'P0001'; end if;
      elsif v_g ->> 'aktion' = 'neu' then
        select g.id into v_gid from gruppen g where g.verein_id = p_verein_id and lower(g.name) = lower(btrim(v_gname)) limit 1;
        if v_gid is null then
          v_gid := gruppe_speichern(p_verein_id, null, left(btrim(v_gname), 80), null, null, null, '{}', '{}', '{}', false);
          n_gneu := n_gneu + 1;
        end if;
      end if;
      if v_gid is not null then v_gruppen := v_gruppen || jsonb_build_object(v_gname, v_gid); end if;
    end loop;
  end if;

  for z in select value from jsonb_array_elements(p_zeilen) loop
    v_vn := import_text(z, 'vorname', 100);
    v_nn := import_text(z, 'nachname', 100);
    if v_vn is null or v_nn is null then
      raise exception 'Jedes Mitglied braucht Vor- und Nachnamen.' using errcode = 'P0001';
    end if;
    v_gid := case when z ? 'gruppe' then (v_gruppen ->> btrim(z ->> 'gruppe'))::uuid end;
    if v_gid is null and z ? 'gruppe' then v_gid := (v_gruppen ->> (z ->> 'gruppe'))::uuid; end if;
    v_uebernehmen := coalesce((z ->> 'uebernehmen')::boolean, false);

    if z ->> 'aktion' = 'vorhanden' and z ->> 'ziel_art' = 'register' then
      select * into v_ret from mitglieder m where m.id = (z ->> 'ziel_id')::uuid and m.verein_id = p_verein_id for update;
      if not found then raise exception 'Vorhandenes Mitglied nicht gefunden.' using errcode = 'P0001'; end if;
      if v_uebernehmen then
        update mitglieder m set
          vorname = coalesce(v_vn, m.vorname), nachname = coalesce(v_nn, m.nachname),
          email = coalesce(import_email(z), m.email),
          mitgliedsnummer = coalesce(import_text(z, 'mitgliedsnummer', 50), m.mitgliedsnummer),
          geburtsdatum = coalesce(import_datum(z, 'geburtsdatum'), m.geburtsdatum),
          geschlecht = coalesce(geschlecht_normal(z ->> 'geschlecht'), m.geschlecht),
          telefon = coalesce(import_text(z, 'telefon', 50), m.telefon),
          strasse = coalesce(import_text(z, 'strasse', 150), m.strasse),
          hausnummer = coalesce(import_text(z, 'hausnummer', 20), m.hausnummer),
          plz = coalesce(import_text(z, 'plz', 20), m.plz),
          ort = coalesce(import_text(z, 'ort', 100), m.ort),
          eintrittsdatum = coalesce(import_datum(z, 'eintrittsdatum'), m.eintrittsdatum),
          mitgliedsstatus = coalesce(import_text(z, 'mitgliedsstatus', 60), m.mitgliedsstatus),
          gruppe_id = coalesce(v_gid, m.gruppe_id),
          updated_at = now()
        where m.id = v_ret.id;
        n_akt := n_akt + 1;
      elsif v_gid is not null and v_ret.gruppe_id is null then
        update mitglieder set gruppe_id = v_gid, updated_at = now() where id = v_ret.id;
        n_akt := n_akt + 1;
      else
        n_gleich := n_gleich + 1;
      end if;
      v_vm := v_ret.vereins_mitglied_id;
      if v_vm is not null and v_gid is not null then
        begin
          insert into gruppen_mitglieder (gruppe_id, vereins_mitglied_id, funktion) values (v_gid, v_vm, 'mitglied') on conflict do nothing;
          if found then n_gzu := n_gzu + 1; end if;
        exception when others then null;
        end;
      end if;
      continue;
    end if;

    v_vm := null; v_user := null;
    if z ->> 'aktion' = 'vorhanden' and z ->> 'ziel_art' = 'konto' then
      select vm.id, vm.user_id into v_vm, v_user from vereins_mitglieder vm
      where vm.id = (z ->> 'ziel_id')::uuid and vm.verein_id = p_verein_id
        and not exists (select 1 from mitglieder m where m.vereins_mitglied_id = vm.id);
      if v_vm is null then raise exception 'Vorhandenes Mitglied mit TanzRaum-Konto nicht gefunden oder bereits verbunden.' using errcode = 'P0001'; end if;
    end if;

    insert into mitglieder (verein_id, user_id, vereins_mitglied_id, vorname, nachname, email, mitgliedsnummer, geburtsdatum, geschlecht,
                            telefon, strasse, hausnummer, plz, ort, eintrittsdatum, mitgliedsstatus, gruppe_id, quelle, importiert_am)
    values (p_verein_id, v_user, v_vm, v_vn, v_nn, import_email(z), import_text(z, 'mitgliedsnummer', 50), import_datum(z, 'geburtsdatum'),
            geschlecht_normal(z ->> 'geschlecht'), import_text(z, 'telefon', 50), import_text(z, 'strasse', 150), import_text(z, 'hausnummer', 20),
            import_text(z, 'plz', 20), import_text(z, 'ort', 100), import_datum(z, 'eintrittsdatum'), import_text(z, 'mitgliedsstatus', 60),
            v_gid, v_quelle, case when v_quelle = 'import' then now() end)
    returning id into v_id;
    if v_vm is not null then
      n_verk := n_verk + 1;
      if v_gid is not null then
        begin
          insert into gruppen_mitglieder (gruppe_id, vereins_mitglied_id, funktion) values (v_gid, v_vm, 'mitglied') on conflict do nothing;
          if found then n_gzu := n_gzu + 1; end if;
        exception when others then null;
        end;
      end if;
    else
      n_neu := n_neu + 1;
    end if;
  end loop;

  return jsonb_build_object('neu', n_neu, 'aktualisiert', n_akt, 'verknuepft', n_verk, 'unveraendert', n_gleich,
                            'gruppen_neu', n_gneu, 'gruppen_zugeordnet', n_gzu, 'id', case when jsonb_array_length(p_zeilen) = 1 then v_id end);
end;
$$;
revoke all on function public.mitglieder_importieren(uuid, jsonb, jsonb, text) from public, anon;
grant execute on function public.mitglieder_importieren(uuid, jsonb, jsonb, text) to authenticated;

-- Einzelnes Mitglied (Stammdaten) aendern
create or replace function public.mitglied_stammdaten_aendern(p_mitglied_id uuid, p_daten jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v mitglieder%rowtype; v_gid uuid;
begin
  select * into v from mitglieder where id = p_mitglied_id;
  if not found or not is_verein_admin(v.verein_id) then
    raise exception 'Dafür fehlt dir die Berechtigung.' using errcode = '42501';
  end if;
  if p_daten ? 'email' and nullif(btrim(coalesce(p_daten ->> 'email', '')), '') is not null and import_email(p_daten) is null then
    raise exception 'Bitte eine gültige E-Mail-Adresse eingeben.' using errcode = 'P0001';
  end if;
  if p_daten ? 'gruppe_id' and nullif(p_daten ->> 'gruppe_id', '') is not null then
    select g.id into v_gid from gruppen g where g.id = (p_daten ->> 'gruppe_id')::uuid and g.verein_id = v.verein_id;
    if v_gid is null then raise exception 'Gruppe nicht gefunden.' using errcode = 'P0001'; end if;
  end if;
  update mitglieder m set
    vorname = case when p_daten ? 'vorname' then coalesce(import_text(p_daten, 'vorname', 100), m.vorname) else m.vorname end,
    nachname = case when p_daten ? 'nachname' then coalesce(import_text(p_daten, 'nachname', 100), m.nachname) else m.nachname end,
    email = case when p_daten ? 'email' then import_email(p_daten) else m.email end,
    mitgliedsnummer = case when p_daten ? 'mitgliedsnummer' then import_text(p_daten, 'mitgliedsnummer', 50) else m.mitgliedsnummer end,
    gruppe_id = case when p_daten ? 'gruppe_id' then v_gid else m.gruppe_id end,
    updated_at = now()
  where m.id = p_mitglied_id;
end;
$$;
revoke all on function public.mitglied_stammdaten_aendern(uuid, jsonb) from public, anon;
grant execute on function public.mitglied_stammdaten_aendern(uuid, jsonb) to authenticated;

-- Stammdatensatz ohne TanzRaum-Konto entfernen (Konto-Mitgliedschaften werden hier nie beruehrt)
create or replace function public.mitglied_stammdaten_entfernen(p_mitglied_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v mitglieder%rowtype;
begin
  select * into v from mitglieder where id = p_mitglied_id;
  if not found or not is_verein_admin(v.verein_id) then
    raise exception 'Dafür fehlt dir die Berechtigung.' using errcode = '42501';
  end if;
  if v.vereins_mitglied_id is not null then
    raise exception 'Dieses Mitglied hat ein TanzRaum-Konto – bitte über die Mitgliederverwaltung entfernen.' using errcode = 'P0001';
  end if;
  delete from mitglieder where id = p_mitglied_id;
end;
$$;
revoke all on function public.mitglied_stammdaten_entfernen(uuid) from public, anon;
grant execute on function public.mitglied_stammdaten_entfernen(uuid) to authenticated;

-- ── Persoenliche Einladungslinks ──────────────────────────────────────────────────────────────────────
-- Erzeugt je Mitglied ohne Konto einen persoenlichen Link (oder liefert den offenen): zufaelliger Token,
-- 30 Tage gueltig, einmal verwendbar, widerrufbar, keine Personendaten in der URL.
create or replace function public.mitglied_einladungen_erstellen(p_verein_id uuid, p_mitglied_ids uuid[])
returns table(mitglied_id uuid, einladung_id uuid, token uuid, email text)
language plpgsql security definer set search_path to 'public' as $$
declare
  m mitglieder%rowtype;
  v_eid uuid;
  v_rolle uuid;
begin
  if not is_verein_admin(p_verein_id) then
    raise exception 'Nur Vereinsadmins dürfen Mitglieder einladen.' using errcode = '42501';
  end if;
  if not verein_hat_lizenz(p_verein_id) then
    raise exception 'Einladungen gibt es mit der Vereinslizenz.' using errcode = '42501';
  end if;
  if cardinality(coalesce(p_mitglied_ids, '{}')) > 500 then
    raise exception 'Höchstens 500 Mitglieder auf einmal.' using errcode = 'P0001';
  end if;
  for m in select * from mitglieder x where x.id = any (p_mitglied_ids) and x.verein_id = p_verein_id and x.vereins_mitglied_id is null loop
    v_eid := mitglied_offene_einladung(m.id);
    if v_eid is null then
      select r.id into v_rolle from rollen r where r.name = case when m.geschlecht = 'weiblich' then 'Tänzerin' else 'Tänzer' end;
      insert into einladungen (verein_id, rolle_id, created_by, expires_at, max_uses, mitglied_id, email)
      values (p_verein_id, v_rolle, auth.uid(), now() + interval '30 days', 1, m.id, m.email)
      returning id into v_eid;
    end if;
    return query select m.id, e.id, e.token, m.email from einladungen e where e.id = v_eid;
  end loop;
end;
$$;
revoke all on function public.mitglied_einladungen_erstellen(uuid, uuid[]) from public, anon;
grant execute on function public.mitglied_einladungen_erstellen(uuid, uuid[]) to authenticated;

-- Vor dem E-Mail-Versand: Empfaenger (hinterlegte Adresse) + Schutz gegen versehentliches Mehrfachsenden (10 Minuten)
create or replace function public.mitglied_einladung_versand(p_einladung_id uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare e einladungen%rowtype; v_email text;
begin
  select * into e from einladungen where id = p_einladung_id;
  if not found or e.mitglied_id is null or not is_verein_admin(e.verein_id) then
    raise exception 'Dafür fehlt dir die Berechtigung.' using errcode = '42501';
  end if;
  if e.revoked or e.uses >= e.max_uses or (e.expires_at is not null and e.expires_at <= now()) then
    raise exception 'Diese Einladung ist nicht mehr gültig.' using errcode = 'P0001';
  end if;
  select m.email into v_email from mitglieder m where m.id = e.mitglied_id;
  if v_email is null then
    raise exception 'Für dieses Mitglied ist keine E-Mail-Adresse hinterlegt.' using errcode = 'P0001';
  end if;
  if e.gesendet_am is not null and e.gesendet_am > now() - interval '10 minutes' then
    raise exception 'Die Einladung wurde gerade erst gesendet. Bitte warte ein paar Minuten, bevor du sie erneut sendest.' using errcode = 'P0001';
  end if;
  return v_email;
end;
$$;
revoke all on function public.mitglied_einladung_versand(uuid) from public, anon;
grant execute on function public.mitglied_einladung_versand(uuid) to authenticated;

-- Nach erfolgreichem Versand: Zeitpunkt merken, Gueltigkeit ab jetzt 30 Tage
create or replace function public.mitglied_einladung_gesendet(p_einladung_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare e einladungen%rowtype;
begin
  select * into e from einladungen where id = p_einladung_id;
  if not found or e.mitglied_id is null or not is_verein_admin(e.verein_id) then
    raise exception 'Dafür fehlt dir die Berechtigung.' using errcode = '42501';
  end if;
  update einladungen set gesendet_am = now(), gesendet_anzahl = gesendet_anzahl + 1,
    expires_at = greatest(coalesce(expires_at, now()), now() + interval '30 days'),
    email = (select m.email from mitglieder m where m.id = e.mitglied_id)
  where id = p_einladung_id;
end;
$$;
revoke all on function public.mitglied_einladung_gesendet(uuid) from public, anon;
grant execute on function public.mitglied_einladung_gesendet(uuid) to authenticated;

create or replace function public.mitglied_einladung_widerrufen(p_mitglied_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v mitglieder%rowtype;
begin
  select * into v from mitglieder where id = p_mitglied_id;
  if not found or not is_verein_admin(v.verein_id) then
    raise exception 'Dafür fehlt dir die Berechtigung.' using errcode = '42501';
  end if;
  update einladungen set revoked = true where mitglied_id = p_mitglied_id and not revoked and uses < max_uses;
end;
$$;
revoke all on function public.mitglied_einladung_widerrufen(uuid) from public, anon;
grant execute on function public.mitglied_einladung_widerrufen(uuid) to authenticated;

-- ── Einladungsseite: persoenliche Einladung kennzeichnen (ohne Personendaten) ─────────────────────────
drop function if exists public.einladung_vorschau(uuid);
create function public.einladung_vorschau(p_token uuid)
returns table(verein_name text, rolle text, gruppe_name text, gueltig boolean, grund text, admin_einladung boolean, persoenlich boolean)
language sql stable security definer set search_path to 'public' as $$
  select v.name, r.name, coalesce(g.name, gm.name),
    (not e.revoked and (e.expires_at is null or e.expires_at > now()) and e.uses < e.max_uses),
    case when e.revoked then 'Diese Einladung wurde zurückgezogen.'
         when e.expires_at is not null and e.expires_at <= now() then 'Diese Einladung ist abgelaufen.'
         when e.uses >= e.max_uses then 'Diese Einladung wurde bereits verwendet.' end,
    coalesce(rollen_typ(r.name) = 'admin', false),
    e.mitglied_id is not null
  from einladungen e
  join vereine v on v.id = e.verein_id
  left join rollen r on r.id = e.rolle_id
  left join gruppen g on g.id = e.gruppe_id
  left join mitglieder m on m.id = e.mitglied_id
  left join gruppen gm on gm.id = m.gruppe_id
  where e.token = p_token;
$$;
revoke all on function public.einladung_vorschau(uuid) from public;
grant execute on function public.einladung_vorschau(uuid) to anon, authenticated;

-- ── Einloesen: Konto mit vorhandenem Stammdatensatz verbinden ─────────────────────────────────────────
create or replace function public.invite_einloesen(p_token uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_row einladungen%rowtype;
  v_m mitglieder%rowtype;
  v_verein_name text;
  v_existing_id uuid;
  v_bisher uuid;
  v_vm_id uuid;
  v_antrag uuid;
  v_gruppe uuid;
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
  -- Persoenliche Einladung: der Stammdatensatz darf noch mit keinem Konto verbunden sein
  if v_row.mitglied_id is not null then
    select * into v_m from mitglieder where id = v_row.mitglied_id for update;
    if not found or v_m.verein_id <> v_row.verein_id then
      return jsonb_build_object('success', false, 'error', 'Einladungslink ungültig.');
    end if;
    if v_m.vereins_mitglied_id is not null then
      return jsonb_build_object('success', false, 'error', 'Diese Einladung wurde bereits verwendet.');
    end if;
    v_gruppe := v_m.gruppe_id;
  end if;
  select name into v_verein_name from vereine where id = v_row.verein_id;

  select id into v_existing_id from vereins_mitglieder where user_id = auth.uid() and verein_id = v_row.verein_id;
  if v_existing_id is not null and v_row.gruppe_id is null and v_row.mitglied_id is null then
    return jsonb_build_object('success', false, 'error', 'Du bist bereits Mitglied in diesem Verein.');
  end if;
  if v_existing_id is not null and v_row.mitglied_id is not null
     and exists (select 1 from mitglieder x where x.vereins_mitglied_id = v_existing_id) then
    return jsonb_build_object('success', false, 'error', 'Dein Konto ist in diesem Verein bereits mit einem Mitglied verbunden.');
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
      -- Persoenliche Einladung: Konto vormerken – die Verbindung entsteht automatisch beim Wechsel
      if v_row.mitglied_id is not null then
        update mitglieder set user_id = auth.uid(), updated_at = now() where id = v_row.mitglied_id;
      end if;
      update einladungen set uses = uses + 1 where id = v_row.id;
      return jsonb_build_object('success', false, 'error',
        'Du bist noch einem anderen Verein zugeordnet. Wir haben deinen bisherigen Verein um Freigabe gebeten – danach wirst du ' ||
        coalesce(v_verein_name, 'dem neuen Verein') || ' hinzugefügt.');
    end if;
    insert into vereins_mitglieder (user_id, verein_id, rolle_id, hinzugefuegt_von)
    values (auth.uid(), v_row.verein_id, v_row.rolle_id, v_row.created_by)
    returning id into v_vm_id;
    -- Kein Mitgliedsantrag: Vereinsadmin-Einladung der Plattform, oder persoenliche Einladung eines bereits
    -- im Verein gefuehrten (importierten/angelegten) Mitglieds
    if v_row.mitglied_id is null
       and not (exists (select 1 from rollen r where r.id = v_row.rolle_id and rollen_typ(r.name) = 'admin')
                and exists (select 1 from profiles p where p.id = v_row.created_by and p.ist_plattform_admin)) then
      v_antrag := vereinsbeitritt_vorbereiten(v_vm_id, v_row.created_by);
    end if;
  else
    v_vm_id := v_existing_id;
  end if;

  if v_row.mitglied_id is not null then
    update mitglieder set user_id = auth.uid(), vereins_mitglied_id = v_vm_id, updated_at = now() where id = v_row.mitglied_id;
  end if;
  v_gruppe := coalesce(v_row.gruppe_id, v_gruppe);
  if v_gruppe is not null then
    begin
      insert into gruppen_mitglieder (gruppe_id, vereins_mitglied_id, funktion) values (v_gruppe, v_vm_id, 'mitglied')
      on conflict do nothing;
    exception when others then null;
    end;
  end if;

  update einladungen set uses = uses + 1 where id = v_row.id;
  return jsonb_build_object('success', true, 'verein_name', v_verein_name, 'verein_id', v_row.verein_id, 'antrag_id', v_antrag);
end;
$$;

-- Nach einem freigegebenen Vereinswechsel: vorgemerkten Stammdatensatz automatisch verbinden
create or replace function public.mitglied_konto_verbinden()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_m uuid; v_g uuid;
begin
  select m.id, m.gruppe_id into v_m, v_g from mitglieder m
  where m.verein_id = new.verein_id and m.user_id = new.user_id and m.vereins_mitglied_id is null
  order by m.updated_at desc limit 1;
  if v_m is not null then
    update mitglieder set vereins_mitglied_id = new.id, updated_at = now() where id = v_m;
    if v_g is not null then
      begin
        insert into gruppen_mitglieder (gruppe_id, vereins_mitglied_id, funktion) values (v_g, new.id, 'mitglied') on conflict do nothing;
      exception when others then null;
      end;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists vereins_mitglieder_stammdaten_verbinden on public.vereins_mitglieder;
create trigger vereins_mitglieder_stammdaten_verbinden after insert on public.vereins_mitglieder
  for each row execute function public.mitglied_konto_verbinden();
