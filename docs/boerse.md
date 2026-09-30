# TanzRaum Börse

Community-Marktplatz für **alle** angemeldeten Personen (FREE, BASIC, VEREIN): kaufen, verkaufen, tauschen,
verschenken, suchen. Keine Vereinsfunktion, keine Verbindung zur Vereinsverwaltung. Migrationen
`20260930003042_boerse`, `20260930003207_boerse_telefon`.

## Seiten

- `/dashboard/boerse` – Startseite mit Suche, Kategorien (inkl. Unterkategorien), Art (Verkaufen/Tauschen/
  Verschenken/Suchanzeigen), Filter (Größe, Zustand, Preis von/bis, kostenlos, Versand, Abholung, Tausch, Ort,
  „Nur in meiner Nähe“ mit Umkreis), Sortierung (neu, Preis ↑/↓, Entfernung), Seiten à 24.
- `/dashboard/boerse/[id]` – Detailseite: Galerie, Preis, Zustand, Größe, Beschreibung, Ort, Versand/Abholung/Tausch,
  Anbieter, Datum, „Verkäufer/Anbieter kontaktieren“, Favorit, „Angebot melden“.
- `/dashboard/boerse/neu`, `/dashboard/boerse/[id]/bearbeiten` – Formular mit bis zu 8 Bildern (im Browser verkleinert).
- `/dashboard/boerse/meine` – eigene Angebote nach Status (Status ändern, bearbeiten, löschen) und „Meine Favoriten“.
- `/dashboard/admin/boerse` – Moderation (Plattform-Administration).
- Navigation „TanzRaum Börse“ (alle Tarife), Schnellaktion „Börse – Angebot einstellen“, Abschnitt auf der Landingpage.

## Regeln (in der Datenbank)

- Lesen: alle Angemeldeten sehen aktive/reservierte Angebote; eigene immer; Administration alle (Moderation).
  Blockierte Personen sehen sich gegenseitig nicht. Schreiben nur über RPCs (`boerse_*`).
- Unter 16: nur ansehen und merken – keine eigenen Angebote, kein Kontakt (Jugendschutz). Eltern können einstellen.
- Kontakt: `boerse_kontaktieren` öffnet den bestehenden Privatchat (oder legt ihn an) und schreibt die Anfrage mit
  Link zum Angebot. In solchen Chats dürfen beide (ab 16, ohne Elternsperre, nicht blockiert, nicht gesperrt)
  Nachrichten schreiben – auch FREE und ohne Kontaktanfrage. **Keine Anrufe** über die Börse. Chatliste zeigt
  „Börse · Titel“.
- Datenschutz: Ort nur als Ortsname (Ortsmitte auf ~1 km gerundet für die Umkreissuche), keine Straße/PLZ;
  Telefonnummern und E-Mail-Adressen im Text werden abgelehnt; Bilder im privaten Bucket `boerse`
  (`<user>/<angebot>/…`), Anzeige nur über kurzlebige signierte Links.
- Missbrauchsschutz: max. 20 neue Angebote/Tag, 100 aktive, 30 Kontakte/Tag, 20 Meldungen/Tag, 300 Favoriten.
- Moderation: gemeldete Angebote mit Gründen; deaktivieren (mit Grund, Benachrichtigung), Meldung verwerfen,
  löschen, Person für die Börse einschränken (befristet/unbefristet, pausiert ihre Angebote). Die Administration sieht
  nur Angebot, Meldegründe und den Namen der anbietenden Person – keine Chats, keine Vereinsdaten, keine meldende Person.
- Keine Zahlungsabwicklung, keine Provision, keine Verwahrung von Geld.
- Kategorien in `boerse_kategorien` (Schlüssel, Eltern, Name, Emoji, Sortierung, aktiv) – neue Kategorien per Insert.
- Datenexport enthält eigene Angebote, Favoriten, Meldungen und Kontakte.

## Später möglich (Struktur vorhanden)

Suchaufträge/Benachrichtigungen bei neuen Treffern, Preisänderungs-Hinweise, „ähnliche Angebote“, Kostüm-Sets/
Gruppenkostüme als eigene Unterkategorien, Bewertungen.

## Vorschlag Rechtstexte (noch NICHT eingebaut – Freigabe nötig)

**Nutzungsbedingungen, neuer Abschnitt „TanzRaum Börse“**
1. Die Börse ist ein Kontaktangebot zwischen Nutzerinnen und Nutzern. Verträge kommen ausschließlich zwischen den
   Beteiligten zustande; TanzRaum ist nicht Vertragspartei, wickelt keine Zahlungen ab und übernimmt keine Gewähr
   für Angebote, Beschreibungen, Zustand oder Lieferung.
2. Verboten sind rechtswidrige, gefälschte, gefährliche oder anstößige Angebote sowie Angebote, die Rechte Dritter
   verletzen. Bilder dürfen nur verwendet werden, wenn die nötigen Rechte bestehen; erkennbare Personen nur mit
   deren Einwilligung.
3. Private Kontaktdaten gehören nicht in Angebote; die Kontaktaufnahme erfolgt über den TanzRaum-Chat.
4. Gewerbliche Anbieter müssen ihre gesetzlichen Informationspflichten selbst erfüllen.
5. TanzRaum kann Angebote bei Verstößen deaktivieren oder löschen und die Nutzung der Börse einschränken.
6. Angebote einstellen und Anbietende kontaktieren ist ab 16 Jahren möglich.

**Datenschutzerklärung, Ergänzung**
Für die Börse verarbeiten wir die Angaben deiner Angebote (Titel, Beschreibung, Preis, Zustand, Größe, Ort als
Ortsname und gerundete Ortsmitte, Bilder), Favoriten, Meldungen und die Verknüpfung zwischen Angebot und
Chat-Kontakt (Art. 6 Abs. 1 lit. b DSGVO). Angebote sind für angemeldete Nutzerinnen und Nutzer sichtbar.
Bilder werden nicht öffentlich abgelegt. Beim Löschen eines Angebots werden Angaben und Bilder gelöscht.
