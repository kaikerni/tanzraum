-- Ehrungen & Orden – Katalog nach dem korrigierten Kompendium
-- („Deutsches Karnevalsorden-Kompendium – geprüfte und korrigierte Ausgabe, bereinigt um fiktive Einträge“)
--
-- * Entfernt die im korrigierten Kompendium nicht mehr enthaltenen Organisationen/Auszeichnungen der Erstbefuellung.
--   Nur Eintraege aus der Erstbefuellung (Quelle = erstes Kompendium); bereits verwendete Eintraege werden nicht
--   geloescht, sondern deaktiviert.
-- * BDK-Verdienstorden: Kriterien laut korrigiertem Kompendium („aktive ehrenamtliche Arbeit“), Gold mit Brillanten
--   mit Antrag und Einzelfallpruefung.
-- * Vereinigung Badisch-Pfaelzischer Karnevalvereine: Stufensystem mit Punkten (Verdienstorden am Band 4, Grosser
--   Verdienstorden 8, Goldener Loewe 11, Goldener Loewe mit Brillanten nach weiteren 22 aktiven Jahren).
-- * Alles bleibt Pruefstatus „nicht_geprueft“ – die Freigabe erfolgt durch den TanzRaum-Admin.

-- ---------------------------------------------------------------------------------------------
-- 1) Nicht mehr enthaltene Eintraege der Erstbefuellung entfernen bzw. deaktivieren
-- ---------------------------------------------------------------------------------------------
create temporary table _behalten (name text primary key) on commit drop;
insert into _behalten values ('Bund Deutscher Karneval e.V.'), ('Vereinigung Badisch-Pfälzischer Karnevalvereine'),
  ('Vereinigung Schwäbisch-Alemannischer Narrenzünfte e.V.'), ('Kölner Festkomitee von 1823 e.V.');

create temporary table _alt_orgs on commit drop as
  select o.id from public.ehrungs_organisationen o
  where o.quelle like 'Ehrungs-Kompendium „Gesamtkompendium%' and o.name not in (select name from _behalten);

update public.ehrungsarten a set aktiv = false,
       pruef_bemerkung = 'Im korrigierten Kompendium nicht mehr enthalten – deaktiviert (wird bereits verwendet).'
where a.organisation_id in (select id from _alt_orgs)
  and exists (select 1 from public.mitglied_ehrungen me where me.ehrungsart_id = a.id or me.auto_ehrungsart_id = a.id);
delete from public.ehrungsarten a
where a.organisation_id in (select id from _alt_orgs)
  and not exists (select 1 from public.mitglied_ehrungen me where me.ehrungsart_id = a.id or me.auto_ehrungsart_id = a.id);

update public.ehrungs_organisationen o set aktiv = false,
       pruef_bemerkung = 'Im korrigierten Kompendium nicht mehr enthalten – deaktiviert (wird bereits verwendet).'
where o.id in (select id from _alt_orgs)
  and (exists (select 1 from public.ehrungsarten a where a.organisation_id = o.id)
       or exists (select 1 from public.verein_ehrungs_organisationen vo where vo.organisation_id = o.id));
delete from public.ehrungs_organisationen o
where o.id in (select id from _alt_orgs)
  and not exists (select 1 from public.ehrungsarten a where a.organisation_id = o.id)
  and not exists (select 1 from public.verein_ehrungs_organisationen vo where vo.organisation_id = o.id);

-- ---------------------------------------------------------------------------------------------
-- 2) Verbleibende Organisationen aktualisieren
-- ---------------------------------------------------------------------------------------------
update public.ehrungs_organisationen set
  quelle = 'Deutsches Karnevalsorden-Kompendium – geprüfte und korrigierte Ausgabe (übernommen am 26.09.2026)',
  pruefstatus = 'nicht_geprueft', aktiv = true
where name in (select name from _behalten);

update public.ehrungs_organisationen set
  beschreibung = 'Dachverband für rund 5.300 Karnevals- und Fastnachtsvereine in Deutschland (laut Kompendium). Die bundesweiten Verdienstorden bilden die übergeordnete Klammer und werden nach zeitlichen Mindestvorgaben verliehen.',
  pruef_bemerkung = null
where name = 'Bund Deutscher Karneval e.V.';

update public.ehrungs_organisationen set
  beschreibung = 'Punktesystem laut Kompendium: aktive Tätigkeit 0,5 Punkte je Jahr; bestimmte Ämter (z. B. 1. Vorsitzende, Sitzungspräsidenten) 1 Punkt je Jahr; bestimmte Sonderleistungen (z. B. Deutsche Meistertitel im Tanzsport, langjährige Jugendarbeit) fließen ebenfalls ein. Stufen: Verdienstorden am Band (4 Punkte), Großer Verdienstorden (8 Punkte), Goldener Löwe (11 Punkte), Goldener Löwe mit Brillanten (nach weiteren 22 aktiven Jahren).',
  pruef_bemerkung = 'Welche Ämter genau 1 Punkt je Jahr bringen und wie Sonderleistungen bewertet werden, ist im Kompendium nur beispielhaft genannt. In TanzRaum sind die Funktionen „Vorstand“ und „Sitzungspräsident“ mit 1 Punkt je Jahr hinterlegt; Sonderleistungen bitte über eine Korrektur oder manuell berücksichtigen. Ob Punkte aus gleichzeitiger aktiver Tätigkeit und Amt addiert werden, ist nicht angegeben (TanzRaum addiert).'
where name = 'Vereinigung Badisch-Pfälzischer Karnevalvereine';

update public.ehrungs_organisationen set
  beschreibung = 'Laut Kompendium: Verwendet konsequent keine mathematischen Kampagnenpunkte. Ehrungen basieren ausschließlich auf jahrzehntelanger Vereinstreue, der Weitergabe alten Handwerks (Holzmasken-Schnitzen) oder dem traditionsgebundenen Tragen des Häses.',
  pruef_bemerkung = null
where name = 'Vereinigung Schwäbisch-Alemannischer Narrenzünfte e.V.';

update public.ehrungs_organisationen set
  beschreibung = 'Laut Kompendium: Autonomes, historisch verankertes Vergabesystem für den Verdienstorden des Kölner Karnevals, bei dem insbesondere der Beitrag zum Erhalt des Ur-Kölner Brauchtums und die langjährige Arbeit in den Traditionskorps im Vordergrund stehen.',
  pruef_bemerkung = null
where name = 'Kölner Festkomitee von 1823 e.V.';

-- ---------------------------------------------------------------------------------------------
-- 3) Auszeichnungen: vorhandene aktualisieren, fehlende anlegen
-- ---------------------------------------------------------------------------------------------
update public.ehrungsarten a set name = 'Goldener Löwe mit Brillanten'
from public.ehrungs_organisationen o
where o.id = a.organisation_id and o.name = 'Vereinigung Badisch-Pfälzischer Karnevalvereine' and a.name = 'Goldener Löwe mit Brillant'
  and not exists (select 1 from public.ehrungsarten x where x.organisation_id = o.id and x.name = 'Goldener Löwe mit Brillanten');

create temporary table _arten (organisation text, serie text, name text, stufe text, stufe_nr int, kategorie text,
  voraussetzungen text, antrag boolean, bemerkung text) on commit drop;
insert into _arten values
  ('Bund Deutscher Karneval e.V.', 'BDK-Verdienstorden', 'Verdienstorden in Silber', 'Silber', 1, 'Dienstauszeichnung',
   '15 Jahre aktive ehrenamtliche Arbeit. Besonderheit: Ununterbrochene Treue zum karnevalistischen Brauchtum.', null,
   'Kriterium „aktive ehrenamtliche Arbeit“ ist als ehrenamtliche Tätigkeit hinterlegt. Ob die 15 Jahre ununterbrochen sein müssen, geht aus dem Kompendium nicht eindeutig hervor.'),
  ('Bund Deutscher Karneval e.V.', 'BDK-Verdienstorden', 'Verdienstorden in Gold', 'Gold', 2, 'Dienstauszeichnung',
   '25 Jahre aktive ehrenamtliche Arbeit. Besonderheit: Höchste reguläre Dienstauszeichnung des BDK-Dachverbands.', null,
   'Kriterium „aktive ehrenamtliche Arbeit“ ist als ehrenamtliche Tätigkeit hinterlegt.'),
  ('Bund Deutscher Karneval e.V.', 'BDK-Verdienstorden', 'Verdienstorden in Gold mit Brillanten', 'Gold mit Brillanten', 3, 'Dienstauszeichnung',
   '40 Jahre ununterbrochene Aktivität. Besonderheit: Sehr seltene Verleihung, erfordert einen formellen Antrag mit Einzelfallprüfung durch den BDK.', true,
   'Automatischer Vorschlag nur als Hinweis – Verleihung ausschließlich nach Antrag und Einzelfallprüfung durch den BDK.'),
  ('Vereinigung Badisch-Pfälzischer Karnevalvereine', 'VBPK-Verdienstorden', 'Verdienstorden am Band', 'am Band', 1, 'Verdienstorden',
   '4 Punkte nach dem Punktesystem der Vereinigung.', null, null),
  ('Vereinigung Badisch-Pfälzischer Karnevalvereine', 'VBPK-Verdienstorden', 'Großer Verdienstorden', 'Großer Verdienstorden', 2, 'Verdienstorden',
   '8 Punkte nach dem Punktesystem der Vereinigung.', null, null),
  ('Vereinigung Badisch-Pfälzischer Karnevalvereine', 'VBPK-Verdienstorden', 'Goldener Löwe', 'Goldener Löwe', 3, 'Verdienstorden',
   '11 Punkte nach dem Punktesystem der Vereinigung (z. B. 22 Jahre ununterbrochene aktive Tätigkeit oder 11 Jahre in einem Amt).', null, null),
  ('Vereinigung Badisch-Pfälzischer Karnevalvereine', 'VBPK-Verdienstorden', 'Goldener Löwe mit Brillanten', 'Goldener Löwe mit Brillanten', 4, 'Verdienstorden',
   'Nach weiteren 22 aktiven Jahren nach dem Goldenen Löwen.', null,
   'Die Frist „nach weiteren 22 aktiven Jahren“ bezieht sich auf die Verleihung des Goldenen Löwen und wird nicht automatisch berechnet – bitte manuell vormerken.'),
  ('Kölner Festkomitee von 1823 e.V.', null, 'Verdienstorden des Kölner Karnevals', null, null, 'Verdienstorden',
   'Kriterien nicht hinterlegt. Laut Kompendium stehen der Beitrag zum Erhalt des Ur-Kölner Brauchtums und die langjährige Arbeit in den Traditionskorps im Vordergrund.', null, null);

update public.ehrungsarten a set
  serie = x.serie, stufe = x.stufe, stufe_nr = x.stufe_nr, kategorie = x.kategorie, voraussetzungen = x.voraussetzungen,
  antrag_erforderlich = x.antrag, pruef_bemerkung = x.bemerkung, aktiv = true, pruefstatus = 'nicht_geprueft',
  quelle = 'Deutsches Karnevalsorden-Kompendium – geprüfte und korrigierte Ausgabe (übernommen am 26.09.2026)'
from _arten x join public.ehrungs_organisationen o on o.name = x.organisation
where a.typ = 'verband' and a.organisation_id = o.id and a.name = x.name;

insert into public.ehrungsarten (typ, organisation_id, serie, name, stufe, stufe_nr, kategorie, voraussetzungen, antrag_erforderlich,
                                 pruef_bemerkung, quelle, pruefstatus, automatische_vorschlaege, bestellung_erforderlich)
select 'verband', o.id, x.serie, x.name, x.stufe, x.stufe_nr, x.kategorie, x.voraussetzungen, x.antrag, x.bemerkung,
       'Deutsches Karnevalsorden-Kompendium – geprüfte und korrigierte Ausgabe (übernommen am 26.09.2026)', 'nicht_geprueft', true, true
from _arten x join public.ehrungs_organisationen o on o.name = x.organisation
where not exists (select 1 from public.ehrungsarten a where a.typ = 'verband' and a.organisation_id = o.id and a.name = x.name);

-- ---------------------------------------------------------------------------------------------
-- 4) Regeln neu setzen (Regeln werden nicht referenziert; verliehene Ehrungen sind per Snapshot geschuetzt)
-- ---------------------------------------------------------------------------------------------
delete from public.ehrungs_regeln r using public.ehrungsarten a, public.ehrungs_organisationen o
where r.ehrungsart_id = a.id and a.organisation_id = o.id
  and o.name in ('Bund Deutscher Karneval e.V.', 'Vereinigung Badisch-Pfälzischer Karnevalvereine', 'Kölner Festkomitee von 1823 e.V.');

insert into public.ehrungs_regeln (ehrungsart_id, berechnung, jahre, punkte_min, punkte_gewichte, ununterbrochen, bemerkung)
select a.id, x.berechnung, x.jahre, x.punkte_min, x.gewichte, x.ununterbrochen, x.bemerkung
from (values
  ('Bund Deutscher Karneval e.V.', 'Verdienstorden in Silber', 'ehrenamt', 15::numeric, null::numeric, null::jsonb, false, 'Laut Kompendium: 15 Jahre aktive ehrenamtliche Arbeit'),
  ('Bund Deutscher Karneval e.V.', 'Verdienstorden in Gold', 'ehrenamt', 25::numeric, null::numeric, null::jsonb, false, 'Laut Kompendium: 25 Jahre aktive ehrenamtliche Arbeit'),
  ('Bund Deutscher Karneval e.V.', 'Verdienstorden in Gold mit Brillanten', 'ehrenamt', 40::numeric, null::numeric, null::jsonb, true, 'Laut Kompendium: 40 Jahre ununterbrochene Aktivität; Antrag und Einzelfallprüfung durch den BDK'),
  ('Vereinigung Badisch-Pfälzischer Karnevalvereine', 'Verdienstorden am Band', 'punkte', null, 4::numeric, '{"aktiv": 0.5, "funktion:Vorstand": 1, "funktion:Sitzungspräsident": 1}'::jsonb, false, 'Laut Kompendium: 4 Punkte'),
  ('Vereinigung Badisch-Pfälzischer Karnevalvereine', 'Großer Verdienstorden', 'punkte', null, 8::numeric, '{"aktiv": 0.5, "funktion:Vorstand": 1, "funktion:Sitzungspräsident": 1}'::jsonb, false, 'Laut Kompendium: 8 Punkte'),
  ('Vereinigung Badisch-Pfälzischer Karnevalvereine', 'Goldener Löwe', 'punkte', null, 11::numeric, '{"aktiv": 0.5, "funktion:Vorstand": 1, "funktion:Sitzungspräsident": 1}'::jsonb, false, 'Laut Kompendium: 11 Punkte'),
  ('Vereinigung Badisch-Pfälzischer Karnevalvereine', 'Goldener Löwe mit Brillanten', 'manuell', null, null, null, false, 'Laut Kompendium: nach weiteren 22 aktiven Jahren nach dem Goldenen Löwen')
) x(organisation, name, berechnung, jahre, punkte_min, gewichte, ununterbrochen, bemerkung)
join public.ehrungs_organisationen o on o.name = x.organisation
join public.ehrungsarten a on a.organisation_id = o.id and a.name = x.name and a.typ = 'verband';
