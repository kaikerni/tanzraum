import type { SupabaseClient } from "@supabase/supabase-js";

// Preise kommen aus der Datenbank (tarif_preise) -- dieselben Werte nutzt abo_anlegen beim Kauf.
export type Periode = "monat" | "jahr";
export type BezahlTarif = "basic" | "verein";
export type Preise = Record<BezahlTarif, Record<Periode, number>>; // Cent

export const TARIF_LABEL: Record<string, string> = { free: "FREE", basic: "BASIC", verein: "VEREIN" };

export const ABO_STATUS_LABEL: Record<string, string> = {
  pending: "Zahlung ausstehend",
  active: "Aktiv",
  trialing: "Testphase",
  past_due: "Zahlung offen",
  cancelled: "Gekündigt",
  expired: "Abgelaufen",
  paused_by_organization: "Pausiert (Vereinslizenz)",
};

export const ANBIETER_LABEL: Record<string, string> = { stripe: "Karte/Lastschrift (Stripe)", paypal: "PayPal", manuell: "Manuell (Support)" };
export const PERIODE_LABEL: Record<string, string> = { monat: "monatlich", jahr: "jährlich", unbefristet: "unbefristet" };

export async function getPreise(supabase: SupabaseClient): Promise<Preise | null> {
  const { data } = await supabase.from("tarif_preise").select("tarif, periode, preis_cent");
  const p: Partial<Record<BezahlTarif, Partial<Record<Periode, number>>>> = {};
  for (const r of (data ?? []) as { tarif: BezahlTarif; periode: Periode; preis_cent: number }[]) {
    (p[r.tarif] ??= {})[r.periode] = r.preis_cent;
  }
  if (!p.basic?.monat || !p.basic?.jahr || !p.verein?.monat || !p.verein?.jahr) return null;
  return p as Preise;
}

export function euro(cent: number): string {
  const e = cent / 100;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: Number.isInteger(e) ? 0 : 2 }).format(e);
}

// Ersparnis Jahr gegenueber 12 x Monat (aus den gespeicherten Preisen berechnet)
export function ersparnis(preise: Preise, tarif: BezahlTarif): number {
  return Math.max(0, preise[tarif].monat * 12 - preise[tarif].jahr);
}

// Wie viele Monatsbeitraege die Ersparnis ausmacht (fuer "2 MONATE GRATIS")
export function gratisMonate(preise: Preise, tarif: BezahlTarif): number {
  return Math.round(ersparnis(preise, tarif) / preise[tarif].monat);
}

export function datum(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }).format(d);
}

export type AboInfo = {
  id: string;
  tarif: string;
  periode: string;
  preis_cent: number;
  anbieter: string;
  status: string;
  laeuft_bis: string | null;
  gekuendigt_zum: string | null;
  pause_grund?: string | null;
  pausiert_am?: string | null;
  pause_verein?: string | null;
};

export type MeinTarifStatus = {
  zugang: {
    persoenlicher_tarif: string;
    persoenlich_aktiv_bis: string | null;
    vereinszugang: boolean;
    verein_id: string | null;
    effektiv: string;
    plattform_admin: boolean;
  };
  verein_name: string | null;
  abos: AboInfo[];
  admin_vereine: { id: string; name: string; lizenz: boolean; lizenz_bis: string | null; abo: AboInfo | null }[];
};
