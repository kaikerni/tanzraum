-- Trainer-Netzwerk ausschließlich für die Vereinsrolle Trainer/in (Entscheidung 30.09.2026):
-- Vereins-Admins ohne Trainerrolle werden weder gefunden noch im Netzwerkprofil als Admin-Verein gezeigt.

-- Netzwerkprofil: nur Vereine, in denen die Person Trainer/in ist
do $$
declare
  d text := pg_get_functiondef('public.netzwerk_profil(uuid)'::regprocedure);
  alt text := $a$rollen_typ(r.name) in ('trainer', 'admin')$a$;
begin
  if position(alt in d) = 0 then raise exception 'netzwerk_profil: Stelle nicht gefunden'; end if;
  execute replace(d, alt, $n$rollen_typ(r.name) = 'trainer'$n$);
end $$;

-- Ältere Suchfunktionen (von der App nicht mehr genutzt): nur für Netzwerk-Berechtigte, nur Trainer/innen mit Vereinslizenz
create or replace function public.suche_netzwerk_trainer(suchbegriff text, anfragender_id uuid)
returns table(id uuid, anzeigename text, handle text, verein_name text, verein_id uuid)
language sql stable security definer set search_path = public as $$
  select distinct on (p.id) p.id,
    coalesce(nullif(trim(coalesce(p.vorname,'') || ' ' || coalesce(p.nachname,'')), ''), '@' || p.handle) as anzeigename,
    p.handle, v.name, v.id
  from profiles p
  join vereins_mitglieder vm on vm.user_id = p.id and coalesce(vm.aktiv, true)
  join rollen r on r.id = vm.rolle_id
  join vereine v on v.id = vm.verein_id
  where auth.uid() is not null
    and netzwerk_modus() = 'trainer'
    and length(btrim(coalesce(suchbegriff, ''))) >= 2
    and rollen_typ(r.name) = 'trainer' and verein_hat_lizenz(v.id)
    and netzwerk_sichtbar(p.id)
    and (p.handle ilike '%'||suchbegriff||'%' or p.vorname ilike '%'||suchbegriff||'%' or p.nachname ilike '%'||suchbegriff||'%')
  order by p.id limit 10;
$$;

create or replace function public.trainer_profil_info(p_user_id uuid)
returns table(verein_name text, verein_id uuid, mitglieder_anzahl integer, gruppen jsonb)
language sql stable security definer set search_path = public as $$
  select v.name, v.id,
    case when v.mitgliederzahl_oeffentlich then (select count(*)::int from vereins_mitglieder vm2 where vm2.verein_id = v.id) else null end,
    coalesce((select jsonb_agg(distinct jsonb_build_object('name', g.name, 'altersklasse', ak.name, 'disziplin', d.name))
              from gruppen_mitglieder gm join gruppen g on g.id = gm.gruppe_id
              left join disziplinen d on d.id = g.disziplin_id left join altersklassen ak on ak.id = g.altersklasse_id
              where gm.vereins_mitglied_id = vm.id and gm.funktion in ('trainer','betreuer')), '[]'::jsonb)
  from vereins_mitglieder vm join vereine v on v.id = vm.verein_id join rollen r on r.id = vm.rolle_id
  where auth.uid() is not null
    and netzwerk_modus() = 'trainer'
    and vm.user_id = p_user_id and coalesce(vm.aktiv, true)
    and rollen_typ(r.name) = 'trainer' and verein_hat_lizenz(v.id)
    and (netzwerk_sichtbar(p_user_id) or p_user_id = auth.uid())
  limit 1;
$$;
