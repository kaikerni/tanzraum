import type { Ansicht } from "@/lib/admin/ansicht";
import type { VorschauEinstellungen } from "@/lib/supabase/server";
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
const WOCHENTAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const wochentag = (datum: string) => WOCHENTAG[new Date(`${datum}T12:00:00Z`).getUTCDay()];
// Turniere liegen immer am Wochenende: erster Samstag, der mindestens 7 Tage entfernt ist
const SA = (() => {
  const wt = new Date(`${tag(0)}T12:00:00Z`).getUTCDay();
  return 7 + ((6 - wt + 7) % 7);
})();

const PERSONEN = [
  { n: 1, name: "Sabine Keller", rolle: "Trainerin", ak: "Hauptklasse", g: [G1, G2, G3], funktion: "trainer" },
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

// Wie in der Datenbank: offizielle Altersklassen + Disziplinen mit Besetzung und Zuordnung (altersklasse_disziplinen)
const AK = { jugend: "0e000000-0000-4000-8000-000000000f02", junioren: "0e000000-0000-4000-8000-000000000f04", ue15: "0e000000-0000-4000-8000-000000000f05" };
const DISZ = [
  { id: "0e000000-0000-4000-8000-000000000f11", name: "Tanzgarden", besetzung: "gruppe", ak: [AK.jugend, AK.junioren, AK.ue15] },
  { id: "0e000000-0000-4000-8000-000000000f13", name: "Gemischte Garde", besetzung: "gruppe", ak: [AK.ue15] },
  { id: "0e000000-0000-4000-8000-000000000f14", name: "Tanzpaare", besetzung: "paar", ak: [AK.jugend, AK.junioren, AK.ue15] },
  { id: "0e000000-0000-4000-8000-000000000f15", name: "Solist weiblich", besetzung: "solo", ak: [AK.jugend, AK.junioren, AK.ue15] },
  { id: "0e000000-0000-4000-8000-000000000f16", name: "Solist männlich", besetzung: "solo", ak: [AK.jugend, AK.junioren, AK.ue15] },
  { id: "0e000000-0000-4000-8000-000000000f12", name: "Schautanz", besetzung: "gruppe", ak: [AK.jugend, AK.junioren, AK.ue15] },
];

const GRUPPEN = [
  { id: G1, name: "Juniorengarde", ak: "Junioren", akId: AK.junioren, akFrei: null, disziplin: "Tanzgarden", disziplinId: DISZ[0].id, tage: [2, 4], von: "18:00", bis: "19:30", halle: "Sporthalle Nord" },
  { id: G2, name: "Showtanzgruppe", ak: "Ü15", akId: AK.ue15, akFrei: null, disziplin: "Schautanz", disziplinId: DISZ[5].id, tage: [3], von: "19:30", bis: "21:00", halle: "Gymnastikraum" },
  { id: G3, name: "Minis", ak: "Bambinis", akId: null, akFrei: "Bambinis", disziplin: null, disziplinId: null, tage: [5], von: "16:30", bis: "17:30", halle: "Sporthalle Nord" },
];

// wie rolle_familie() in der Datenbank
function rollenFamilie(rolle: string | null | undefined): string {
  const r = (rolle ?? "").toLowerCase();
  if (r.includes("admin") || r.includes("vorsitz")) return "admin";
  if (r.includes("trainer")) return "trainer";
  if (r.includes("betreuer")) return "betreuer";
  if (["eltern", "mutter", "vater"].includes(r)) return "eltern";
  if (r.startsWith("tänzer") || r.startsWith("tanzer")) return "mitglied";
  return "sonstige";
}

const ROLLE: Record<Exclude<Ansicht, "free" | "basic">, { name: string; vorname: string; gruppen: string[] }> = {
  verein_admin: { name: "Vereins-Admin", vorname: "Sophie", gruppen: [] },
  verein_trainer: { name: "Trainerin", vorname: "Lena", gruppen: [G1, G2] },
  verein_betreuer: { name: "Betreuerin", vorname: "Katrin", gruppen: [G1] },
  verein_mitglied: { name: "Tänzerin", vorname: "Emma", gruppen: [G1] },
  verein_eltern: { name: "Eltern", vorname: "Markus", gruppen: [] },
};

export function vorschauDaten(ansicht: Ansicht, userId: string, einstellungen: VorschauEinstellungen): VorschauDaten {
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
    gesperrt: false, logo: null, module_aus: [], news_rollen: ["trainer"],
  };

  // Mitglieder inkl. der Person, als die die Administration gerade schaut
  const mitglieder = [
    ...(mitVerein ? [{ n: 0, name: ichName, rolle: r!.name, ak: ansicht === "verein_mitglied" ? "Jugend" : null, g: r!.gruppen, funktion: istTrainer ? "trainer" : istBetreuer ? "betreuer" : undefined }] : []),
    ...PERSONEN.filter((p) => !(ansicht === "verein_eltern" && p.n === 12)),
  ];
  const ELTERN_VM = ansicht === "verein_eltern" ? ICH : vm(12);
  const ELTERN_NAME = ansicht === "verein_eltern" ? ichName : "Markus Beispiel";
  const KINDER = [vm(6), vm(7)];
  const inGruppe = (p: (typeof mitglieder)[number], gid: string) => (p.g as readonly string[]).includes(gid);
  const funktionVon = (p: (typeof mitglieder)[number]) => ("funktion" in p && p.funktion ? p.funktion : "mitglied");
  const ich = mitglieder.find((p) => p.n === 0);
  // Gruppen, in denen ich Trainer/in bzw. Betreuer/in bin (gruppen_mitglieder.funktion)
  const betreueGruppen = new Set(ich && (istTrainer || istBetreuer) ? ich.g : []);
  // DB ist_relevantes_mitglied(): Admin alle; sonst ich, meine Kinder und – mit Bereich „mitglieder“ – wer eine Gruppe mit mir teilt
  const relevant = (p: (typeof mitglieder)[number]) =>
    istAdmin ||
    p.n === 0 ||
    (ansicht === "verein_eltern" && KINDER.includes(vm(p.n))) ||
    (zugriff.bereiche.includes("mitglieder") && !!ich && ich.g.some((gid) => inGruppe(p, gid)));
  const gruppenGroesse = (gid: string) => mitglieder.filter((p) => inGruppe(p, gid)).length;
  const mitgliedZeile = (p: (typeof mitglieder)[number]) => ({
    vm_id: vm(p.n), user_id: p.n === 0 ? userId : uid(p.n), name: p.name, handle: null, email: istAdmin ? `${p.name.split(" ")[0].toLowerCase()}@example.org` : null,
    rolle_id: null, rolle: p.rolle, aktiv: true, altersklasse: p.ak, seit: "2024-09-01", bereiche: null,
    gruppen: p.g.map((id) => ({ id, name: GRUPPEN.find((g) => g.id === id)!.name, funktion: funktionVon(p) })),
    eltern: p.n === 6 || p.n === 7 ? [{ vm_id: ELTERN_VM, name: ELTERN_NAME }] : [],
    kinder: vm(p.n) === ELTERN_VM ? [{ vm_id: vm(6), name: "Lea Hoffmann" }, { vm_id: vm(7), name: "Paul Beispiel" }] : [],
    ist_ich: p.n === 0, geschlecht: /a$|e$|n$/.test(p.name.split(" ")[0]) ? "w" : "m",
  });

  // Trainings der naechsten Wochen aus den Gruppenzeiten
  // wie training_kalender: Vereinsadmin alle Gruppen, sonst eigene, betreute und die Gruppen der Kinder
  const meineGruppen = new Set(
    istAdmin
      ? GRUPPEN.map((g) => g.id)
      : ansicht === "verein_eltern"
        ? GRUPPEN.filter((g) => mitglieder.some((p) => KINDER.includes(vm(p.n)) && inGruppe(p, g.id))).map((g) => g.id)
        : [...(ich?.g ?? []), ...betreueGruppen],
  );
  const meine = mitglieder.filter((p) => (p.n === 0 && funktionVon(p) === "mitglied" && ansicht !== "verein_eltern") || (ansicht === "verein_eltern" && KINDER.includes(vm(p.n))));
  // Abmeldungen im Beispiel: jeweils die dritte Person einer Gruppe an den naechsten drei Tagen
  const abgemeldet = (gid: string, i: number) => {
    const dritte = mitglieder.filter((p) => inGruppe(p, gid) && funktionVon(p) === "mitglied")[2];
    return i >= 0 && i < 3 ? dritte : undefined;
  };
  const trainingsTage = (von: string, bis: string) => {
    const liste: Json[] = [];
    for (let i = -7; i <= 28; i++) {
      const datum = tag(i);
      if (datum < von || datum > bis) continue;
      const wt = new Date(`${datum}T12:00:00Z`).getUTCDay() || 7;
      for (const g of GRUPPEN) {
        if (!g.tage.includes(wt) || !meineGruppen.has(g.id)) continue;
        const leute = meine.filter((p) => inGruppe(p, g.id));
        const weg = abgemeldet(g.id, i);
        liste.push({
          termin_id: `${g.id.slice(0, -2)}${String(wt).padStart(2, "0")}`, verein_id: V, verein_name: verein.name, gruppe_id: g.id, gruppe_name: g.name,
          datum, von: `${g.von}:00`, bis: `${g.bis}:00`, halle: g.halle, titel: `Training ${g.name}`, wiederholend: true,
          // ist_gruppen_betreuung (Trainer) bzw. _erweitert (Trainer/Betreuer) + Bereich „anwesenheit“
          darf_verwalten: istAdmin || (istTrainer && betreueGruppen.has(g.id)),
          darf_anwesenheit: istAdmin || (betreueGruppen.has(g.id) && zugriff.bereiche.includes("anwesenheit")),
          personen: leute.map((p) => ({
            vm_id: vm(p.n), name: p.name, ich: p.n === 0, abgemeldet: weg?.n === p.n, grund: weg?.n === p.n ? "Krank" : null,
            kategorie: weg?.n === p.n ? "krankheit" : null, hinweis: null,
          })),
          // Trainer/Betreuer der Gruppe: Abmeldungen mit Name, Grund und Zeitpunkt
          abmeldungen:
            istAdmin || betreueGruppen.has(g.id)
              ? weg
                ? [{ vm_id: vm(weg.n), name: weg.name, kategorie: "krankheit", hinweis: null, grund: "Krank", erstellt_am: `${tag(Math.min(i, 0))}T12:32:00Z` }]
                : []
              : null,
        });
      }
    }
    return liste;
  };

  const turniere = [
    { id: "0e000000-0000-4000-8000-000000000301", name: "Landesmeisterschaft Garde", typ: "Turnier", kategorie: null, ort: "Musterhalle", adresse: "Festhalle Musterstadt", ausrichter: "TV Musterstadt",
      ausschreibung_url: null, verband: "Beispielverband", erster_tag: tag(SA), letzter_tag: tag(SA + 1), tage: [{ datum: tag(SA), wochentag: wochentag(tag(SA)), beginn: "10:00:00" }, { datum: tag(SA + 1), wochentag: wochentag(tag(SA + 1)), beginn: "10:00:00" }],
      meldeschluss: tag(SA - 5), beginn_samstag: "10:00", beginn_sonntag: "10:00", verein_id: null, verein_name: null, unsere_starts: mitVerein ? 2 : 0, gemerkt: false },
    { id: "0e000000-0000-4000-8000-000000000302", name: "Herbstpokal", typ: "Turnier", kategorie: null, ort: "Beispielstadt", adresse: "Stadthalle", ausrichter: null,
      ausschreibung_url: null, verband: "Beispielverband", erster_tag: tag(SA + 15), letzter_tag: tag(SA + 15), tage: [{ datum: tag(SA + 15), wochentag: wochentag(tag(SA + 15)), beginn: "11:00:00" }],
      meldeschluss: tag(SA + 4), beginn_samstag: null, beginn_sonntag: "11:00", verein_id: null, verein_name: null, unsere_starts: mitVerein ? 1 : 0, gemerkt: true },
  ];
  const start = (id: string, t: (typeof turniere)[number], g: (typeof GRUPPEN)[number], status: string) => ({
    id, turnier_id: t.id, turnier_name: t.name, turnier_ort: t.ort, erster_tag: t.erster_tag, letzter_tag: t.letzter_tag, turnier_tage: t.tage.map((x) => ({ datum: x.datum, wochentag: x.wochentag })),
    meldeschluss: t.meldeschluss, eigenes_turnier: false, gruppe_id: g.id, gruppe_name: g.name, formation_id: null, formation_name: null, bezeichnung: null, solisten: [], solisten_namen: null,
    disziplin_id: null, disziplin: g.disziplin, altersklasse_id: null, altersklasse: g.ak, tag: t.erster_tag, startnummer: status === "gemeldet" ? 14 : null, status, notiz: null,
    platz: null, punkte: null, ergebnis_notiz: null, dabei: Math.max(0, gruppenGroesse(g.id) - 2), nicht_dabei: 1, unsicher: 1, teilnehmer: gruppenGroesse(g.id), darf_bearbeiten: verwaltetTraining,
  });
  const starts = mitVerein ? [start("0e000000-0000-4000-8000-000000000311", turniere[0], GRUPPEN[0], "gemeldet"), start("0e000000-0000-4000-8000-000000000312", turniere[1], GRUPPEN[1], "geplant")] : [];

  const kt = (n: number, art: string, titel: string, datum: string, extra: Json = {}) => ({
    id: `0e000000-0000-4000-8000-0000000004${String(n).padStart(2, "0")}`, verein_id: V, verein_name: verein.name, art, titel, beschreibung: null, ort: null, datum, bis_datum: null,
    von: null, bis: null, zielgruppe: "verein", gruppen: [], rueckmeldung: false, darf_bearbeiten: istAdmin || zugriff.bereiche.includes("saison"), personen: [], zusagen: 0, absagen: 0, vielleicht: 0, meine_antwort: null, ...extra,
  });
  // Gruppentermine sehen Admin, die Gruppe selbst und Eltern der Kinder in der Gruppe (DB termin_zeile_sichtbar)
  const siehtGruppe = (gid: string) =>
    istAdmin || (!!ich && inGruppe(ich, gid)) || (ansicht === "verein_eltern" && mitglieder.some((p) => KINDER.includes(vm(p.n)) && inGruppe(p, gid)));
  const termine = mitVerein
    ? [
        kt(1, "fest", "Vereinsfest", tag(12), { von: "15:00:00", ort: "Vereinsheim", rueckmeldung: true, zusagen: 8, absagen: 2, vielleicht: 2 }),
        ...(siehtGruppe(G2) ? [kt(2, "auftritt", "Auftritt Stadtfest", tag(5), { von: "17:00:00", ort: "Marktplatz", zielgruppe: "gruppen", gruppen: ["Showtanzgruppe"] })] : []),
        kt(3, "versammlung", "Mitgliederversammlung", tag(30), { von: "19:30:00", ort: "Vereinsheim" }),
      ]
    : [];

  const news = mitVerein
    ? [
        { id: "0e000000-0000-4000-8000-000000000501", verein_id: V, verein_name: verein.name, titel: "Kostümprobe am Samstag", text: "Bitte bringt alle eure Gardeuniform mit – wir prüfen Größen und Knöpfe. Beginn 10 Uhr in der Sporthalle Nord.",
          wichtig: true, erstellt_am: vor(1), geaendert_am: null, autor: "Sabine Keller", gelesen_am: null, ist_empfaenger: true, darf_verwalten: istAdmin, empfaenger: istAdmin ? mitglieder.length : null, gelesen: istAdmin ? mitglieder.length - 4 : null, ziele: [{ art: "verein" }] },
        { id: "0e000000-0000-4000-8000-000000000502", verein_id: V, verein_name: verein.name, titel: "Neue Trainingszeiten Minis", text: "Ab nächster Woche trainieren die Minis freitags von 16:30 bis 17:30 Uhr.",
          wichtig: false, erstellt_am: vor(4), geaendert_am: null, autor: "Thomas Weber", gelesen_am: vor(3), ist_empfaenger: siehtGruppe(G3), darf_verwalten: istAdmin, empfaenger: istAdmin ? gruppenGroesse(G3) + 1 : null, gelesen: istAdmin ? gruppenGroesse(G3) : null, ziele: [{ art: "gruppe", id: G3 }] },
      ].filter((n) => n.ist_empfaenger || istAdmin)
    : [];
  const umfragen = mitVerein
    ? [{ id: "0e000000-0000-4000-8000-000000000511", verein_id: V, verein_name: verein.name, frage: "Welcher Termin passt für die Weihnachtsfeier?", beschreibung: null,
        optionen: ["Fr, 12.12.", "Sa, 13.12.", "Fr, 19.12."], mehrfach: true, anonym: false, endet_am: vor(-6), erstellt_am: vor(2), autor: "Thomas Weber", ist_empfaenger: true,
        darf_verwalten: istAdmin, empfaenger: mitglieder.length, teilnehmer: 9, stimmen: [4, 6, 3], meine: [], namen: null }]
    : [];

  const fahrten = {
    zugang: mitVerein, verein_id: mitVerein ? V : null, verein_name: mitVerein ? verein.name : null, ich: userId, darf_schreiben: mitVerein,
    fahrten: mitVerein
      ? [
          { id: "0e000000-0000-4000-8000-000000000601", art: "angebot", anlass: "Landesmeisterschaft Garde", ziel: "Festhalle Musterstadt", datum: tag(SA), uhrzeit: "07:30", treffpunkt: "Parkplatz Vereinsheim",
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
  // Statistik aus dem Beispielverein (verein_statistik: nur zusammengefasste Zahlen)
  const zaehle = (werte: (string | null)[]) =>
    Object.entries(werte.reduce<Record<string, number>>((m, w) => ({ ...m, [w ?? "Ohne Angabe"]: (m[w ?? "Ohne Angabe"] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const statistik = {
    inhalte: ["mitglieder", "rollen", "altersklassen", "gruppen", "beteiligung", "turniere"],
    mitglieder: { aktiv: mitglieder.length, neu: 1, verlauf: Array.from({ length: 12 }, (_, i) => ({ monat: tag(-30 * (11 - i)).slice(0, 7), gesamt: Math.max(1, mitglieder.length - (i < 4 ? 3 : i < 8 ? 2 : i < 11 ? 1 : 0)) })) },
    rollen: zaehle(mitglieder.map((p) => p.rolle)).map(([rolle, anzahl]) => ({ rolle, anzahl })),
    altersklassen: zaehle(mitglieder.map((p) => p.ak)).map(([altersklasse, anzahl]) => ({ altersklasse, anzahl })),
    gruppen: GRUPPEN.map((g) => ({ gruppe: g.name, anzahl: gruppenGroesse(g.id) })),
    beteiligung: Array.from({ length: 12 }, (_, i) => ({ monat: tag(-30 * (11 - i)).slice(0, 7), prozent: [78, 81, 70, 83, 86, 88, 84, 79, 82, 87, 90, 85][i] })),
    turniere: { starts: 12, podest: 5, siege: 2 },
  };

  const onlineKontakte = [{ id: uid(2), name: "Lena Muster", avatar_url: null }, { id: uid(5), name: "Jonas Wagner", avatar_url: null }];
  const darfKostueme = mitVerein && kostuemeVerwalten;

  // Nachrichten: Vereinschat, Gruppenchat und eine Direktnachricht (erfundene Texte)
  const C_VEREIN = "0e000000-0000-4000-8000-000000000701";
  const C_GRUPPE = "0e000000-0000-4000-8000-000000000702";
  const C_DM = "0e000000-0000-4000-8000-000000000703";
  // Gruppenchat: eigene Gruppe, bei Eltern die Gruppe der Kinder
  const eigeneGruppe = ansicht === "verein_eltern" ? GRUPPEN[2] : (GRUPPEN.find((g) => r?.gruppen.includes(g.id)) ?? GRUPPEN[0]);
  const chatEintrag = (id: string, typ: string, bereich: string, name: string, untertitel: string | null, letzte: string, sender: string, minuten: number, ungelesen: number, partner: string | null = null) => ({
    id, typ, bereich, name, untertitel, partner_id: partner, partner_rolle: null, avatar_url: null, letzte_nachricht: letzte,
    letzte_zeit: new Date(Date.now() - minuten * 60_000).toISOString(), letzter_sender: sender, ungelesen, darf_schreiben: true,
    ist_leitung: istAdmin || istTrainer, nur_leitung_schreibt: false, blockiert: false,
  });
  const chats = [
    ...(mitVerein
      ? [
          chatEintrag(C_GRUPPE, "trainingsgruppe", "gruppe", eigeneGruppe.name, verein.name, "Denkt bitte an die weißen Stiefel am Samstag 👢", "Sabine Keller", 25, 2),
          chatEintrag(C_VEREIN, "verein", "verein", verein.name, "Alle Mitglieder", "Die Hallenzeiten in den Herbstferien stehen im Kalender.", "Thomas Weber", 180, 0),
        ]
      : []),
    ...(tarif === "free" && !mitVerein ? [] : [chatEintrag(C_DM, "dm", mitVerein ? "verein" : "netzwerk", "Jonas Wagner", mitVerein ? verein.name : "TanzRaum Connect", "Klingt gut, bis Donnerstag!", "Jonas Wagner", 60 * 26, 0, uid(5))]),
  ];
  const nachricht = (i: number, gespraech: string, von: number, text: string, minuten: number) => ({
    id: `0e000000-0000-4000-8000-0000000007${gespraech.slice(-1)}${i}`, sender_id: von === 0 ? userId : uid(von), sender_name: von === 0 ? ichName : PERSONEN.find((p) => p.n === von)?.name ?? "Mitglied",
    eigene: von === 0, inhalt: text, bild_pfad: null, umfrage: null, anhang: null, standort: null, sticker: null, reaktionen: [], antwort_auf: null, antwort_sender: null,
    antwort_text: null, antwort_sticker: null, gesendet_am: new Date(Date.now() - minuten * 60_000).toISOString(), geloescht: false, darf_loeschen: von === 0, bearbeitet: false, weitergeleitet: false,
  });
  const verlaeufe: Record<string, ReturnType<typeof nachricht>[]> = {
    [C_GRUPPE]: [
      nachricht(1, C_GRUPPE, 1, "Hallo zusammen! Am Samstag ist Generalprobe für den Auftritt beim Stadtfest.", 60 * 20),
      nachricht(2, C_GRUPPE, 4, "Um wie viel Uhr sollen wir da sein?", 60 * 19),
      nachricht(3, C_GRUPPE, 1, "Treffpunkt 13:30 Uhr an der Sporthalle Nord, Fahrgemeinschaften stehen in TanzRaum.", 60 * 19 - 5),
      nachricht(4, C_GRUPPE, 0, "Super, ich bin dabei 👍", 60 * 18),
      nachricht(5, C_GRUPPE, 1, "Denkt bitte an die weißen Stiefel am Samstag 👢", 25),
    ],
    [C_VEREIN]: [
      nachricht(1, C_VEREIN, 9, "Liebe Mitglieder, die Hallenzeiten in den Herbstferien stehen im Kalender.", 180),
    ],
    [C_DM]: [
      nachricht(1, C_DM, 5, "Hi! Hast du Lust, nächste Woche die neue Showtanz-Choreo zu üben?", 60 * 27),
      nachricht(2, C_DM, 0, "Ja gern – Donnerstag nach dem Training?", 60 * 26 + 10),
      nachricht(3, C_DM, 5, "Klingt gut, bis Donnerstag!", 60 * 26),
    ],
  };
  const chatKopf = (id: string) => {
    const c = chats.find((x) => x.id === id);
    return c
      ? [{ id: c.id, typ: c.typ, name: c.name, untertitel: c.untertitel, partner_id: c.partner_id, avatar_url: null, darf_schreiben: true, ist_leitung: c.ist_leitung, nur_leitung_schreibt: false,
           partner_gelesen_bis: null, partner_rolle: null, ich_habe_blockiert: false, partner_blockiert: false, sperrgrund: null }]
      : [];
  };

  // Ehrungen (nur Vereins-Admin): erkannte und laufende Vorgaenge
  const ehrung = (i: number, person: number, name: string, status: string, faellig: string, org: string | null, typ = "verband") => ({
    id: `0e000000-0000-4000-8000-00000000075${i}`, verein_id: V, vereins_mitglied_id: vm(person), person_name: PERSONEN.find((p) => p.n === person)?.name ?? "Mitglied",
    ehrungsart_id: `0e000000-0000-4000-8000-00000000076${i}`, art: { name, typ, serie: null, stufe: null, kategorie: "Treue", bestellung_erforderlich: typ === "verband", pruefstatus: "geprueft", ehrungs_organisationen: org ? { name: org } : null },
    auto: null, herkunft: "automatisch", auto_ehrungsart_id: null, auto_faellig_am: null, auto_grundlage: null, faellig_am: faellig, faellig_jahr: Number(faellig.slice(0, 4)),
    grundlage: i === 1
      ? { verknuepfung: "eine", faellig_am: faellig, regeln: [{ berechnung: "funktion", jahre: 11, funktion: "Trainerin", punkte_min: null, punkte_gewichte: null, ununterbrochen: false, beginn: `${Number(faellig.slice(0, 4)) - 11}${faellig.slice(4)}`, korrektur_von: null, faellig_am: faellig }] }
      : null,
    grundlage_text: null, korrektur: null, status, begruendung: null, interne_notiz: null, wunsch_datum: null, anlass: status === "eingeplant" ? "Jahreshauptversammlung" : null,
    veranstaltung: null, bestellung_id: null, bestellt_am: status === "bestellt" ? tag(-12) : null, erhalten_am: null, eingeplant_am: status === "eingeplant" ? tag(45) : null,
    verliehen_am: status === "verliehen" ? tag(-120) : null, verliehen_durch: null, verleihung_bemerkung: null, snapshot: null, updated_at: vor(3),
  });
  const ehrungen = istAdmin
    ? [
        ehrung(1, 1, "Verdienstorden in Silber", "moeglich", tag(20), "Bund Deutscher Karneval"),
        ehrung(2, 8, "Vereinsnadel in Gold (25 Jahre)", "vorgemerkt", tag(60), null, "verein"),
        ehrung(3, 9, "Ehrennadel des Landesverbands", "bestellt", tag(-5), "Landesverband Beispielland"),
        ehrung(4, 4, "Jugendehrennadel", "eingeplant", tag(45), "Bund Deutscher Karneval"),
        ehrung(5, 10, "Vereinsnadel in Silber (10 Jahre)", "verliehen", tag(-120), null, "verein"),
      ]
    : [];

  // ---- Dashboard wie dashboard_*() ----
  const heuteWt = new Date(`${tag(0)}T12:00:00Z`).getUTCDay() || 7;
  const trainingHeute = (gid: string) => GRUPPEN.find((g) => g.id === gid)!.tage.includes(heuteWt);
  const sichtbareGruppen = tarif === "free" || !mitVerein ? [] : GRUPPEN.filter((g) => meineGruppen.has(g.id));
  const heuteListe = sichtbareGruppen
    .filter((g) => trainingHeute(g.id))
    .map((g) => ({ titel: `Training ${g.name}`, gruppe_name: g.name, halle: g.halle, von: `${g.von}:00`, bis: `${g.bis}:00`, verein_name: verein.name,
      teilnehmer_gesamt: gruppenGroesse(g.id), teilnehmer_erwartet: gruppenGroesse(g.id) - (abgemeldet(g.id, 0) ? 1 : 0) }));
  const abmeldungenHeute = GRUPPEN.filter((g) => trainingHeute(g.id) && abgemeldet(g.id, 0)).length;
  const hatBereich = (b: string) => zugriff.bereiche.includes(b);
  const relevanteMitglieder = mitglieder.filter(relevant);
  const wocheStart = (() => {
    const d = new Date(`${tag(0)}T12:00:00Z`);
    return tag(-((d.getUTCDay() || 7) - 1));
  })();
  const turnierTage = turniere.flatMap((t) => t.tage.map((x) => ({ t, datum: x.datum })));
  const dieseWoche = turnierTage.filter((x) => x.datum >= wocheStart && x.datum <= tag(-((new Date(`${tag(0)}T12:00:00Z`).getUTCDay() || 7) - 7)));
  const ungelesenGesamt = chats.reduce((s2, c) => s2 + c.ungelesen, 0);
  const dashboardKennzahlen = {
    mitglieder: hatBereich("mitglieder")
      ? { wert: relevanteMitglieder.length, neu_woche: 0, vereine: 1, verlauf: Array.from({ length: 8 }, (_, i) => Math.max(1, relevanteMitglieder.length - (i < 5 ? 2 : i < 7 ? 1 : 0))) }
      : null,
    trainings_heute: tarif === "free"
      ? null
      : { wert: heuteListe.length, erwartet: heuteListe.reduce((s2, h) => s2 + h.teilnehmer_erwartet, 0), verlauf: Array.from({ length: 8 }, () => sichtbareGruppen.reduce((s2, g) => s2 + g.tage.length, 0)) },
    abmeldungen_heute: hatBereich("anwesenheit") ? { wert: abmeldungenHeute, verlauf: [1, 0, 2, 1, 2, 1, 1, abmeldungenHeute] } : null,
    turniere_woche: {
      wert: new Set(dieseWoche.map((x) => x.t.id)).size,
      erstes_name: dieseWoche[0]?.t.name ?? null, erstes_ort: dieseWoche[0]?.t.ort ?? null, erstes_datum: dieseWoche[0]?.datum ?? null,
      verlauf: [0, 1, 0, 0, 1, 0, 0, new Set(dieseWoche.map((x) => x.t.id)).size],
    },
    nachrichten: { ungelesen: ungelesenGesamt, verlauf: [2, 3, 1, 4, 2, 5, 3, ungelesenGesamt] },
    beteiligung: hatBereich("anwesenheit") ? { prozent: 85, vormonat: 82, verlauf: [78, 81, 70, 83, 86, 88, 84, 85] } : null,
  };
  const naechsteTermine = (anzahl: number) => [
    ...sichtbareGruppen.map((g) => ({ typ: "training", titel: g.name, ort: g.halle, datum: null, von: `${g.von}:00`, bis: `${g.bis}:00`, wiederholend: true, wochentag: g.tage[0] })),
    ...termine.filter((t) => t.datum <= tag(30)).map((t) => ({ typ: "termin", titel: t.titel, ort: t.ort, datum: t.datum, von: t.von, bis: t.bis, wiederholend: false, wochentag: null })),
    ...turnierTage.filter((x) => x.datum <= tag(30)).map((x) => ({ typ: "turnier", titel: x.t.name, ort: x.t.ort, datum: x.datum, von: null, bis: null, wiederholend: false, wochentag: null })),
  ]
    .sort((a, b) => Number(b.wiederholend) - Number(a.wiederholend) || String(a.datum ?? "").localeCompare(String(b.datum ?? "")))
    .slice(0, anzahl);
  const altersklassenVerteilung = hatBereich("mitglieder")
    ? Object.entries(relevanteMitglieder.reduce<Record<string, number>>((m, p) => ({ ...m, [p.ak ?? "Ohne Angabe"]: (m[p.ak ?? "Ohne Angabe"] ?? 0) + 1 }), {}))
        .map(([altersklasse, anzahl]) => ({ altersklasse, anzahl }))
        .sort((a, b) => b.anzahl - a.anzahl)
    : [];
  const offeneUeberfaellig = hatBereich("beitraege") ? beitraege.filter((b) => !b.bezahlt && b.faellig < tag(0)).length : 0;
  const radar = [
    ...(offeneUeberfaellig ? [{ typ: "beitrag", dringlichkeit: "hoch", titel: `${offeneUeberfaellig} überfällige${offeneUeberfaellig === 1 ? "r Beitrag" : " Beiträge"}`, untertitel: "seit Fälligkeit unbezahlt" }] : []),
    ...(hatBereich("anwesenheit") && abmeldungenHeute ? [{ typ: "abmeldung", dringlichkeit: "mittel", titel: `${abmeldungenHeute} Abmeldung${abmeldungenHeute === 1 ? "" : "en"} für heute`, untertitel: `(${abmeldungenHeute} Gruppe${abmeldungenHeute === 1 ? "" : "n"} betroffen)` }] : []),
    ...(mitVerein ? [{ typ: "datei", dringlichkeit: "neu", titel: "1 neue Datei im Verein", untertitel: "in den letzten 7 Tagen hochgeladen" }] : []),
  ];
  const meineKinder = ansicht === "verein_eltern"
    ? mitglieder.filter((p) => KINDER.includes(vm(p.n))).map((p) => {
        const heute = GRUPPEN.filter((g) => inGruppe(p, g.id) && trainingHeute(g.id));
        return { kind_vm_id: vm(p.n), name: p.name, verein_name: verein.name, gruppen: GRUPPEN.filter((g) => inGruppe(p, g.id)).map((g) => g.name).join(", ") || null,
          training_heute: heute.map((g) => `${g.von}–${g.bis} ${g.name}`).join(", ") || null, heute_abgemeldet: heute.some((g) => abgemeldet(g.id, 0)?.n === p.n) };
      })
    : [];

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
    // spotlights_fuer_mich(): eingeschaltet und fuer den eigenen Tarif freigegeben
    spotlights_fuer_mich: einstellungen.spotlightsAktiv && einstellungen.spotlightsTarife.includes(tarif),
    spotlight_leiste: [],
    eigene_ungelesene_nachrichten_anzahl: ungelesenGesamt,
    // Dashboard
    dashboard_kennzahlen: dashboardKennzahlen,
    dashboard_heute: heuteListe,
    dashboard_naechste_termine: (b: Json) => naechsteTermine(Number(b.p_anzahl ?? 6)),
    dashboard_naechste_turniere: (b: Json) => turniere.slice(0, Number(b.p_anzahl ?? 4)).map((t) => ({ id: t.id, name: t.name, ort: t.ort, erster_tag: t.erster_tag, anzahl_tage: t.tage.length, neu: false })),
    dashboard_altersklassen: altersklassenVerteilung,
    dashboard_beteiligung_verlauf: (b: Json) =>
      hatBereich("anwesenheit")
        ? Array.from({ length: Number(b.p_wochen ?? 8) }, (_, i) => ({ woche_start: tag(-7 * (Number(b.p_wochen ?? 8) - 1 - i)), prozent: [78, 81, 70, 83, 86, 88, 84, 85][i % 8] }))
        : [],
    dashboard_radar: radar,
    meine_ankuendigungen: [],
    meine_offenen_wichtigen_news: [],
    meine_mitgliedsantraege: [],
    // Verein suchen / Beitritt anfragen (nur Beispielvereine, nichts wird gesendet)
    meine_beitrittsanfragen: [],
    vereine_suchen: [
      { verein_id: "00000000-0000-4000-8000-0000000000b1", name: "TSV Beispielstadt", ort: "Beispielstadt", logo_url: null },
      { verein_id: "00000000-0000-4000-8000-0000000000b2", name: "Tanzsportclub Musterhausen", ort: "Musterhausen", logo_url: null },
    ],
    beitrittsanfragen_liste:
      ansicht === "verein_admin"
        ? [{ id: "00000000-0000-4000-8000-0000000000b3", name: "Mia Beispiel", geschlecht: "weiblich", nachricht: "Ich tanze seit zwei Jahren und würde gern bei euch mitmachen.", erstellt_am: new Date().toISOString() }]
        : [],
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
    online_uebersicht: { gesamt: 128, verein: mitVerein ? 4 : 0, hat_verein: mitVerein, kontakte: onlineKontakte, ich_sichtbar: true },
    online_liste: { gesamt: 128, sichtbar: 2, treffer: 2, personen: onlineKontakte.map((k) => ({ ...k, kontakt: true })), profile_verlinken: true },
    // Verein
    verein_uebersicht: mitVerein
      ? { meine_rolle: r!.name, meine_gruppen: r!.gruppen.map((id) => GRUPPEN.find((g) => g.id === id)!.name), lizenz: true, mitglieder_anzahl: mitglieder.length,
          gruppen: GRUPPEN.map((g) => ({ id: g.id, name: g.name, altersklasse_id: g.akId, altersklasse: g.ak, altersklasse_frei: g.akFrei, disziplin_id: g.disziplinId, disziplin: g.disziplin,
            besetzung: g.disziplinId ? (DISZ.find((d) => d.id === g.disziplinId)?.besetzung ?? null) : null, thema: null,
            anzahl: mitglieder.filter((p) => inGruppe(p, g.id) && funktionVon(p) === "mitglied").length,
            trainer_anzahl: mitglieder.filter((p) => inGruppe(p, g.id) && funktionVon(p) === "trainer").length,
            betreuer_anzahl: mitglieder.filter((p) => inGruppe(p, g.id) && funktionVon(p) === "betreuer").length,
            trainer: mitglieder.filter((p) => inGruppe(p, g.id) && funktionVon(p) === "trainer").map((p) => p.name),
            betreuer: mitglieder.filter((p) => inGruppe(p, g.id) && funktionVon(p) === "betreuer").map((p) => p.name) })),
          ansprechpartner: [{ name: "Thomas Weber", rolle: "Vorsitzender" }, { name: "Sabine Keller", rolle: "Trainerin" }] }
      : null,
    vereinslizenz_status: null,
    // DB mitglieder_liste(): nur mit Bereich „mitglieder“ bzw. Admin; ohne Admin nur relevante Mitglieder
    mitglieder_liste: istAdmin || hatBereich("mitglieder") ? mitglieder.filter(relevant).map(mitgliedZeile) : null,
    mitglieder_auswahl: namenListe,
    // Gruppen-Assistent (nur Vereinsadmin/Trainer)
    is_verein_admin_oder_trainer: istAdmin || istTrainer,
    gruppe_assistent_personen: istAdmin || istTrainer
      ? mitglieder.map((p) => ({ vm_id: vm(p.n), name: p.name, geschlecht: /a$|e$|n$/.test(p.name.split(" ")[0]) ? "weiblich" : "männlich", familie: rollenFamilie(p.rolle) }))
      : null,
    dashboard_meine_kinder: meineKinder,
    // Training & Anwesenheit
    training_kalender: (b: Json) => trainingsTage(b.p_von ?? tag(-7), b.p_bis ?? tag(28)),
    // ist_gruppen_betreuung(): Admin alle Gruppen, Trainer/in die eigenen (Betreuer/innen nicht)
    meine_betreuten_gruppen: GRUPPEN.filter((g) => istAdmin || (istTrainer && betreueGruppen.has(g.id))).map((g) => ({ gruppe_id: g.id, gruppe_name: g.name, verein_id: V, verein_name: verein.name })),
    // Teilnehmer fuer „Abmeldung eintragen“ (nur Trainer der Gruppe bzw. Vereinsadmin)
    training_teilnehmer: (b: Json) => {
      if (!(istAdmin || (istTrainer && betreueGruppen.has(b.p_gruppe_id)))) return [];
      const i = Math.round((Date.parse(`${b.p_datum}T12:00:00Z`) - Date.parse(`${tag(0)}T12:00:00Z`)) / 86400000);
      const weg = abgemeldet(b.p_gruppe_id, i);
      return mitglieder
        .filter((p) => inGruppe(p, b.p_gruppe_id) && funktionVon(p) === "mitglied")
        .map((p) => ({ vm_id: vm(p.n), name: p.name, abgemeldet: p === weg, kategorie: p === weg ? "krankheit" : null, hinweis: null }));
    },
    anwesenheit_liste: (b: Json) => {
      const weg = mitglieder.filter((p) => inGruppe(p, b.p_gruppe_id) && funktionVon(p) === "mitglied")[2];
      return mitglieder
        .filter((p) => inGruppe(p, b.p_gruppe_id) && funktionVon(p) === "mitglied")
        .map((p, j) => ({ vm_id: vm(p.n), name: p.name, abgemeldet: p === weg, grund: p === weg ? "Krank" : null, anwesend: p === weg ? false : j % 4 === 3 ? null : true }));
    },
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
    teamcloud_speicher: (b: Json) =>
      b.p_verein_id
        ? { belegt: 412345 + 1234567, limit: 500 * 1024 * 1024, dateien: 2, darf_hochladen: verwaltetTraining }
        : { belegt: 0, limit: 100 * 1024 * 1024, dateien: 0, darf_hochladen: tarif !== "free" },
    // Statistik & Verwaltung
    verein_statistik: statistik,
    // Standard (bereich_standard_rollen)
    verein_bereich_zugaenge: { fahrgemeinschaften: ["trainer", "betreuer", "mitglied", "eltern", "sonstige"], kostueme: ["betreuer"], finanzen: [], statistiken: [] },
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
    // Chat (Beispielverlaeufe; Schreiben ist in der Vorschau gesperrt)
    chat_liste: chats,
    chat_kopf: (b: Json) => chatKopf(b.p_gespraech_id),
    chat_nachrichten: (b: Json) => verlaeufe[b.p_gespraech_id] ?? [],
    chat_ist_stumm: false,
    chat_suchen: [],
    chat_kontakte: [],
    // Ehrungen
    ehrungen_aktualisieren: 0,
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
    gruppen: mitVerein ? GRUPPEN.map((g) => ({ id: g.id, name: g.name, verein_id: V, altersklasse_id: g.akId, altersklasse_frei: g.akFrei, disziplin_id: g.disziplinId, thema: null })) : [],
    trainingstermine: mitVerein
      ? GRUPPEN.flatMap((g) => g.tage.map((t) => ({ id: `${g.id.slice(0, -2)}${String(t).padStart(2, "0")}`, gruppe_id: g.id, ist_wiederholend: true, wochentag: t, datum: null, von: `${g.von}:00`, bis: `${g.bis}:00`, halle: g.halle, titel: `Training ${g.name}`, gruppen: { name: g.name } })))
      : [],
    termine: [],
    turniere: [],
    rollen: ["Vereins-Admin", "Trainerin", "Betreuerin", "Tänzerin", "Tänzer", "Eltern"].map((name, i) => ({ id: `0e000000-0000-4000-8000-000000000d0${i + 1}`, name, verein_id: V })),
    benachrichtigungen: [],
    kostueme: sichtbareKostueme,
    kostuem_gruppen: mitVerein ? [{ id: KS1, verein_id: V, name: kostuemSatz.name, farbe: kostuemSatz.farbe, beschreibung: "Juniorengarde – Jacke, Rock, Dreispitz" }] : [],
    kostuem_ausgaben: [],
    beitraege: istAdmin ? beitraege : [],
    beitragstypen: istAdmin
      ? [{ id: "0e000000-0000-4000-8000-000000000891", verein_id: V, name: "Jahresbeitrag Aktive", betrag: 120, rhythmus: "jährlich", aktiv: true, automatisch: true, naechste_faelligkeit: `${Number(jahr) + 1}-01-31` }, { id: "0e000000-0000-4000-8000-000000000892", verein_id: V, name: "Jahresbeitrag Kinder", betrag: 60, rhythmus: "jährlich", aktiv: true }]
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
    plattform_einstellungen: [{ id: true, spotlights_aktiv: einstellungen.spotlightsAktiv, spotlights_tarife: einstellungen.spotlightsTarife, musik_aktiv: einstellungen.musikAn }],
    tarif_preise: [{ tarif: "basic", periode: "monat", preis_cent: 299 }, { tarif: "basic", periode: "jahr", preis_cent: 2990 }, { tarif: "verein", periode: "monat", preis_cent: 2990 }, { tarif: "verein", periode: "jahr", preis_cent: 29900 }],
    altersklassen: [{ id: AK.jugend, name: "Jugend" }, { id: AK.junioren, name: "Junioren" }, { id: AK.ue15, name: "Ü15" }],
    disziplinen: DISZ.map((d) => ({ id: d.id, name: d.name, besetzung: d.besetzung })),
    altersklasse_disziplinen: DISZ.flatMap((d) => d.ak.map((a) => ({ altersklasse_id: a, disziplin_id: d.id }))),
    gruppen_mitglieder: mitglieder.flatMap((p) => (p.g as readonly string[]).map((gid) => ({ gruppe_id: gid, vereins_mitglied_id: vm(p.n), funktion: funktionVon(p) }))),
    verbaende: [],
    einladungen: [],
    juryraum_mitglieder: [],
    mitglied_ehrungen: ehrungen,
    ehrungsarten: [],
    verein_ehrungs_organisationen: [],
    ehrungs_organisationen: [],
    ehrungs_bestellungen: [],
    mitglied_zeitraeume: [],
  };
  return { rpc, tab };
}

