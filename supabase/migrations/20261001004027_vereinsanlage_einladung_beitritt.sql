-- Vereinsanlage durch die TanzRaum-Administration, manuelle Vereinslizenz (z. B. Pilot: 0 €, 1 Jahr),
-- Vereinsadmin-Einladung (Registrierung bleibt Pflicht), oeffentliche Einladungsvorschau, Vereinssuche und
-- Beitrittsanfragen. Allgemein fuer jeden Verein – keine Sonderlogik fuer einzelne Vereine.

-- ---------- Verein anlegen (ohne dass die Administration Mitglied wird) ----------
create or replace function public.admin_verein_anlegen(
  p_name text, p_kuerzel text default null, p_strasse text default null, p_hausnummer text default null,
  p_plz text default null, p_ort text default null, p_email text default null, p_telefon text default null,
  p_webseite text default null, p_ansprechpartner text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  if v_name = '' or char_length(v_name) > 120 then raise exception 'Bitte einen Vereinsnamen angeben (höchstens 120 Zeichen).' using errcode = 'P0001'; end if;
  if exists (select 1 from vereine v where lower(v.name) = lower(v_name)) then
    raise exception 'Einen Verein mit diesem Namen gibt es bereits.' using errcode = 'P0001';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Bitte eine gültige E-Mail-Adresse angeben.' using errcode = 'P0001';
  end if;
  insert into vereine (name, kuerzel, strasse, hausnummer, plz, ort, email, telefon, webseite, ansprechpartner)
  values (v_name, nullif(btrim(coalesce(p_kuerzel, '')), ''), nullif(btrim(coalesce(p_strasse, '')), ''), nullif(btrim(coalesce(p_hausnummer, '')), ''),
          nullif(btrim(coalesce(p_plz, '')), ''), nullif(btrim(coalesce(p_ort, '')), ''), v_email, nullif(btrim(coalesce(p_telefon, '')), ''),
          nullif(btrim(coalesce(p_webseite, '')), ''), nullif(btrim(coalesce(p_ansprechpartner, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_verein_anlegen(text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_verein_anlegen(text, text, text, text, text, text, text, text, text, text) to authenticated;

-- ---------- Vereinslizenz manuell aktivieren (normale Lizenzlogik: Abo „manuell“ + Tarif-Neuberechnung) ----------
create or replace function public.admin_vereinslizenz_setzen(p_verein_id uuid, p_start date, p_monate integer, p_preis_cent integer, p_status text default 'active')
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_bis timestamptz;
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  if not exists (select 1 from vereine v where v.id = p_verein_id) then raise exception 'Verein nicht gefunden.' using errcode = 'P0001'; end if;
  if p_start is null or p_start > v_heute or p_start < v_heute - 366 then
    raise exception 'Der Start muss heute oder in den letzten 12 Monaten liegen.' using errcode = 'P0001';
  end if;
  if p_monate is null or p_monate < 1 or p_monate > 60 then raise exception 'Laufzeit: 1 bis 60 Monate.' using errcode = 'P0001'; end if;
  if p_preis_cent is null or p_preis_cent < 0 or p_preis_cent > 10000000 then raise exception 'Ungültiger Preis.' using errcode = 'P0001'; end if;
  if p_status not in ('active', 'trialing') then raise exception 'Status: aktiv oder Test.' using errcode = 'P0001'; end if;
  -- Eine laufende bezahlte Lizenz (Karte, PayPal, Überweisung) wird nicht ueberschrieben
  if exists (select 1 from abos a where a.inhaber = 'verein' and a.verein_id = p_verein_id and a.anbieter <> 'manuell' and abo_gilt(a)) then
    raise exception 'Der Verein hat bereits eine laufende bezahlte Lizenz.' using errcode = 'P0001';
  end if;
  v_bis := ((p_start + make_interval(months => p_monate))::timestamp + interval '23 hours 59 minutes') at time zone 'Europe/Berlin';
  if v_bis <= now() then raise exception 'Mit diesem Start wäre die Lizenz bereits abgelaufen.' using errcode = 'P0001'; end if;
  update abos set status = 'expired', aktualisiert_am = now()
  where inhaber = 'verein' and verein_id = p_verein_id and anbieter = 'manuell' and status in ('active', 'trialing');
  insert into abos (inhaber, user_id, verein_id, tarif, periode, preis_cent, anbieter, status, laeuft_bis)
  values ('verein', auth.uid(), p_verein_id, 'verein', case when p_monate % 12 = 0 then 'jahr' else 'monat' end, p_preis_cent, 'manuell', p_status, v_bis);
  perform tarif_neu_berechnen_verein(p_verein_id, 'admin_manuell');
  return jsonb_build_object('aktiv', verein_hat_lizenz(p_verein_id), 'bis', (select v.tarif_aktiv_bis from vereine v where v.id = p_verein_id));
end;
$$;
revoke all on function public.admin_vereinslizenz_setzen(uuid, date, integer, integer, text) from public, anon;
grant execute on function public.admin_vereinslizenz_setzen(uuid, date, integer, integer, text) to authenticated;

create or replace function public.admin_vereinslizenz_beenden(p_verein_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  update abos set status = 'expired', laeuft_bis = least(coalesce(laeuft_bis, now()), now()), aktualisiert_am = now()
  where inhaber = 'verein' and verein_id = p_verein_id and anbieter = 'manuell' and status in ('active', 'trialing');
  perform tarif_neu_berechnen_verein(p_verein_id, 'admin_manuell_beendet');
end;
$$;
revoke all on function public.admin_vereinslizenz_beenden(uuid) from public, anon;
grant execute on function public.admin_vereinslizenz_beenden(uuid) to authenticated;

-- ---------- Vereinsadmin einladen (Einladung ≠ Konto: die Person registriert sich selbst und nimmt dann an) ----------
alter table public.einladungen add column if not exists email text;
alter table public.einladungen drop constraint if exists einladungen_email_check;
alter table public.einladungen add constraint einladungen_email_check check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));

create or replace function public.admin_vereinsadmin_einladen(p_verein_id uuid, p_email text)
returns table(einladung_id uuid, token uuid) language plpgsql security definer set search_path to 'public' as $$
declare
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_rolle uuid;
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  if not exists (select 1 from vereine v where v.id = p_verein_id) then raise exception 'Verein nicht gefunden.' using errcode = 'P0001'; end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Bitte eine gültige E-Mail-Adresse angeben.' using errcode = 'P0001'; end if;
  select r.id into v_rolle from rollen r where rollen_typ(r.name) = 'admin' order by r.name limit 1;
  return query
  insert into einladungen (verein_id, rolle_id, created_by, expires_at, max_uses, email)
  values (p_verein_id, v_rolle, auth.uid(), now() + interval '14 days', 1, v_email)
  returning einladungen.id, einladungen.token;
end;
$$;
revoke all on function public.admin_vereinsadmin_einladen(uuid, text) from public, anon;
grant execute on function public.admin_vereinsadmin_einladen(uuid, text) to authenticated;

-- Vereinsadmin-Einladungen eines Vereins mit Status offen/angenommen/abgelaufen/widerrufen (nur Admin-Rolle)
create or replace function public.admin_vereinsadmin_einladungen(p_verein_id uuid)
returns table(id uuid, email text, erstellt_am timestamptz, gueltig_bis timestamptz, status text, token uuid)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  return query
  select e.id, e.email, e.created_at, e.expires_at,
    case when e.revoked then 'widerrufen' when e.uses >= e.max_uses then 'angenommen'
         when e.expires_at is not null and e.expires_at <= now() then 'abgelaufen' else 'offen' end,
    case when not e.revoked and e.uses < e.max_uses and (e.expires_at is null or e.expires_at > now()) then e.token end
  from einladungen e join rollen r on r.id = e.rolle_id
  where e.verein_id = p_verein_id and rollen_typ(r.name) = 'admin'
  order by e.created_at desc limit 20;
end;
$$;
revoke all on function public.admin_vereinsadmin_einladungen(uuid) from public, anon;
grant execute on function public.admin_vereinsadmin_einladungen(uuid) to authenticated;

create or replace function public.admin_einladung_widerrufen(p_einladung_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  update einladungen e set revoked = true from rollen r
  where e.id = p_einladung_id and r.id = e.rolle_id and rollen_typ(r.name) = 'admin';
end;
$$;
revoke all on function public.admin_einladung_widerrufen(uuid) from public, anon;
grant execute on function public.admin_einladung_widerrufen(uuid) to authenticated;

-- Einladungs-E-Mail: auch fuer Einladungen, die die TanzRaum-Administration selbst erstellt hat
create or replace function public.mail_einladung_daten(p_einladung_id uuid)
returns table(token uuid, verein_id uuid, verein_name text, rolle_name text, gruppe_name text, einlader text, gueltig_bis timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select e.token, e.verein_id, v.name, r.name, g.name, (select a.anzeige from anzeige_namen(array[auth.uid()]) a), e.expires_at
  from einladungen e
  join vereine v on v.id = e.verein_id
  left join rollen r on r.id = e.rolle_id
  left join gruppen g on g.id = e.gruppe_id
  where e.id = p_einladung_id
    and (is_verein_admin(e.verein_id) or (ist_plattform_admin_aktuell() and e.created_by = auth.uid()))
    and verein_hat_lizenz(e.verein_id)
    and not e.revoked and (e.expires_at is null or e.expires_at > now()) and e.uses < e.max_uses;
$$;

-- Oeffentliche Vorschau eines Einladungslinks (ohne Anmeldung): nur Verein, Rolle und Gueltigkeit
create or replace function public.einladung_vorschau(p_token uuid)
returns table(verein_name text, rolle text, gruppe_name text, gueltig boolean, grund text, admin_einladung boolean)
language sql stable security definer set search_path to 'public' as $$
  select v.name, r.name, g.name,
    (not e.revoked and (e.expires_at is null or e.expires_at > now()) and e.uses < e.max_uses),
    case when e.revoked then 'Diese Einladung wurde zurückgezogen.'
         when e.expires_at is not null and e.expires_at <= now() then 'Diese Einladung ist abgelaufen.'
         when e.uses >= e.max_uses then 'Diese Einladung wurde bereits verwendet.' end,
    coalesce(rollen_typ(r.name) = 'admin', false)
  from einladungen e
  join vereine v on v.id = e.verein_id
  left join rollen r on r.id = e.rolle_id
  left join gruppen g on g.id = e.gruppe_id
  where e.token = p_token;
$$;
revoke all on function public.einladung_vorschau(uuid) from public;
grant execute on function public.einladung_vorschau(uuid) to anon, authenticated;

-- ---------- Vereinssuche und Beitrittsanfragen (Nutzer registriert sich selbst) ----------
create table if not exists public.vereins_beitrittsanfragen (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nachricht text check (nachricht is null or char_length(nachricht) <= 500),
  status text not null default 'offen' check (status in ('offen', 'angenommen', 'abgelehnt', 'zurueckgezogen')),
  erstellt_am timestamptz not null default now(),
  entschieden_am timestamptz,
  entschieden_von uuid
);
create unique index if not exists vereins_beitrittsanfragen_offen on public.vereins_beitrittsanfragen (user_id) where status = 'offen';
create index if not exists vereins_beitrittsanfragen_verein on public.vereins_beitrittsanfragen (verein_id, status);
alter table public.vereins_beitrittsanfragen enable row level security;
drop policy if exists "Eigene Beitrittsanfragen sehen" on public.vereins_beitrittsanfragen;
create policy "Eigene Beitrittsanfragen sehen" on public.vereins_beitrittsanfragen for select to authenticated
  using (user_id = auth.uid() or is_verein_admin(verein_id) or hat_vereinsbereich(verein_id, 'beitritt'));
-- Schreiben nur ueber die Funktionen unten
revoke insert, update, delete on public.vereins_beitrittsanfragen from anon, authenticated;

create or replace function public.vereine_suchen(p_suche text)
returns table(verein_id uuid, name text, ort text, logo_url text)
language sql stable security definer set search_path to 'public' as $$
  select v.id, v.name, v.ort, v.logo_url from vereine v
  where auth.uid() is not null and char_length(btrim(coalesce(p_suche, ''))) >= 2
    and verein_hat_lizenz(v.id) and not coalesce(v.gesperrt, false)
    and (v.name ilike '%' || btrim(p_suche) || '%' or coalesce(v.kuerzel, '') ilike btrim(p_suche) || '%' or coalesce(v.ort, '') ilike btrim(p_suche) || '%')
  order by v.name limit 20;
$$;
revoke all on function public.vereine_suchen(text) from public, anon;
grant execute on function public.vereine_suchen(text) to authenticated;

create or replace function public.beitritt_anfragen(p_verein_id uuid, p_nachricht text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_id uuid;
  v_name text;
begin
  if auth.uid() is null then raise exception 'Bitte zuerst anmelden.' using errcode = '42501'; end if;
  if exists (select 1 from vereins_mitglieder vm where vm.user_id = auth.uid()) then
    raise exception 'Du bist bereits einem Verein zugeordnet. In TanzRaum gehört jede Person genau einem Verein an.' using errcode = 'P0001';
  end if;
  if not verein_hat_lizenz(p_verein_id) or exists (select 1 from vereine v where v.id = p_verein_id and coalesce(v.gesperrt, false)) then
    raise exception 'Bei diesem Verein ist gerade kein Beitritt über TanzRaum möglich.' using errcode = 'P0001';
  end if;
  if exists (select 1 from vereins_beitrittsanfragen a where a.user_id = auth.uid() and a.status = 'offen') then
    raise exception 'Du hast bereits eine offene Beitrittsanfrage.' using errcode = 'P0001';
  end if;
  insert into vereins_beitrittsanfragen (verein_id, user_id, nachricht)
  values (p_verein_id, auth.uid(), nullif(left(btrim(coalesce(p_nachricht, '')), 500), ''))
  returning id into v_id;
  select coalesce((select a.anzeige from anzeige_namen(array[auth.uid()]) a), 'Eine Person') into v_name;
  perform antrag_verwaltung_benachrichtigen(p_verein_id, 'Neue Beitrittsanfrage von ' || v_name || ' – bitte unter „Mitgliedsanträge“ annehmen oder ablehnen.');
  return v_id;
end;
$$;
revoke all on function public.beitritt_anfragen(uuid, text) from public, anon;
grant execute on function public.beitritt_anfragen(uuid, text) to authenticated;

create or replace function public.beitritt_anfrage_zurueckziehen(p_id uuid)
returns void language sql security definer set search_path to 'public' as $$
  update vereins_beitrittsanfragen set status = 'zurueckgezogen', entschieden_am = now()
  where id = p_id and user_id = auth.uid() and status = 'offen';
$$;
revoke all on function public.beitritt_anfrage_zurueckziehen(uuid) from public, anon;
grant execute on function public.beitritt_anfrage_zurueckziehen(uuid) to authenticated;

create or replace function public.meine_beitrittsanfragen()
returns table(id uuid, verein_id uuid, verein_name text, status text, erstellt_am timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select a.id, a.verein_id, v.name, a.status, a.erstellt_am
  from vereins_beitrittsanfragen a join vereine v on v.id = a.verein_id
  where a.user_id = auth.uid() order by a.erstellt_am desc limit 5;
$$;
revoke all on function public.meine_beitrittsanfragen() from public, anon;
grant execute on function public.meine_beitrittsanfragen() to authenticated;

create or replace function public.beitrittsanfragen_liste(p_verein_id uuid)
returns table(id uuid, name text, geschlecht text, nachricht text, erstellt_am timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not (is_verein_admin(p_verein_id) or hat_vereinsbereich(p_verein_id, 'beitritt')) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  return query
  select a.id, coalesce(nullif(btrim(coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')), ''), '@' || p.handle, 'Unbekannt'),
         geschlecht_normal(p.geschlecht), a.nachricht, a.erstellt_am
  from vereins_beitrittsanfragen a left join profiles p on p.id = a.user_id
  where a.verein_id = p_verein_id and a.status = 'offen'
  order by a.erstellt_am;
end;
$$;
revoke all on function public.beitrittsanfragen_liste(uuid) from public, anon;
grant execute on function public.beitrittsanfragen_liste(uuid) to authenticated;

-- Annehmen: Person wird Vereinsmitglied (gleicher Weg wie beim Hinzufuegen, inkl. Mitgliedsantrag falls verlangt)
create or replace function public.beitrittsanfrage_entscheiden(p_id uuid, p_annehmen boolean, p_rolle_id uuid default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  a vereins_beitrittsanfragen%rowtype;
  v_rolle uuid := p_rolle_id;
  v_vm uuid;
  v_name text;
begin
  select * into a from vereins_beitrittsanfragen where id = p_id and status = 'offen' for update;
  if a.id is null then raise exception 'Anfrage nicht gefunden oder bereits bearbeitet.' using errcode = 'P0001'; end if;
  if not (is_verein_admin(a.verein_id) or hat_vereinsbereich(a.verein_id, 'beitritt')) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  select name into v_name from vereine where id = a.verein_id;
  if not coalesce(p_annehmen, false) then
    update vereins_beitrittsanfragen set status = 'abgelehnt', entschieden_am = now(), entschieden_von = auth.uid() where id = a.id;
    perform antrag_person_benachrichtigen(a.user_id, 'Der Verein ' || coalesce(v_name, '') || ' hat deine Beitrittsanfrage nicht angenommen.');
    return null;
  end if;
  if exists (select 1 from vereins_mitglieder vm where vm.user_id = a.user_id) then
    raise exception 'Die Person ist inzwischen einem anderen Verein zugeordnet.' using errcode = 'P0001';
  end if;
  if v_rolle is null or not exists (select 1 from rollen r where r.id = v_rolle) then
    select r.id into v_rolle from rollen r where rolle_familie(r.name) = 'mitglied'
    order by (r.name = case when (select geschlecht_normal(p.geschlecht) from profiles p where p.id = a.user_id) = 'weiblich' then 'Tänzerin' else 'Tänzer' end) desc, r.name limit 1;
  end if;
  -- Vereinsadmin-Rechte nur ueber Einladung bzw. Mitgliederverwaltung, nicht ueber eine Beitrittsanfrage
  if rollen_typ((select r.name from rollen r where r.id = v_rolle)) = 'admin' then
    raise exception 'Über eine Beitrittsanfrage kann niemand Vereinsadmin werden.' using errcode = 'P0001';
  end if;
  insert into vereins_mitglieder (user_id, verein_id, rolle_id, hinzugefuegt_von) values (a.user_id, a.verein_id, v_rolle, auth.uid())
  returning id into v_vm;
  perform vereinsbeitritt_vorbereiten(v_vm, auth.uid());
  update vereins_beitrittsanfragen set status = 'angenommen', entschieden_am = now(), entschieden_von = auth.uid() where id = a.id;
  perform antrag_person_benachrichtigen(a.user_id, 'Willkommen! Der Verein ' || coalesce(v_name, '') || ' hat deine Beitrittsanfrage angenommen.');
  return v_vm;
end;
$$;
revoke all on function public.beitrittsanfrage_entscheiden(uuid, boolean, uuid) from public, anon;
grant execute on function public.beitrittsanfrage_entscheiden(uuid, boolean, uuid) to authenticated;
