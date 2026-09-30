-- Musik plattformweit ein-/ausschaltbar (TanzRaum-Administration), Standard: aus.
-- Aus = kein Menüpunkt, keine Uploads, keine Wiedergabe. Vorhandene Titel/Dateien bleiben unverändert gespeichert.

alter table public.plattform_einstellungen add column if not exists musik_aktiv boolean not null default false;

create or replace function public.musik_freigegeben()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select e.musik_aktiv from plattform_einstellungen e where e.id), false);
$$;
revoke all on function public.musik_freigegeben() from public, anon;
grant execute on function public.musik_freigegeben() to authenticated;

create or replace function public.admin_musik_setzen(p_aktiv boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not ist_plattform_admin_aktuell() then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  if p_aktiv is null then
    raise exception 'Ungültige Einstellung.' using errcode = 'P0001';
  end if;
  update plattform_einstellungen set musik_aktiv = p_aktiv, geaendert_am = now(), geaendert_von = auth.uid() where id;
end;
$$;
revoke all on function public.admin_musik_setzen(boolean) from public, anon;
grant execute on function public.admin_musik_setzen(boolean) to authenticated;

-- Hochladen, Hoeren und Dateizugriff nur bei eingeschalteter Musik
do $$
declare
  d text;
begin
  d := pg_get_functiondef('public.musik_upload_vorbereiten'::regproc);
  if position('  if auth.uid() is null then' in d) = 0 then raise exception 'musik_upload_vorbereiten: Stelle nicht gefunden'; end if;
  d := replace(d, '  if auth.uid() is null then', E'  if not musik_freigegeben() then\n    raise exception ''Der Musikbereich ist derzeit ausgeschaltet.'' using errcode = ''P0001'';\n  end if;\n  if auth.uid() is null then');
  execute d;
end $$;

drop policy if exists "Musik: hoeren bzw. eigene" on public.musik_titel;
create policy "Musik: hoeren bzw. eigene" on public.musik_titel for select to authenticated
  using (hochgeladen and musik_freigegeben()
         and ((verein_id is not null and musik_hoerbar(verein_id, gruppen)) or (user_id is not null and user_id = auth.uid())));

create or replace function public.musik_datei_sichtbar(p_pfad text)
returns boolean language sql stable security definer set search_path = public as $$
  select musik_freigegeben() and exists (select 1 from musik_titel m where m.datei_pfad = p_pfad and m.hochgeladen
    and ((m.verein_id is not null and musik_hoerbar(m.verein_id, m.gruppen)) or (m.user_id is not null and m.user_id = auth.uid())));
$$;
