-- TanzRaum Chat (oeffentlicher Live-Chat) und TanzRaum Schutzpruefung fuer oeffentlichen Chat und Gruppenchats
--
-- Grundsatz: Nachrichten in geschuetzten Chats (tanzraum, verein, trainingsgruppe, gruppenchat) werden VOR der
-- Speicherung geprueft. Der Browser darf dort nicht mehr direkt in `nachrichten` schreiben (RLS). Veroeffentlicht wird
-- ausschliesslich ueber die Edge Function `chat-senden` (feste Schutzregeln -> externe KI-Pruefung -> Freigabe), die
-- danach `schutz_veroeffentlichen` mit dem Service-Schluessel aufruft. Erst diese Speicherung loest Realtime aus –
-- eine blockierte Nachricht erreicht nie einen anderen Nutzer.
-- Private 1:1-Nachrichten (dm), JuryRaum und alle bestehenden Jugendschutz-/Elternregeln bleiben unveraendert.
-- Die automatische Pruefung heisst „TanzRaum Schutzpruefung“ – sie ist NICHT Kai (Kai bleibt der Assistent).
-- Datensparsamkeit: Protokolliert werden nur Kategorie, Schwere, Massnahme und ein Hash – kein Nachrichtentext.
-- Nur bei einem Moderationsfall wird ein kurzer Auszug (max. 500 Zeichen) gespeichert und nach Abschluss geleert.

-- =============================================================================================
-- 1) Oeffentlicher TanzRaum Chat als Gespraech (eine einzige Zeile)
-- =============================================================================================
alter table public.gespraeche drop constraint if exists gespraeche_typ_check,
  add constraint gespraeche_typ_check check (typ = any (array['dm', 'verein', 'trainingsgruppe', 'juryraum', 'gruppenchat', 'tanzraum']));
create unique index if not exists gespraeche_tanzraum_eindeutig on public.gespraeche ((true)) where typ = 'tanzraum';
insert into public.gespraeche (typ, name)
select 'tanzraum', 'TanzRaum Chat' where not exists (select 1 from public.gespraeche where typ = 'tanzraum');

-- Chatregeln einmalig bestaetigt
alter table public.profiles add column if not exists chat_regeln_am timestamptz;

-- Einstellungen (konfigurierbare Schwellenwerte der Schutzpruefung)
alter table public.plattform_einstellungen add column if not exists chat_einstellungen jsonb not null default '{}'::jsonb;
-- Freigabe des oeffentlichen Chats durch den TanzRaum-Admin (wie bei Spotlights): an/aus und fuer welche Tarife.
-- Standard: aus – der Admin schaltet ihn frei, sobald die KI-Pruefung eingerichtet ist.
alter table public.plattform_einstellungen add column if not exists chat_aktiv boolean not null default false;
alter table public.plattform_einstellungen add column if not exists chat_tarife text[] not null default array['free', 'basic', 'verein'];
alter table public.plattform_einstellungen drop constraint if exists plattform_chat_tarife_gueltig,
  add constraint plattform_chat_tarife_gueltig check (chat_tarife <@ array['free', 'basic', 'verein']);
grant select (chat_aktiv, chat_tarife) on public.plattform_einstellungen to authenticated;

-- Oeffentlicher Chat fuer mich freigegeben? (Admin und Moderation mit Recht immer; sonst Schalter + Tarif)
create or replace function public.chat_fuer_mich()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select auth.uid() is not null
    and not exists (select 1 from profiles p where p.id = auth.uid() and coalesce(p.gesperrt, false))
    and (ist_plattform_admin_aktuell() or team_darf('chat.oeffentlich_moderieren')
         or exists (select 1 from plattform_einstellungen e where e.id and e.chat_aktiv and tarif_von(auth.uid()) = any(e.chat_tarife)));
$function$;
revoke all on function public.chat_fuer_mich() from public, anon;
grant execute on function public.chat_fuer_mich() to authenticated;

create or replace function public.admin_chat_freigabe_setzen(p_aktiv boolean, p_tarife text[])
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v text[] := array(select distinct x from unnest(coalesce(p_tarife, '{}')) x where x in ('free', 'basic', 'verein') order by x);
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  if coalesce(p_aktiv, false) and coalesce(array_length(v, 1), 0) = 0 then
    raise exception 'Bitte mindestens einen Tarif auswählen.' using errcode = 'P0001';
  end if;
  update plattform_einstellungen set chat_aktiv = coalesce(p_aktiv, false), chat_tarife = v, geaendert_am = now(), geaendert_von = auth.uid() where id;
  perform protokollieren('chat_freigabe_geaendert', null, jsonb_build_object('aktiv', coalesce(p_aktiv, false), 'tarife', v));
end;
$function$;
revoke all on function public.admin_chat_freigabe_setzen(boolean, text[]) from public, anon;
grant execute on function public.admin_chat_freigabe_setzen(boolean, text[]) to authenticated;

create or replace function public.chat_einstellung_wert(p_schluessel text)
 returns integer
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((select (e.chat_einstellungen->>p_schluessel)::int from plattform_einstellungen e where e.id limit 1),
    case p_schluessel
      when 'max_laenge_oeffentlich' then 1000      -- Zeichen je Nachricht im oeffentlichen Chat
      when 'pro_minute' then 8                      -- Nachrichten je Minute (alle geschuetzten Chats)
      when 'pro_10_minuten' then 40
      when 'duplikat_minuten' then 10               -- identische Nachricht erneut erst nach x Minuten
      when 'fenster_stunden' then 24                -- Zeitraum fuer wiederholte Verstoesse
      when 'verwarnung_ab' then 2                   -- ab dem 2. Verstoss: Verwarnung
      when 'sperre_ab' then 3                       -- ab dem 3. Verstoss: zeitweise Schreibsperre
      when 'sperre_minuten' then 60
      when 'sperre_lang_ab' then 5                  -- ab dem 5. Verstoss: laengere Schreibsperre
      when 'sperre_lang_stunden' then 24
      when 'fall_ab_anzahl' then 3                  -- ab so vielen Verstoessen entsteht ein Moderationsfall
      when 'fall_ab_schwere' then 3                 -- schwere Verstoesse (3) erzeugen sofort einen Fall
      when 'oeffentlich_ab_16' then 1               -- 1 = im oeffentlichen Chat schreiben erst ab 16 (lesen immer)
    end);
$function$;
revoke all on function public.chat_einstellung_wert(text) from public, anon;
grant execute on function public.chat_einstellung_wert(text) to authenticated;

-- =============================================================================================
-- 2) Schreibsperren (zeitweise; nie dauerhaft automatisch) und Schutzereignisse
-- =============================================================================================
create table if not exists public.chat_schreibsperren (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bereich text not null check (bereich in ('oeffentlich', 'gruppen', 'alle')),
  bis timestamptz not null,
  grund text check (char_length(grund) <= 500),
  automatisch boolean not null default false,
  erstellt_von uuid references public.profiles(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  aufgehoben_am timestamptz,
  aufgehoben_von uuid references public.profiles(id) on delete set null
);
create index if not exists chat_schreibsperren_aktiv on public.chat_schreibsperren (user_id, bis) where aufgehoben_am is null;
comment on table public.chat_schreibsperren is 'Zeitweise Chat-Schreibsperren (automatisch durch die Schutzpruefung oder durch Moderation). Kontosperren bleiben Menschen vorbehalten.';
alter table public.chat_schreibsperren enable row level security;
create policy "Eigene Chat-Sperren" on public.chat_schreibsperren for select to authenticated using (user_id = auth.uid());
revoke all on public.chat_schreibsperren from public, anon, authenticated;
grant select on public.chat_schreibsperren to authenticated;
grant all on public.chat_schreibsperren to service_role;

create table if not exists public.schutz_ereignisse (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  gespraech_id uuid references public.gespraeche(id) on delete set null,
  chat_art text not null check (chat_art in ('oeffentlich', 'gruppe')),
  quelle text not null check (quelle in ('regel', 'ki', 'flut', 'ki_fehler')),
  ergebnis text not null check (ergebnis in ('blockiert', 'auffaellig', 'nicht_geprueft')),
  kategorie text not null check (char_length(kategorie) between 1 and 40),
  schwere smallint not null default 1 check (schwere between 0 and 3),
  massnahme text not null default 'keine' check (massnahme in ('keine', 'verwarnung', 'sperre', 'sperre_lang', 'fall')),
  text_hash text,
  erstellt_am timestamptz not null default now()
);
create index if not exists schutz_ereignisse_user on public.schutz_ereignisse (user_id, erstellt_am desc);
create index if not exists schutz_ereignisse_zeit on public.schutz_ereignisse (erstellt_am desc);
comment on table public.schutz_ereignisse is 'TanzRaum Schutzpruefung: blockierte/nicht gepruefte Nachrichten (ohne Text, nur Kategorie/Schwere/Massnahme/Hash). Aufbewahrung 180 Tage.';
alter table public.schutz_ereignisse enable row level security;
revoke all on public.schutz_ereignisse from public, anon, authenticated;
grant all on public.schutz_ereignisse to service_role;

-- Moderationsfaelle aus dem Chat in der bestehenden Tabelle `meldungen`
alter table public.meldungen add column if not exists nachricht_id uuid references public.nachrichten(id) on delete set null;
alter table public.meldungen add column if not exists gespraech_id uuid references public.gespraeche(id) on delete set null;
alter table public.meldungen add column if not exists automatisch boolean not null default false;
alter table public.meldungen add column if not exists auszug text;
alter table public.meldungen drop constraint if exists meldungen_auszug_laenge,
  add constraint meldungen_auszug_laenge check (char_length(auszug) <= 500);
alter table public.meldungen drop constraint if exists meldungen_bereich_check,
  add constraint meldungen_bereich_check check (bereich in ('allgemein', 'treff', 'chat'));
alter table public.meldungen drop constraint if exists meldungen_grund_check,
  add constraint meldungen_grund_check check (grund = any (array['unangemessen', 'belaestigung', 'unerwuenschter_kontakt', 'jugendgefaehrdend',
    'spam', 'sonstiges', 'beleidigung', 'werbung', 'problematisch', 'mobbing', 'sexualisiert', 'persoenliche_daten', 'regelverstoss', 'schutzpruefung']));
create index if not exists meldungen_chat on public.meldungen (bereich, status, erstellt_am desc) where bereich = 'chat';

-- =============================================================================================
-- 3) Team-Rechte: Bereich „chat“
-- =============================================================================================
create or replace function public.team_rechte_katalog()
 returns text[]
 language sql
 immutable
 set search_path to 'public'
as $function$
  select array[
    'treff', 'treff.themen_erstellen', 'treff.themen_bearbeiten', 'treff.themen_loeschen', 'treff.beitraege_bearbeiten',
    'treff.beitraege_loeschen', 'treff.themen_verschieben', 'treff.themen_schliessen', 'treff.themen_oeffnen',
    'treff.themen_anpinnen', 'treff.themen_entpinnen', 'treff.meldungen_bearbeiten', 'treff.nutzer_melden',
    'treff.nutzer_sperren', 'treff.nutzer_entfernen', 'treff.empfehlen',
    'workshops', 'workshops.ansehen', 'workshops.erstellen', 'workshops.bearbeiten', 'workshops.freigeben',
    'workshops.ablehnen', 'workshops.archivieren', 'workshops.loeschen',
    'wissen', 'wissen.erstellen', 'wissen.bearbeiten', 'wissen.veroeffentlichen', 'wissen.loeschen',
    'news', 'news.verwalten',
    'spotlight', 'spotlight.meldungen_bearbeiten',
    'nutzer', 'nutzer.ansehen', 'nutzer.sperren',
    'chat', 'chat.oeffentlich_moderieren', 'chat.gruppen_moderieren', 'chat.meldungen_bearbeiten',
    'chat.nachrichten_loeschen', 'chat.nutzer_stummschalten'];
$function$;

-- =============================================================================================
-- 4) Zugriff und Schreibrecht (bestehende Funktionen, um „tanzraum“ und Schreibsperren ergaenzt)
-- =============================================================================================
create or replace function public.ist_geschuetzter_chat(p_gespraech_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from gespraeche g where g.id = p_gespraech_id and g.typ in ('tanzraum', 'verein', 'trainingsgruppe', 'gruppenchat'));
$function$;
grant execute on function public.ist_geschuetzter_chat(uuid) to authenticated;

create or replace function public.chat_sperre_bis(p_user_id uuid, p_oeffentlich boolean)
 returns timestamptz
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select max(s.bis) from chat_schreibsperren s
  where s.user_id = p_user_id and s.aufgehoben_am is null and s.bis > now()
    and (s.bereich = 'alle' or s.bereich = case when p_oeffentlich then 'oeffentlich' else 'gruppen' end);
$function$;
revoke all on function public.chat_sperre_bis(uuid, boolean) from public, anon;
grant execute on function public.chat_sperre_bis(uuid, boolean) to authenticated;

CREATE OR REPLACE FUNCTION public.hat_gespraech_zugriff(p_gespraech_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  g gespraeche%rowtype;
begin
  if auth.uid() is null then return false; end if;
  select * into g from gespraeche where id = p_gespraech_id;
  if not found then return false; end if;

  if g.typ = 'tanzraum' then
    -- Oeffentlicher TanzRaum Chat: angemeldet, nicht gesperrt, vom Admin fuer den eigenen Tarif freigegeben
    return chat_fuer_mich();
  elsif g.typ = 'dm' then
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

CREATE OR REPLACE FUNCTION public.darf_im_gespraech_schreiben(p_gespraech_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from gespraeche g
    where g.id = p_gespraech_id and hat_gespraech_zugriff(g.id)
      and case
        when g.typ = 'juryraum' then true
        when g.typ = 'dm' then exists (
          select 1 from gespraech_teilnehmer t where t.gespraech_id = g.id and t.user_id <> auth.uid()
            and (darf_direkt_schreiben(t.user_id) or boerse_darf_schreiben(g.id, t.user_id)))
        -- Oeffentlicher Chat: keine Elternsperre, keine Schreibsperre, Schreiben ab 16 (einstellbar)
        when g.typ = 'tanzraum' then not eltern_nachrichtensperre(auth.uid())
          and chat_sperre_bis(auth.uid(), true) is null
          and (chat_einstellung_wert('oeffentlich_ab_16') = 0 or not ist_unter_16(auth.uid()))
        -- Elterliche Nachrichtensperre: in Gruppenchats nur noch lesen
        else (not g.nur_leitung_schreibt or ist_chat_leitung(g.id)) and not eltern_nachrichtensperre(auth.uid())
          and chat_sperre_bis(auth.uid(), false) is null
      end);
$function$;

-- Leitung im oeffentlichen Chat = Moderation mit Recht (darf dort Nachrichten entfernen)
CREATE OR REPLACE FUNCTION public.ist_chat_leitung(p_gespraech_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from gespraeche g
    where g.id = p_gespraech_id and hat_gespraech_zugriff(g.id)
      and ((g.typ = 'gruppenchat' and g.erstellt_von = auth.uid())
           or (g.typ = 'tanzraum' and team_darf('chat.oeffentlich_moderieren') and team_darf('chat.nachrichten_loeschen'))
           or (g.typ in ('verein', 'trainingsgruppe')
               and (is_verein_admin(g.verein_id)
                    or (g.typ = 'verein' and ist_vereinsleitung(g.verein_id))
                    or (g.typ = 'trainingsgruppe' and ist_gruppen_betreuung_erweitert(g.gruppe_id))))));
$function$;

-- Direktes Schreiben aus dem Browser nur noch in Chats ohne Schutzpruefung (Privatchat, JuryRaum)
drop policy if exists "Nachrichten schreiben" on public.nachrichten;
create policy "Nachrichten schreiben" on public.nachrichten for insert to authenticated
  with check ((sender_id = auth.uid()) and (geloescht_am is null) and not ist_geschuetzter_chat(gespraech_id)
    and darf_im_gespraech_schreiben(gespraech_id)
    and ((bild_pfad is null) or (bild_pfad like (gespraech_id)::text || '/%'))
    and ((anhang is null) or ((anhang ->> 'pfad') like (gespraech_id)::text || '/%')));

-- Bearbeiten in geschuetzten Chats nur ueber die Schutzpruefung
CREATE OR REPLACE FUNCTION public.nachricht_bearbeiten(p_nachricht_id uuid, p_inhalt text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n nachrichten%rowtype;
  v_text text := btrim(coalesce(p_inhalt, ''));
begin
  select * into n from nachrichten where id = p_nachricht_id;
  if n.id is null or n.sender_id <> auth.uid() or n.geloescht_am is not null
     or n.umfrage is not null or n.standort is not null or n.sticker is not null or (n.anhang is not null and n.anhang->>'art' = 'audio') then
    raise exception 'Diese Nachricht kannst du nicht bearbeiten.' using errcode = 'P0001';
  end if;
  if ist_geschuetzter_chat(n.gespraech_id) and coalesce(current_setting('tanzraum.schutz_freigabe', true), '') <> 'ja' then
    raise exception 'Änderungen in diesem Chat werden vor dem Speichern geprüft. Bitte erneut senden.' using errcode = '42501';
  end if;
  if n.gesendet_am < now() - interval '24 hours' then
    raise exception 'Nachrichten können nur bis 24 Stunden nach dem Senden bearbeitet werden.' using errcode = 'P0001';
  end if;
  if not darf_im_gespraech_schreiben(n.gespraech_id) then
    raise exception 'Du darfst in diesem Chat nicht schreiben.' using errcode = '42501';
  end if;
  if char_length(v_text) > 4000 or (v_text = '' and n.bild_pfad is null and n.anhang is null) then
    raise exception 'Die Nachricht darf nicht leer sein.' using errcode = 'P0001';
  end if;
  update nachrichten set inhalt = v_text, bearbeitet_am = now() where id = n.id;
end;
$function$;

-- Weiterleiten: nie in den oeffentlichen Chat; in Gruppenchats nur bereits gepruefte Nachrichten
CREATE OR REPLACE FUNCTION public.nachricht_weiterleiten(p_nachricht_id uuid, p_ziel_gespraech_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n nachrichten%rowtype;
  v_ziel text := (select g.typ from gespraeche g where g.id = p_ziel_gespraech_id);
begin
  select * into n from nachrichten where id = p_nachricht_id;
  if n.id is null or n.geloescht_am is not null or not hat_gespraech_zugriff(n.gespraech_id) then
    raise exception 'Nachricht nicht gefunden.' using errcode = 'P0001';
  end if;
  if n.bild_pfad is not null or n.anhang is not null or n.umfrage is not null then
    raise exception 'Fotos, Dateien, Sprachnachrichten und Umfragen können nicht weitergeleitet werden.' using errcode = 'P0001';
  end if;
  if v_ziel = 'tanzraum' then
    raise exception 'In den TanzRaum Chat kann nicht weitergeleitet werden.' using errcode = 'P0001';
  end if;
  if ist_geschuetzter_chat(p_ziel_gespraech_id) and not ist_geschuetzter_chat(n.gespraech_id) and coalesce(n.inhalt, '') <> '' then
    raise exception 'Diese Nachricht bitte als neue Nachricht schreiben – Gruppenchats werden vor dem Senden geprüft.' using errcode = 'P0001';
  end if;
  if n.standort is not null and v_ziel <> 'dm' then
    raise exception 'Standorte können nur in Privatchats weitergeleitet werden.' using errcode = 'P0001';
  end if;
  if not darf_im_gespraech_schreiben(p_ziel_gespraech_id) then
    raise exception 'In diesem Chat darfst du nicht schreiben.' using errcode = '42501';
  end if;
  perform set_config('tanzraum.schutz_freigabe', 'ja', true);
  insert into nachrichten (gespraech_id, sender_id, inhalt, standort, sticker, weitergeleitet)
  values (p_ziel_gespraech_id, auth.uid(), n.inhalt, n.standort, n.sticker, true);
  perform set_config('tanzraum.schutz_freigabe', '', true);
end;
$function$;

-- Kein Push fuer den oeffentlichen Chat (sonst Benachrichtigungsflut)
CREATE OR REPLACE FUNCTION public.chat_push_ziele(p_geheimnis text, p_nachricht_id uuid)
 RETURNS TABLE(abo_id uuid, endpoint text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n nachrichten%rowtype;
  g gespraeche%rowtype;
  kandidat uuid;
  empfaenger uuid[] := '{}';
begin
  if p_geheimnis is null or p_geheimnis <> (select decrypted_secret from vault.decrypted_secrets where name = 'chat_push_geheimnis') then
    raise exception 'Nicht berechtigt' using errcode = '42501';
  end if;
  select * into n from nachrichten where id = p_nachricht_id;
  if n.id is null or n.geloescht_am is not null then return; end if;
  select * into g from gespraeche where id = n.gespraech_id;
  if g.typ in ('juryraum', 'tanzraum') then return; end if;

  for kandidat in
    select distinct u from (
      select t.user_id as u from gespraech_teilnehmer t where t.gespraech_id = g.id
      union
      select vm.user_id from vereins_mitglieder vm where g.verein_id is not null and vm.verein_id = g.verein_id and coalesce(vm.aktiv, true)
    ) x
    where u is not null and u <> n.sender_id
      and exists (select 1 from push_subscriptions ps where ps.user_id = x.u)
      and push_kategorie_aktiv(x.u, 'chat')
      and not exists (select 1 from blockierungen b where b.blocker_id = x.u and b.blockiert_id = n.sender_id)
      and (g.nur_leitung_schreibt or not exists (select 1 from chat_stumm s where s.gespraech_id = g.id and s.user_id = x.u))
  loop
    perform set_config('request.jwt.claim.sub', kandidat::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', kandidat, 'role', 'authenticated')::text, true);
    if hat_gespraech_zugriff(g.id) then
      empfaenger := empfaenger || kandidat;
    end if;
  end loop;

  return query select ps.id, ps.endpoint from push_subscriptions ps where ps.user_id = any(empfaenger);
end;
$function$;

-- Sperrgrund im Chatkopf: zeitweise Schreibsperre der Schutzpruefung/Moderation anzeigen
CREATE OR REPLACE FUNCTION public.chat_kopf(p_gespraech_id uuid)
 RETURNS TABLE(id uuid, typ text, name text, untertitel text, partner_id uuid, partner_rolle text, avatar_url text, darf_schreiben boolean, ist_leitung boolean, nur_leitung_schreibt boolean, partner_gelesen_bis timestamp with time zone, ich_habe_blockiert boolean, partner_blockiert boolean, sperrgrund text, partner_zugestellt_bis timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.typ, c.name, c.untertitel, c.partner_id, c.partner_rolle, c.avatar_url, c.darf_schreiben, c.ist_leitung, c.nur_leitung_schreibt,
    -- Lesestatus: Privatchat = Gegenueber; Gruppenchat = alle anderen Mitglieder (aeltester Stand)
    case when c.typ = 'dm' then (select t.last_read_at from gespraech_teilnehmer t where t.gespraech_id = c.id and t.user_id = c.partner_id)
         when c.typ = 'gruppenchat' then (select min(t.last_read_at) from gespraech_teilnehmer t where t.gespraech_id = c.id and t.user_id <> auth.uid()) end,
    c.typ = 'dm' and exists (select 1 from blockierungen b where b.blocker_id = auth.uid() and b.blockiert_id = c.partner_id),
    c.typ = 'dm' and exists (select 1 from blockierungen b where b.blocker_id = c.partner_id and b.blockiert_id = auth.uid()),
    case when c.darf_schreiben then null
         when c.typ = 'dm' then schreib_sperrgrund(c.partner_id)
         when eltern_nachrichtensperre(auth.uid()) then 'eltern_sperre_ich'
         when chat_sperre_bis(auth.uid(), false) is not null then 'chat_gesperrt'
         else 'nur_leitung' end,
    case when c.typ = 'dm' then (select greatest(t.zugestellt_bis, t.last_read_at) from gespraech_teilnehmer t where t.gespraech_id = c.id and t.user_id = c.partner_id)
         when c.typ = 'gruppenchat' then (select min(greatest(t.zugestellt_bis, t.last_read_at)) from gespraech_teilnehmer t where t.gespraech_id = c.id and t.user_id <> auth.uid()) end
  from chat_liste() c where c.id = p_gespraech_id;
$function$;

-- =============================================================================================
-- 5) Oeffentlicher Chat: Status, Regeln, Absenderangaben
-- =============================================================================================
create or replace function public.tanzraum_chat()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid := (select g.id from gespraeche g where g.typ = 'tanzraum' limit 1);
  v_gelesen timestamptz;
begin
  if auth.uid() is null or v_id is null or not hat_gespraech_zugriff(v_id) then return null; end if;
  select t.last_read_at into v_gelesen from gespraech_teilnehmer t where t.gespraech_id = v_id and t.user_id = auth.uid();
  return jsonb_build_object(
    'id', v_id,
    'tarife', (select e.chat_tarife from plattform_einstellungen e where e.id limit 1),
    'aktiv', (select e.chat_aktiv from plattform_einstellungen e where e.id limit 1),
    'darf_schreiben', darf_im_gespraech_schreiben(v_id),
    'sperre_bis', chat_sperre_bis(auth.uid(), true),
    'unter_16', ist_unter_16(auth.uid()) and chat_einstellung_wert('oeffentlich_ab_16') = 1,
    'eltern_sperre', eltern_nachrichtensperre(auth.uid()),
    'regeln_bestaetigt', (select p.chat_regeln_am is not null from profiles p where p.id = auth.uid()),
    'max_laenge', chat_einstellung_wert('max_laenge_oeffentlich'),
    'moderation', ist_chat_leitung(v_id),
    'ungelesen', least((select count(*) from nachrichten n where n.gespraech_id = v_id and n.sender_id <> auth.uid() and n.geloescht_am is null
                         and n.gesendet_am > coalesce(v_gelesen, now() - interval '1 day')), 99));
end;
$function$;
revoke all on function public.tanzraum_chat() from public, anon;
grant execute on function public.tanzraum_chat() to authenticated;

create or replace function public.chat_regeln_bestaetigen()
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update profiles set chat_regeln_am = now() where id = auth.uid() and chat_regeln_am is null;
$function$;
revoke all on function public.chat_regeln_bestaetigen() from public, anon;
grant execute on function public.chat_regeln_bestaetigen() to authenticated;

-- Profilbild, @Nutzername, Verein und Kennzeichnung der Absender eines Chats (nur mit Zugriff auf diesen Chat)
create or replace function public.chat_absender(p_gespraech_id uuid, p_user_ids uuid[])
 returns table(user_id uuid, handle text, avatar_url text, verein text, kennzeichen text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p.id, p.handle,
    case when not coalesce(p.konto_privat, false) or kann_privates_profil_sehen(p.id) then p.avatar_url end,
    coalesce((select v.name from vereine v where v.id = offizieller_verein_von(p.id)), nullif(btrim(p.verein_angabe), '')),
    (select k.kennzeichen from team_kennzeichen(array[p.id]) k)
  from profiles p
  where hat_gespraech_zugriff(p_gespraech_id) and p.id = any(p_user_ids[1:200])
    and exists (select 1 from nachrichten n where n.gespraech_id = p_gespraech_id and n.sender_id = p.id);
$function$;
revoke all on function public.chat_absender(uuid, uuid[]) from public, anon;
grant execute on function public.chat_absender(uuid, uuid[]) to authenticated;

-- =============================================================================================
-- 6) Schutzpruefung – Vorpruefung (als Nutzer), Veroeffentlichen und Blockieren (nur Service)
-- =============================================================================================
-- Text fuer Duplikat-Erkennung: Kleinbuchstaben, nur Buchstaben/Ziffern
create or replace function public.schutz_normal(p_text text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9äöüß]+', '', 'g');
$function$;

-- Wird von der Edge Function im Namen des angemeldeten Nutzers aufgerufen: Rechte, Sperre, Flut, Duplikat und
-- Kontext (eigene letzte Nachrichten in diesem Chat, im oeffentlichen Chat zusaetzlich die letzten 3 Nachrichten ohne Namen).
create or replace function public.schutz_vorpruefung(p_gespraech_id uuid, p_art text, p_nachricht_id uuid, p_text text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  g gespraeche%rowtype;
  v_oeffentlich boolean;
  v_sperre timestamptz;
  v_hash text := md5(schutz_normal(p_text));
  n nachrichten%rowtype;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'grund', 'keine_rechte'); end if;
  select * into g from gespraeche where id = p_gespraech_id;
  if g.id is null or g.typ not in ('tanzraum', 'verein', 'trainingsgruppe', 'gruppenchat') then
    return jsonb_build_object('ok', false, 'grund', 'keine_rechte');
  end if;
  v_oeffentlich := g.typ = 'tanzraum';
  v_sperre := chat_sperre_bis(auth.uid(), v_oeffentlich);
  if v_sperre is not null then return jsonb_build_object('ok', false, 'grund', 'gesperrt', 'bis', v_sperre); end if;
  if p_art = 'bearbeiten' then
    select * into n from nachrichten x where x.id = p_nachricht_id and x.gespraech_id = g.id;
    if n.id is null or n.sender_id <> auth.uid() or n.geloescht_am is not null or n.gesendet_am < now() - interval '24 hours' then
      return jsonb_build_object('ok', false, 'grund', 'keine_rechte');
    end if;
  end if;
  if not darf_im_gespraech_schreiben(g.id) then return jsonb_build_object('ok', false, 'grund', 'keine_rechte'); end if;

  -- Flut: Nachrichten je Minute / je 10 Minuten (alle geschuetzten Chats zusammen)
  if (select count(*) from nachrichten x join gespraeche y on y.id = x.gespraech_id
      where x.sender_id = auth.uid() and x.gesendet_am > now() - interval '1 minute' and y.typ in ('tanzraum', 'verein', 'trainingsgruppe', 'gruppenchat'))
       >= chat_einstellung_wert('pro_minute')
     or (select count(*) from nachrichten x join gespraeche y on y.id = x.gespraech_id
      where x.sender_id = auth.uid() and x.gesendet_am > now() - interval '10 minutes' and y.typ in ('tanzraum', 'verein', 'trainingsgruppe', 'gruppenchat'))
       >= chat_einstellung_wert('pro_10_minuten') then
    return jsonb_build_object('ok', false, 'grund', 'flut', 'oeffentlich', v_oeffentlich);
  end if;
  -- Gleiche Nachricht wiederholt (nur bei Text)
  if p_art = 'neu' and schutz_normal(p_text) <> '' and exists (
      select 1 from nachrichten x where x.sender_id = auth.uid() and x.gespraech_id = g.id
        and x.gesendet_am > now() - make_interval(mins => chat_einstellung_wert('duplikat_minuten'))
        and md5(schutz_normal(x.inhalt)) = v_hash) then
    return jsonb_build_object('ok', false, 'grund', 'duplikat', 'oeffentlich', v_oeffentlich);
  end if;

  return jsonb_build_object(
    'ok', true,
    'oeffentlich', v_oeffentlich,
    'max_laenge', case when v_oeffentlich then chat_einstellung_wert('max_laenge_oeffentlich') else 4000 end,
    -- Minderjaehrige beteiligt? Oeffentlich immer ja; in Gruppen, wenn ein Mitglied unter 16 bzw. unter 18 ist
    'minderjaehrige', v_oeffentlich or exists (
      select 1 from (
        select t.user_id as u from gespraech_teilnehmer t where t.gespraech_id = g.id
        union select vm.user_id from vereins_mitglieder vm where g.typ = 'verein' and vm.verein_id = g.verein_id and coalesce(vm.aktiv, true)
        union select vm.user_id from gruppen_mitglieder gm join vereins_mitglieder vm on vm.id = gm.vereins_mitglied_id
          where g.typ = 'trainingsgruppe' and gm.gruppe_id = g.gruppe_id and coalesce(vm.aktiv, true)) m
      where m.u is not null and (geburtsdatum_von(m.u) is null or geburtsdatum_von(m.u) > (now() - interval '18 years')::date)),
    'kontext_eigene', coalesce((select jsonb_agg(z.inhalt order by z.gesendet_am) from (
        select x.inhalt, x.gesendet_am from nachrichten x
        where x.sender_id = auth.uid() and x.gespraech_id = g.id and x.geloescht_am is null and x.inhalt <> ''
          and x.gesendet_am > now() - interval '30 minutes' and (p_nachricht_id is null or x.id <> p_nachricht_id)
        order by x.gesendet_am desc limit 5) z), '[]'::jsonb),
    'kontext_chat', case when v_oeffentlich then coalesce((select jsonb_agg(z.inhalt order by z.gesendet_am) from (
        select x.inhalt, x.gesendet_am from nachrichten x
        where x.gespraech_id = g.id and x.sender_id <> auth.uid() and x.geloescht_am is null and x.inhalt <> ''
          and x.gesendet_am > now() - interval '15 minutes'
        order by x.gesendet_am desc limit 3) z), '[]'::jsonb) else '[]'::jsonb end);
end;
$function$;
revoke all on function public.schutz_vorpruefung(uuid, text, uuid, text) from public, anon;
grant execute on function public.schutz_vorpruefung(uuid, text, uuid, text) to authenticated;

-- Veroeffentlichen nach bestandener Pruefung – NUR mit Service-Schluessel (Edge Function chat-senden).
-- Prueft Zugriff und Schreibrecht erneut im Namen des Absenders.
create or replace function public.schutz_veroeffentlichen(p_user_id uuid, p_gespraech_id uuid, p_art text, p_nachricht_id uuid, p_nachricht jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_typ text := (select g.typ from gespraeche g where g.id = p_gespraech_id);
  v_inhalt text := btrim(coalesce(p_nachricht->>'inhalt', ''));
  v_bild text := nullif(p_nachricht->>'bild_pfad', '');
  v_anhang jsonb := case when jsonb_typeof(p_nachricht->'anhang') = 'object' then p_nachricht->'anhang' end;
  v_umfrage jsonb := case when jsonb_typeof(p_nachricht->'umfrage') = 'object' then p_nachricht->'umfrage' end;
  v_standort jsonb := case when jsonb_typeof(p_nachricht->'standort') = 'object' then p_nachricht->'standort' end;
  v_sticker text := nullif(p_nachricht->>'sticker', '');
  v_antwort uuid := case when (p_nachricht->>'antwort_auf') ~* '^[0-9a-f-]{36}$' then (p_nachricht->>'antwort_auf')::uuid end;
begin
  if v_typ is null or v_typ not in ('tanzraum', 'verein', 'trainingsgruppe', 'gruppenchat') then
    raise exception 'Kein geschützter Chat.' using errcode = 'P0001';
  end if;
  -- ab hier im Namen des Absenders (auth.uid())
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  if not darf_im_gespraech_schreiben(p_gespraech_id) or chat_sperre_bis(p_user_id, v_typ = 'tanzraum') is not null then
    raise exception 'Du darfst in diesem Chat gerade nicht schreiben.' using errcode = '42501';
  end if;
  -- Oeffentlicher Chat: nur Text, Antworten und TanzRaum-Smileys
  if v_typ = 'tanzraum' and (v_bild is not null or v_anhang is not null or v_umfrage is not null or v_standort is not null) then
    raise exception 'Im TanzRaum Chat sind nur Text und TanzRaum-Smileys möglich.' using errcode = 'P0001';
  end if;
  if v_typ = 'tanzraum' and char_length(v_inhalt) > chat_einstellung_wert('max_laenge_oeffentlich') then
    raise exception 'Die Nachricht ist zu lang.' using errcode = 'P0001';
  end if;
  if char_length(v_inhalt) > 4000 then raise exception 'Die Nachricht ist zu lang.' using errcode = 'P0001'; end if;
  if v_bild is not null and v_bild not like p_gespraech_id::text || '/%' then raise exception 'Das Bild ist ungültig.' using errcode = 'P0001'; end if;
  if v_anhang is not null and coalesce(v_anhang->>'pfad', '') not like p_gespraech_id::text || '/%' then
    raise exception 'Der Anhang ist ungültig.' using errcode = 'P0001';
  end if;

  perform set_config('tanzraum.schutz_freigabe', 'ja', true);
  if p_art = 'bearbeiten' then
    perform nachricht_bearbeiten(p_nachricht_id, v_inhalt);
    v_id := p_nachricht_id;
  else
    if v_inhalt = '' and v_bild is null and v_anhang is null and v_umfrage is null and v_standort is null and v_sticker is null then
      raise exception 'Die Nachricht ist leer.' using errcode = 'P0001';
    end if;
    insert into nachrichten (gespraech_id, sender_id, inhalt, bild_pfad, anhang, umfrage, standort, sticker, antwort_auf)
    values (p_gespraech_id, p_user_id, v_inhalt, v_bild, v_anhang, v_umfrage, v_standort, v_sticker, v_antwort)
    returning id into v_id;
  end if;
  perform set_config('tanzraum.schutz_freigabe', '', true);
  return v_id;
end;
$function$;
revoke all on function public.schutz_veroeffentlichen(uuid, uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.schutz_veroeffentlichen(uuid, uuid, text, uuid, jsonb) to service_role;

-- Blockierte bzw. nicht gepruefte Nachricht protokollieren und abgestufte Massnahmen ausloesen – NUR Service.
-- Nie eine Kontosperre: hoechstens eine zeitweise Chat-Schreibsperre und ein Moderationsfall.
create or replace function public.schutz_blockieren(p_user_id uuid, p_gespraech_id uuid, p_quelle text, p_ergebnis text,
                                                    p_kategorie text, p_schwere integer, p_text_hash text, p_auszug text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_typ text := (select g.typ from gespraeche g where g.id = p_gespraech_id);
  v_oeffentlich boolean := v_typ = 'tanzraum';
  v_anzahl int;
  v_massnahme text := 'keine';
  v_bis timestamptz;
  v_fall boolean := false;
  v_schwere int := greatest(0, least(coalesce(p_schwere, 1), 3));
  v_kategorie text := left(coalesce(nullif(btrim(p_kategorie), ''), 'sonstiges'), 40);
begin
  if v_typ is null or p_user_id is null then raise exception 'Ungültig.' using errcode = 'P0001'; end if;
  -- Ausfall/Fehler der Pruefung: nur protokollieren, keine Massnahme gegen den Nutzer
  if p_ergebnis = 'nicht_geprueft' then
    insert into schutz_ereignisse (user_id, gespraech_id, chat_art, quelle, ergebnis, kategorie, schwere, massnahme, text_hash)
    values (p_user_id, p_gespraech_id, case when v_oeffentlich then 'oeffentlich' else 'gruppe' end, p_quelle, 'nicht_geprueft', v_kategorie, 0, 'keine', p_text_hash);
    return jsonb_build_object('massnahme', 'keine');
  end if;

  select count(*) + 1 into v_anzahl from schutz_ereignisse e
  where e.user_id = p_user_id and e.ergebnis <> 'nicht_geprueft'
    and e.erstellt_am > now() - make_interval(hours => chat_einstellung_wert('fenster_stunden'));

  if v_anzahl >= chat_einstellung_wert('sperre_lang_ab') then
    v_massnahme := 'sperre_lang';
    v_bis := now() + make_interval(hours => chat_einstellung_wert('sperre_lang_stunden'));
  elsif v_anzahl >= chat_einstellung_wert('sperre_ab') or v_schwere >= 3 then
    v_massnahme := 'sperre';
    v_bis := now() + make_interval(mins => chat_einstellung_wert('sperre_minuten'));
  elsif v_anzahl >= chat_einstellung_wert('verwarnung_ab') then
    v_massnahme := 'verwarnung';
  end if;
  v_fall := v_schwere >= chat_einstellung_wert('fall_ab_schwere') or v_anzahl >= chat_einstellung_wert('fall_ab_anzahl');

  if v_bis is not null then
    insert into chat_schreibsperren (user_id, bereich, bis, grund, automatisch)
    values (p_user_id, case when v_oeffentlich then 'oeffentlich' else 'gruppen' end, v_bis, 'Automatische Schutzprüfung: ' || v_kategorie, true);
  end if;
  if v_massnahme in ('verwarnung', 'sperre', 'sperre_lang') then
    insert into benachrichtigungen (user_id, typ, text, link)
    values (p_user_id, 'chat_hinweis',
      case when v_bis is null then 'Hinweis: Mehrere deiner Chatnachrichten konnten nicht veröffentlicht werden. Bitte beachte die TanzRaum-Chatregeln.'
           else 'Du kannst bis ' || to_char(v_bis at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') || ' Uhr in '
                || case when v_oeffentlich then 'den TanzRaum Chat' else 'Gruppenchats' end || ' nicht schreiben, weil mehrere Nachrichten gegen die Chatregeln verstoßen haben.' end,
      case when v_oeffentlich then '/dashboard/chat' else '/dashboard/nachrichten' end);
  end if;
  if v_fall and not exists (
      select 1 from meldungen m where m.bereich = 'chat' and m.automatisch and m.ziel_user_id = p_user_id and m.status in ('offen', 'in_pruefung')
        and m.erstellt_am > now() - interval '1 hour') then
    insert into meldungen (melder_id, ziel_user_id, grund, text, status, bereich, gespraech_id, automatisch, auszug)
    values (null, p_user_id, 'schutzpruefung',
      'Schutzprüfung (' || p_quelle || '): ' || v_kategorie || ', Schwere ' || v_schwere || ', ' || v_anzahl || '. Verstoß in ' || chat_einstellung_wert('fenster_stunden') || ' Std.',
      'offen', 'chat', p_gespraech_id, true, left(p_auszug, 500));
  end if;
  insert into schutz_ereignisse (user_id, gespraech_id, chat_art, quelle, ergebnis, kategorie, schwere, massnahme, text_hash)
  values (p_user_id, p_gespraech_id, case when v_oeffentlich then 'oeffentlich' else 'gruppe' end, p_quelle,
          case when p_ergebnis = 'auffaellig' then 'auffaellig' else 'blockiert' end, v_kategorie, v_schwere,
          case when v_fall and v_massnahme = 'keine' then 'fall' else v_massnahme end, p_text_hash);
  return jsonb_build_object('massnahme', v_massnahme, 'sperre_bis', v_bis, 'fall', v_fall);
end;
$function$;
revoke all on function public.schutz_blockieren(uuid, uuid, text, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.schutz_blockieren(uuid, uuid, text, text, text, integer, text, text) to service_role;

-- =============================================================================================
-- 7) Melden und Moderation (bestehende Tabelle meldungen, Bereich „chat“)
-- =============================================================================================
create or replace function public.chat_nachricht_melden(p_nachricht_id uuid, p_grund text, p_text text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  n nachrichten%rowtype;
begin
  select * into n from nachrichten where id = p_nachricht_id;
  if n.id is null or n.geloescht_am is not null or not hat_gespraech_zugriff(n.gespraech_id) or not ist_geschuetzter_chat(n.gespraech_id) then
    raise exception 'Nachricht nicht gefunden.' using errcode = 'P0001';
  end if;
  if n.sender_id = auth.uid() then raise exception 'Eigene Nachrichten kannst du nicht melden.' using errcode = 'P0001'; end if;
  if p_grund not in ('beleidigung', 'belaestigung', 'mobbing', 'unangemessen', 'sexualisiert', 'spam', 'persoenliche_daten', 'regelverstoss', 'sonstiges') then
    raise exception 'Bitte einen Grund wählen.' using errcode = 'P0001';
  end if;
  if exists (select 1 from meldungen m where m.nachricht_id = n.id and m.melder_id = auth.uid()) then
    raise exception 'Du hast diese Nachricht bereits gemeldet.' using errcode = 'P0001';
  end if;
  if (select count(*) from meldungen m where m.melder_id = auth.uid() and m.erstellt_am > now() - interval '1 hour') >= 20 then
    raise exception 'Du hast gerade sehr viele Meldungen gesendet. Bitte versuche es später erneut.' using errcode = 'P0001';
  end if;
  insert into meldungen (melder_id, ziel_user_id, grund, text, status, bereich, nachricht_id, gespraech_id, automatisch, auszug)
  values (auth.uid(), n.sender_id, p_grund, nullif(left(btrim(coalesce(p_text, '')), 1000), ''), 'offen', 'chat', n.id, n.gespraech_id, false,
          left(coalesce(nullif(n.inhalt, ''), case when n.sticker is not null then '[TanzRaum-Smiley]' when n.bild_pfad is not null then '[Foto]'
                                                    when n.anhang is not null then '[Datei: ' || (n.anhang->>'name') || ']' else '' end), 500));
end;
$function$;
revoke all on function public.chat_nachricht_melden(uuid, text, text) from public, anon;
grant execute on function public.chat_nachricht_melden(uuid, text, text) to authenticated;

-- Darf die aktuelle Person Chat-Faelle dieser Art sehen/bearbeiten?
create or replace function public.chat_moderation_darf(p_oeffentlich boolean)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select ist_plattform_admin_aktuell()
      or (team_darf('chat.meldungen_bearbeiten')
          and team_darf(case when p_oeffentlich then 'chat.oeffentlich_moderieren' else 'chat.gruppen_moderieren' end));
$function$;
grant execute on function public.chat_moderation_darf(boolean) to authenticated;

-- Moderationsfaelle Chat. Moderatoren sehen nur den gemeldeten bzw. blockierten Auszug – kein Einblick in Gruppenchats.
create or replace function public.chat_faelle(p_status text default null)
 returns table(id uuid, erstellt_am timestamptz, status text, grund text, text text, automatisch boolean, oeffentlich boolean,
               chat_name text, auszug text, nachricht_id uuid, nachricht_entfernt boolean, melder text, ziel_user_id uuid, ziel text,
               ziel_avatar text, ziel_gesperrt boolean, ziel_chat_sperre_bis timestamptz, verstoesse_30_tage integer, admin_notiz text, bearbeitet_am timestamptz)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not (chat_moderation_darf(true) or chat_moderation_darf(false)) then
    raise exception 'Dafür fehlt dir das Recht „Chat-Meldungen bearbeiten“.' using errcode = '42501';
  end if;
  return query
  select m.id, m.erstellt_am, m.status, m.grund, m.text, m.automatisch, g.typ = 'tanzraum',
    case g.typ when 'tanzraum' then 'TanzRaum Chat' when 'verein' then 'Vereinschat' when 'trainingsgruppe' then 'Tanzgruppen-Chat'
               when 'gruppenchat' then 'Gruppenchat' else 'Chat' end,
    m.auszug, m.nachricht_id, coalesce((select n.geloescht_am is not null from nachrichten n where n.id = m.nachricht_id), true),
    case when m.automatisch then 'Schutzprüfung' else coalesce((select '@' || p.handle from profiles p where p.id = m.melder_id), 'Gelöschtes Konto') end,
    m.ziel_user_id,
    coalesce((select '@' || p.handle from profiles p where p.id = m.ziel_user_id), 'Gelöschtes Konto'),
    (select p.avatar_url from profiles p where p.id = m.ziel_user_id),
    coalesce((select p.gesperrt from profiles p where p.id = m.ziel_user_id), false),
    (select max(s.bis) from chat_schreibsperren s where s.user_id = m.ziel_user_id and s.aufgehoben_am is null and s.bis > now()),
    (select count(*)::int from schutz_ereignisse e where e.user_id = m.ziel_user_id and e.ergebnis <> 'nicht_geprueft' and e.erstellt_am > now() - interval '30 days'),
    m.admin_notiz, m.bearbeitet_am
  from meldungen m left join gespraeche g on g.id = m.gespraech_id
  where m.bereich = 'chat' and (p_status is null or m.status = p_status)
    and chat_moderation_darf(coalesce(g.typ, 'tanzraum') = 'tanzraum')
  order by m.status = 'offen' desc, m.erstellt_am desc
  limit 200;
end;
$function$;
revoke all on function public.chat_faelle(text) from public, anon;
grant execute on function public.chat_faelle(text) to authenticated;

-- Fall bearbeiten: Status, Notiz, optional Nachricht entfernen, verwarnen, zeitweise Schreibsperre.
-- Kontosperre erfolgt ausschliesslich ueber die bestehende Funktion team_konto_sperren (Recht „nutzer.sperren“).
create or replace function public.chat_fall_setzen(p_id uuid, p_status text, p_notiz text, p_nachricht_entfernen boolean,
                                                   p_verwarnen boolean, p_sperre_stunden integer)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  m meldungen%rowtype;
  v_oeffentlich boolean;
begin
  select * into m from meldungen where id = p_id and bereich = 'chat';
  if m.id is null then raise exception 'Fall nicht gefunden.' using errcode = 'P0001'; end if;
  v_oeffentlich := coalesce((select g.typ = 'tanzraum' from gespraeche g where g.id = m.gespraech_id), true);
  if not chat_moderation_darf(v_oeffentlich) then raise exception 'Dafür fehlt dir das Recht.' using errcode = '42501'; end if;
  if p_status not in ('offen', 'in_pruefung', 'erledigt', 'keine_massnahme') then raise exception 'Ungültiger Status.' using errcode = 'P0001'; end if;

  if coalesce(p_nachricht_entfernen, false) and m.nachricht_id is not null then
    if not (ist_plattform_admin_aktuell() or team_darf('chat.nachrichten_loeschen')) then
      raise exception 'Dafür fehlt dir das Recht „Nachrichten entfernen“.' using errcode = '42501';
    end if;
    update nachrichten set geloescht_am = now(), inhalt = '', bild_pfad = null, umfrage = null, anhang = null, standort = null, sticker = null
    where id = m.nachricht_id and geloescht_am is null;
    perform protokollieren('chat_nachricht_entfernt', m.ziel_user_id, jsonb_build_object('fall_id', m.id, 'oeffentlich', v_oeffentlich));
  end if;
  if coalesce(p_sperre_stunden, 0) > 0 and m.ziel_user_id is not null then
    if not (ist_plattform_admin_aktuell() or team_darf('chat.nutzer_stummschalten')) then
      raise exception 'Dafür fehlt dir das Recht „Nutzer stummschalten“.' using errcode = '42501';
    end if;
    if exists (select 1 from profiles p where p.id = m.ziel_user_id and p.ist_plattform_admin) then
      raise exception 'Der TanzRaum-Admin kann nicht gesperrt werden.' using errcode = '42501';
    end if;
    insert into chat_schreibsperren (user_id, bereich, bis, grund, automatisch, erstellt_von)
    values (m.ziel_user_id, case when v_oeffentlich then 'oeffentlich' else 'gruppen' end, now() + make_interval(hours => least(p_sperre_stunden, 24 * 90)),
            nullif(left(btrim(coalesce(p_notiz, '')), 500), ''), false, auth.uid());
    perform protokollieren('chat_schreibsperre', m.ziel_user_id, jsonb_build_object('fall_id', m.id, 'stunden', p_sperre_stunden, 'oeffentlich', v_oeffentlich));
  end if;
  if coalesce(p_verwarnen, false) and m.ziel_user_id is not null then
    insert into benachrichtigungen (user_id, typ, text, link)
    values (m.ziel_user_id, 'chat_hinweis', 'Verwarnung der TanzRaum-Moderation: Bitte halte dich im Chat an die TanzRaum-Chatregeln.',
            case when v_oeffentlich then '/dashboard/chat' else '/dashboard/nachrichten' end);
    perform protokollieren('chat_verwarnung', m.ziel_user_id, jsonb_build_object('fall_id', m.id));
  end if;
  update meldungen set status = p_status, admin_notiz = nullif(left(btrim(coalesce(p_notiz, '')), 2000), ''),
    bearbeitet_von = auth.uid(), bearbeitet_am = now(),
    -- Datensparsamkeit: abgeschlossene Faelle behalten keinen Nachrichtenauszug
    auszug = case when p_status in ('erledigt', 'keine_massnahme') then null else auszug end
  where id = m.id;
  if m.melder_id is not null and p_status in ('erledigt', 'keine_massnahme') and m.status not in ('erledigt', 'keine_massnahme') then
    insert into benachrichtigungen (user_id, typ, text, link)
    values (m.melder_id, 'meldung_status', 'Danke für deine Meldung – sie wurde von der TanzRaum-Moderation bearbeitet.', null);
  end if;
end;
$function$;
revoke all on function public.chat_fall_setzen(uuid, text, text, boolean, boolean, integer) from public, anon;
grant execute on function public.chat_fall_setzen(uuid, text, text, boolean, boolean, integer) to authenticated;

-- Aktive Chat-Sperren (Moderation) und Aufheben
create or replace function public.chat_sperren_liste()
 returns table(id uuid, user_id uuid, nutzer text, avatar_url text, bereich text, bis timestamptz, grund text, automatisch boolean, erstellt_am timestamptz)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not (ist_plattform_admin_aktuell() or team_darf('chat.nutzer_stummschalten')) then
    raise exception 'Dafür fehlt dir das Recht „Nutzer stummschalten“.' using errcode = '42501';
  end if;
  return query
  select s.id, s.user_id, coalesce('@' || p.handle, 'Gelöschtes Konto'), p.avatar_url, s.bereich, s.bis, s.grund, s.automatisch, s.erstellt_am
  from chat_schreibsperren s left join profiles p on p.id = s.user_id
  where s.aufgehoben_am is null and s.bis > now()
  order by s.bis desc limit 200;
end;
$function$;
revoke all on function public.chat_sperren_liste() from public, anon;
grant execute on function public.chat_sperren_liste() to authenticated;

create or replace function public.chat_sperre_aufheben(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user uuid;
begin
  if not (ist_plattform_admin_aktuell() or team_darf('chat.nutzer_stummschalten')) then
    raise exception 'Dafür fehlt dir das Recht „Nutzer stummschalten“.' using errcode = '42501';
  end if;
  update chat_schreibsperren set aufgehoben_am = now(), aufgehoben_von = auth.uid() where id = p_id and aufgehoben_am is null returning user_id into v_user;
  if v_user is null then raise exception 'Sperre nicht gefunden.' using errcode = 'P0001'; end if;
  perform protokollieren('chat_schreibsperre_aufgehoben', v_user, jsonb_build_object('sperre_id', p_id));
end;
$function$;
revoke all on function public.chat_sperre_aufheben(uuid) from public, anon;
grant execute on function public.chat_sperre_aufheben(uuid) to authenticated;

-- Statistik der Schutzpruefung (nur Zahlen, keine Inhalte)
create or replace function public.schutz_statistik(p_tage integer default 7)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_seit timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_tage, 7), 180)));
begin
  if not (chat_moderation_darf(true) or chat_moderation_darf(false)) then
    raise exception 'Dafür fehlt dir das Recht „Chat-Meldungen bearbeiten“.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'blockiert', (select count(*) from schutz_ereignisse e where e.erstellt_am > v_seit and e.ergebnis in ('blockiert', 'auffaellig')),
    'nicht_geprueft', (select count(*) from schutz_ereignisse e where e.erstellt_am > v_seit and e.ergebnis = 'nicht_geprueft'),
    'nicht_geprueft_24h', (select count(*) from schutz_ereignisse e where e.erstellt_am > now() - interval '24 hours' and e.ergebnis = 'nicht_geprueft'),
    'sperren', (select count(*) from schutz_ereignisse e where e.erstellt_am > v_seit and e.massnahme in ('sperre', 'sperre_lang')),
    'faelle_offen', (select count(*) from meldungen m where m.bereich = 'chat' and m.status in ('offen', 'in_pruefung')),
    'kategorien', coalesce((select jsonb_object_agg(k, a) from (
        select e.kategorie k, count(*) a from schutz_ereignisse e where e.erstellt_am > v_seit and e.ergebnis <> 'nicht_geprueft' group by e.kategorie) x), '{}'::jsonb),
    'quellen', coalesce((select jsonb_object_agg(q, a) from (
        select e.quelle q, count(*) a from schutz_ereignisse e where e.erstellt_am > v_seit group by e.quelle) x), '{}'::jsonb),
    'einstellungen', (select coalesce(e.chat_einstellungen, '{}'::jsonb) from plattform_einstellungen e where e.id limit 1));
end;
$function$;
revoke all on function public.schutz_statistik(integer) from public, anon;
grant execute on function public.schutz_statistik(integer) to authenticated;

-- Schwellenwerte einstellen (nur TanzRaum-Admin)
create or replace function public.admin_chat_einstellungen_setzen(p jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  k text;
  v jsonb := '{}'::jsonb;
  erlaubt text[] := array['max_laenge_oeffentlich', 'pro_minute', 'pro_10_minuten', 'duplikat_minuten', 'fenster_stunden', 'verwarnung_ab',
                          'sperre_ab', 'sperre_minuten', 'sperre_lang_ab', 'sperre_lang_stunden', 'fall_ab_anzahl', 'fall_ab_schwere', 'oeffentlich_ab_16'];
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  for k in select jsonb_object_keys(coalesce(p, '{}'::jsonb)) loop
    if not k = any(erlaubt) or jsonb_typeof(p->k) <> 'number' or (p->>k)::numeric <> floor((p->>k)::numeric)
       or (p->>k)::int < 0 or (p->>k)::int > 10000 then
      raise exception 'Ungültiger Wert für %.', k using errcode = 'P0001';
    end if;
    v := v || jsonb_build_object(k, (p->>k)::int);
  end loop;
  if (v ? 'max_laenge_oeffentlich') and ((v->>'max_laenge_oeffentlich')::int not between 100 and 4000) then
    raise exception 'Die Nachrichtenlänge muss zwischen 100 und 4000 Zeichen liegen.' using errcode = 'P0001';
  end if;
  if (v ? 'oeffentlich_ab_16') and (v->>'oeffentlich_ab_16')::int not in (0, 1) then raise exception 'Ungültiger Wert.' using errcode = 'P0001'; end if;
  update plattform_einstellungen set chat_einstellungen = v, geaendert_am = now(), geaendert_von = auth.uid() where id;
  perform protokollieren('chat_einstellungen_geaendert', null, v);
end;
$function$;
revoke all on function public.admin_chat_einstellungen_setzen(jsonb) from public, anon;
grant execute on function public.admin_chat_einstellungen_setzen(jsonb) to authenticated;

-- =============================================================================================
-- 8) Aufbewahrung: Schutzereignisse 180 Tage, Auszuege offener automatischer Faelle hoechstens 90 Tage
-- =============================================================================================
create or replace function public.schutz_aufraeumen()
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  delete from schutz_ereignisse where erstellt_am < now() - interval '180 days';
  update meldungen set auszug = null where bereich = 'chat' and auszug is not null and erstellt_am < now() - interval '90 days';
  update chat_schreibsperren set aufgehoben_am = coalesce(aufgehoben_am, bis) where aufgehoben_am is null and bis < now() - interval '30 days';
$function$;
revoke all on function public.schutz_aufraeumen() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    begin
      perform cron.unschedule('schutz-aufraeumen');
    exception when others then null;
    end;
    perform cron.schedule('schutz-aufraeumen', '41 3 * * *', 'select public.schutz_aufraeumen()');
  end if;
end $$;

-- Realtime: die bestehende Veroeffentlichung von `nachrichten` bleibt (Nachrichten entstehen erst nach der Pruefung).
