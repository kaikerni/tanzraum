-- TanzRaum-Netzwerk, Buddys, Messenger (verbindliche Struktur FREE / BASIC / VEREIN) und JuryRaum-Schalter
--
-- Bestehende Strukturen werden weiterverwendet (keine zweite Chat-, Spotlight- oder Netzwerkarchitektur):
--   Buddys        = connections (art 'kontakt'), bisher „Kontakte/Vernetzen“ – vorhandene Verbindungen bleiben erhalten
--   Messenger     = gespraeche / gespraech_teilnehmer / nachrichten (neuer Chattyp 'gruppenchat' fuer eigene Gruppenchats)
--   Spotlights    = unveraendert (Erstellen ab BASIC war bereits serverseitig geprueft)
--
-- Regeln:
--   FREE   : Nutzer suchen, freigegebene Profile ansehen, Direktnachricht aus dem Profil (1:1) – keine Buddys, keine Gruppenchats
--   BASIC  : zusaetzlich Buddys (anfragen, annehmen, ablehnen, entfernen), eigene Gruppenchats
--   Jugendschutz (unter 16) bleibt unveraendert: Direktnachrichten nur im eigenen Verein und mit Eltern; keine Gruppenchats
--   ausserhalb des Vereins; Elternsperre und Blockieren haben immer Vorrang.
--   Zustellstatus: ✓ gesendet · ✓✓ zugestellt (TanzRaum auf einem Geraet erreicht: App offen oder Push empfangen) · ✓✓ gelesen
--   JuryRaum: plattformweiter Schalter (Standard AUS). Aus = kein Zugriff, Daten bleiben vollstaendig erhalten.

-- ---------------------------------------------------------------------------------------------
-- 1) JuryRaum-Schalter (wie Musik/Spotlights)
-- ---------------------------------------------------------------------------------------------
alter table public.plattform_einstellungen add column if not exists juryraum_aktiv boolean not null default false;

create or replace function public.juryraum_freigegeben()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select e.juryraum_aktiv from plattform_einstellungen e where e.id), false);
$$;
revoke all on function public.juryraum_freigegeben() from public, anon;
grant execute on function public.juryraum_freigegeben() to authenticated;

create or replace function public.admin_juryraum_setzen(p_aktiv boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not ist_plattform_admin_aktuell() then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  if p_aktiv is null then
    raise exception 'Ungültige Einstellung.' using errcode = 'P0001';
  end if;
  update plattform_einstellungen set juryraum_aktiv = p_aktiv, geaendert_am = now(), geaendert_von = auth.uid() where id;
end;
$$;
revoke all on function public.admin_juryraum_setzen(boolean) from public, anon;
grant execute on function public.admin_juryraum_setzen(boolean) to authenticated;

-- Ausgeschaltet: keine JuryRaum-Rolle -> Turniere, Besetzungen, Unterkuenfte, Fahrgemeinschaften und JuryRaum-Chats
-- sind ueber die bestehenden Regeln nicht mehr lesbar. Nichts wird geloescht.
create or replace function public.juryraum_eigene_rolle()
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select rolle from public.juryraum_mitglieder where user_id = auth.uid() and aktiv = true and public.juryraum_freigegeben() limit 1;
$function$;

-- Aktive JuryRaum-Mitgliedschaft nur bei eingeschaltetem JuryRaum (Navigation, Dashboard, Kai)
create or replace function public.juryraum_fuer_mich()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and juryraum_freigegeben()
     and exists (select 1 from juryraum_mitglieder m where m.user_id = auth.uid() and m.aktiv);
$$;
revoke all on function public.juryraum_fuer_mich() from public, anon;
grant execute on function public.juryraum_fuer_mich() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2) Gruppenchats (eigener Chattyp im bestehenden Messenger)
-- ---------------------------------------------------------------------------------------------
alter table public.gespraeche drop constraint gespraeche_typ_check;
alter table public.gespraeche add constraint gespraeche_typ_check
  check (typ = any (array['dm'::text, 'verein'::text, 'trainingsgruppe'::text, 'juryraum'::text, 'gruppenchat'::text]));

-- Zustellstatus je Teilnehmer (✓✓ zugestellt)
alter table public.gespraech_teilnehmer add column if not exists zugestellt_bis timestamptz;

create or replace function public.hat_gespraech_zugriff(p_gespraech_id uuid)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  g gespraeche%rowtype;
begin
  if auth.uid() is null then return false; end if;
  select * into g from gespraeche where id = p_gespraech_id;
  if not found then return false; end if;

  if g.typ = 'dm' then
    return exists (select 1 from gespraech_teilnehmer t where t.gespraech_id = g.id and t.user_id = auth.uid());
  elsif g.typ = 'gruppenchat' then
    -- Eigene Gruppenchats ab BASIC (oder ueber die Vereinslizenz); bei FREE ruht der Zugriff, die Mitgliedschaft bleibt
    return exists (select 1 from gespraech_teilnehmer t where t.gespraech_id = g.id and t.user_id = auth.uid())
       and tarif_von(auth.uid()) in ('basic', 'verein');
  elsif g.typ = 'juryraum' then
    return juryraum_sieht_turnier(g.turnier_id);
  end if;
  if not verein_hat_lizenz(g.verein_id) then return false; end if;
  if g.typ = 'verein' then
    if exists (select 1 from vereine x where x.id = g.verein_id and 'chat' = any(x.module_aus)) then return false; end if;
    return exists (select 1 from vereins_mitglieder vm where vm.verein_id = g.verein_id and vm.user_id = auth.uid() and coalesce(vm.aktiv, true));
  elsif g.typ = 'trainingsgruppe' then
    return is_verein_admin(g.verein_id)
      or exists (select 1 from gruppen_mitglieder gm join vereins_mitglieder vm on vm.id = gm.vereins_mitglied_id
                 where gm.gruppe_id = g.gruppe_id and vm.user_id = auth.uid() and coalesce(vm.aktiv, true));
  end if;
  return false;
end;
$function$;

-- Gruppenchat-Leitung = Ersteller/in (Name aendern, Mitglieder hinzufuegen/entfernen, Nachrichten entfernen)
create or replace function public.ist_chat_leitung(p_gespraech_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from gespraeche g
    where g.id = p_gespraech_id and hat_gespraech_zugriff(g.id)
      and ((g.typ = 'gruppenchat' and g.erstellt_von = auth.uid())
           or (g.typ in ('verein', 'trainingsgruppe')
               and (is_verein_admin(g.verein_id)
                    or (g.typ = 'verein' and ist_vereinsleitung(g.verein_id))
                    or (g.typ = 'trainingsgruppe' and ist_gruppen_betreuung_erweitert(g.gruppe_id))))));
$function$;

-- Wer darf in einen Gruppenchat aufgenommen werden? Ab 16, ab BASIC, und ich darf der Person direkt schreiben.
create or replace function public.gruppenchat_mitglied_erlaubt(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user_id is not null and p_user_id <> auth.uid()
     and not ist_unter_16(p_user_id)
     and tarif_von(p_user_id) in ('basic', 'verein')
     and darf_direkt_schreiben(p_user_id);
$$;
revoke all on function public.gruppenchat_mitglied_erlaubt(uuid) from public, anon, authenticated;

create or replace function public.gruppenchat_pruefen_ich()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if not konto_aktiv() then raise exception 'Dein Konto ist gesperrt.' using errcode = '42501'; end if;
  if tarif_von(auth.uid()) not in ('basic', 'verein') then
    raise exception 'Gruppenchats gibt es ab BASIC oder über einen Verein mit Vereinslizenz.' using errcode = 'P0001';
  end if;
  if ist_unter_16(auth.uid()) then
    raise exception 'Unter 16 Jahren schreibst du in den Chats deines Vereins und deiner Tanzgruppen.' using errcode = 'P0001';
  end if;
  if eltern_nachrichtensperre(auth.uid()) then
    raise exception 'Nachrichten sind für dein Konto deaktiviert.' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.gruppenchat_pruefen_ich() from public, anon, authenticated;

create or replace function public.gruppenchat_erstellen(p_name text, p_mitglieder uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_ids uuid[] := array(select distinct m from unnest(coalesce(p_mitglieder, '{}')) m where m is not null and m <> auth.uid());
  v_id uuid;
  m uuid;
begin
  perform gruppenchat_pruefen_ich();
  if v_name is null or char_length(v_name) > 60 then
    raise exception 'Bitte gib einen Namen mit höchstens 60 Zeichen ein.' using errcode = 'P0001';
  end if;
  if coalesce(array_length(v_ids, 1), 0) < 1 then
    raise exception 'Wähle mindestens eine Person aus.' using errcode = 'P0001';
  end if;
  if array_length(v_ids, 1) > 99 then
    raise exception 'Ein Gruppenchat hat höchstens 100 Mitglieder.' using errcode = 'P0001';
  end if;
  if (select count(*) from gespraeche g where g.typ = 'gruppenchat' and g.erstellt_von = auth.uid() and g.created_at > now() - interval '1 day') >= 10 then
    raise exception 'Du hast heute schon 10 Gruppenchats erstellt – morgen geht es weiter.' using errcode = 'P0001';
  end if;
  foreach m in array v_ids loop
    if not gruppenchat_mitglied_erlaubt(m) then
      raise exception 'Mindestens eine ausgewählte Person kann nicht in einen Gruppenchat aufgenommen werden.' using errcode = 'P0001';
    end if;
  end loop;
  insert into gespraeche (typ, name, erstellt_von) values ('gruppenchat', v_name, auth.uid()) returning id into v_id;
  insert into gespraech_teilnehmer (gespraech_id, user_id, last_read_at) values (v_id, auth.uid(), now());
  insert into gespraech_teilnehmer (gespraech_id, user_id, last_read_at) select v_id, x, now() - interval '1 second' from unnest(v_ids) x;
  return v_id;
end;
$$;

create or replace function public.gruppenchat_mitglieder_hinzufuegen(p_gespraech_id uuid, p_mitglieder uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[];
  m uuid;
begin
  perform gruppenchat_pruefen_ich();
  if not exists (select 1 from gespraeche g where g.id = p_gespraech_id and g.typ = 'gruppenchat') or not ist_chat_leitung(p_gespraech_id) then
    raise exception 'Mitglieder hinzufügen kann nur, wer den Gruppenchat erstellt hat.' using errcode = '42501';
  end if;
  v_ids := array(select distinct x from unnest(coalesce(p_mitglieder, '{}')) x
                 where x is not null and not exists (select 1 from gespraech_teilnehmer t where t.gespraech_id = p_gespraech_id and t.user_id = x));
  if coalesce(array_length(v_ids, 1), 0) = 0 then return 0; end if;
  if (select count(*) from gespraech_teilnehmer t where t.gespraech_id = p_gespraech_id) + array_length(v_ids, 1) > 100 then
    raise exception 'Ein Gruppenchat hat höchstens 100 Mitglieder.' using errcode = 'P0001';
  end if;
  foreach m in array v_ids loop
    if not gruppenchat_mitglied_erlaubt(m) then
      raise exception 'Mindestens eine ausgewählte Person kann nicht in einen Gruppenchat aufgenommen werden.' using errcode = 'P0001';
    end if;
  end loop;
  insert into gespraech_teilnehmer (gespraech_id, user_id, last_read_at) select p_gespraech_id, x, now() - interval '1 second' from unnest(v_ids) x;
  return array_length(v_ids, 1);
end;
$$;

create or replace function public.gruppenchat_mitglied_entfernen(p_gespraech_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from gespraeche g where g.id = p_gespraech_id and g.typ = 'gruppenchat') or not ist_chat_leitung(p_gespraech_id) then
    raise exception 'Mitglieder entfernen kann nur, wer den Gruppenchat erstellt hat.' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Zum Verlassen nutze „Gruppe verlassen“.' using errcode = 'P0001';
  end if;
  delete from gespraech_teilnehmer t where t.gespraech_id = p_gespraech_id and t.user_id = p_user_id;
end;
$$;

-- Verlassen: geht auch ohne aktuellen Tarif. Verlaesst die Erstellerin/der Ersteller, uebernimmt das dienstaelteste Mitglied.
create or replace function public.gruppenchat_verlassen(p_gespraech_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_nachfolger uuid;
begin
  if not exists (select 1 from gespraeche g join gespraech_teilnehmer t on t.gespraech_id = g.id
                 where g.id = p_gespraech_id and g.typ = 'gruppenchat' and t.user_id = auth.uid()) then
    raise exception 'Gruppenchat nicht gefunden.' using errcode = 'P0001';
  end if;
  delete from gespraech_teilnehmer t where t.gespraech_id = p_gespraech_id and t.user_id = auth.uid();
  if exists (select 1 from gespraeche g where g.id = p_gespraech_id and g.erstellt_von = auth.uid()) then
    select t.user_id into v_nachfolger from gespraech_teilnehmer t where t.gespraech_id = p_gespraech_id order by t.id limit 1;
    update gespraeche set erstellt_von = v_nachfolger where id = p_gespraech_id;
  end if;
end;
$$;

create or replace function public.gruppenchat_umbenennen(p_gespraech_id uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if not exists (select 1 from gespraeche g where g.id = p_gespraech_id and g.typ = 'gruppenchat') or not ist_chat_leitung(p_gespraech_id) then
    raise exception 'Den Namen ändern kann nur, wer den Gruppenchat erstellt hat.' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) > 60 then
    raise exception 'Bitte gib einen Namen mit höchstens 60 Zeichen ein.' using errcode = 'P0001';
  end if;
  update gespraeche set name = v_name where id = p_gespraech_id;
end;
$$;

create or replace function public.gruppenchat_mitglieder(p_gespraech_id uuid)
returns table(user_id uuid, anzeige text, avatar_url text, ist_leitung boolean, ich boolean)
language sql stable security definer set search_path = public as $$
  select t.user_id, a.anzeige,
    (select p.avatar_url from profiles p where p.id = t.user_id and (not coalesce(p.konto_privat, false) or kann_privates_profil_sehen(p.id))),
    g.erstellt_von = t.user_id, t.user_id = auth.uid()
  from gespraeche g
  join gespraech_teilnehmer t on t.gespraech_id = g.id
  join anzeige_namen(array(select x.user_id from gespraech_teilnehmer x where x.gespraech_id = p_gespraech_id)) a on a.user_id = t.user_id
  where g.id = p_gespraech_id and g.typ = 'gruppenchat' and hat_gespraech_zugriff(g.id)
  order by g.erstellt_von = t.user_id desc, a.anzeige;
$$;

-- Auswahl fuer „Neuer Gruppenchat“ / „Mitglieder hinzufuegen“: meine Kontakte (Verein, Familie, Buddys), die aufgenommen werden duerfen
create or replace function public.gruppenchat_kandidaten()
returns table(user_id uuid, anzeige text, handle text, avatar_url text, grund text)
language sql stable security definer set search_path = public as $$
  select k.user_id, k.anzeige, k.handle, k.avatar_url, k.grund
  from chat_kontakte() k
  where tarif_von(auth.uid()) in ('basic', 'verein') and not ist_unter_16(auth.uid()) and gruppenchat_mitglied_erlaubt(k.user_id);
$$;

revoke all on function public.gruppenchat_kandidaten() from public, anon;
grant execute on function public.gruppenchat_kandidaten() to authenticated;
revoke all on function public.gruppenchat_erstellen(text, uuid[]) from public, anon;
revoke all on function public.gruppenchat_mitglieder_hinzufuegen(uuid, uuid[]) from public, anon;
revoke all on function public.gruppenchat_mitglied_entfernen(uuid, uuid) from public, anon;
revoke all on function public.gruppenchat_verlassen(uuid) from public, anon;
revoke all on function public.gruppenchat_umbenennen(uuid, text) from public, anon;
revoke all on function public.gruppenchat_mitglieder(uuid) from public, anon;
grant execute on function public.gruppenchat_erstellen(text, uuid[]) to authenticated;
grant execute on function public.gruppenchat_mitglieder_hinzufuegen(uuid, uuid[]) to authenticated;
grant execute on function public.gruppenchat_mitglied_entfernen(uuid, uuid) to authenticated;
grant execute on function public.gruppenchat_verlassen(uuid) to authenticated;
grant execute on function public.gruppenchat_umbenennen(uuid, text) to authenticated;
grant execute on function public.gruppenchat_mitglieder(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3) Direktnachricht (FREE) und Buddys (BASIC)
-- ---------------------------------------------------------------------------------------------
-- Neu: Direktnachricht an freigegebene (nicht private) Profile – beide ab 16, unabhaengig vom Tarif und ohne Buddy.
-- Private Konten: nur Verein, Eltern/Kind oder Buddys (Buddys ab BASIC). Unter 16 unveraendert: Verein und Eltern.
create or replace function public.darf_direkt_schreiben(p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select auth.uid() is not null and p_user_id is not null and p_user_id <> auth.uid()
    and exists (select 1 from profiles p where p.id = p_user_id and not coalesce(p.gesperrt, false))
    and not ist_blockiert(auth.uid(), p_user_id)
    and (
      -- verknuepfte Eltern und Kinder
      ist_elternteil_von(auth.uid(), p_user_id) or ist_elternteil_von(p_user_id, auth.uid())
      or (not eltern_nachrichtensperre(auth.uid()) and not eltern_nachrichtensperre(p_user_id)
          and (
            -- gemeinsamer Verein (mit Vereinslizenz) – auch fuer unter 16
            hat_vereinsbeziehung(auth.uid(), p_user_id)
            -- ab 16 (beide): Direktnachricht an ein freigegebenes Profil (alle Tarife)
            or (not ist_unter_16(auth.uid()) and not ist_unter_16(p_user_id)
                and (not exists (select 1 from profiles p where p.id = p_user_id and coalesce(p.konto_privat, false))
                     -- privates Konto: nur Buddys, beide mit Buddy-Funktion (ab BASIC)
                     or (kontakt_angenommen(auth.uid(), p_user_id)
                         and tarif_von(auth.uid()) in ('basic', 'verein') and tarif_von(p_user_id) in ('basic', 'verein')))))));
$function$;

-- Gruende, die die ANDERE Person betreffen (unter 16, Elternsperre), werden weiterhin nicht verraten
create or replace function public.schreib_sperrgrund(p_user_id uuid)
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case
    when auth.uid() is null or p_user_id is null or p_user_id = auth.uid() then 'nicht_moeglich'
    when darf_direkt_schreiben(p_user_id) then null
    when not exists (select 1 from profiles p where p.id = p_user_id and not coalesce(p.gesperrt, false)) then 'nicht_moeglich'
    when ist_blockiert(auth.uid(), p_user_id) then 'blockiert'
    when eltern_nachrichtensperre(auth.uid()) then 'eltern_sperre_ich'
    when ist_unter_16(auth.uid()) then 'jugendschutz'
    when eltern_nachrichtensperre(p_user_id) or ist_unter_16(p_user_id) then 'nicht_moeglich'
    when not kontakt_angenommen(auth.uid(), p_user_id) then 'privat_konto'
    when tarif_von(auth.uid()) not in ('basic', 'verein') then 'tarif_ich'
    when tarif_von(p_user_id) not in ('basic', 'verein') then 'tarif_partner'
    else 'nicht_moeglich'
  end;
$function$;

-- Schutz vor Massennachrichten: hoechstens 20 neue Direktchats pro Tag mit Personen ohne Verein-, Familien- oder Buddy-Beziehung
do $$
declare
  d text;
  alt text := E'  if darf_direkt_schreiben(p_user_id) then\n    if v_id is null then\n';
  neu text := E'  if darf_direkt_schreiben(p_user_id) then\n    if v_id is null then\n'
           || E'      if not hat_vereinsbeziehung(auth.uid(), p_user_id) and not ist_elternteil_von(auth.uid(), p_user_id)\n'
           || E'         and not ist_elternteil_von(p_user_id, auth.uid()) and not kontakt_angenommen(auth.uid(), p_user_id)\n'
           || E'         and (select count(*) from gespraeche g where g.typ = ''dm'' and g.erstellt_von = auth.uid() and g.created_at > now() - interval ''1 day'') >= 20 then\n'
           || E'        raise exception ''Du hast heute schon viele neue Unterhaltungen begonnen – morgen geht es weiter.'' using errcode = ''P0001'';\n'
           || E'      end if;\n';
begin
  d := pg_get_functiondef('public.kontakt_aufnehmen'::regproc);
  if position(alt in d) = 0 then raise exception 'kontakt_aufnehmen: Stelle nicht gefunden'; end if;
  execute replace(d, alt, neu);
end $$;

-- Buddy-Anfrage: unabhaengig von der Nachrichtenfunktion (frueher „direkt“, wenn Schreiben schon erlaubt war), nur ab BASIC
create or replace function public.kontaktanfrage_senden(p_user_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  c connections%rowtype;
begin
  if auth.uid() is null or p_user_id is null or p_user_id = auth.uid()
     or not exists (select 1 from profiles p where p.id = p_user_id and not coalesce(p.gesperrt, false))
     or ist_blockiert(auth.uid(), p_user_id) then
    raise exception 'Eine Kontaktaufnahme mit dieser Person ist nicht möglich.' using errcode = 'P0001';
  end if;
  if tarif_von(auth.uid()) not in ('basic', 'verein') then
    raise exception 'Buddys gibt es ab BASIC oder über einen Verein mit Vereinslizenz.' using errcode = 'P0001';
  end if;
  if ist_unter_16(auth.uid()) or ist_unter_16(p_user_id) then
    raise exception 'Eine Buddy-Anfrage an diese Person ist nicht möglich.' using errcode = 'P0001';
  end if;
  select * into c from connections x
  where x.art = 'kontakt'
    and ((x.user_id = auth.uid() and x.connected_to = p_user_id) or (x.user_id = p_user_id and x.connected_to = auth.uid()));
  if c.id is not null then
    if c.status = 'blocked' then
      raise exception 'Eine Kontaktaufnahme mit dieser Person ist nicht möglich.' using errcode = 'P0001';
    elsif c.status = 'pending' and c.user_id = auth.uid() then
      return 'angefragt';
    elsif c.status = 'pending' then
      raise exception 'Diese Person hat dir bereits eine Buddy-Anfrage geschickt – du findest sie unter „Buddy-Anfragen“.' using errcode = 'P0001';
    elsif c.status = 'rejected' and c.user_id = auth.uid() then
      raise exception 'Diese Person hat deine Buddy-Anfrage abgelehnt.' using errcode = 'P0001';
    elsif c.status = 'rejected' then
      -- Die Person, die abgelehnt hat, fragt nun selbst an
      update connections set user_id = auth.uid(), connected_to = p_user_id, status = 'pending', created_at = now(), beantwortet_am = null where id = c.id;
    else
      return 'angenommen';
    end if;
  else
    insert into connections (user_id, connected_to, status) values (auth.uid(), p_user_id, 'pending');
  end if;
  insert into benachrichtigungen (user_id, typ, text)
  values (p_user_id, 'kontaktanfrage', 'Neue Buddy-Anfrage von ' || coalesce((select a.anzeige from anzeige_namen(array[auth.uid()]) a), 'jemandem') || '.');
  return 'angefragt';
end;
$function$;

-- Annehmen nur ab BASIC (Ablehnen und Blockieren immer)
do $$
declare
  d text;
  alt text := E'  if p_aktion = ''annehmen'' then\n';
  neu text := E'  if p_aktion = ''annehmen'' then\n'
           || E'    if tarif_von(auth.uid()) not in (''basic'', ''verein'') then\n'
           || E'      raise exception ''Buddys gibt es ab BASIC oder über einen Verein mit Vereinslizenz.'' using errcode = ''P0001'';\n'
           || E'    end if;\n';
begin
  d := pg_get_functiondef('public.kontaktanfrage_beantworten'::regproc);
  if position(alt in d) = 0 then raise exception 'kontaktanfrage_beantworten: Stelle nicht gefunden'; end if;
  d := replace(d, alt, neu);
  d := replace(d, 'Kontaktanfrage nicht gefunden.', 'Buddy-Anfrage nicht gefunden.');
  execute d;
end $$;

-- Profil: „Als Buddy hinzufuegen“ nur ab BASIC anbieten
do $$
declare
  d text;
  alt text := E'''kann_vernetzen'', p.id <> auth.uid() and not ist_unter_16(auth.uid())';
  neu text := E'''kann_vernetzen'', p.id <> auth.uid() and tarif_von(auth.uid()) in (''basic'', ''verein'') and not ist_unter_16(auth.uid())';
begin
  d := pg_get_functiondef('public.netzwerk_person'::regproc);
  if position(alt in d) = 0 then raise exception 'netzwerk_person: Stelle nicht gefunden'; end if;
  execute replace(d, alt, neu);
end $$;

-- Buddy entfernen (nur die Buddy-Verbindung; Chats bleiben)
create or replace function public.buddy_entfernen(p_user_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from connections where art = 'kontakt' and status = 'accepted'
    and least(user_id, connected_to) = least(auth.uid(), p_user_id) and greatest(user_id, connected_to) = greatest(auth.uid(), p_user_id);
$$;
revoke all on function public.buddy_entfernen(uuid) from public, anon;
grant execute on function public.buddy_entfernen(uuid) to authenticated;

-- Buddyliste mit Online-Status (Online nur, wenn die Person ihn zeigt; unter 16 nie)
create or replace function public.meine_buddys()
returns table(user_id uuid, anzeige text, handle text, avatar_url text, vereine text, online boolean, seit timestamptz, darf_schreiben boolean)
language sql stable security definer set search_path = public as $$
  with b as (
    select case when c.user_id = auth.uid() then c.connected_to else c.user_id end as uid, coalesce(c.beantwortet_am, c.created_at) as seit
    from connections c
    where c.art = 'kontakt' and c.status = 'accepted' and auth.uid() in (c.user_id, c.connected_to)
      and tarif_von(auth.uid()) in ('basic', 'verein')
  )
  select b.uid, a.anzeige, p.handle, p.avatar_url, netzwerk_vereine_text(b.uid),
    coalesce(p.online_sichtbar, false) and p.zuletzt_online > now() - interval '3 minutes' and not ist_unter_16(b.uid),
    b.seit, darf_direkt_schreiben(b.uid)
  from b join profiles p on p.id = b.uid and not coalesce(p.gesperrt, false)
  join anzeige_namen(array(select uid from b)) a on a.user_id = b.uid
  where not ist_blockiert(auth.uid(), b.uid)
  order by 6 desc, a.anzeige;
$$;
revoke all on function public.meine_buddys() from public, anon;
grant execute on function public.meine_buddys() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4) Zustellstatus (✓✓ zugestellt) – echte Daten: App geoeffnet oder Push auf einem Geraet empfangen
-- ---------------------------------------------------------------------------------------------
create or replace function public.nachrichten_zugestellt()
returns void language sql security definer set search_path = public as $$
  update gespraech_teilnehmer t set zugestellt_bis = now()
  where t.user_id = auth.uid()
    and exists (select 1 from gespraeche g where g.id = t.gespraech_id and g.typ in ('dm', 'gruppenchat'))
    and (t.zugestellt_bis is null or t.zugestellt_bis < now() - interval '2 seconds');
$$;
revoke all on function public.nachrichten_zugestellt() from public, anon;
grant execute on function public.nachrichten_zugestellt() to authenticated;

-- Gelesen heisst auch zugestellt
create or replace function public.chat_gelesen(p_gespraech_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not hat_gespraech_zugriff(p_gespraech_id) then return; end if;
  insert into gespraech_teilnehmer (gespraech_id, user_id, last_read_at, zugestellt_bis)
  values (p_gespraech_id, auth.uid(), now(), now())
  on conflict (gespraech_id, user_id) do update set last_read_at = now(), zugestellt_bis = now();
end;
$function$;

-- ---------------------------------------------------------------------------------------------
-- 5) Chatliste und Chatkopf um Gruppenchats und Zustellstatus erweitern (bestehende Funktionen, gezielte Ergaenzung)
-- ---------------------------------------------------------------------------------------------
do $$
declare
  d text;
  procedure_text text;
begin
  d := pg_get_functiondef('public.chat_liste'::regproc);
  -- Gruppenchats ueber die Teilnehmerliste
  procedure_text := $a$(g.typ = 'dm' and exists (select 1 from gespraech_teilnehmer t where t.gespraech_id = g.id and t.user_id = auth.uid()))$a$;
  if position(procedure_text in d) = 0 then raise exception 'chat_liste: Kandidaten nicht gefunden'; end if;
  d := replace(d, procedure_text, $a$(g.typ in ('dm', 'gruppenchat') and exists (select 1 from gespraech_teilnehmer t where t.gespraech_id = g.id and t.user_id = auth.uid()))$a$);
  -- Bereich „gruppenchat“
  procedure_text := $a$case s.typ when 'verein' then 'verein' when 'trainingsgruppe' then 'gruppe'$a$;
  if position(procedure_text in d) = 0 then raise exception 'chat_liste: Bereich nicht gefunden'; end if;
  d := replace(d, procedure_text, $a$case s.typ when 'verein' then 'verein' when 'trainingsgruppe' then 'gruppe' when 'gruppenchat' then 'gruppenchat'$a$);
  -- Untertitel: Mitgliederzahl
  procedure_text := $a$when 'verein' then 'Vereinschat' else v.name end$a$;
  if position(procedure_text in d) = 0 then raise exception 'chat_liste: Untertitel nicht gefunden'; end if;
  d := replace(d, procedure_text, $a$when 'verein' then 'Vereinschat'
      when 'gruppenchat' then 'Gruppenchat · ' || (select count(*) from gespraech_teilnehmer t2 where t2.gespraech_id = s.id) || ' Mitglieder'
      else v.name end$a$);
  execute d;
end $$;

drop function public.chat_kopf(uuid);
create function public.chat_kopf(p_gespraech_id uuid)
 returns table(id uuid, typ text, name text, untertitel text, partner_id uuid, partner_rolle text, avatar_url text, darf_schreiben boolean,
               ist_leitung boolean, nur_leitung_schreibt boolean, partner_gelesen_bis timestamp with time zone, ich_habe_blockiert boolean,
               partner_blockiert boolean, sperrgrund text, partner_zugestellt_bis timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select c.id, c.typ, c.name, c.untertitel, c.partner_id, c.partner_rolle, c.avatar_url, c.darf_schreiben, c.ist_leitung, c.nur_leitung_schreibt,
    -- Lesestatus: Privatchat = Gegenueber; Gruppenchat = alle anderen Mitglieder (aeltester Stand)
    case when c.typ = 'dm' then (select t.last_read_at from gespraech_teilnehmer t where t.gespraech_id = c.id and t.user_id = c.partner_id)
         when c.typ = 'gruppenchat' then (select min(t.last_read_at) from gespraech_teilnehmer t where t.gespraech_id = c.id and t.user_id <> auth.uid()) end,
    c.typ = 'dm' and exists (select 1 from blockierungen b where b.blocker_id = auth.uid() and b.blockiert_id = c.partner_id),
    c.typ = 'dm' and exists (select 1 from blockierungen b where b.blocker_id = c.partner_id and b.blockiert_id = auth.uid()),
    case when c.darf_schreiben then null
         when c.typ = 'dm' then schreib_sperrgrund(c.partner_id)
         when eltern_nachrichtensperre(auth.uid()) then 'eltern_sperre_ich'
         else 'nur_leitung' end,
    case when c.typ = 'dm' then (select greatest(t.zugestellt_bis, t.last_read_at) from gespraech_teilnehmer t where t.gespraech_id = c.id and t.user_id = c.partner_id)
         when c.typ = 'gruppenchat' then (select min(greatest(t.zugestellt_bis, t.last_read_at)) from gespraech_teilnehmer t where t.gespraech_id = c.id and t.user_id <> auth.uid()) end
  from chat_liste() c where c.id = p_gespraech_id;
$function$;
revoke all on function public.chat_kopf(uuid) from public, anon;
grant execute on function public.chat_kopf(uuid) to authenticated, service_role;
