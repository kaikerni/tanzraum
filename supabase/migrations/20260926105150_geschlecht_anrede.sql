-- Geschlecht als Pflichtangabe und persoenliche Bezeichnung (Taenzerin / Taenzer / Taenzer/in)
--
-- * geschlecht_normal(): liest alte Kurzwerte (w/m) und neue Werte (weiblich/maennlich/divers) einheitlich;
--   die gespeicherten Daten werden dabei nicht veraendert.
-- * mein_geschlecht() / geschlecht_setzen(): eigene Angabe lesen bzw. setzen (nur die drei erlaubten Werte).
-- * mitglieder_liste(): zusaetzliche Spalte geschlecht (Rueckgabetyp aendert sich -> drop + create, Rechte wie bisher).
-- * netzwerk_person(): zusaetzlicher Schluessel geschlecht, nur wenn das Profil fuer die ansehende Person sichtbar ist.

create or replace function public.geschlecht_normal(p_wert text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case lower(trim(coalesce(p_wert, '')))
    when 'w' then 'weiblich'
    when 'weiblich' then 'weiblich'
    when 'm' then 'männlich'
    when 'männlich' then 'männlich'
    when 'maennlich' then 'männlich'
    when 'd' then 'divers'
    when 'divers' then 'divers'
  end;
$function$;

create or replace function public.mein_geschlecht()
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$ select geschlecht_normal(p.geschlecht) from profiles p where p.id = auth.uid(); $function$;

create or replace function public.geschlecht_setzen(p_geschlecht text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if p_geschlecht is null or p_geschlecht not in ('weiblich', 'männlich', 'divers') then
    raise exception 'Bitte wähle ein Geschlecht aus.' using errcode = 'P0001';
  end if;
  update profiles set geschlecht = p_geschlecht where id = auth.uid();
end;
$function$;

drop function public.mitglieder_liste(uuid);

CREATE OR REPLACE FUNCTION public.mitglieder_liste(p_verein_id uuid)
 RETURNS TABLE(vm_id uuid, user_id uuid, name text, handle text, email text, rolle_id uuid, rolle text, aktiv boolean, altersklasse text, seit timestamp with time zone, bereiche text[], gruppen jsonb, eltern jsonb, kinder jsonb, ist_ich boolean, geschlecht text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_admin boolean := is_verein_admin(p_verein_id) or ist_plattform_admin_aktuell();
begin
  if not v_admin and not exists (select 1 from meine_bereiche() mb where mb.verein_id = p_verein_id and mb.bereich = 'mitglieder') then
    raise exception 'Keine Berechtigung fuer die Mitgliederliste' using errcode = '42501';
  end if;

  return query
  select vm.id, vm.user_id, a.anzeige, a.handle,
    case when v_admin then (select u.email::text from auth.users u where u.id = vm.user_id) end,
    vm.rolle_id, r.name, coalesce(vm.aktiv, true), vm.altersklasse, vm.created_at,
    case when v_admin then coalesce(vm.bereiche, '{}') end,
    coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'funktion', gm.funktion) order by g.name)
              from gruppen_mitglieder gm join gruppen g on g.id = gm.gruppe_id where gm.vereins_mitglied_id = vm.id), '[]'),
    coalesce((select jsonb_agg(jsonb_build_object('vm_id', e.id, 'name', ea.anzeige))
              from eltern_kind_zuordnung ekz join vereins_mitglieder e on e.id = ekz.eltern_vm_id
              cross join lateral anzeige_namen(array[e.user_id]) ea where ekz.kind_vm_id = vm.id), '[]'),
    coalesce((select jsonb_agg(jsonb_build_object('vm_id', k.id, 'name', ka.anzeige))
              from eltern_kind_zuordnung ekz join vereins_mitglieder k on k.id = ekz.kind_vm_id
              cross join lateral anzeige_namen(array[k.user_id]) ka where ekz.eltern_vm_id = vm.id), '[]'),
    vm.user_id = auth.uid(),
    (select geschlecht_normal(pg.geschlecht) from profiles pg where pg.id = vm.user_id)
  from vereins_mitglieder vm
  left join rollen r on r.id = vm.rolle_id
  cross join lateral anzeige_namen(array[vm.user_id]) a
  where vm.verein_id = p_verein_id
    and (v_admin or ist_relevantes_mitglied(vm.id))
  order by coalesce(vm.aktiv, true) desc, a.anzeige;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.netzwerk_person(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  p profiles%rowtype;
  v_eigener_kontext boolean;
  v_privat_sichtbar boolean;
begin
  select * into p from profiles x where x.id = p_user_id;
  if p.id is null or auth.uid() is null or coalesce(p.gesperrt, false)
     or (p.id <> auth.uid() and ist_blockiert(auth.uid(), p.id))
     or not konto_aktiv() then
    return null;
  end if;
  v_eigener_kontext := p.id = auth.uid() or hat_vereinsbeziehung(auth.uid(), p.id) or ist_elternteil_von(auth.uid(), p.id)
                       or ist_elternteil_von(p.id, auth.uid());
  v_privat_sichtbar := v_eigener_kontext or not coalesce(p.konto_privat, false) or kann_privates_profil_sehen(p.id)
                       or kontakt_angenommen(auth.uid(), p.id);
  return jsonb_build_object(
    'id', p.id,
    'name', (select a.anzeige from anzeige_namen(array[p.id]) a),
    'handle', p.handle,
    'avatar_url', case when v_privat_sichtbar then p.avatar_url end,
    'privat', not v_privat_sichtbar,
    'geschlecht', case when v_privat_sichtbar then geschlecht_normal(p.geschlecht) end,
    'ich', p.id = auth.uid(),
    'ort', case when v_privat_sichtbar and (v_eigener_kontext or not ist_unter_15(p.id)) then p.ort end,
    'vereine', case when v_privat_sichtbar then coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'ort', v.ort, 'rolle', coalesce(r.name, 'Mitglied')) order by v.name)
      from vereins_mitglieder vm join vereine v on v.id = vm.verein_id left join rollen r on r.id = vm.rolle_id
      where vm.user_id = p.id and coalesce(vm.aktiv, true) and not coalesce(v.gesperrt, false)), '[]'::jsonb) else '[]'::jsonb end,
    'gruppen', case when v_privat_sichtbar then coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'verein', v.name, 'funktion', gm.funktion,
                                          'disziplin', d.name, 'altersklasse', ak.name) order by g.name)
      from gruppen_mitglieder gm join vereins_mitglieder vm on vm.id = gm.vereins_mitglied_id and coalesce(vm.aktiv, true)
      join gruppen g on g.id = gm.gruppe_id join vereine v on v.id = g.verein_id
      left join disziplinen d on d.id = g.disziplin_id left join altersklassen ak on ak.id = g.altersklasse_id
      where vm.user_id = p.id), '[]'::jsonb) else '[]'::jsonb end,
    'status', verbindungs_status(p.id),
    'darf_schreiben', p.id <> auth.uid() and darf_direkt_schreiben(p.id),
    'sperrgrund', case when p.id <> auth.uid() then schreib_sperrgrund(p.id) end,
    'kann_vernetzen', p.id <> auth.uid() and not ist_unter_15(auth.uid()) and not ist_unter_15(p.id)
                      and not ist_blockiert(auth.uid(), p.id),
    'blockiert_von_mir', exists (select 1 from blockierungen b where b.blocker_id = auth.uid() and b.blockiert_id = p.id)
  );
end;
$function$
;

revoke all on function public.geschlecht_normal(text) from public, anon, authenticated, service_role;
grant execute on function public.geschlecht_normal(text) to service_role;
revoke all on function public.mein_geschlecht() from public, anon, authenticated, service_role;
grant execute on function public.mein_geschlecht() to authenticated, service_role;
revoke all on function public.geschlecht_setzen(text) from public, anon, authenticated, service_role;
grant execute on function public.geschlecht_setzen(text) to authenticated, service_role;
revoke all on function public.mitglieder_liste(uuid) from public, anon, authenticated, service_role;
grant execute on function public.mitglieder_liste(uuid) to authenticated, service_role;
