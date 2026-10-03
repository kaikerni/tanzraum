-- Datenschutzerklaerung Fassung 01.10.2026 registrieren (nur neuer Eintrag; aeltere Fassungen bleiben gueltig fuer die Kenntnisnahme)
insert into public.rechtstext_versionen (art, version, gueltig_ab, aenderungshinweis)
select 'datenschutz', '01.10.2026', timestamptz '2026-10-01 00:00:00+00',
       'Ergänzt: Spotlight (Stories) mit Standort, Erwähnungen, Musik (7f), Meine Navigation (4), Speicherdauer Spotlights (13)'
where not exists (select 1 from public.rechtstext_versionen where art = 'datenschutz' and version = '01.10.2026');
