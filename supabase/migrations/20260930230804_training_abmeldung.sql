-- Training & Abmeldung: feste Gruende (neutral fuer alle Gruppen), Anzeige ohne Quelle,
-- nur mit Vereinslizenz, genau ein konkreter Trainingstermin, Korrektur ohne Duplikate,
-- Benachrichtigung der zustaendigen Trainer, Trainer-/Betreuer-Sicht auf die Abmeldungen je Termin.

-- 1) Abmeldegruende: neue Gruende arzttermin/veranstaltung; bisherige Werte bleiben gueltig (keine Datenaenderung)
alter table public.trainings_abmeldungen drop constraint if exists trainings_abmeldungen_grund_kategorie_check;
alter table public.trainings_abmeldungen add constraint trainings_abmeldungen_grund_kategorie_check
  check (grund_kategorie in ('krankheit', 'schule', 'urlaub', 'arzttermin', 'veranstaltung', 'familie', 'sonstiges', 'arbeit', 'verletzung'));

create or replace function public.abmeldegrund_text(p_kategorie text, p_hinweis text)
returns text language sql immutable set search_path to 'public' as $$
  select case p_kategorie
      when 'krankheit' then 'Krank' when 'schule' then 'Schule' when 'urlaub' then 'Urlaub'
      when 'arzttermin' then 'Arzttermin' when 'veranstaltung' then 'Andere Veranstaltung'
      when 'familie' then 'Familie / privat' when 'arbeit' then 'Arbeit' when 'verletzung' then 'Verletzung'
      else 'Sonstiger Grund' end
    || coalesce(' – ' || nullif(btrim(p_hinweis), ''), '');
$$;

create or replace function public.abmeldegrund_emoji(p_kategorie text)
returns text language sql immutable set search_path to 'public' as $$
  select case p_kategorie
      when 'krankheit' then '🤒' when 'schule' then '🏫' when 'urlaub' then '🏖️' when 'arzttermin' then '🩺'
      when 'veranstaltung' then '💃' when 'familie' then '👨‍👩‍👧' when 'arbeit' then '💼' when 'verletzung' then '🩹'
      else '✏️' end;
$$;

-- 2) Vorbereitung beim Eintragen UND Aendern: keine Quellenangabe mehr im Anzeigetext ("abgemeldet ist abgemeldet"),
--    nur mit Vereinslizenz, nur fuer einen tatsaechlich stattfindenden Termin; beim Aendern bleiben Person/Termin/Zeitpunkt fest.
create or replace function public.trainings_abmeldung_vorbereiten()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_kind_user uuid;
begin
  if tg_op = 'UPDATE' then
    new.verein_id := old.verein_id;
    new.gruppe_id := old.gruppe_id;
    new.datum := old.datum;
    new.vereins_mitglied_id := old.vereins_mitglied_id;
    new.erstellt_am := old.erstellt_am;
  end if;
  if not verein_hat_lizenz(new.verein_id) then
    raise exception 'Training & Abmeldung gibt es nur mit der Vereinslizenz.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and not exists (
      select 1 from trainingstermine tt
      where tt.gruppe_id = new.gruppe_id
        and ((tt.ist_wiederholend and tt.wochentag = extract(isodow from new.datum)::int)
          or (not tt.ist_wiederholend and tt.datum = new.datum))) then
    raise exception 'An diesem Tag findet für diese Gruppe kein Training statt.' using errcode = 'P0001';
  end if;

  select vm.user_id into v_kind_user from vereins_mitglieder vm where vm.id = new.vereins_mitglied_id;
  new.eingetragen_von := auth.uid();
  -- Quelle bleibt intern (Nachvollziehbarkeit/Datenexport), wird aber nirgends angezeigt
  new.quelle := case
    when auth.uid() is not null and auth.uid() = v_kind_user then 'selbst'
    when auth.uid() is not null and (ist_elternteil_von(auth.uid(), v_kind_user) or exists (
           select 1 from eltern_kind_zuordnung ekz join vereins_mitglieder e on e.id = ekz.eltern_vm_id
           where ekz.kind_vm_id = new.vereins_mitglied_id and e.user_id = auth.uid())) then 'eltern'
    else 'manuell'
  end;
  new.hinweis := left(nullif(btrim(coalesce(new.hinweis, '')), ''), 300);
  if new.grund_kategorie is not null then
    new.grund := left(abmeldegrund_text(new.grund_kategorie, new.hinweis), 300);
  end if;
  return new;
end;
$$;

drop trigger if exists trainings_abmeldung_vorbereiten on public.trainings_abmeldungen;
create trigger trainings_abmeldung_vorbereiten before insert or update on public.trainings_abmeldungen
  for each row execute function public.trainings_abmeldung_vorbereiten();

-- 3) Korrigieren statt doppelt eintragen (ein Status je Person und Termin): UPDATE im Rahmen der bestehenden Rechte
drop policy if exists "Trainer korrigieren Abmeldungen (update)" on public.trainings_abmeldungen;
create policy "Trainer korrigieren Abmeldungen (update)" on public.trainings_abmeldungen
  for update to authenticated
  using (ist_gruppen_betreuung(gruppe_id))
  with check (ist_gruppen_betreuung(gruppe_id));

drop policy if exists "Mitglied/Eltern aendern eigene Abmeldung (update)" on public.trainings_abmeldungen;
create policy "Mitglied/Eltern aendern eigene Abmeldung (update)" on public.trainings_abmeldungen
  for update to authenticated
  using (datum >= current_date and ist_eigenes_oder_kind(vereins_mitglied_id))
  with check (datum >= current_date and ist_eigenes_oder_kind(vereins_mitglied_id));

-- 4) Neue Abmeldung -> bestehende Benachrichtigungen an die Trainer dieser Gruppe (nicht an die eintragende Person)
create or replace function public.trainings_abmeldung_benachrichtigen()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
  v_name text;
  v_gruppe text;
begin
  if new.datum < v_heute then return null; end if;
  select coalesce(nullif(btrim(coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')), ''), 'Ein Mitglied') into v_name
  from vereins_mitglieder vm left join profiles p on p.id = vm.user_id where vm.id = new.vereins_mitglied_id;
  select g.name into v_gruppe from gruppen g where g.id = new.gruppe_id;
  insert into benachrichtigungen (user_id, typ, text)
  select distinct vm.user_id, 'training_abmeldung',
    left('🔴 Neue Abmeldung: ' || coalesce(v_name, 'Ein Mitglied') || ' – ' || abmeldegrund_emoji(new.grund_kategorie) || ' '
         || abmeldegrund_text(new.grund_kategorie, null) || ' (' || coalesce(v_gruppe, 'Training') || ', '
         || case when new.datum = v_heute then 'heute' when new.datum = v_heute + 1 then 'morgen' else to_char(new.datum, 'DD.MM.') end
         || ')', 500)
  from gruppen_mitglieder gm
  join vereins_mitglieder vm on vm.id = gm.vereins_mitglied_id
  where gm.gruppe_id = new.gruppe_id and gm.funktion = 'trainer'
    and vm.user_id is not null and coalesce(vm.aktiv, true)
    and vm.user_id is distinct from auth.uid();
  return null;
end;
$$;

drop trigger if exists trainings_abmeldung_benachrichtigen on public.trainings_abmeldungen;
create trigger trainings_abmeldung_benachrichtigen after insert on public.trainings_abmeldungen
  for each row execute function public.trainings_abmeldung_benachrichtigen();

-- Push (bestehender Weg ueber chat-push/benachrichtigung_push_ziele), nur mit Push-Kategorie "abmeldung"
create or replace function public.training_abmeldung_push_ausloesen()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_geheimnis text;
begin
  if new.typ <> 'training_abmeldung' then return null; end if;
  select decrypted_secret into v_geheimnis from vault.decrypted_secrets where name = 'chat_push_geheimnis';
  if v_geheimnis is null then return null; end if;
  perform net.http_post(
    url := 'https://oraiqjulxmohclfixwdq.supabase.co/functions/v1/chat-push',
    body := jsonb_build_object('benachrichtigung_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tanzraum-geheimnis', v_geheimnis),
    timeout_milliseconds := 5000);
  return null;
exception when others then
  return null; -- Push darf das Anlegen nie verhindern
end;
$$;
revoke all on function public.training_abmeldung_push_ausloesen() from public, anon, authenticated;

drop trigger if exists training_abmeldung_push on public.benachrichtigungen;
create trigger training_abmeldung_push after insert on public.benachrichtigungen
  for each row when (new.typ = 'training_abmeldung') execute function public.training_abmeldung_push_ausloesen();

create or replace function public.benachrichtigung_push_ziele(p_geheimnis text, p_benachrichtigung_id uuid)
returns table(abo_id uuid, endpoint text) language plpgsql security definer set search_path to 'public' as $$
declare
  b benachrichtigungen%rowtype;
begin
  if not interner_aufruf_ok(p_geheimnis) then
    raise exception 'Nicht berechtigt' using errcode = '42501';
  end if;
  select * into b from benachrichtigungen where id = p_benachrichtigung_id;
  if b.id is null or b.typ not in ('fahrgemeinschaft', 'training_abmeldung') or b.gelesen or b.erstellt_am < now() - interval '10 minutes' then return; end if;
  return query
  select ps.id, ps.endpoint from push_subscriptions ps
  where ps.user_id = b.user_id
    and push_erlaubt(ps.user_id)
    and push_kategorie_aktiv(ps.user_id, case b.typ when 'training_abmeldung' then 'abmeldung' else 'fahrgemeinschaften' end);
end;
$$;

create or replace function public.meine_push_training_abmeldung()
returns table(id uuid, text text) language sql stable security definer set search_path to 'public' as $$
  select b.id, b.text from benachrichtigungen b
  where b.user_id = auth.uid() and b.typ = 'training_abmeldung' and not b.gelesen and b.erstellt_am > now() - interval '3 minutes'
  order by b.erstellt_am desc limit 1;
$$;
revoke all on function public.meine_push_training_abmeldung() from public, anon;
grant execute on function public.meine_push_training_abmeldung() to authenticated;

-- 5) Trainingskalender: nur mit Vereinslizenz; sichtbar sind nur die eigenen Gruppen, die der Kinder und die
--    betreuten Gruppen (Vereinsadmin: alle). Trainer/Betreuer der Gruppe erhalten die Abmeldungen je Termin.
drop function if exists public.training_kalender(date, date);
create function public.training_kalender(p_von date, p_bis date)
returns table(termin_id uuid, verein_id uuid, verein_name text, gruppe_id uuid, gruppe_name text, datum date,
              von time without time zone, bis time without time zone, halle text, titel text, wiederholend boolean,
              darf_verwalten boolean, darf_anwesenheit boolean, personen jsonb, abmeldungen jsonb)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
declare
  v_bis date := least(p_bis, p_von + 62);
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  with meine as (
    select vm.id as vm_id, vm.user_id, true as ich from vereins_mitglieder vm
    where vm.user_id = auth.uid() and coalesce(vm.aktiv, true)
    union
    select k.id, k.user_id, false from eltern_kind_zuordnung ekz
    join vereins_mitglieder e on e.id = ekz.eltern_vm_id and e.user_id = auth.uid() and coalesce(e.aktiv, true)
    join vereins_mitglieder k on k.id = ekz.kind_vm_id and coalesce(k.aktiv, true)
  ),
  sichtbar as (
    select tt.* from trainingstermine tt
    where verein_hat_lizenz(tt.verein_id)
      and (is_verein_admin(tt.verein_id)
        or ist_gruppen_betreuung_erweitert(tt.gruppe_id)
        or exists (select 1 from gruppen_mitglieder gm join meine m on m.vm_id = gm.vereins_mitglied_id
                   where gm.gruppe_id = tt.gruppe_id))
  ),
  tage as (
    select s.id as tid, d::date as tag
    from sichtbar s, generate_series(p_von, v_bis, interval '1 day') d
    where (s.ist_wiederholend and extract(isodow from d) = s.wochentag)
       or (not s.ist_wiederholend and s.datum = d::date)
  ),
  basis as (
    select s.id as b_id, s.verein_id as b_verein, s.gruppe_id as b_gruppe, t.tag as b_tag, s.von as b_von, s.bis as b_bis,
      s.halle as b_halle, s.titel as b_titel, s.ist_wiederholend as b_wiederholend,
      ist_gruppen_betreuung(s.gruppe_id) as b_verwalten,
      is_verein_admin(s.verein_id) or (ist_gruppen_betreuung_erweitert(s.gruppe_id) and hat_vereinsbereich(s.verein_id, 'anwesenheit')) as b_anwesenheit
    from tage t join sichtbar s on s.id = t.tid
  )
  select b.b_id, b.b_verein, v.name, b.b_gruppe, g.name, b.b_tag, b.b_von, b.b_bis, b.b_halle, b.b_titel, b.b_wiederholend,
    b.b_verwalten, b.b_anwesenheit,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'vm_id', m.vm_id,
        'name', (select a.anzeige from anzeige_namen(array[m.user_id]) a),
        'ich', m.ich,
        'abgemeldet', ab.id is not null,
        'grund', ab.grund,
        'kategorie', ab.grund_kategorie,
        'hinweis', ab.hinweis) order by m.ich desc)
      from meine m
      join gruppen_mitglieder gm on gm.vereins_mitglied_id = m.vm_id and gm.gruppe_id = b.b_gruppe
        and coalesce(gm.funktion, 'mitglied') = 'mitglied'
      left join trainings_abmeldungen ab on ab.vereins_mitglied_id = m.vm_id and ab.gruppe_id = b.b_gruppe and ab.datum = b.b_tag
    ), '[]'::jsonb),
    case when b.b_verwalten or b.b_anwesenheit then coalesce((
      select jsonb_agg(jsonb_build_object(
        'vm_id', ab.vereins_mitglied_id,
        'name', coalesce(a.anzeige, 'Unbekannt'),
        'kategorie', ab.grund_kategorie,
        'hinweis', ab.hinweis,
        'grund', ab.grund,
        'erstellt_am', ab.erstellt_am) order by a.anzeige)
      from trainings_abmeldungen ab
      join vereins_mitglieder vm on vm.id = ab.vereins_mitglied_id
      left join lateral anzeige_namen(array[vm.user_id]) a on true
      where ab.gruppe_id = b.b_gruppe and ab.datum = b.b_tag
    ), '[]'::jsonb) end
  from basis b
  join gruppen g on g.id = b.b_gruppe
  join vereine v on v.id = b.b_verein
  order by b.b_tag, b.b_von;
end;
$$;
revoke all on function public.training_kalender(date, date) from public, anon;
grant execute on function public.training_kalender(date, date) to authenticated;

-- 6) Teilnehmer einer Gruppe fuer "Abmeldung eintragen" (nur wer Abmeldungen der Gruppe verwalten darf)
create or replace function public.training_teilnehmer(p_gruppe_id uuid, p_datum date)
returns table(vm_id uuid, name text, abgemeldet boolean, kategorie text, hinweis text)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_verein uuid;
begin
  select g.verein_id into v_verein from gruppen g where g.id = p_gruppe_id;
  if v_verein is null or not ist_gruppen_betreuung(p_gruppe_id) or not verein_hat_lizenz(v_verein) then
    raise exception 'Keine Berechtigung für diese Gruppe.' using errcode = '42501';
  end if;
  return query
  select vm.id, a.anzeige, ab.id is not null, ab.grund_kategorie, ab.hinweis
  from gruppen_mitglieder gm
  join vereins_mitglieder vm on vm.id = gm.vereins_mitglied_id and coalesce(vm.aktiv, true)
  cross join lateral anzeige_namen(array[vm.user_id]) a
  left join trainings_abmeldungen ab on ab.vereins_mitglied_id = vm.id and ab.gruppe_id = p_gruppe_id and ab.datum = p_datum
  where gm.gruppe_id = p_gruppe_id and coalesce(gm.funktion, 'mitglied') = 'mitglied'
  order by a.anzeige;
end;
$$;
revoke all on function public.training_teilnehmer(uuid, date) from public, anon;
grant execute on function public.training_teilnehmer(uuid, date) to authenticated;
