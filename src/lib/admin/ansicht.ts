import type { Zugriff } from "@/lib/navigation";

// „Ansicht als …“ der TanzRaum-Administration: Navigation und Dashboard so, wie sie ein Tarif bzw. eine
// Vereinsrolle sieht. Nur Darstellung – Rechte vergibt weiterhin ausschliesslich die Datenbank (RLS),
// das Dashboard zeigt dabei erfundene Beispieldaten, keine echten Personen oder Vereine.

export const ANSICHT_COOKIE = "tr_ansicht";

export const ANSICHTEN = ["free", "basic", "verein_admin", "verein_trainer", "verein_betreuer", "verein_mitglied", "verein_eltern"] as const;
export type Ansicht = (typeof ANSICHTEN)[number];

export const ANSICHT_LABEL: Record<Ansicht, string> = {
  free: "FREE",
  basic: "BASIC",
  verein_admin: "VEREIN · Vereinsadmin",
  verein_trainer: "VEREIN · Trainer/in",
  verein_betreuer: "VEREIN · Betreuer/in",
  verein_mitglied: "VEREIN · Tänzer/in",
  verein_eltern: "VEREIN · Eltern",
};

export const ANSICHT_TEXT: Record<Ansicht, string> = {
  free: "Kostenloses Konto ohne Verein",
  basic: "Persönliches BASIC – eigener Kalender, Training, TanzRaum Connect",
  verein_admin: "Verein mit Lizenz – alle Vereinsbereiche und die Vereinsverwaltung",
  verein_trainer: "Mitglieder, Anwesenheit, Saisonplanung, Trainer-Netzwerk",
  verein_betreuer: "Mitglieder, Anwesenheit, Kostüme & Requisiten",
  verein_mitglied: "Tänzerin/Tänzer im Verein – Training, Termine, News, Fahrgemeinschaften",
  verein_eltern: "Elternkonto mit Kind im Verein",
};

export function istAnsicht(wert: unknown): wert is Ansicht {
  return typeof wert === "string" && (ANSICHTEN as readonly string[]).includes(wert);
}

// Bereiche wie meine_bereiche() mit den Standardeinstellungen eines Vereins (bereiche_fuer_rolle, bereich_standard_rollen)
const ROLLEN_BEREICHE: Record<Exclude<Ansicht, "free" | "basic">, string[]> = {
  verein_admin: ["rolle_admin", "mitglieder", "anwesenheit", "beitraege", "material", "saison", "netzwerk", "beitritt", "fahrgemeinschaften", "statistiken"],
  verein_trainer: ["rolle_trainer", "mitglieder", "anwesenheit", "saison", "netzwerk", "fahrgemeinschaften"],
  verein_betreuer: ["rolle_betreuer", "mitglieder", "anwesenheit", "material", "fahrgemeinschaften"],
  verein_mitglied: ["rolle_mitglied", "fahrgemeinschaften"],
  verein_eltern: ["rolle_eltern", "fahrgemeinschaften"],
};

export function ansichtZugriff(ansicht: Ansicht): Zugriff {
  if (ansicht === "free" || ansicht === "basic") return { tarif: ansicht, bereiche: [], istPlattformAdmin: false, moduleAus: [], netzwerk: null };
  return {
    tarif: "verein",
    bereiche: ROLLEN_BEREICHE[ansicht],
    istPlattformAdmin: false,
    moduleAus: [],
    netzwerk: ansicht === "verein_admin" || ansicht === "verein_trainer" ? "trainer" : null,
  };
}
