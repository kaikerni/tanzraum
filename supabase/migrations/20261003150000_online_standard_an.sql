-- Online-Status: standardmaessig AN fuer alle Konten
--
-- Bisher war "Online-Status zeigen" (profiles.online_sichtbar) ein Opt-in (Standard aus). Jetzt ist er fuer neue UND
-- bestehende Konten eingeschaltet; jede Person kann ihn unter Einstellungen → Online-Status jederzeit ausschalten.
-- Unveraendert: Konten unter 16 Jahren werden nie mit Namen gezeigt, gesperrte und blockierte Personen nie;
-- Namen sehen nur Kontakte/Vereinsmitglieder. Die Gesamtzahl ("x gerade online") war nie vom Schalter abhaengig.
-- Keine Funktionen oder Regeln (RLS) werden geaendert; zusaetzlich wird die neue Fassung der Datenschutzerklaerung registriert.

alter table public.profiles alter column online_sichtbar set default true;

update public.profiles set online_sichtbar = true where online_sichtbar is distinct from true;

comment on column public.profiles.online_sichtbar is 'Online-Status fuer Kontakte/Vereinsmitglieder mit Namen zeigen (Standard: an, abschaltbar)';

-- Datenschutzerklaerung Fassung 03.10.2026 (Online-Status voreingestellt, abschaltbar)
insert into public.rechtstext_versionen (art, version, gueltig_ab, aenderungshinweis)
select 'datenschutz', '03.10.2026', timestamptz '2026-10-03 00:00:00+00',
       'Geändert: Online-Status mit Namen für Kontakte/Vereinsmitglieder ist voreingestellt und in den Einstellungen abschaltbar'
where not exists (select 1 from public.rechtstext_versionen where art = 'datenschutz' and version = '03.10.2026');
