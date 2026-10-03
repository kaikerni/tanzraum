-- Erster Vereinsadmin eines von der TanzRaum-Administration angelegten Vereins: Einladung der Administration mit
-- Admin-Rolle -> sofort aktiver Vereinsadmin (kein Mitgliedsantrag; sonst waere der Verein ohne aktiven Admin).
do $$
declare
  v_def text := pg_get_functiondef('public.invite_einloesen(uuid)'::regprocedure);
  v_alt text := $a$    v_antrag := vereinsbeitritt_vorbereiten(v_vm_id, v_row.created_by);$a$;
  v_neu text := $n$    if not (exists (select 1 from rollen r where r.id = v_row.rolle_id and rollen_typ(r.name) = 'admin')
            and exists (select 1 from profiles p where p.id = v_row.created_by and p.ist_plattform_admin)) then
      v_antrag := vereinsbeitritt_vorbereiten(v_vm_id, v_row.created_by);
    end if;$n$;
begin
  if position(v_alt in v_def) = 0 then raise exception 'invite_einloesen: Stelle nicht gefunden'; end if;
  execute replace(v_def, v_alt, v_neu);
end $$;
