-- Ehrungen & Orden – Regeln der Verbandsauszeichnungen je Verein anpassbar
--
-- Der zentrale Katalog bleibt die Voreinstellung. Ein Vereinsadmin kann fuer seinen Verein einzelne Werte einer
-- Verbandsregel abweichend festlegen (z. B. welche Aemter beim Punktesystem zaehlen, Jahre, ununterbrochen) oder die
-- Regel fuer seinen Verein ausschalten. Nicht angepasste Werte kommen weiter aus dem Katalog; „Auf Voreinstellung
-- zuruecksetzen“ loescht die Anpassung. Vereinseigene Auszeichnungen werden wie bisher direkt bearbeitet.

create table public.verein_ehrungs_regel_anpassungen (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  regel_id uuid not null references public.ehrungs_regeln(id) on delete cascade,
  aktiv boolean not null default true,
  jahre numeric(5, 2) check (jahre is null or jahre > 0),
  funktion text,
  punkte_min numeric(7, 2) check (punkte_min is null or punkte_min > 0),
  punkte_gewichte jsonb check (punkte_gewichte is null or jsonb_typeof(punkte_gewichte) = 'object'),
  ununterbrochen boolean,
  bemerkung text,
  geaendert_von uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (verein_id, regel_id)
);
create index verein_ehrungs_regel_anpassungen_regel_idx on public.verein_ehrungs_regel_anpassungen (regel_id);

-- Nur Verbandsregeln; die wirksame Regel muss vollstaendig bleiben; Bearbeiter und Zeitpunkt festhalten
create or replace function public.ehrungs_regel_anpassung_pruefen()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  g ehrungs_regeln%rowtype;
  v_typ text;
begin
  select r.* into g from ehrungs_regeln r where r.id = new.regel_id;
  select a.typ into v_typ from ehrungsarten a where a.id = g.ehrungsart_id;
  if v_typ is distinct from 'verband' then
    raise exception 'Nur Regeln von Verbandsauszeichnungen können für einen Verein angepasst werden.' using errcode = 'P0001';
  end if;
  new.funktion := nullif(trim(new.funktion), '');
  if g.berechnung in ('mitgliedschaft', 'aktiv', 'ehrenamt', 'funktion') and coalesce(new.jahre, g.jahre) is null then
    raise exception 'Bitte die erforderlichen Jahre angeben.' using errcode = 'P0001';
  end if;
  if g.berechnung = 'funktion' and coalesce(new.funktion, nullif(trim(g.funktion), '')) is null then
    raise exception 'Bitte die Funktion angeben.' using errcode = 'P0001';
  end if;
  if g.berechnung = 'punkte' and (coalesce(new.punkte_min, g.punkte_min) is null
                                  or coalesce(new.punkte_gewichte, g.punkte_gewichte, '{}'::jsonb) = '{}'::jsonb) then
    raise exception 'Bitte Mindestpunkte und mindestens einen Punktwert je Jahr angeben.' using errcode = 'P0001';
  end if;
  new.geaendert_von := auth.uid();
  new.updated_at := now();
  return new;
end;
$function$;

create trigger ehrungs_regel_anpassung_pruefen before insert or update on public.verein_ehrungs_regel_anpassungen
  for each row execute function public.ehrungs_regel_anpassung_pruefen();

-- Wirksame Regeln einer Auszeichnung fuer einen Verein (Katalog + Anpassung des Vereins)
create or replace function public.ehrungs_regeln_wirksam(p_verein_id uuid, p_ehrungsart_id uuid)
 returns setof public.ehrungs_regeln
 language sql
 stable
 set search_path to 'public'
as $function$
  select g.id, g.ehrungsart_id, g.berechnung,
         coalesce(o.jahre, g.jahre), coalesce(o.funktion, g.funktion), coalesce(o.punkte_min, g.punkte_min),
         coalesce(o.punkte_gewichte, g.punkte_gewichte), coalesce(o.ununterbrochen, g.ununterbrochen),
         coalesce(o.bemerkung, g.bemerkung), g.sortierung, g.created_at
  from ehrungs_regeln g
  left join verein_ehrungs_regel_anpassungen o on o.regel_id = g.id and o.verein_id = p_verein_id
  where g.ehrungsart_id = p_ehrungsart_id and coalesce(o.aktiv, true);
$function$;

-- Berechnung mit den wirksamen Regeln des Vereins (Grundlage vermerkt, ob eine Regel angepasst ist)
create or replace function public.ehrung_berechnen(p_vm uuid, p_ehrungsart_id uuid, p_korrektur_von date default null)
 returns jsonb
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  a ehrungsarten%rowtype;
  r ehrungs_regeln%rowtype;
  v_verein uuid;
  v_regeln jsonb := '[]';
  v_faellig date;
  v_gesamt date;
  v_alle_da boolean := true;
  v_auto boolean := false;
  v_beginn date;
  v_angepasst boolean;
begin
  select * into a from ehrungsarten where id = p_ehrungsart_id;
  select vm.verein_id into v_verein from vereins_mitglieder vm where vm.id = p_vm;
  for r in select * from ehrungs_regeln_wirksam(v_verein, p_ehrungsart_id) x order by x.sortierung, x.created_at loop
    v_angepasst := exists (select 1 from verein_ehrungs_regel_anpassungen o where o.regel_id = r.id and o.verein_id = v_verein);
    if r.berechnung = 'manuell' then
      v_regeln := v_regeln || jsonb_build_array(jsonb_build_object('berechnung', 'manuell', 'bemerkung', r.bemerkung));
      continue;
    end if;
    v_auto := true;
    v_faellig := ehrung_regel_faellig(p_vm, r, p_korrektur_von);
    select min(z.von) into v_beginn from mitglied_zeitraeume z
      where z.vereins_mitglied_id = p_vm
        and (r.berechnung = 'punkte' or (z.art = r.berechnung
             and (r.berechnung <> 'funktion' or lower(trim(z.funktion)) = lower(trim(r.funktion)))));
    v_regeln := v_regeln || jsonb_build_array(jsonb_build_object(
      'berechnung', r.berechnung, 'jahre', r.jahre, 'funktion', r.funktion, 'punkte_min', r.punkte_min,
      'punkte_gewichte', r.punkte_gewichte, 'ununterbrochen', r.ununterbrochen, 'vereinsanpassung', v_angepasst,
      'beginn', case when p_korrektur_von is not null then least(p_korrektur_von, v_beginn) else v_beginn end,
      'korrektur_von', p_korrektur_von, 'faellig_am', v_faellig));
    if v_faellig is null then
      v_alle_da := false;
    elsif a.regel_verknuepfung = 'alle' then
      v_gesamt := greatest(v_gesamt, v_faellig);
    else
      v_gesamt := least(v_gesamt, v_faellig);
    end if;
  end loop;
  if a.regel_verknuepfung = 'alle' and not v_alle_da then v_gesamt := null; end if;
  if not v_auto then v_gesamt := null; end if;
  return jsonb_build_object('verknuepfung', a.regel_verknuepfung, 'regeln', v_regeln, 'faellig_am', v_gesamt,
                            'berechnet_am', (now() at time zone 'Europe/Berlin')::date);
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
      and exists (select 1 from ehrungs_regeln_wirksam(p_verein_id, ea.id) rg where rg.berechnung <> 'manuell')
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
    and not exists (
      select 1 from mitglied_ehrungen me join ehrungsarten x on x.id = me.ehrungsart_id
      where me.vereins_mitglied_id = bw.vm_id and me.status not in ('nicht_vorgesehen', 'abgelehnt')
        and coalesce(x.serie, x.id::text) = bw.serie_schluessel and coalesce(x.stufe_nr, 0) >= bw.stufe_nr);
end;
$function$;

-- Geaenderte Regeln (Katalog oder Anpassung) in unveraenderten Vorschlaegen nachziehen – auch wenn sich nur die
-- Grundlage (nicht das Datum) aendert; nicht mehr erreichbare, unbearbeitete Vorschlaege entfallen
create or replace function public.ehrungen_aktualisieren_intern(p_verein_id uuid)
 returns integer
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_neu integer := 0;
  v record;
begin
  for v in select me.id, me.vereins_mitglied_id, me.ehrungsart_id,
                  (me.begruendung is null and me.interne_notiz is null and me.wunsch_datum is null and me.bestellung_id is null) as unberuehrt
           from mitglied_ehrungen me
           where me.verein_id = p_verein_id and me.herkunft = 'automatisch' and me.status = 'moeglich'
             and me.vereins_mitglied_id is not null loop
    -- nicht mehr erreichbare, unbearbeitete Vorschlaege entfernen (z. B. Regel fuer den Verein ausgeschaltet)
    if v.unberuehrt and (ehrung_berechnen(v.vereins_mitglied_id, v.ehrungsart_id) ->> 'faellig_am') is null then
      delete from mitglied_ehrungen where id = v.id;
      continue;
    end if;
    update mitglied_ehrungen me set
      auto_grundlage = x.g, grundlage = x.g, auto_faellig_am = (x.g ->> 'faellig_am')::date, faellig_am = (x.g ->> 'faellig_am')::date,
      aenderungs_begruendung = 'Automatisch neu berechnet (Zeiten oder Regeln geändert)'
    from (select ehrung_berechnen(v.vereins_mitglied_id, v.ehrungsart_id) as g) x
    where me.id = v.id
      and (me.faellig_am is distinct from (x.g ->> 'faellig_am')::date
           or (me.grundlage -> 'regeln') is distinct from (x.g -> 'regeln'));
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

-- Rechte
alter table public.verein_ehrungs_regel_anpassungen enable row level security;
create policy "Ehrungen: Regelanpassungen (Vereinsadmin)" on public.verein_ehrungs_regel_anpassungen for all to authenticated
  using (ehrungen_berechtigt(verein_id)) with check (ehrungen_berechtigt(verein_id));
revoke all on table public.verein_ehrungs_regel_anpassungen from public, anon;
grant select, insert, update, delete on table public.verein_ehrungs_regel_anpassungen to authenticated;
grant all on table public.verein_ehrungs_regel_anpassungen to service_role;

revoke all on function public.ehrungs_regel_anpassung_pruefen() from public, anon, authenticated;
revoke all on function public.ehrungs_regeln_wirksam(uuid, uuid) from public, anon, authenticated;
revoke all on function public.ehrung_berechnen(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.ehrungs_vorschlaege_intern(uuid, integer) from public, anon, authenticated;
revoke all on function public.ehrungen_aktualisieren_intern(uuid) from public, anon, authenticated;
grant execute on function public.ehrungs_regeln_wirksam(uuid, uuid), public.ehrung_berechnen(uuid, uuid, date),
  public.ehrungs_vorschlaege_intern(uuid, integer), public.ehrungen_aktualisieren_intern(uuid) to service_role;

-- Hinweis im Katalog: Aemter sind Voreinstellung und je Verein anpassbar
update public.ehrungs_organisationen set
  pruef_bemerkung = 'Voreinstellung: Die Funktionen „Vorstand“ und „Sitzungspräsident“ bringen 1 Punkt je Jahr, aktive Tätigkeit 0,5 Punkte je Jahr; Punkte aus mehreren Kriterien werden addiert. Das Kompendium nennt die Ämter nur beispielhaft – jeder Verein kann die Regeln unter Ehrungen → Auszeichnungen für sich anpassen (z. B. eigene Amtsbezeichnungen). Sonderleistungen bitte über eine Korrektur oder manuell berücksichtigen.'
where name = 'Vereinigung Badisch-Pfälzischer Karnevalvereine';
