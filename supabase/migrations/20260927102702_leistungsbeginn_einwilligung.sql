-- Vorzeitiger Leistungsbeginn beim Kauf (Widerrufsrecht/Wertersatz) als Einwilligungsnachweis.
-- Die Edge Function zahlung-starten verlangt die Bestaetigung und speichert Wortlaut, Version und Abo.
alter table public.einwilligungen drop constraint einwilligungen_art_check;
alter table public.einwilligungen add constraint einwilligungen_art_check
  check (art = any (array['nutzungsbedingungen', 'datenschutz_kenntnis', 'eltern_zustimmung', 'push', 'map', 'vorzeitiger_leistungsbeginn']));
alter table public.einwilligungen drop constraint einwilligungen_quelle_check;
alter table public.einwilligungen add constraint einwilligungen_quelle_check
  check (quelle = any (array['registrierung', 'einstellungen', 'geraet', 'eltern_link', 'eltern_einstellung', 'kauf']));
