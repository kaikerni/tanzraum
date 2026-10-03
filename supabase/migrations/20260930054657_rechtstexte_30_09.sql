-- Neue Fassungen: Nutzungsbedingungen (7a Börse, 7b Vereinsbereiche) und Datenschutzerklärung (7d Börse, 7e Musik/Kostüme/
-- Finanzen/Fahrgemeinschaften, Speicherdauer). Bestehende Nutzer bestätigen die neuen Nutzungsbedingungen beim nächsten Login.

insert into public.rechtstext_versionen (art, version, gueltig_ab, aenderungshinweis) values
  ('nutzungsbedingungen', '30.09.2026', '2026-09-30', 'Ergänzt: TanzRaum Börse (7a) und Vereinsbereiche Musik, Kostüme, Finanzen, Fahrgemeinschaften (7b)'),
  ('datenschutz', '30.09.2026', '2026-09-30', 'Ergänzt: TanzRaum Börse (7d), Musik, Kostüme & Requisiten, Finanzen, Fahrgemeinschaften (7e), Speicherdauer')
on conflict do nothing;

-- Uebergang zwischen App-Staenden: bis 14 Tage nach Inkrafttreten wird auch die vorherige Fassung noch angenommen
-- (Registrierung auf einem noch nicht aktualisierten Server). Wer so zustimmt, wird beim naechsten Login erneut gefragt,
-- weil rechtstexte_offen() weiterhin die aktuelle Fassung verlangt.
create or replace function public.nutzungsbedingungen_zulaessig(p_version text)
returns boolean language sql stable security definer set search_path = public as $$
  with v as (
    select version, gueltig_ab, row_number() over (order by gueltig_ab desc, erfasst_am desc) as n
    from rechtstext_versionen where art = 'nutzungsbedingungen' and gueltig_ab <= now()
  )
  select exists (select 1 from v where n = 1 and version = p_version)
      or exists (select 1 from v where n = 2 and version = p_version and (select gueltig_ab from v where n = 1) > now() - interval '14 days');
$$;
revoke all on function public.nutzungsbedingungen_zulaessig(text) from public, anon;
grant execute on function public.nutzungsbedingungen_zulaessig(text) to authenticated, service_role;

do $$
declare
  d text;
  f text;
begin
  foreach f in array array['public.einwilligungen_bei_registrierung', 'public.rechtstexte_bestaetigen'] loop
    d := pg_get_functiondef(f::regproc);
    if position('is distinct from rechtstext_aktuell(''nutzungsbedingungen'')' in d) = 0 then
      raise exception '%: Stelle nicht gefunden', f;
    end if;
    d := replace(d, 'v_nb is distinct from rechtstext_aktuell(''nutzungsbedingungen'')', 'not nutzungsbedingungen_zulaessig(v_nb)');
    d := replace(d, 'p_nutzungsbedingungen is distinct from rechtstext_aktuell(''nutzungsbedingungen'')', 'not nutzungsbedingungen_zulaessig(p_nutzungsbedingungen)');
    if position('rechtstext_aktuell(''nutzungsbedingungen'')' in d) > 0 then
      raise exception '%: Ersetzung unvollständig', f;
    end if;
    execute d;
  end loop;
end $$;
