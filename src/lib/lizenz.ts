// Lizenzarten und Laufzeit-Anzeige (BASIC, VEREIN) – Grundlage: abos (abo_lizenzart) bzw. Vereinslizenz

export const LIZENZART_LABEL: Record<string, string> = {
  PAID_BASIC: "Regulär bezahlt",
  MANUAL_FREE: "Kostenlos manuell freigeschaltet",
  TEAM_FREE: "Kostenlos als TanzRaum Teammitglied",
  VEREIN: "Vereinslizenz",
};

export const ANBIETER_KURZ: Record<string, string> = {
  stripe: "Karte/Lastschrift",
  paypal: "PayPal",
  manuell: "Manuell",
  ueberweisung: "Überweisung",
};

export const BALD_TAGE = 14;

export type LizenzStatus = { stufe: "aktiv" | "bald" | "abgelaufen" | "free"; text: string; tage: number | null };

// Tage bis zum Ablauf (Kalendertage in Berlin); null = unbefristet
export function restTage(ablauf: string | null, jetzt = new Date()): number | null {
  if (!ablauf) return null;
  const tag = (d: Date) => new Date(d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })).getTime();
  return Math.round((tag(new Date(ablauf)) - tag(jetzt)) / 86400000);
}

export function lizenzStatus(tarif: string, ablauf: string | null, jetzt = new Date()): LizenzStatus {
  if (ablauf && new Date(ablauf).getTime() <= jetzt.getTime()) return { stufe: "abgelaufen", text: "🔴 Abgelaufen", tage: 0 };
  if (tarif === "free") return { stufe: "free", text: "FREE", tage: null };
  const tage = restTage(ablauf, jetzt);
  if (tage !== null && tage <= BALD_TAGE) return { stufe: "bald", text: "🟠 Läuft bald ab", tage };
  return { stufe: "aktiv", text: "🟢 Aktiv", tage };
}
