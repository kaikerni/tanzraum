-- Vereinslizenz (jaehrlich) per Ueberweisung – ohne Zahlungsanbieter, ohne Gebuehren.
-- Ablauf: Vereinsadmin beantragt -> Zahlungsaufforderung (Mail + PDF mit Bankverbindung und Referenz) ->
-- Plattform-Admin bestaetigt den Zahlungseingang -> Lizenz 1 Jahr aktiv + Rechnung. 30 Tage vor Ablauf automatisch
-- neue Zahlungsaufforderung; ohne Zahlung laeuft die Lizenz zum Stichtag aus. Freischaltung erst nach Zahlungseingang.

-- 1) Anbieter "ueberweisung" fuer Abos
alter table public.abos drop constraint if exists abos_anbieter_check;
alter table public.abos add constraint abos_anbieter_check check (anbieter = any (array['stripe', 'paypal', 'manuell', 'ueberweisung']));

-- 2) Bankverbindung in den Anbieterangaben (nur Plattform-Admin liest/pflegt; Vereinsadmins sehen sie nur zu einer
--    offenen Zahlungsaufforderung ueber mein_tarif_status / die Aufforderung selbst)
alter table public.plattform_anbieter
  add column if not exists bank_inhaber text,
  add column if not exists iban text,
  add column if not exists bic text,
  add column if not exists bank_name text;
grant select (bank_inhaber, iban, bic, bank_name), update (bank_inhaber, iban, bic, bank_name) on public.plattform_anbieter to authenticated;

create or replace function public.plattform_anbieter_bank_pruefen()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.bank_inhaber := nullif(btrim(coalesce(new.bank_inhaber, '')), '');
  new.bank_name := nullif(btrim(coalesce(new.bank_name, '')), '');
  new.iban := nullif(upper(regexp_replace(coalesce(new.iban, ''), '\s', '', 'g')), '');
  new.bic := nullif(upper(regexp_replace(coalesce(new.bic, ''), '\s', '', 'g')), '');
  if new.iban is not null and new.iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then
    raise exception 'Bitte eine gültige IBAN angeben.' using errcode = 'P0001';
  end if;
  if new.bic is not null and new.bic !~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$' then
    raise exception 'Bitte eine gültige BIC angeben.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists plattform_anbieter_bank on public.plattform_anbieter;
create trigger plattform_anbieter_bank before insert or update on public.plattform_anbieter
  for each row execute function public.plattform_anbieter_bank_pruefen();

-- 3) Zahlungsaufforderungen
create table if not exists public.zahlungsaufforderungen (
  id uuid primary key default gen_random_uuid(),
  abo_id uuid references public.abos(id) on delete set null,
  verein_id uuid not null references public.vereine(id) on delete cascade,
  art text not null check (art in ('neu', 'verlaengerung')),
  betrag_cent int not null check (betrag_cent > 0),
  referenz text not null unique,
  empfaenger_email text,
  faellig_am date not null,
  status text not null default 'offen' check (status in ('offen', 'bezahlt', 'storniert')),
  erstellt_am timestamptz not null default now(),
  erstellt_von uuid,
  versendet_am timestamptz,
  bezahlt_am timestamptz,
  bestaetigt_von uuid,
  storniert_am timestamptz,
  rechnung_id uuid references public.rechnungen(id)
);
create index if not exists zahlungsaufforderungen_verein on public.zahlungsaufforderungen (verein_id, status);
create index if not exists zahlungsaufforderungen_abo on public.zahlungsaufforderungen (abo_id, status);
alter table public.zahlungsaufforderungen enable row level security;
drop policy if exists "Vereinsadmin und Plattform-Admin lesen" on public.zahlungsaufforderungen;
create policy "Vereinsadmin und Plattform-Admin lesen" on public.zahlungsaufforderungen
  for select to authenticated using (is_verein_admin(verein_id) or ist_plattform_admin_aktuell());
revoke insert, update, delete on public.zahlungsaufforderungen from authenticated, anon;

-- Kurze, gut abtippbare Referenz fuer den Verwendungszweck (ohne 0/O/1/I)
create or replace function public.zahlungsreferenz_neu()
returns text
language plpgsql
set search_path to 'public'
as $$
declare
  z constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  r text;
begin
  loop
    r := 'ZA-';
    for i in 1..6 loop
      r := r || substr(z, 1 + floor(random() * length(z))::int, 1);
    end loop;
    exit when not exists (select 1 from zahlungsaufforderungen where referenz = r);
  end loop;
  return r;
end;
$$;

-- Lizenzzeitraum: Start (Tag) -> laeuft_bis = Start + 1 Jahr, 00:00 Uhr Berlin (wie Periodenende bei Stripe)
create or replace function public.lizenz_ende(p_von date)
returns timestamptz
language sql
stable
as $$ select ((p_von + interval '1 year')::date::timestamp at time zone 'Europe/Berlin') $$;

-- 4) Beantragen (Vereinsadmin)
create or replace function public.ueberweisung_beantragen(p_verein_id uuid, p_leistungsbeginn_version text, p_leistungsbeginn_text text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_preis int;
  v_abo uuid;
  v_id uuid;
  v_email text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if p_verein_id is null or not exists (
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
  insert into zahlungsaufforderungen (abo_id, verein_id, art, betrag_cent, referenz, empfaenger_email, faellig_am, erstellt_von)
  values (v_abo, p_verein_id, 'neu', v_preis, zahlungsreferenz_neu(), v_email, (now() at time zone 'Europe/Berlin')::date + 14, auth.uid())
  returning id into v_id;
  insert into einwilligungen (user_id, art, version, erteilt, quelle, erteilt_von, details)
  values (auth.uid(), 'vorzeitiger_leistungsbeginn', left(p_leistungsbeginn_version, 40), true, 'kauf', auth.uid(),
          jsonb_build_object('abo_id', v_abo, 'tarif', 'verein', 'periode', 'jahr', 'anbieter', 'ueberweisung', 'text', left(p_leistungsbeginn_text, 2000)));
  return v_id;
end;
$$;

-- 5) Zurueckziehen (Vereinsadmin, nur solange die erste Zahlung noch offen ist)
create or replace function public.ueberweisung_zurueckziehen(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  z zahlungsaufforderungen%rowtype;
begin
  select * into z from zahlungsaufforderungen where id = p_id for update;
  if z.id is null or not (is_verein_admin(z.verein_id) or ist_plattform_admin_aktuell()) then
    raise exception 'Nicht berechtigt.' using errcode = '42501';
  end if;
  if z.status <> 'offen' or z.art <> 'neu' then
    raise exception 'Diese Überweisung kann nicht mehr zurückgezogen werden.' using errcode = 'P0001';
  end if;
  update zahlungsaufforderungen set status = 'storniert', storniert_am = now() where id = z.id;
  delete from abos where id = z.abo_id and status = 'pending' and anbieter = 'ueberweisung';
end;
$$;

-- 6) Plattform-Admin: Liste
create or replace function public.admin_ueberweisungen()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nicht berechtigt.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', z.id, 'art', z.art, 'status', z.status, 'betrag_cent', z.betrag_cent, 'referenz', z.referenz,
      'verein_id', z.verein_id, 'verein_name', v.name, 'empfaenger_email', z.empfaenger_email,
      'faellig_am', z.faellig_am, 'erstellt_am', z.erstellt_am, 'versendet_am', z.versendet_am, 'bezahlt_am', z.bezahlt_am,
      'rechnung_id', z.rechnung_id, 'lizenz_bis', a.laeuft_bis)
      order by (z.status = 'offen') desc, z.faellig_am, z.erstellt_am desc)
    from zahlungsaufforderungen z
    join vereine v on v.id = z.verein_id
    left join abos a on a.id = z.abo_id
    where z.status = 'offen' or z.erstellt_am > now() - interval '180 days'), '[]'::jsonb);
end;
$$;

-- 7) Plattform-Admin: Zahlungseingang bestaetigen -> Lizenz 1 Jahr + Rechnung (Rueckgabe: Rechnungs-ID)
create or replace function public.admin_ueberweisung_bestaetigen(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  z zahlungsaufforderungen%rowtype;
  a abos%rowtype;
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
  v_von date;
  v_bis timestamptz;
  v_rechnung uuid;
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
  v_rechnung := erstelle_rechnung('verein', null, a.verein_id, 'verein', 'jahr', z.betrag_cent / 100.0, 'ueberweisung',
                                  v_von, (v_bis at time zone 'Europe/Berlin')::date - 1);
  update zahlungsaufforderungen set status = 'bezahlt', bezahlt_am = now(), bestaetigt_von = auth.uid(), rechnung_id = v_rechnung
   where id = z.id;
  return v_rechnung;
end;
$$;

-- 8) Plattform-Admin: stornieren (z. B. nie bezahlt). Erstanfrage -> Abo entfernt; Verlaengerung -> Lizenz laeuft aus.
create or replace function public.admin_ueberweisung_stornieren(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  z zahlungsaufforderungen%rowtype;
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nicht berechtigt.' using errcode = '42501'; end if;
  select * into z from zahlungsaufforderungen where id = p_id for update;
  if z.id is null or z.status <> 'offen' then raise exception 'Diese Zahlungsaufforderung ist nicht mehr offen.' using errcode = 'P0001'; end if;
  update zahlungsaufforderungen set status = 'storniert', storniert_am = now() where id = z.id;
  delete from abos where id = z.abo_id and status = 'pending' and anbieter = 'ueberweisung';
end;
$$;

-- 9) Verlaengerungen: 30 Tage vor Ablauf neue Zahlungsaufforderung (nur Dienst/Cron, gibt neue IDs fuer den Versand zurueck)
create or replace function public.ueberweisung_verlaengerungen()
returns setof uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  a record;
  v_id uuid;
  v_preis int;
  v_email text;
begin
  select preis_cent into v_preis from tarif_preise where tarif = 'verein' and periode = 'jahr';
  for a in
    select ab.* from abos ab
    where ab.anbieter = 'ueberweisung' and ab.status = 'active' and ab.gekuendigt_zum is null
      and ab.laeuft_bis is not null and ab.laeuft_bis <= now() + interval '30 days'
      and not exists (select 1 from zahlungsaufforderungen z where z.abo_id = ab.id and z.status = 'offen')
      and not exists (select 1 from zahlungsaufforderungen z where z.abo_id = ab.id and z.art = 'verlaengerung'
                        and z.erstellt_am > ab.laeuft_bis - interval '60 days')
  loop
    select email::text into v_email from auth.users where id = a.user_id;
    if v_email is null then
      select u.email::text into v_email from vereins_mitglieder vm join auth.users u on u.id = vm.user_id join rollen r on r.id = vm.rolle_id
       where vm.verein_id = a.verein_id and coalesce(vm.aktiv, true) and rollen_typ(r.name) = 'admin' limit 1;
    end if;
    insert into zahlungsaufforderungen (abo_id, verein_id, art, betrag_cent, referenz, empfaenger_email, faellig_am)
    values (a.id, a.verein_id, 'verlaengerung', coalesce(v_preis, a.preis_cent), zahlungsreferenz_neu(), v_email,
            (a.laeuft_bis at time zone 'Europe/Berlin')::date)
    returning id into v_id;
    return next v_id;
  end loop;
end;
$$;
revoke all on function public.ueberweisung_verlaengerungen() from public, anon, authenticated;
grant execute on function public.ueberweisung_verlaengerungen() to service_role;

-- 10) Ablauf: Ueberweisungs-Lizenzen enden zum Stichtag (ohne Zahlung), offene Erstanfragen verfallen nach 30 Tagen
create or replace function public.abos_ablaufen()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
begin
  for r in update abos set status = 'expired', aktualisiert_am = now()
           where (status = 'cancelled' and laeuft_bis is not null and laeuft_bis <= now())
              or (anbieter = 'ueberweisung' and status in ('active', 'past_due') and laeuft_bis is not null and laeuft_bis <= now())
           returning inhaber, user_id, verein_id loop
    if r.inhaber = 'person' then perform tarif_neu_berechnen_person(r.user_id, 'abgelaufen');
    else perform tarif_neu_berechnen_verein(r.verein_id, 'abgelaufen'); end if;
  end loop;
  update zahlungsaufforderungen z set status = 'storniert', storniert_am = now()
   where z.status = 'offen' and z.art = 'neu' and z.erstellt_am < now() - interval '30 days';
  delete from abos a where a.status = 'pending' and a.anbieter = 'ueberweisung'
     and not exists (select 1 from zahlungsaufforderungen z where z.abo_id = a.id and z.status = 'offen');
  delete from abos where status = 'pending' and anbieter <> 'ueberweisung' and erstellt_am < now() - interval '2 days';
  insert into vereins_lizenz_abdeckungen (verein_id, user_id, vereins_mitglied_id, status, source, starts_at)
  select vm.verein_id, vm.user_id, vm.id, 'active', 'club_license', now()
  from vereins_mitglieder vm
  where vm.user_id is not null and coalesce(vm.aktiv, true) and verein_hat_lizenz(vm.verein_id)
    and not exists (select 1 from vereins_lizenz_abdeckungen d where d.vereins_mitglied_id = vm.id and d.status = 'active');
  update vereins_lizenz_abdeckungen d set status = 'ended', ended_at = now(), ends_at = now()
  where d.status = 'active' and not exists (
    select 1 from vereins_mitglieder vm where vm.id = d.vereins_mitglied_id and coalesce(vm.aktiv, true) and verein_hat_lizenz(vm.verein_id));
end;
$$;

-- 11) Kauf per Stripe/PayPal nicht parallel zu einer offenen Ueberweisung; offene Ueberweisungs-Abos nicht wegraeumen
do $$
declare
  f text := pg_get_functiondef('public.abo_anlegen(text, text, text, uuid)'::regprocedure);
  n int := 0;
  alt1 text := $a$delete from abos where status = 'pending' and user_id = auth.uid() and erstellt_am < now() - interval '1 minute';$a$;
  neu1 text := $a$delete from abos where status = 'pending' and user_id = auth.uid() and anbieter <> 'ueberweisung' and erstellt_am < now() - interval '1 minute';$a$;
  alt2 text := $a$    if exists (select 1 from abos a where a.inhaber = 'verein' and a.verein_id = p_verein_id and abo_gilt(a)) then$a$;
  neu2 text := $a$    if exists (select 1 from zahlungsaufforderungen z where z.verein_id = p_verein_id and z.status = 'offen' and z.art = 'neu') then
      raise exception 'Für diesen Verein ist bereits eine Überweisung beauftragt – zieh sie unter „Mein Tarif“ zuerst zurück.' using errcode = 'P0001';
    end if;
    if exists (select 1 from abos a where a.inhaber = 'verein' and a.verein_id = p_verein_id and abo_gilt(a)) then$a$;
begin
  if position(alt1 in f) > 0 then f := replace(f, alt1, neu1); n := n + 1; end if;
  if position(alt2 in f) > 0 then f := replace(f, alt2, neu2); n := n + 1; end if;
  if n <> 2 then raise exception 'abo_anlegen: erwartete Stellen nicht gefunden (%).', n; end if;
  execute f;
end $$;

-- 12) Mein Tarif: offene Ueberweisung je verwaltetem Verein + Bankverbindung (nur wenn etwas offen ist)
create or replace function public.mein_tarif_status()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $$
  with admin_v as (
    select v.* from vereine v where exists (select 1 from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
      where vm.verein_id = v.id and vm.user_id = auth.uid() and coalesce(vm.aktiv, true) and rollen_typ(r.name) = 'admin')
  ), offen as (
    select z.* from zahlungsaufforderungen z where z.status = 'offen' and z.verein_id in (select id from admin_v)
  )
  select jsonb_build_object(
    'zugang', effektiver_zugang(auth.uid()),
    'verein_name', (select v.name from vereine v where v.id = vereinslizenz_verein_von(auth.uid())),
    'abos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'tarif', a.tarif, 'periode', a.periode, 'preis_cent', a.preis_cent,
        'anbieter', a.anbieter, 'status', a.status, 'laeuft_bis', a.laeuft_bis, 'gekuendigt_zum', a.gekuendigt_zum,
        'pause_grund', a.pause_grund, 'pausiert_am', a.pausiert_am, 'pause_verein', (select v.name from vereine v where v.id = a.pause_verein_id))
        order by a.erstellt_am desc)
      from abos a where a.inhaber = 'person' and a.user_id = auth.uid() and abo_gilt(a)), '[]'::jsonb),
    'admin_vereine', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'lizenz', verein_hat_lizenz(v.id),
        'lizenz_bis', v.tarif_aktiv_bis,
        'abo', (select jsonb_build_object('id', a.id, 'periode', a.periode, 'preis_cent', a.preis_cent, 'anbieter', a.anbieter, 'status', a.status,
                  'laeuft_bis', a.laeuft_bis, 'gekuendigt_zum', a.gekuendigt_zum)
                from abos a where a.inhaber = 'verein' and a.verein_id = v.id and abo_gilt(a) order by a.erstellt_am desc limit 1),
        'ueberweisung', (select jsonb_build_object('id', o.id, 'art', o.art, 'betrag_cent', o.betrag_cent, 'referenz', o.referenz,
                  'faellig_am', o.faellig_am, 'erstellt_am', o.erstellt_am, 'empfaenger_email', o.empfaenger_email)
                from offen o where o.verein_id = v.id order by o.erstellt_am desc limit 1))
        order by v.name)
      from admin_v v), '[]'::jsonb),
    'bank', case when exists (select 1 from offen) then
      (select jsonb_build_object('inhaber', p.bank_inhaber, 'iban', p.iban, 'bic', p.bic, 'bank', p.bank_name) from plattform_anbieter p where p.id = true)
      end,
    'ueberweisung_moeglich', exists (select 1 from plattform_anbieter p where p.id = true and p.iban is not null and p.bank_inhaber is not null));
$$;

revoke all on function public.ueberweisung_beantragen(uuid, text, text) from public, anon;
revoke all on function public.ueberweisung_zurueckziehen(uuid) from public, anon;
revoke all on function public.admin_ueberweisungen() from public, anon;
revoke all on function public.admin_ueberweisung_bestaetigen(uuid) from public, anon;
revoke all on function public.admin_ueberweisung_stornieren(uuid) from public, anon;
grant execute on function public.ueberweisung_beantragen(uuid, text, text) to authenticated;
grant execute on function public.ueberweisung_zurueckziehen(uuid) to authenticated;
grant execute on function public.admin_ueberweisungen() to authenticated;
grant execute on function public.admin_ueberweisung_bestaetigen(uuid) to authenticated;
grant execute on function public.admin_ueberweisung_stornieren(uuid) to authenticated;
