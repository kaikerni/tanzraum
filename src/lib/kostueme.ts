// Kostueme & Requisiten (Vereinslizenz). Rechte: DB (darf_kostueme_verwalten, RLS auf kostueme/kostuem_gruppen/kostuem_ausgaben).

export type KostuemArt = "kostuem" | "requisit" | "zubehoer";
export type KostuemZustand = "neu" | "gut" | "gebraucht" | "reparatur" | "defekt";

export const ART_LABEL: Record<KostuemArt, string> = { kostuem: "Kostüm", requisit: "Requisit", zubehoer: "Zubehör" };
export const ART_EMOJI: Record<KostuemArt, string> = { kostuem: "👗", requisit: "🎭", zubehoer: "🎀" };
export const ZUSTAND_LABEL: Record<KostuemZustand, string> = {
  neu: "Neu",
  gut: "Gut",
  gebraucht: "Gebraucht",
  reparatur: "Reparatur nötig",
  defekt: "Defekt",
};
export const ZUSTAENDE = Object.keys(ZUSTAND_LABEL) as KostuemZustand[];
export const ARTEN = Object.keys(ART_LABEL) as KostuemArt[];

export type Kostuemsatz = { id: string; name: string; farbe: string | null; beschreibung: string | null };

export type Teil = {
  id: string;
  verein_id: string;
  kostuem_gruppe_id: string | null;
  vereins_mitglied_id: string | null;
  teil: string;
  art: KostuemArt;
  anzahl: number;
  groesse: string | null;
  zustand: KostuemZustand;
  lagerort: string | null;
  vergabe_datum: string | null;
  rueckgabe: string | null;
  notiz: string | null;
};

export const TEIL_SPALTEN =
  "id, verein_id, kostuem_gruppe_id, vereins_mitglied_id, teil, art, anzahl, groesse, zustand, lagerort, vergabe_datum, rueckgabe, notiz";

export function heuteBerlin(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

export function istUeberfaellig(t: Pick<Teil, "vereins_mitglied_id" | "rueckgabe">): boolean {
  return !!t.vereins_mitglied_id && !!t.rueckgabe && t.rueckgabe < heuteBerlin();
}

export function datum(d: string | null): string {
  return d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("de-DE") : "";
}
