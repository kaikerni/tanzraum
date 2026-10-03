-- Gefuehrter Gruppen-Assistent: Altersklasse ≠ Gruppe ≠ Disziplin.
-- Offizielle Altersklassen (Jugend, Junioren, Ü15) bleiben in altersklassen + altersklasse_disziplinen;
-- normale Vereinsgruppen koennen stattdessen eine freie Altersklasse (z. B. Bambinis) tragen – nie beides.
-- Tanzpaar und Solist sind Gruppen mit der Disziplin Tanzpaare bzw. Solist weiblich/maennlich (Training, Abmeldung,
-- Anwesenheit, Trainer und Betreuer funktionieren damit unveraendert). Gruppenstaerke = Anzahl zugeordneter Tänzer.

alter table public.gruppen add column if not exists altersklasse_frei text;
alter table public.gruppen drop constraint if exists gruppen_altersklasse_frei_check;
alter table public.gruppen add constraint gruppen_altersklasse_frei_check
  check (altersklasse_frei is null or char_length(btrim(altersklasse_frei)) between 1 and 40);
alter table public.gruppen drop constraint if exists gruppen_eine_altersklasse;
alter table public.gruppen add constraint gruppen_eine_altersklasse
  check (altersklasse_id is null or altersklasse_frei is null);

-- Personen fuer den Assistenten: aktive Mitglieder des Vereins mit Geschlecht (Tanzpaar/Solist) und Rollenfamilie
create or replace function public.gruppe_assistent_personen(p_verein_id uuid)
returns table(vm_id uuid, name text, geschlecht text, familie text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not (is_verein_admin_oder_trainer(p_verein_id) or ist_plattform_admin_aktuell()) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  return query
  select vm.id, a.anzeige, geschlecht_normal(p.geschlecht), rolle_familie(r.name)
  from vereins_mitglieder vm
  left join profiles p on p.id = vm.user_id
  left join rollen r on r.id = vm.rolle_id
  cross join lateral anzeige_namen(array[vm.user_id]) a
  where vm.verein_id = p_verein_id and coalesce(vm.aktiv, true) and vm.aufnahme_status = 'aufgenommen'
  order by a.anzeige;
end;
$$;
revoke all on function public.gruppe_assistent_personen(uuid) from public, anon;
grant execute on function public.gruppe_assistent_personen(uuid) to authenticated;

-- Gruppe anlegen/aendern inkl. Tänzer, Trainer, Betreuer in einem Schritt (gleiche Rechte wie bisher: Vereinsadmin/Trainer)
create or replace function public.gruppe_speichern(
  p_verein_id uuid,
  p_gruppe_id uuid,
  p_name text,
  p_altersklasse_id uuid,
  p_altersklasse_frei text,
  p_disziplin_id uuid,
  p_taenzer uuid[],
  p_trainer uuid[],
  p_betreuer uuid[],
  p_personen boolean default true)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_frei text := nullif(btrim(coalesce(p_altersklasse_frei, '')), '');
  v_ak uuid := p_altersklasse_id;
  v_besetzung text;
  v_diszi text;
  v_taenzer uuid[] := array(select distinct x from unnest(coalesce(p_taenzer, '{}')) x);
  v_trainer uuid[] := array(select distinct x from unnest(coalesce(p_trainer, '{}')) x);
  v_betreuer uuid[] := array(select distinct x from unnest(coalesce(p_betreuer, '{}')) x);
  v_alle uuid[];
  n_w int; n_m int; n_andere int;
begin
  if not is_verein_admin_oder_trainer(p_verein_id) then
    raise exception 'Nur Vereinsadmin und Trainer dürfen Gruppen verwalten.' using errcode = '42501';
  end if;
  if not verein_hat_lizenz(p_verein_id) then
    raise exception 'Gruppen verwalten gibt es mit der Vereinslizenz.' using errcode = '42501';
  end if;
  if v_name = '' or char_length(v_name) > 80 then
    raise exception 'Bitte einen Namen angeben (höchstens 80 Zeichen).' using errcode = 'P0001';
  end if;
  -- Freie Altersklasse mit offiziellem Namen -> offizielle Altersklasse verwenden
  if v_frei is not null then
    if v_ak is not null then raise exception 'Bitte nur eine Altersklasse wählen.' using errcode = 'P0001'; end if;
    if char_length(v_frei) > 40 then raise exception 'Die Altersklasse darf höchstens 40 Zeichen lang sein.' using errcode = 'P0001'; end if;
    select a.id into v_ak from altersklassen a where lower(a.name) = lower(v_frei);
    if v_ak is not null then v_frei := null; end if;
  end if;
  -- Altersklasse ist nie der Gruppenname
  if exists (select 1 from altersklassen a where lower(a.name) = lower(v_name)) or lower(v_name) = lower(coalesce(v_frei, '')) then
    raise exception '„%“ ist eine Altersklasse – bitte der Gruppe einen eigenen Namen geben (z. B. „Jugendgarde 1“).', v_name using errcode = 'P0001';
  end if;
  if p_disziplin_id is not null then
    select d.besetzung, d.name into v_besetzung, v_diszi from disziplinen d where d.id = p_disziplin_id;
    if v_diszi is null then raise exception 'Unbekannte Disziplin.' using errcode = 'P0001'; end if;
    if v_ak is not null and not exists (
        select 1 from altersklasse_disziplinen x where x.altersklasse_id = v_ak and x.disziplin_id = p_disziplin_id) then
      raise exception 'Die Disziplin „%“ gibt es in dieser Altersklasse nicht.', v_diszi using errcode = 'P0001';
    end if;
  end if;

  if p_gruppe_id is not null then
    update gruppen set name = v_name, altersklasse_id = v_ak, altersklasse_frei = v_frei, disziplin_id = p_disziplin_id
    where id = p_gruppe_id and verein_id = p_verein_id
    returning id into v_id;
    if v_id is null then raise exception 'Gruppe nicht gefunden.' using errcode = 'P0001'; end if;
  else
    insert into gruppen (verein_id, name, altersklasse_id, altersklasse_frei, disziplin_id)
    values (p_verein_id, v_name, v_ak, v_frei, p_disziplin_id)
    returning id into v_id;
  end if;

  if p_personen then
    v_alle := v_taenzer || v_trainer || v_betreuer;
    if cardinality(v_alle) <> (select count(distinct x) from unnest(v_alle) x) then
      raise exception 'Eine Person hat in einer Gruppe nur eine Aufgabe (Tänzer, Trainer oder Betreuer).' using errcode = 'P0001';
    end if;
    if exists (select 1 from unnest(v_alle) x where not exists (
        select 1 from vereins_mitglieder vm where vm.id = x and vm.verein_id = p_verein_id and coalesce(vm.aktiv, true))) then
      raise exception 'Es können nur aktive Mitglieder des eigenen Vereins zugeordnet werden.' using errcode = 'P0001';
    end if;
    if exists (select 1 from unnest(v_trainer) x join vereins_mitglieder vm on vm.id = x left join rollen r on r.id = vm.rolle_id
               where rolle_familie(r.name) not in ('admin', 'trainer')) then
      raise exception 'Als Trainer können nur Mitglieder mit der Rolle Trainer oder Vereinsadmin eingetragen werden.' using errcode = 'P0001';
    end if;
    if exists (select 1 from unnest(v_betreuer) x join vereins_mitglieder vm on vm.id = x left join rollen r on r.id = vm.rolle_id
               where rolle_familie(r.name) not in ('admin', 'trainer', 'betreuer')) then
      raise exception 'Als Betreuer können nur Mitglieder mit der Rolle Betreuer, Trainer oder Vereinsadmin eingetragen werden.' using errcode = 'P0001';
    end if;

    -- Geschlechterlogik je Disziplin
    select count(*) filter (where s.g = 'weiblich'), count(*) filter (where s.g = 'männlich'),
           count(*) filter (where s.g is null or s.g not in ('weiblich', 'männlich'))
      into n_w, n_m, n_andere
    from (select geschlecht_normal(p.geschlecht) g from unnest(v_taenzer) x
          join vereins_mitglieder vm on vm.id = x left join profiles p on p.id = vm.user_id) s;
    if v_besetzung = 'solo' then
      if cardinality(v_taenzer) > 1 then
        raise exception 'Bei „%“ tanzt genau eine Person.', v_diszi using errcode = 'P0001';
      end if;
      if cardinality(v_taenzer) = 1 and v_diszi ilike '%weiblich%' and n_w <> 1 then
        raise exception 'Für „Solist weiblich“ bitte eine weibliche Person auswählen.' using errcode = 'P0001';
      end if;
      if cardinality(v_taenzer) = 1 and v_diszi ilike '%männlich%' and n_m <> 1 then
        raise exception 'Für „Solist männlich“ bitte eine männliche Person auswählen.' using errcode = 'P0001';
      end if;
    elsif v_besetzung = 'paar' then
      if cardinality(v_taenzer) > 2 or n_w > 1 or n_m > 1 or n_andere > 0 then
        raise exception 'Ein Tanzpaar besteht aus einer weiblichen und einer männlichen Person.' using errcode = 'P0001';
      end if;
    end if;

    delete from gruppen_mitglieder gm where gm.gruppe_id = v_id and not (gm.vereins_mitglied_id = any (v_alle));
    insert into gruppen_mitglieder (gruppe_id, vereins_mitglied_id, funktion)
    select v_id, x, 'mitglied' from unnest(v_taenzer) x
    union all select v_id, x, 'trainer' from unnest(v_trainer) x
    union all select v_id, x, 'betreuer' from unnest(v_betreuer) x
    on conflict (gruppe_id, vereins_mitglied_id) do update set funktion = excluded.funktion;
  end if;
  return v_id;
end;
$$;
revoke all on function public.gruppe_speichern(uuid, uuid, text, uuid, text, uuid, uuid[], uuid[], uuid[], boolean) from public, anon;
grant execute on function public.gruppe_speichern(uuid, uuid, text, uuid, text, uuid, uuid[], uuid[], uuid[], boolean) to authenticated;

-- Vereinsuebersicht: Altersklasse (offiziell oder frei), Besetzung, Gruppenstaerke und Zahl der Trainer/Betreuer
do $$
declare
  v_def text := pg_get_functiondef('public.verein_uebersicht(uuid)'::regprocedure);
  v_alt text := $a$        'altersklasse', ak.name,$a$;
  v_neu text := $n$        'altersklasse', coalesce(ak.name, g.altersklasse_frei),
        'altersklasse_frei', g.altersklasse_frei,
        'besetzung', d.besetzung,
        'trainer_anzahl', (select count(*) from gruppen_mitglieder gm where gm.gruppe_id = g.id and gm.funktion = 'trainer'),
        'betreuer_anzahl', (select count(*) from gruppen_mitglieder gm where gm.gruppe_id = g.id and gm.funktion = 'betreuer'),$n$;
begin
  if position(v_alt in v_def) = 0 then raise exception 'verein_uebersicht: Stelle nicht gefunden'; end if;
  execute replace(v_def, v_alt, v_neu);
end $$;
