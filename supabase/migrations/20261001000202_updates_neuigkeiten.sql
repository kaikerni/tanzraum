-- Updates & Neuigkeiten: Release-Informationen als Erweiterung der bestehenden TanzRaum-Ankuendigungen (Art "neuheit").
-- Zentrale Quelle fuer Landingpage („✨ Neu bei TanzRaum“), eingeloggten Bereich („Was ist neu?“) und Kai.
alter table public.plattform_ankuendigungen
  add column if not exists version text,
  add column if not exists kategorie text,
  add column if not exists kurztext text,
  add column if not exists auf_landingpage boolean not null default false,
  add column if not exists im_benutzerbereich boolean not null default true,
  add column if not exists kai_hinweis boolean not null default false;

alter table public.plattform_ankuendigungen drop constraint if exists plattform_ankuendigungen_version_check;
alter table public.plattform_ankuendigungen add constraint plattform_ankuendigungen_version_check
  check (version is null or version ~ '^[0-9]+\.[0-9]+\.[0-9]+$');
alter table public.plattform_ankuendigungen drop constraint if exists plattform_ankuendigungen_kategorie_check;
alter table public.plattform_ankuendigungen add constraint plattform_ankuendigungen_kategorie_check
  check (kategorie is null or kategorie in ('neue_funktion', 'verbesserung', 'fehlerbehebung', 'hinweis'));
alter table public.plattform_ankuendigungen drop constraint if exists plattform_ankuendigungen_kurztext_check;
alter table public.plattform_ankuendigungen add constraint plattform_ankuendigungen_kurztext_check
  check (kurztext is null or char_length(kurztext) <= 300);

-- Eingeloggter Bereich: nur Eintraege, die dort erscheinen sollen (bestehende Ankuendigungen: Standard true)
create or replace function public.ankuendigung_fuer_mich(a plattform_ankuendigungen)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select auth.uid() is not null and a.im_benutzerbereich and a.sichtbar_ab <= now() and (a.sichtbar_bis is null or a.sichtbar_bis > now())
    and case a.zielgruppe
      when 'alle' then true
      when 'ab16' then not coalesce(ist_unter_16(auth.uid()), true)
      when 'verantwortliche' then exists (
        select 1 from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
        where vm.user_id = auth.uid() and rolle_familie(r.name) in ('admin', 'trainer', 'betreuer'))
      else false end;
$$;

drop function if exists public.meine_ankuendigungen();
create function public.meine_ankuendigungen()
returns table(id uuid, titel text, text text, art text, wichtig boolean, sichtbar_ab timestamptz, sichtbar_bis timestamptz,
              gelesen_am timestamptz, bild_pfad text, link_url text, link_text text,
              version text, kategorie text, kurztext text, kai_hinweis boolean)
language sql stable security definer set search_path to 'public' as $$
  select a.id, a.titel, a.text, a.art, a.wichtig, a.sichtbar_ab, a.sichtbar_bis, g.gelesen_am, a.bild_pfad, a.link_url, a.link_text,
         a.version, a.kategorie, a.kurztext, a.kai_hinweis
  from plattform_ankuendigungen a
  left join plattform_ankuendigung_gelesen g on g.ankuendigung_id = a.id and g.user_id = auth.uid()
  where ankuendigung_fuer_mich(a)
  order by a.wichtig desc, a.sichtbar_ab desc
  limit 30;
$$;
revoke all on function public.meine_ankuendigungen() from public, anon;
grant execute on function public.meine_ankuendigungen() to authenticated;

drop function if exists public.ankuendigungen_admin();
create function public.ankuendigungen_admin()
returns table(id uuid, titel text, text text, art text, wichtig boolean, push boolean, zielgruppe text, sichtbar_ab timestamptz,
              sichtbar_bis timestamptz, erstellt_am timestamptz, gelesen integer, bild_pfad text, link_url text, link_text text,
              version text, kategorie text, kurztext text, auf_landingpage boolean, im_benutzerbereich boolean, kai_hinweis boolean)
language sql stable security definer set search_path to 'public' as $$
  select a.id, a.titel, a.text, a.art, a.wichtig, a.push, a.zielgruppe, a.sichtbar_ab, a.sichtbar_bis, a.erstellt_am,
         (select count(*)::int from plattform_ankuendigung_gelesen g where g.ankuendigung_id = a.id),
         a.bild_pfad, a.link_url, a.link_text, a.version, a.kategorie, a.kurztext, a.auf_landingpage, a.im_benutzerbereich, a.kai_hinweis
  from plattform_ankuendigungen a where ist_plattform_admin_aktuell()
  order by a.erstellt_am desc limit 100;
$$;
revoke all on function public.ankuendigungen_admin() from public, anon;
grant execute on function public.ankuendigungen_admin() to authenticated;

-- Oeffentliche Landingpage: nur freigegebene Neuheiten, nur oeffentliche Felder (auch ohne Anmeldung)
create or replace function public.tanzraum_neuigkeiten_oeffentlich(p_limit integer default 3)
returns table(id uuid, version text, titel text, kurztext text, text text, kategorie text, datum timestamptz,
              bild_pfad text, link_url text, link_text text)
language sql stable security definer set search_path to 'public' as $$
  select a.id, a.version, a.titel, a.kurztext, a.text, a.kategorie, a.sichtbar_ab, a.bild_pfad, a.link_url, a.link_text
  from plattform_ankuendigungen a
  where a.art = 'neuheit' and a.auf_landingpage and a.zielgruppe = 'alle'
    and a.sichtbar_ab <= now() and (a.sichtbar_bis is null or a.sichtbar_bis > now())
  order by a.sichtbar_ab desc
  limit least(greatest(coalesce(p_limit, 3), 1), 50);
$$;
revoke all on function public.tanzraum_neuigkeiten_oeffentlich(integer) from public;
grant execute on function public.tanzraum_neuigkeiten_oeffentlich(integer) to anon, authenticated;
