import type { Ansicht } from "@/lib/admin/ansicht";
import { ansichtZugriff } from "@/lib/admin/ansicht";

// Beispiel-Datenbestand fuer „Ansicht als …“ der TanzRaum-Administration.
// Ausschliesslich erfundene Personen und ein erfundener Verein – es werden keine echten Daten gelesen.

// deno-lint-ignore no-explicit-any
type Json = any;
export type VorschauDaten = { rpc: Record<string, Json | ((body: Json) => Json)>; tab: Record<string, Json[]> };

const V = "0e000000-0000-4000-8000-00000000000a";
const G1 = "0e000000-0000-4000-8000-0000000000b1";
const G2 = "0e000000-0000-4000-8000-0000000000b2";
const G3 = "0e000000-0000-4000-8000-0000000000b3";
const vm = (n: number) => `0e000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;
const uid = (n: number) => `0e000000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`;

function tag(plus: number): string {
  const d = new Date(Date.now() + plus * 86_400_000);
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}
const vor = (tage: number) => new Date(Date.now() - tage * 86_400_000).toISOString();

const PERSONEN = [
  { n: 1, name: "Sabine Keller", rolle: "Trainerin", ak: "Hauptklasse", g: [G1, G2], funktion: "trainer" },
  { n: 2, name: "Lena Muster", rolle: "Tänzerin", ak: "Jugend", g: [G1] },
  { n: 3, name: "Mia Beispiel", rolle: "Tänzerin", ak: "Jugend", g: [G1] },
  { n: 4, name: "Emma Schulz", rolle: "Tänzerin", ak: "Jugend", g: [G1, G2] },
  { n: 5, name: "Jonas Wagner", rolle: "Tänzer", ak: "Hauptklasse", g: [G2] },
  { n: 6, name: "Lea Hoffmann", rolle: "Tänzerin", ak: "Kinder", g: [G3] },
  { n: 7, name: "Paul Beispiel", rolle: "Tänzer", ak: "Kinder", g: [G3] },
  { n: 8, name: "Katrin Braun", rolle: "Betreuerin", ak: null, g: [G1], funktion: "betreuer" },
  { n: 9, name: "Thomas Weber", rolle: "Vereins-Admin", ak: null, g: [] },
  { n: 10, name: "Julia Neumann", rolle: "Tänzerin", ak: "Hauptklasse", g: [G2] },
  { n: 11, name: "Marie Fischer", rolle: "Tänzerin", ak: "Kinder", g: [G3] },
  { n: 12, name: "Markus Beispiel", rolle: "Eltern", ak: null, g: [] },
] as const;

const GRUPPEN = [
  { id: G1, name: "Juniorengarde", ak: "Jugend", disziplin: "Garde", tage: [2, 4], von: "18:00", bis: "19:30", halle: "Sporthalle Nord" },
  { id: G2, name: "Showtanzgruppe", ak: "Hauptklasse", disziplin: "Showtanz", tage: [3], von: "19:30", bis: "21:00", halle: "Gymnastikraum" },
  { id: G3, name: "Minis", ak: "Kinder", disziplin: "Garde", tage: [5], von: "16:30", bis: "17:30", halle: "Sporthalle Nord" },
];

const ROLLE: Record<Exclude<Ansicht, "free" | "basic">, { name: string; vorname: string; gruppen: string[] }> = {
  verein_admin: { name: "Vereins-Admin", vorname: "Sophie", gruppen: [] },
  verein_trainer: { name: "Trainerin", vorname: "Lena", gruppen: [G1, G2] },
  verein_betreuer: { name: "Betreuerin", vorname: "Katrin", gruppen: [G1] },
  verein_mitglied: { name: "Tänzerin", vorname: "Emma", gruppen: [G1] },
  verein_eltern: { name: "Eltern", vorname: "Markus", gruppen: [] },
};

export function vorschauDaten(ansicht: Ansicht, userId: string, einstellungen: { musikAn: boolean }): VorschauDaten {
  const mitVerein = ansicht.startsWith("verein_");
  const r = mitVerein ? ROLLE[ansicht as keyof typeof ROLLE] : null;
  const zugriff = ansichtZugriff(ansicht);
  const istAdmin = ansicht === "verein_admin";
  const istTrainer = ansicht === "verein_trainer";
  const istBetreuer = ansicht === "verein_betreuer";
  const verwaltetTraining = istAdmin || istTrainer;
  const ICH = vm(0);
  const vorname = r?.vorname ?? (ansicht === "free" ? "Mia" : "Jonas");
  const ichName = `${vorname} Beispiel`;
  const tarif = mitVerein ? "verein" : ansicht;

  const verein = {
    id: V, name: "TSC Beispielstadt e.V.", kuerzel: "TSC", logo_url: null, beschreibung: "Garde- und Showtanz in Beispielstadt – seit 1965.",
    ansprechpartner: null, email: "info@tsc-beispielstadt.example", telefon: "01234 567890", webseite: "tsc-beispielstadt.example",
    strasse: "Am Sportplatz", hausnummer: "1", plz: "12345", ort: "Beispielstadt", tarif: "verein", verband_id: null, verbaende: null,
    gesperrt: false, logo: null, module_aus: [], news_rollen: ["admin", "trainer"],
  };

  // Mitglieder inkl. der Person, als die die Administration gerade schaut
  const mitglieder = [
    ...(mitVerein ? [{ n: 0, name: ichName, rolle: r!.name, ak: ansicht === "verein_mitglied" ? "Jugend" : null, g: r!.gruppen, funktion: istTrainer ? "trainer" : istBetreuer ? "betreuer" : undefined }] : []),
    ...PERSONEN,
  ];
  const mitgliedZeile = (p: (typeof mitglieder)[number]) => ({
    vm_id: vm(p.n), user_id: p.n === 0 ? userId : uid(p.n), name: p.name, handle: null, email: istAdmin ? `${p.name.split(" ")[0].toLowerCase()}@example.org` : null,
    rolle_id: null, rolle: p.rolle, aktiv: true, altersklasse: p.ak, seit: "2024-09-01", bereiche: null,
    gruppen: p.g.map((id) => ({ id, name: GRUPPEN.find((g) => g.id === id)!.name, funktion: "funktion" in p && p.funktion ? p.funktion : "mitglied" })),
    eltern: p.n === 6 || p.n === 7 ? [{ vm_id: vm(12), name: "Markus Beispiel" }] : [],
    kinder: p.n === 12 || (ansicht === "verein_eltern" && p.n === 0) ? [{ vm_id: vm(6), name: "Lea Hoffmann" }, { vm_id: vm(7), name: "Paul Beispiel" }] : [],
    ist_ich: p.n === 0, geschlecht: /a$|e$|n$/.test(p.name.split(" ")[0]) ? "w" : "m",
  });

  // Trainings der naechsten Wochen aus den Gruppenzeiten
  const meineGruppen = new Set(
    istAdmin ? GRUPPEN.map((g) => g.id) : ansicht === "verein_eltern" ? [G3] : (r?.gruppen ?? []),
  );
  const trainingsTage = (von: string, bis: string) => {
    const liste: Json[] = [];
    for (let i = -7; i <= 28; i++) {
      const datum = tag(i);
      if (datum < von || datum > bis) continue;
      const wt = new Date(`${datum}T12:00:00Z`).getUTCDay() || 7;
      for (const g of GRUPPEN) {
        if (!g.tage.includes(wt) || !meineGruppen.has(g.id)) continue;
        const leute = mitglieder.filter((p) => (p.g as readonly string[]).includes(g.id));
        liste.push({
          termin_id: `${g.id.slice(0, -2)}${String(wt).padStart(2, "0")}`, verein_id: V, verein_name: verein.name, gruppe_id: g.id, gruppe_name: g.name,
          datum, von: `${g.von}:00`, bis: `${g.bis}:00`, halle: g.halle, titel: `Training ${g.name}`, wiederholend: true,
          darf_verwalten: verwaltetTraining, darf_anwesenheit: verwaltetTraining || istBetreuer,
          personen: leute.map((p, j) => ({ vm_id: vm(p.n), name: p.name, ich: p.n === 0, abgemeldet: j === 2 && i >= 0 && i < 3, grund: j === 2 && i >= 0 && i < 3 ? "Krank" : null })),
        });
      }
    }
    return liste;
  };

  const turniere = [
    { id: "0e000000-0000-4000-8000-000000000301", name: "Landesmeisterschaft Garde", typ: "Turnier", kategorie: null, ort: "Musterhalle", adresse: "Festhalle Musterstadt", ausrichter: "TV Musterstadt",
      ausschreibung_url: null, verband: "Beispielverband", erster_tag: tag(9), letzter_tag: tag(10), tage: [{ datum: tag(9), wochentag: "Sa", beginn: "10:00:00" }, { datum: tag(10), wochentag: "So", beginn: "10:00:00" }],
      meldeschluss: tag(4), beginn_samstag: "10:00", beginn_sonntag: "10:00", verein_id: null, verein_name: null, unsere_starts: mitVerein ? 2 : 0, gemerkt: false },
    { id: "0e000000-0000-4000-8000-000000000302", name: "Herbstpokal", typ: "Turnier", kategorie: null, ort: "Beispielstadt", adresse: "Stadthalle", ausrichter: null,
      ausschreibung_url: null, verband: "Beispielverband", erster_tag: tag(23), letzter_tag: tag(23), tage: [{ datum: tag(23), wochentag: "So", beginn: "11:00:00" }],
      meldeschluss: tag(12), beginn_samstag: null, beginn_sonntag: "11:00", verein_id: null, verein_name: null, unsere_starts: mitVerein ? 1 : 0, gemerkt: true },
  ];
  const start = (id: string, t: (typeof turniere)[number], g: (typeof GRUPPEN)[number], status: string) => ({
    id, turnier_id: t.id, turnier_name: t.name, turnier_ort: t.ort, erster_tag: t.erster_tag, letzter_tag: t.letzter_tag, turnier_tage: t.tage.map((x) => ({ datum: x.datum, wochentag: x.wochentag })),
    meldeschluss: t.meldeschluss, eigenes_turnier: false, gruppe_id: g.id, gruppe_name: g.name, formation_id: null, formation_name: null, bezeichnung: null, solisten: [], solisten_namen: null,
    disziplin_id: null, disziplin: g.disziplin, altersklasse_id: null, altersklasse: g.ak, tag: t.erster_tag, startnummer: status === "gemeldet" ? 14 : null, status, notiz: null,
    platz: null, punkte: null, ergebnis_notiz: null, dabei: 9, nicht_dabei: 1, unsicher: 2, teilnehmer: 12, darf_bearbeiten: verwaltetTraining,
  });
  const starts = mitVerein ? [start("0e000000-0000-4000-8000-000000000311", turniere[0], GRUPPEN[0], "gemeldet"), start("0e000000-0000-4000-8000-000000000312", turniere[1], GRUPPEN[1], "geplant")] : [];

  const kt = (n: number, art: string, titel: string, datum: string, extra: Json = {}) => ({
    id: `0e000000-0000-4000-8000-0000000004${String(n).padStart(2, "0")}`, verein_id: V, verein_name: verein.name, art, titel, beschreibung: null, ort: null, datum, bis_datum: null,
    von: null, bis: null, zielgruppe: "verein", gruppen: [], rueckmeldung: false, darf_bearbeiten: istAdmin, personen: [], zusagen: 0, absagen: 0, vielleicht: 0, meine_antwort: null, ...extra,
  });
  const termine = mitVerein
    ? [
        kt(1, "fest", "Sommerfest", tag(12), { von: "15:00:00", ort: "Vereinsheim", rueckmeldung: true, zusagen: 31, absagen: 4, vielleicht: 6 }),
        kt(2, "auftritt", "Auftritt Stadtfest", tag(5), { von: "17:00:00", ort: "Marktplatz", zielgruppe: "gruppen", gruppen: ["Showtanzgruppe"] }),
        kt(3, "versammlung", "Mitgliederversammlung", tag(30), { von: "19:30:00", ort: "Vereinsheim" }),
      ]
    : [];

  const news = mitVerein
    ? [
        { id: "0e000000-0000-4000-8000-000000000501", verein_id: V, verein_name: verein.name, titel: "Kostümprobe am Samstag", text: "Bitte bringt alle eure Gardeuniform mit – wir prüfen Größen und Knöpfe. Beginn 10 Uhr in der Sporthalle Nord.",
          wichtig: true, erstellt_am: vor(1), geaendert_am: null, autor: "Sabine Keller", gelesen_am: null, ist_empfaenger: true, darf_verwalten: istAdmin, empfaenger: istAdmin ? 42 : null, gelesen: istAdmin ? 31 : null, ziele: [{ art: "verein" }] },
        { id: "0e000000-0000-4000-8000-000000000502", verein_id: V, verein_name: verein.name, titel: "Neue Trainingszeiten Minis", text: "Ab nächster Woche trainieren die Minis freitags von 16:30 bis 17:30 Uhr.",
          wichtig: false, erstellt_am: vor(4), geaendert_am: null, autor: "Thomas Weber", gelesen_am: vor(3), ist_empfaenger: true, darf_verwalten: istAdmin, empfaenger: istAdmin ? 18 : null, gelesen: istAdmin ? 15 : null, ziele: [{ art: "gruppe", id: G3 }] },
      ]
    : [];
  const umfragen = mitVerein
    ? [{ id: "0e000000-0000-4000-8000-000000000511", verein_id: V, verein_name: verein.name, frage: "Welcher Termin passt für die Weihnachtsfeier?", beschreibung: null,
        optionen: ["Fr, 12.12.", "Sa, 13.12.", "Fr, 19.12."], mehrfach: true, anonym: false, endet_am: vor(-6), erstellt_am: vor(2), autor: "Thomas Weber", ist_empfaenger: true,
        darf_verwalten: istAdmin, empfaenger: 42, teilnehmer: 23, stimmen: [11, 15, 6], meine: [], namen: null }]
    : [];

  const fahrten = {
    zugang: mitVerein, verein_id: mitVerein ? V : null, verein_name: mitVerein ? verein.name : null, ich: userId, darf_schreiben: mitVerein,
    fahrten: mitVerein
      ? [
          { id: "0e000000-0000-4000-8000-000000000601", art: "angebot", anlass: "Landesmeisterschaft Garde", ziel: "Festhalle Musterstadt", datum: tag(9), uhrzeit: "07:30", treffpunkt: "Parkplatz Vereinsheim",
            richtung: "hin_rueck", plaetze: 3, notiz: "Platz für zwei Kostümtaschen im Kofferraum.", status: "offen", erstellt_am: vor(1), ersteller: { id: uid(1), name: "Sabine Keller" }, ist_meine: false, belegt: 2, angeboten: 0,
            antworten: [{ id: "0e000000-0000-4000-8000-000000000611", art: "mitfahren", personen: 2, text: "Lena und ich", erstellt_am: vor(0), user_id: uid(2), name: "Lena Muster", ist_meine: false }] },
          { id: "0e000000-0000-4000-8000-000000000602", art: "gesuch", anlass: "Training Samstag", ziel: null, datum: tag(3), uhrzeit: "10:00", treffpunkt: "Beispielstadt Süd", richtung: "hin",
            plaetze: 1, notiz: null, status: "offen", erstellt_am: vor(0), ersteller: { id: uid(3), name: "Mia Beispiel" }, ist_meine: false, belegt: 0, angeboten: 1,
            antworten: [{ id: "0e000000-0000-4000-8000-000000000612", art: "anbieten", personen: 1, text: "Ich hol dich um 9:40 ab", erstellt_am: vor(0), user_id: uid(5), name: "Jonas Wagner", ist_meine: false }] },
        ]
      : [],
  };

  const kostuemeVerwalten = istAdmin || istBetreuer;
  const teil = (n: number, x: Json) => ({ id: `0e000000-0000-4000-8000-0000000007${String(n).padStart(2, "0")}`, verein_id: V, kostuem_gruppe_id: null, vereins_mitglied_id: null, art: "kostuem", anzahl: 1,
    groesse: null, zustand: "gut", lagerort: null, vergabe_datum: null, rueckgabe: null, notiz: null, kostuem_gruppen: null, ...x });
  const KS1 = "0e000000-0000-4000-8000-000000000791";
  const kostuemSatz = { name: "Gardeuniform rot 2026", farbe: "#c8102e" };
  const kostueme = mitVerein
    ? [
        teil(1, { teil: "Gardejacke rot", groesse: "152", kostuem_gruppe_id: KS1, vereins_mitglied_id: ansicht === "verein_mitglied" ? ICH : vm(2), vergabe_datum: tag(-20), rueckgabe: tag(60), kostuem_gruppen: kostuemSatz }),
        teil(2, { teil: "Gardejacke rot", groesse: "146", kostuem_gruppe_id: KS1, lagerort: "Vereinsheim, Schrank 2", kostuem_gruppen: kostuemSatz }),
        teil(3, { teil: "Dreispitz", groesse: "M", kostuem_gruppe_id: KS1, vereins_mitglied_id: vm(3), vergabe_datum: tag(-40), rueckgabe: tag(-5), kostuem_gruppen: kostuemSatz }),
        teil(4, { teil: "Gardejacke rot", groesse: "140", kostuem_gruppe_id: KS1, zustand: "reparatur", notiz: "Knopf fehlt", lagerort: "Nähkiste", kostuem_gruppen: kostuemSatz }),
        teil(5, { teil: "Pompons gold", art: "requisit", anzahl: 12, lagerort: "Vereinsheim, Regal oben" }),
        teil(6, { teil: "Minis-Kleidchen blau", groesse: "116", vereins_mitglied_id: vm(6), vergabe_datum: tag(-10), rueckgabe: tag(80) }),
      ]
    : [];
  const sichtbareKostueme = kostuemeVerwalten
    ? kostueme
    : kostueme.filter((k) => k.vereins_mitglied_id === ICH || (ansicht === "verein_eltern" && (k.vereins_mitglied_id === vm(6) || k.vereins_mitglied_id === vm(7))));

  const beitraege = mitVerein
    ? [
        { id: "0e000000-0000-4000-8000-000000000801", vereins_mitglied_id: vm(2), beitragstyp_id: "0e000000-0000-4000-8000-000000000891", beitragstyp_name: "Jahresbeitrag Aktive", betrag: 120, faellig: tag(-15), bezahlt: false, bezahlt_am: null, zahlungsweg: "Überweisung", notiz: null, erinnert_am: vor(5), verein_id: V },
        { id: "0e000000-0000-4000-8000-000000000802", vereins_mitglied_id: vm(3), beitragstyp_id: "0e000000-0000-4000-8000-000000000891", beitragstyp_name: "Jahresbeitrag Aktive", betrag: 120, faellig: tag(15), bezahlt: false, bezahlt_am: null, zahlungsweg: "Überweisung", notiz: null, erinnert_am: null, verein_id: V },
        { id: "0e000000-0000-4000-8000-000000000803", vereins_mitglied_id: vm(4), beitragstyp_id: "0e000000-0000-4000-8000-000000000891", beitragstyp_name: "Jahresbeitrag Aktive", betrag: 120, faellig: tag(-15), bezahlt: true, bezahlt_am: tag(-20), zahlungsweg: "Lastschrift", notiz: null, erinnert_am: null, verein_id: V },
        { id: "0e000000-0000-4000-8000-000000000804", vereins_mitglied_id: vm(6), beitragstyp_id: "0e000000-0000-4000-8000-000000000892", beitragstyp_name: "Jahresbeitrag Kinder", betrag: 60, faellig: tag(-15), bezahlt: true, bezahlt_am: tag(-18), zahlungsweg: "Überweisung", notiz: null, erinnert_am: null, verein_id: V },
      ]
    : [];
  const jahr = tag(0).slice(0, 4);
  const buchung = (n: number, x: Json) => ({ id: `0e000000-0000-4000-8000-0000000009${String(n).padStart(2, "0")}`, verein_id: V, kategorie: null, beschreibung: null, zahlungsart: "Überweisung", beleg_pfad: null, beleg_name: null, beitrag_id: null, ...x });
  const kassenbuch = istAdmin
    ? [
        buchung(1, { datum: `${Number(jahr) - 1}-12-31`, typ: "einnahme", kategorie: "Anfangsbestand", betrag: 2350, beschreibung: "Übertrag Kasse Vorjahr" }),
        buchung(2, { datum: `${jahr}-01-20`, typ: "einnahme", kategorie: "Mitgliedsbeiträge", betrag: 1440, beschreibung: "Jahresbeiträge Januar" }),
        buchung(3, { datum: `${jahr}-02-03`, typ: "ausgabe", kategorie: "Hallenmiete", betrag: 320, beschreibung: "Hallenmiete Q1" }),
        buchung(4, { datum: `${jahr}-04-12`, typ: "ausgabe", kategorie: "Kostüme", betrag: 890, beschreibung: "Stoff Gardeuniform" }),
        buchung(5, { datum: `${jahr}-06-08`, typ: "einnahme", kategorie: "Veranstaltungen", betrag: 610, beschreibung: "Sommerfest Kuchenverkauf", zahlungsart: "Bar" }),
        buchung(6, { datum: tag(-20), typ: "einnahme", kategorie: "Mitgliedsbeiträge", betrag: 120, beschreibung: "Jahresbeitrag Aktive – Emma Schulz", zahlungsart: "Lastschrift", beitrag_id: "0e000000-0000-4000-8000-000000000803" }),
        buchung(7, { datum: tag(-9), typ: "ausgabe", kategorie: "Startgebühren", betrag: 180, beschreibung: "Landesmeisterschaft Garde" }),
      ]
    : [];

  const namenListe = mitglieder.map((p) => ({ vm_id: vm(p.n), name: p.name }));
  const statistik = {
    inhalte: ["mitglieder", "rollen", "altersklassen", "gruppen", "beteiligung", "turniere"],
    mitglieder: { aktiv: 86, neu: 3, verlauf: Array.from({ length: 12 }, (_, i) => ({ monat: tag(-30 * (11 - i)).slice(0, 7), gesamt: 70 + i + (i > 6 ? 3 : 0) })) },
    rollen: [{ rolle: "Tänzerin", anzahl: 52 }, { rolle: "Tänzer", anzahl: 14 }, { rolle: "Trainerin", anzahl: 5 }, { rolle: "Betreuer", anzahl: 4 }, { rolle: "Eltern", anzahl: 11 }],
    altersklassen: [{ altersklasse: "Kinder", anzahl: 24 }, { altersklasse: "Jugend", anzahl: 31 }, { altersklasse: "Hauptklasse", anzahl: 22 }, { altersklasse: "Ü30", anzahl: 9 }],
    gruppen: GRUPPEN.map((g, i) => ({ gruppe: g.name, anzahl: [14, 12, 16][i] })),
    beteiligung: Array.from({ length: 12 }, (_, i) => ({ monat: tag(-30 * (11 - i)).slice(0, 7), prozent: [78, 81, 70, 83, 86, 88, 84, 79, 82, 87, 90, 85][i] })),
    turniere: { starts: 12, podest: 5, siege: 2 },
  };

  const onlineKontakte = [{ id: uid(2), name: "Lena Muster", avatar_url: null }, { id: uid(5), name: "Jonas Wagner", avatar_url: null }];
  const darfKostueme = mitVerein && kostuemeVerwalten;

  const rpc: VorschauDaten["rpc"] = {
    // Konto, Tarif, Rechte
    ist_plattform_admin_aktuell: false,
    mein_geburtsdatum: ansicht === "verein_mitglied" ? "2009-04-12" : "1988-06-20",
    mein_geschlecht: "w",
    mein_kinderkonto_status: "ok",
    rechtstexte_offen: false,
    mein_profil_privat: [{ tarif: mitVerein ? "free" : tarif, tarif_aktiv_bis: null }],
    mein_tarif: tarif,
    meine_bereiche: mitVerein ? zugriff.bereiche.map((b) => ({ verein_id: V, bereich: b })) : [],
    netzwerk_modus: zugriff.netzwerk ?? null,
    meine_module_aus: [],
    musik_freigegeben: einstellungen.musikAn,
    spotlights_fuer_mich: false,
    spotlight_leiste: [],
    eigene_ungelesene_nachrichten_anzahl: 0,
    meine_ankuendigungen: [],
    meine_offenen_wichtigen_news: [],
    meine_mitgliedsantraege: [],
    offene_eltern_bestaetigungen: [],
    mein_tarif_status: {
      abos: ansicht === "basic" ? [{ id: "0e000000-0000-4000-8000-000000000a01", tarif: "basic", status: "active", periode: "jahr", anbieter: "stripe", laeuft_bis: tag(200), preis_cent: 2990, pause_grund: null, pausiert_am: null, pause_verein: null, gekuendigt_zum: null }] : [],
      zugang: { effektiv: tarif, verein_id: mitVerein ? V : null, vereinszugang: mitVerein, plattform_admin: false, persoenlicher_tarif: mitVerein ? "free" : tarif, persoenlich_aktiv_bis: null },
      verein_name: mitVerein ? verein.name : null,
      admin_vereine: istAdmin ? [{ id: V, name: verein.name, lizenz: true, lizenz_bis: tag(240), abo: null, ueberweisung: null }] : [],
      bank: null, ueberweisung_moeglich: false,
    },
    // Online
    online_anzahl: 128,
    online_uebersicht: { gesamt: 128, verein: mitVerein ? 12 : 0, hat_verein: mitVerein, kontakte: onlineKontakte, ich_sichtbar: true },
    online_liste: { gesamt: 128, sichtbar: 2, treffer: 2, personen: onlineKontakte.map((k) => ({ ...k, kontakt: true })), profile_verlinken: true },
    // Verein
    verein_uebersicht: mitVerein
      ? { meine_rolle: r!.name, meine_gruppen: r!.gruppen.map((id) => GRUPPEN.find((g) => g.id === id)!.name), lizenz: true, mitglieder_anzahl: 86,
          gruppen: GRUPPEN.map((g, i) => ({ id: g.id, name: g.name, altersklasse_id: null, altersklasse: g.ak, disziplin_id: null, disziplin: g.disziplin, thema: null, anzahl: [14, 12, 16][i],
            trainer: ["Sabine Keller"], betreuer: i === 0 ? ["Katrin Braun"] : [] })),
          ansprechpartner: [{ name: "Thomas Weber", rolle: "Vorsitzender" }, { name: "Sabine Keller", rolle: "Trainerin" }] }
      : null,
    vereinslizenz_status: null,
    mitglieder_liste: mitglieder.map(mitgliedZeile),
    mitglieder_auswahl: namenListe,
    dashboard_meine_kinder:
      ansicht === "verein_eltern"
        ? [
            { kind_vm_id: vm(6), name: "Lea Hoffmann", verein_name: verein.name, gruppen: "Minis", training_heute: null, heute_abgemeldet: false },
            { kind_vm_id: vm(7), name: "Paul Beispiel", verein_name: verein.name, gruppen: "Minis", training_heute: null, heute_abgemeldet: false },
          ]
        : [],
    // Training & Anwesenheit
    training_kalender: (b: Json) => trainingsTage(b.p_von ?? tag(-7), b.p_bis ?? tag(28)),
    meine_betreuten_gruppen: verwaltetTraining || istBetreuer ? GRUPPEN.filter((g) => meineGruppen.has(g.id)).map((g) => ({ gruppe_id: g.id, gruppe_name: g.name, verein_id: V, verein_name: verein.name })) : [],
    anwesenheit_liste: (b: Json) =>
      mitglieder.filter((p) => (p.g as readonly string[]).includes(b.p_gruppe_id)).map((p, j) => ({ vm_id: vm(p.n), name: p.name, abgemeldet: j === 2, grund: j === 2 ? "Krank" : null, anwesend: j === 2 ? false : j % 4 === 3 ? null : true })),
    // Kalender & Turniere
    kalender_termine: termine,
    kalender_turniere: [],
    termin_teilnehmer: [],
    turniere_uebersicht: turniere,
    vereins_starts: starts,
    meine_turnierstarts: ansicht === "verein_mitglied" ? starts.map((s) => ({ start_id: s.id, turnier_id: s.turnier_id, turnier_name: s.turnier_name, turnier_ort: s.turnier_ort, erster_tag: s.erster_tag, letzter_tag: s.letzter_tag, tag: s.tag, verein_name: verein.name, teilnahme: null })) : [],
    // News & Umfragen
    meine_news: news,
    meine_vereinsumfragen: umfragen,
    darf_news_verfassen: istAdmin || istTrainer,
    news_eigene_gruppen: istAdmin ? null : r?.gruppen ?? [],
    // Fahrgemeinschaften
    fahrgemeinschaften_uebersicht: fahrten,
    // Kostueme
    darf_kostueme_verwalten: darfKostueme,
    kostueme_personen: darfKostueme ? namenListe : null,
    kostueme_inhaber: darfKostueme ? namenListe : null,
    // Finanzen
    darf_finanzen: mitVerein && istAdmin,
    finanzen_namen: istAdmin ? namenListe : null,
    finanzen_personen: istAdmin ? mitglieder.map((p) => ({ vm_id: vm(p.n), name: p.name, rolle: p.rolle })) : null,
    meine_beitraege: istAdmin
      ? []
      : mitVerein
        ? [{ id: "0e000000-0000-4000-8000-000000000809", verein_name: verein.name, person: ansicht === "verein_eltern" ? "Lea Hoffmann" : ichName, art: ansicht === "verein_eltern" ? "Jahresbeitrag Kinder" : "Jahresbeitrag Aktive", betrag: ansicht === "verein_eltern" ? 60 : 120, faellig: tag(15), bezahlt: false, bezahlt_am: null }]
        : [],
    // Musik
    darf_musik_verwalten: mitVerein && (istAdmin || istTrainer),
    darf_eigene_dateien: tarif !== "free",
    musik_speicher: (b: Json) => ({ belegt: b.p_verein_id ? 187 * 1024 * 1024 : 12 * 1024 * 1024, limit: b.p_verein_id ? 1024 * 1024 * 1024 : 200 * 1024 * 1024 }),
    // TeamCloud
    teamcloud_speicher: { belegt: 187 * 1024 * 1024, limit: 500 * 1024 * 1024, dateien: 3, darf_hochladen: verwaltetTraining },
    // Statistik & Verwaltung
    verein_statistik: statistik,
    verein_bereich_zugaenge: { fahrgemeinschaften: ["trainer", "betreuer", "mitglied", "eltern", "sonstige"], kostueme: ["betreuer"], finanzen: [], statistiken: ["trainer"] },
    hat_vereinsbereich: (b: Json) => zugriff.bereiche.includes(b.p_bereich) || istAdmin,
    antraege_liste: istAdmin ? [{ id: "0e000000-0000-4000-8000-000000000b01", status: "eingereicht", name: "Nele Neumann", erstellt_am: vor(3), eingereicht_am: vor(2), entschieden_am: null, unterschrift_verfahren: "bildschirm", papier_vorliegend: false, mitgliedsnummer: null, minderjaehrig: true }] : [],
    freigabe_anfragen: [],
    darf_antraege: istAdmin,
    // Boerse (ohne Bilder)
    boerse_suche: {
      anzahl: 2, seite: 1, pro_seite: 24,
      angebote: [
        { id: "0e000000-0000-4000-8000-000000000c01", art: "verkaufen", kategorie: "kostueme", unterkategorie: null, titel: "Gardekostüm Rot/Gold, komplett", preis_cent: 12000, preis_vb: true, zustand: "sehr_gut", groesse: "152", ort: "Musterstadt", versand: true, abholung: true, tausch_moeglich: false, status: "aktiv", erstellt_am: vor(1), aktualisiert_am: vor(1), ist_meins: false, favorit: false, km: null, bilder: [] },
        { id: "0e000000-0000-4000-8000-000000000c02", art: "verschenken", kategorie: "tanzschuhe", unterkategorie: null, titel: "Gardestiefel weiß", preis_cent: 0, preis_vb: false, zustand: "gut", groesse: "37", ort: "Beispielstadt", versand: false, abholung: true, tausch_moeglich: false, status: "aktiv", erstellt_am: vor(2), aktualisiert_am: vor(2), ist_meins: false, favorit: false, km: null, bilder: [] },
      ],
    },
    boerse_meine: [],
    boerse_darf_handeln: null,
    // TanzRaum Connect (erfundene Personen und Vereine)
    netzwerk_map: tarif === "free" ? [] : [
      { art: "verein", id: V, name: verein.name, zeile: "Beispielstadt", lat: 49.44, lng: 8.2, avatar_url: null },
      { art: "verein", id: "0e000000-0000-4000-8000-000000000c11", name: "KG Blau-Weiß Musterdorf", zeile: "Musterdorf", lat: 49.32, lng: 8.43, avatar_url: null },
      { art: "person", id: uid(1), name: "Sabine Keller", zeile: "Trainerin · Garde", lat: 49.4, lng: 8.26, avatar_url: null },
      { art: "person", id: uid(5), name: "Jonas Wagner", zeile: "Showtanz", lat: 49.48, lng: 8.46, avatar_url: null },
    ],
    netzwerk_suche: tarif === "free" ? [] : [
      { art: "verein", id: V, name: verein.name, zeile1: "Beispielstadt", zeile2: "Garde · Showtanz", avatar_url: null, verein_id: V, status: null },
      { art: "verein", id: "0e000000-0000-4000-8000-000000000c11", name: "KG Blau-Weiß Musterdorf", zeile1: "Musterdorf", zeile2: "Garde", avatar_url: null, verein_id: null, status: null },
      { art: "person", id: uid(1), name: "Sabine Keller", zeile1: "Trainerin", zeile2: verein.name, avatar_url: null, verein_id: V, status: "verbunden" },
      { art: "person", id: uid(5), name: "Jonas Wagner", zeile1: "Tänzer", zeile2: verein.name, avatar_url: null, verein_id: V, status: null },
    ],
    // Chat
    chat_liste: [],
    chat_kontakte: [],
    meine_netzwerk_kontakte: [],
    meine_kontaktanfragen: [],
    anzeige_namen: [],
  };

  const tab: VorschauDaten["tab"] = {
    profiles: [{ id: userId, vorname, nachname: "Beispiel", handle: null, avatar_url: null, gesperrt: false, ist_plattform_admin: false }],
    onboarding_progress: [{ completed: true }],
    vereins_mitglieder: mitVerein
      ? [{ id: ICH, verein_id: V, user_id: userId, aktiv: true, aufnahme_status: "aufgenommen", vereine: { id: V, name: verein.name, tarif: "verein", gesperrt: false }, rollen: { name: r!.name } }]
      : [],
    vereine: mitVerein ? [verein] : [],
    gruppen: mitVerein ? GRUPPEN.map((g) => ({ id: g.id, name: g.name, verein_id: V, altersklasse_id: null, disziplin_id: null, thema: null })) : [],
    trainingstermine: mitVerein
      ? GRUPPEN.flatMap((g) => g.tage.map((t) => ({ id: `${g.id.slice(0, -2)}${String(t).padStart(2, "0")}`, gruppe_id: g.id, ist_wiederholend: true, wochentag: t, datum: null, von: `${g.von}:00`, bis: `${g.bis}:00`, halle: g.halle, titel: `Training ${g.name}`, gruppen: { name: g.name } })))
      : [],
    termine: [],
    turniere: [],
    rollen: [{ id: "0e000000-0000-4000-8000-000000000d01", name: "Tänzerin" }, { id: "0e000000-0000-4000-8000-000000000d02", name: "Trainerin" }, { id: "0e000000-0000-4000-8000-000000000d03", name: "Vereins-Admin" }],
    benachrichtigungen: [],
    kostueme: sichtbareKostueme,
    kostuem_gruppen: mitVerein ? [{ id: KS1, verein_id: V, name: kostuemSatz.name, farbe: kostuemSatz.farbe, beschreibung: "Juniorengarde – Jacke, Rock, Dreispitz" }] : [],
    kostuem_ausgaben: [],
    beitraege: istAdmin ? beitraege : [],
    beitragstypen: istAdmin
      ? [{ id: "0e000000-0000-4000-8000-000000000891", verein_id: V, name: "Jahresbeitrag Aktive", betrag: 120, rhythmus: "jährlich", aktiv: true }, { id: "0e000000-0000-4000-8000-000000000892", verein_id: V, name: "Jahresbeitrag Kinder", betrag: 60, rhythmus: "jährlich", aktiv: true }]
      : [],
    kassenbuch_eintraege: kassenbuch,
    musik_titel: [],
    dateien: mitVerein
      ? [
          { id: "0e000000-0000-4000-8000-000000000e01", verein_id: V, name: "Satzung.pdf", ordner_pfad: "Dokumente", groesse_bytes: 412345, mime_type: "application/pdf", ist_medien: false, hochgeladen: true, hochgeladen_am: vor(14), storage_path: `verein/${V}/e01/satzung.pdf` },
          { id: "0e000000-0000-4000-8000-000000000e02", verein_id: V, name: "Trainingsplan Herbst.png", ordner_pfad: null, groesse_bytes: 1234567, mime_type: "image/png", ist_medien: true, hochgeladen: true, hochgeladen_am: vor(2), storage_path: `verein/${V}/e02/plan.png` },
        ]
      : [],
    boerse_kategorien: [
      ["kostueme", null, "Kostüme", "👗", 10], ["tanzschuhe", null, "Tanzschuhe", "👠", 20], ["accessoires", null, "Accessoires", "🎀", 30], ["requisiten", null, "Requisiten", "🎭", 40],
      ["trainingsbekleidung", null, "Trainingsbekleidung", "👕", 50], ["sonstiges", null, "Sonstiges", "📦", 90],
    ].map(([schluessel, eltern, name, emoji, sortierung]) => ({ schluessel, eltern, name, emoji, sortierung, aktiv: true })),
    plattform_einstellungen: [{ id: true, spotlights_aktiv: false, spotlights_tarife: ["free", "basic", "verein"], musik_aktiv: einstellungen.musikAn }],
    tarif_preise: [{ tarif: "basic", periode: "monat", preis_cent: 299 }, { tarif: "basic", periode: "jahr", preis_cent: 2990 }, { tarif: "verein", periode: "monat", preis_cent: 2990 }, { tarif: "verein", periode: "jahr", preis_cent: 29900 }],
    altersklassen: [{ id: "0e000000-0000-4000-8000-000000000f01", name: "Kinder" }, { id: "0e000000-0000-4000-8000-000000000f02", name: "Jugend" }, { id: "0e000000-0000-4000-8000-000000000f03", name: "Hauptklasse" }],
    disziplinen: [{ id: "0e000000-0000-4000-8000-000000000f11", name: "Garde" }, { id: "0e000000-0000-4000-8000-000000000f12", name: "Showtanz" }],
    verbaende: [],
    einladungen: [],
    juryraum_mitglieder: [],
  };
  return { rpc, tab };
}

