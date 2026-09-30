import type { DashboardAnsichtProps } from "@/components/dashboard/DashboardAnsicht";
import type { Zugriff } from "@/lib/navigation";
import { ansichtZugriff, type Ansicht } from "@/lib/admin/ansicht";

// Beispieldaten fuer die Oberflaechen-Vorschau der TanzRaum-Administration.
// Ausschliesslich erfundene Werte – keine echten Personen, Vereine oder Nutzerdaten.

export type VorschauAnsicht = "free" | "basic" | "verein" | "admin" | "juryraum";

export const VORSCHAU_LABEL: Record<VorschauAnsicht, string> = {
  free: "FREE",
  basic: "BASIC",
  verein: "VEREIN",
  admin: "TANZRAUM-ADMIN",
  juryraum: "JURYRAUM",
};

const heute = new Date();
const tag = (plus: number) => new Date(heute.getTime() + plus * 86_400_000).toISOString().slice(0, 10);
const verlauf = [3, 4, 4, 5, 6, 6, 7, 8];

const BEISPIELVEREIN = { vereinId: "00000000-0000-4000-8000-000000000001", vereinName: "TSC Beispielstadt", vereinTarif: "verein", vereinGesperrt: false, istAdmin: true };

function basis(vorname: string): DashboardAnsichtProps["daten"] {
  return {
    userId: "00000000-0000-4000-8000-00000000000a",
    vorname,
    nachname: "Beispiel",
    handle: null,
    avatarUrl: null,
    gesperrt: false,
    istPlattformAdmin: false,
    persoenlicherTarif: "free",
    tarifAktivBis: null,
    vereine: [],
    istJuryMitglied: false,
  };
}

const TURNIERE = [
  { id: "t1", name: "Landesmeisterschaft Garde", ort: "Musterhalle", ersterTag: tag(9), anzahlTage: 2, neu: true },
  { id: "t2", name: "Frühjahrsturnier", ort: "Beispielstadt", ersterTag: tag(23), anzahlTage: 1, neu: false },
];
const NACHRICHTEN = [
  { id: "n1", inhalt: "Kostümprobe am Samstag um 10 Uhr 💃", gesendetAm: new Date().toISOString(), senderName: "Trainerteam", ungelesen: true },
  { id: "n2", inhalt: "Fahrgemeinschaft zum Turnier steht!", gesendetAm: new Date(Date.now() - 3_600_000).toISOString(), senderName: "Lea", ungelesen: false },
];

export function vorschau(ansicht: Exclude<VorschauAnsicht, "juryraum">): { props: DashboardAnsichtProps; zugriff: Zugriff } {
  const leer = {
    kennzahlen: null,
    termine: [],
    turniere: TURNIERE,
    altersklassen: [],
    heute: [],
    verlauf: [],
    radar: [],
    nachrichten: NACHRICHTEN,
    kinder: [],
    wochen: 8,
  };
  if (ansicht === "free" || ansicht === "basic") {
    const zugriff: Zugriff = { tarif: ansicht, bereiche: [], istPlattformAdmin: false, moduleAus: [] };
    const daten = { ...basis(ansicht === "free" ? "Mia" : "Jonas"), persoenlicherTarif: ansicht };
    return {
      zugriff,
      props: {
        ...leer,
        daten,
        zugriff,
        termine:
          ansicht === "basic"
            ? [{ typ: "privat", titel: "Eigenes Training", ort: "Tanzstudio", datum: tag(1), von: "18:00", bis: "19:30", wiederholend: false, wochentag: null }]
            : [],
        online: { gesamt: 128, verein: 0, hatVerein: false, kontakte: [{ id: "k1", name: "Lea B.", avatarUrl: null }], ichSichtbar: true },
      },
    };
  }
  const istAdmin = ansicht === "admin";
  const zugriff: Zugriff = istAdmin
    ? { tarif: "verein", bereiche: [], istPlattformAdmin: true, netzwerk: "trainer", moduleAus: [] }
    : { tarif: "verein", bereiche: ["rolle_admin", "mitglieder", "anwesenheit", "saison", "beitritt", "beitraege", "material", "fahrgemeinschaften", "statistiken"], istPlattformAdmin: false, moduleAus: [], netzwerk: "trainer" };
  const daten = istAdmin
    ? { ...basis("Admin"), istPlattformAdmin: true }
    : { ...basis("Sophie"), persoenlicherTarif: "free", vereine: [{ ...BEISPIELVEREIN, rolleName: "Vereinsadmin" }] };
  return {
    zugriff,
    props: {
      ...leer,
      daten,
      zugriff,
      kennzahlen: {
        mitglieder: { wert: 86, neuWoche: 3, vereine: 1, verlauf },
        trainingsHeute: { wert: 2, erwartet: 24, verlauf: [1, 2, 2, 1, 2, 3, 2, 2] },
        abmeldungenHeute: { wert: 3, verlauf: [1, 0, 2, 1, 3, 2, 1, 3] },
        turniereWoche: { wert: 1, erstesName: TURNIERE[0].name, erstesOrt: TURNIERE[0].ort, erstesDatum: TURNIERE[0].ersterTag, verlauf: [0, 1, 0, 0, 1, 0, 1, 1] },
        nachrichten: { ungelesen: 4, verlauf: [2, 3, 1, 4, 2, 5, 3, 4] },
        beteiligung: { prozent: 84, vormonat: 79, verlauf: [72, 75, 78, 80, 79, 82, 83, 84] },
      },
      termine: [
        { typ: "training", titel: "Training Juniorengarde", ort: "Sporthalle Nord", datum: tag(0), von: "18:00", bis: "19:30", wiederholend: true, wochentag: null },
        { typ: "termin", titel: "Sommerfest", ort: "Vereinsheim", datum: tag(12), von: "15:00", bis: null, wiederholend: false, wochentag: null },
        { typ: "turnier", titel: TURNIERE[0].name, ort: TURNIERE[0].ort, datum: TURNIERE[0].ersterTag, von: "09:00", bis: null, wiederholend: false, wochentag: null },
      ],
      altersklassen: [
        { altersklasse: "Kinder", anzahl: 24 },
        { altersklasse: "Jugend", anzahl: 31 },
        { altersklasse: "Hauptklasse", anzahl: 22 },
        { altersklasse: "Ü30", anzahl: 9 },
      ],
      heute: [
        { titel: "Training Juniorengarde", gruppeName: "Juniorengarde", halle: "Sporthalle Nord", von: "18:00", bis: "19:30", vereinName: "TSC Beispielstadt", teilnehmerErwartet: 12, teilnehmerGesamt: 14 },
        { titel: "Showtanz", gruppeName: "Showtanzgruppe", halle: "Gymnastikraum", von: "19:30", bis: "21:00", vereinName: "TSC Beispielstadt", teilnehmerErwartet: 12, teilnehmerGesamt: 15 },
      ],
      verlauf: Array.from({ length: 8 }, (_, i) => ({ wocheStart: tag(-7 * (7 - i)), prozent: 72 + i * 1.7 })),
      radar: [
        { typ: "abmeldung", dringlichkeit: "mittel", titel: "3 Abmeldungen für heute", untertitel: "Training Juniorengarde" },
        { typ: "turnier", dringlichkeit: "info", titel: "Meldeschluss in 5 Tagen", untertitel: TURNIERE[0].name },
      ],
      online: istAdmin
        ? { gesamt: 128, verein: 0, hatVerein: false, kontakte: [], ichSichtbar: false, aktiv24h: 412 }
        : { gesamt: 128, verein: 12, hatVerein: true, kontakte: [{ id: "k1", name: "Lea B.", avatarUrl: null }, { id: "k2", name: "Tim K.", avatarUrl: null }], ichSichtbar: true },
    },
  };
}

export const JURY_BEISPIEL = [
  { turnier: "Landesmeisterschaft Garde", ort: "Musterhalle", datum: tag(9), rolle: "Wertungsrichterin", status: "zugesagt" },
  { turnier: "Frühjahrsturnier", ort: "Beispielstadt", datum: tag(23), rolle: "Protokoll", status: "angefragt" },
  { turnier: "Herbstpokal", ort: "Nachbarort", datum: tag(61), rolle: "Wertungsrichterin", status: "offen" },
];

// „Ansicht als …“: Dashboard-Beispieldaten je Tarif bzw. Vereinsrolle (Navigation: ansichtZugriff)
export function vorschauAls(ansicht: Ansicht): DashboardAnsichtProps {
  if (ansicht === "free" || ansicht === "basic") return { ...vorschau(ansicht).props, zugriff: ansichtZugriff(ansicht) };
  const v = vorschau("verein").props;
  const zugriff = ansichtZugriff(ansicht);
  const rolle = { verein_admin: "Vereinsadmin", verein_trainer: "Trainerin", verein_betreuer: "Betreuerin", verein_mitglied: "Tänzerin", verein_eltern: "Elternteil" }[ansicht];
  const vorname = { verein_admin: "Sophie", verein_trainer: "Lena", verein_betreuer: "Katrin", verein_mitglied: "Emma", verein_eltern: "Markus" }[ansicht];
  const daten = { ...v.daten, vorname, vereine: [{ ...BEISPIELVEREIN, istAdmin: ansicht === "verein_admin", rolleName: rolle }] };
  if (ansicht === "verein_admin") return { ...v, daten, zugriff };
  if (ansicht === "verein_trainer" || ansicht === "verein_betreuer") {
    return {
      ...v,
      daten,
      zugriff,
      kennzahlen: v.kennzahlen && { ...v.kennzahlen, mitglieder: v.kennzahlen.mitglieder && { ...v.kennzahlen.mitglieder, wert: 29, neuWoche: 1 } },
      radar: [v.radar[0]],
    };
  }
  // Taenzer/in und Eltern: eigene Termine, keine Vereinskennzahlen
  const kennzahlen = v.kennzahlen && {
    mitglieder: null,
    trainingsHeute: v.kennzahlen.trainingsHeute,
    abmeldungenHeute: null,
    turniereWoche: v.kennzahlen.turniereWoche,
    nachrichten: { ungelesen: 2, verlauf: [1, 0, 2, 1, 1, 3, 0, 2] },
    beteiligung: null,
  };
  return {
    ...v,
    daten,
    zugriff,
    kennzahlen: kennzahlen as DashboardAnsichtProps["kennzahlen"],
    altersklassen: [],
    verlauf: [],
    heute: [v.heute[0]],
    radar: [{ typ: "turnier", dringlichkeit: "info", titel: "Turnier in 9 Tagen", untertitel: TURNIERE[0].name }],
    kinder:
      ansicht === "verein_eltern"
        ? [
            { kindVmId: "00000000-0000-4000-8000-0000000000c1", name: "Mila Beispiel", vereinName: BEISPIELVEREIN.vereinName, gruppen: "Juniorengarde", trainingHeute: "18:00", heuteAbgemeldet: false },
            { kindVmId: "00000000-0000-4000-8000-0000000000c2", name: "Paul Beispiel", vereinName: BEISPIELVEREIN.vereinName, gruppen: "Minis", trainingHeute: null, heuteAbgemeldet: false },
          ]
        : [],
  };
}
