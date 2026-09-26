-- Ehrungen & Orden – taegliche Hinweise an Vereinsadmins
--
-- * Vorschlaege werden taeglich automatisch aktualisiert (auch ohne dass ein Admin die Seite oeffnet).
-- * Benachrichtigungen (Glocke) ausschliesslich an Vereinsadmins von Vereinen mit Vereinslizenz:
--   neue moegliche Ehrungen, Ehrungen in den naechsten 6 Monaten faellig, Verleihung in den naechsten 14 Tagen.
-- * Jeder Hinweis je Ehrung und Art nur einmal (ehrungs_hinweise).
-- Die oeffentlichen Funktionen pruefen weiterhin die Sitzung; die internen Varianten sind nur fuer den Cron-Job.
-- * Personenname im Vorgang direkt aus dem Profil (auch ohne Sitzung, z. B. beim naechtlichen Lauf).

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
    -- Name direkt aus dem Profil (Ehrungen sehen nur Vereinsadmins; funktioniert auch beim naechtlichen Lauf ohne Sitzung)
    new.person_name := coalesce((select nullif(trim(coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')), '')
                                 from vereins_mitglieder vm join profiles p on p.id = vm.user_id
                                 where vm.id = new.vereins_mitglied_id), nullif(new.person_name, ''), 'Unbekannt');
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

create or replace function public.ehrungs_vorschlaege_intern(p_verein_id uuid, p_horizont_monate integer default 24)
 returns table(vereins_mitglied_id uuid, ehrungsart_id uuid, faellig_am date, grundlage jsonb)
 language plpgsql
 stable
 set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
begin
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

create or replace function public.ehrungen_aktualisieren_intern(p_verein_id uuid)
 returns integer
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_neu integer := 0;
  v record;
begin
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
  from ehrungs_vorschlaege_intern(p_verein_id) s
  on conflict do nothing;
  get diagnostics v_neu = row_count;
  return v_neu;
end;
$function$;

-- Oeffentliche Funktionen: Sitzungspruefung + interne Variante
create or replace function public.ehrungs_vorschlaege(p_verein_id uuid, p_horizont_monate integer default 24)
 returns table(vereins_mitglied_id uuid, ehrungsart_id uuid, faellig_am date, grundlage jsonb)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not ehrungen_berechtigt(p_verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  return query select * from ehrungs_vorschlaege_intern(p_verein_id, p_horizont_monate);
end;
$function$;

create or replace function public.ehrungen_aktualisieren(p_verein_id uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not ehrungen_berechtigt(p_verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  return ehrungen_aktualisieren_intern(p_verein_id);
end;
$function$;

create table public.ehrungs_hinweise (
  mitglied_ehrung_id uuid not null references public.mitglied_ehrungen(id) on delete cascade,
  art text not null check (art in ('faellig_6_monate', 'verleihung_14_tage')),
  gesendet_am timestamptz not null default now(),
  primary key (mitglied_ehrung_id, art)
);
alter table public.ehrungs_hinweise enable row level security;
revoke all on table public.ehrungs_hinweise from public, anon, authenticated;
grant all on table public.ehrungs_hinweise to service_role;

create or replace function public.ehrungen_hinweise_senden()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v record;
  v_neu integer;
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  for v in select ve.id, ve.name from vereine ve where verein_hat_lizenz(ve.id) loop
    -- 1) neue moegliche Ehrungen erkennen
    v_neu := ehrungen_aktualisieren_intern(v.id);
    if v_neu > 0 then
      insert into benachrichtigungen (user_id, typ, text)
      select distinct vm.user_id, 'ehrung_vorschlag',
        '🏅 ' || v_neu || ' neue mögliche Ehrung' || case when v_neu = 1 then '' else 'en' end || ' im Verein ' || v.name
        || ' – bitte unter Vereinsverwaltung › Ehrungen & Orden prüfen.'
      from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
      where vm.verein_id = v.id and lower(r.name) like '%admin%' and coalesce(vm.aktiv, true);
    end if;

    -- 2) in den naechsten 6 Monaten faellig (je Ehrung einmal, zusammengefasst je Verein)
    with neu as (
      insert into ehrungs_hinweise (mitglied_ehrung_id, art)
      select me.id, 'faellig_6_monate' from mitglied_ehrungen me
      where me.verein_id = v.id and me.status in ('moeglich', 'geprueft', 'vorgemerkt')
        and me.faellig_am between v_heute and v_heute + interval '6 months'
      on conflict do nothing
      returning mitglied_ehrung_id
    ), liste as (
      select count(*) as n,
             string_agg(me.person_name || ' (' || ea.name || ', ' || to_char(me.faellig_am, 'DD.MM.YYYY') || ')', '; '
                        order by me.faellig_am) filter (where me.rn <= 3) as namen
      from (select m.*, row_number() over (order by m.faellig_am) as rn from mitglied_ehrungen m
            where m.id in (select mitglied_ehrung_id from neu)) me
      join ehrungsarten ea on ea.id = me.ehrungsart_id
    )
    insert into benachrichtigungen (user_id, typ, text)
    select distinct vm.user_id, 'ehrung_faellig',
      '🏅 ' || l.n || ' Ehrung' || case when l.n = 1 then '' else 'en' end || ' in den nächsten 6 Monaten voraussichtlich fällig: '
      || l.namen || case when l.n > 3 then ' und weitere' else '' end || '.'
    from liste l
    cross join vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
    where l.n > 0 and vm.verein_id = v.id and lower(r.name) like '%admin%' and coalesce(vm.aktiv, true);

    -- 3) Verleihung in den naechsten 14 Tagen eingeplant
    with neu as (
      insert into ehrungs_hinweise (mitglied_ehrung_id, art)
      select me.id, 'verleihung_14_tage' from mitglied_ehrungen me
      where me.verein_id = v.id and me.status = 'eingeplant'
        and me.eingeplant_am between v_heute and v_heute + 14
      on conflict do nothing
      returning mitglied_ehrung_id
    ), liste as (
      select count(*) as n,
             string_agg(me.person_name || ' (' || ea.name || ', ' || to_char(me.eingeplant_am, 'DD.MM.YYYY') || ')', '; '
                        order by me.eingeplant_am) as namen
      from mitglied_ehrungen me join ehrungsarten ea on ea.id = me.ehrungsart_id
      where me.id in (select mitglied_ehrung_id from neu)
    )
    insert into benachrichtigungen (user_id, typ, text)
    select distinct vm.user_id, 'ehrung_verleihung', '🎉 Verleihung steht bevor: ' || l.namen || '.'
    from liste l
    cross join vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
    where l.n > 0 and vm.verein_id = v.id and lower(r.name) like '%admin%' and coalesce(vm.aktiv, true);
  end loop;
end;
$function$;

-- Rechte: interne Funktionen nur fuer den Server/Cron
revoke all on function public.ehrungs_vorschlaege_intern(uuid, integer) from public, anon, authenticated;
revoke all on function public.ehrungen_aktualisieren_intern(uuid) from public, anon, authenticated;
revoke all on function public.ehrungen_hinweise_senden() from public, anon, authenticated;
grant execute on function public.ehrungs_vorschlaege_intern(uuid, integer), public.ehrungen_aktualisieren_intern(uuid),
  public.ehrungen_hinweise_senden() to service_role;

-- Taeglich 08:20 Uhr (Sommerzeit) bzw. 07:20 Uhr (Winterzeit) deutscher Zeit
select cron.schedule('ehrungen-hinweise', '20 6 * * *', 'select public.ehrungen_hinweise_senden()');
