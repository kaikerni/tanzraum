-- Persoenliche Einladung ohne bekanntes Geschlecht: Rolle (Tänzerin/Tänzer) erst beim Einloesen aus dem Profil bestimmen
do $$
declare d text;
begin
  d := pg_get_functiondef('public.mitglied_einladungen_erstellen(uuid, uuid[])'::regprocedure);
  if position($a$case when m.geschlecht = 'weiblich' then 'Tänzerin' else 'Tänzer' end$a$ in d) = 0 then
    raise exception 'Muster in mitglied_einladungen_erstellen nicht gefunden';
  end if;
  d := replace(d, $a$case when m.geschlecht = 'weiblich' then 'Tänzerin' else 'Tänzer' end$a$,
                  $a$case m.geschlecht when 'weiblich' then 'Tänzerin' when 'männlich' then 'Tänzer' end$a$);
  execute d;

  d := pg_get_functiondef('public.invite_einloesen(uuid)'::regprocedure);
  if position('    insert into vereins_mitglieder (user_id, verein_id, rolle_id, hinzugefuegt_von)
    values (auth.uid(), v_row.verein_id, v_row.rolle_id, v_row.created_by)' in d) = 0 then
    raise exception 'Muster in invite_einloesen nicht gefunden';
  end if;
  d := replace(d, '    insert into vereins_mitglieder (user_id, verein_id, rolle_id, hinzugefuegt_von)
    values (auth.uid(), v_row.verein_id, v_row.rolle_id, v_row.created_by)',
  $b$    if v_row.mitglied_id is not null and v_row.rolle_id is null then
      select r.id into v_row.rolle_id from rollen r
      where r.name = case when (select geschlecht_normal(p.geschlecht) from profiles p where p.id = auth.uid()) = 'weiblich' then 'Tänzerin' else 'Tänzer' end;
    end if;
    insert into vereins_mitglieder (user_id, verein_id, rolle_id, hinzugefuegt_von)
    values (auth.uid(), v_row.verein_id, v_row.rolle_id, v_row.created_by)$b$);
  execute d;
end $$;
