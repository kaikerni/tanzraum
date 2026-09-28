"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import { antragFunktion } from "@/lib/antraege/edge";
import { getAntragFormular } from "@/lib/antraege/getAntraege";
import { datenAus, pruefeAntrag, type Unterschriften, type Verfahren } from "@/lib/antraege/vorlage";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Antragsteller bzw. verknuepfte Eltern: Mitgliedsantrag zwischenspeichern oder einreichen.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const heute = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

// Nur erwartete Unterschriften uebernehmen (PNG als Daten-URL, Name, Zeitpunkt)
function unterschriftenAus(roh: unknown): Unterschriften {
  const aus: Unterschriften = {};
  if (!roh || typeof roh !== "object") return aus;
  for (const rolle of ["mitglied", "sorge1", "sorge2", "kontoinhaber"] as const) {
    const u = (roh as Record<string, unknown>)[rolle];
    if (!u || typeof u !== "object") continue;
    const e = u as Record<string, unknown>;
    const bild = typeof e.bild === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(e.bild) && e.bild.length <= 140_000 ? e.bild : undefined;
    const name = typeof e.name === "string" ? e.name.trim().slice(0, 120) : undefined;
    if (!bild && !name) continue;
    aus[rolle] = { ...(bild ? { bild } : {}), ...(name ? { name } : {}), zeitpunkt: new Date().toISOString() };
  }
  return aus;
}

export async function antragZwischenspeichern(antragId: string, datenRoh: unknown): Promise<AktionsErgebnis> {
  if (!UUID.test(antragId)) return { error: "Antrag nicht gefunden." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("antrag_einreichen", {
    p_antrag_id: antragId,
    p_daten: datenAus(datenRoh),
    p_verfahren: null,
    p_unterschriften: {},
    p_einreichen: false,
  });
  if (error) return { error: freundlicherFehler(error) };
  return { error: null, ok: "Zwischengespeichert." };
}

export async function antragAbsenden(
  antragId: string,
  datenRoh: unknown,
  verfahren: Verfahren | "",
  unterschriftenRoh: unknown,
): Promise<AktionsErgebnis & { versand?: string }> {
  if (!UUID.test(antragId)) return { error: "Antrag nicht gefunden." };
  const supabase = await sitzung();
  const formular = await getAntragFormular(supabase, antragId);
  if (!formular || !formular.fuerMich) return { error: "Antrag nicht gefunden." };
  if (formular.status !== "offen") return { error: "Dieser Antrag wurde bereits eingereicht." };

  const daten = datenAus(datenRoh);
  const unterschriften = verfahren === "papier" ? {} : unterschriftenAus(unterschriftenRoh);
  // Dieselbe Pruefung wie im Formular (Vorlage des Vereins, Pflichtfelder, IBAN, Unterschriften)
  const fehler = pruefeAntrag(formular.inhalt, daten, verfahren, unterschriften, heute(), formular.erlaubteVerfahren);
  if (fehler) return { error: fehler };

  const { error } = await supabase.rpc("antrag_einreichen", {
    p_antrag_id: antragId,
    p_daten: daten,
    p_verfahren: verfahren,
    p_unterschriften: unterschriften,
    p_einreichen: true,
  });
  if (error) return { error: freundlicherFehler(error) };

  // PDF an die Vereinsadresse (+ Kopie). Der Antrag ist auch ohne E-Mail beim Verein in TanzRaum sichtbar.
  const versand = await antragFunktion(supabase, { aktion: "eingereicht", antrag_id: antragId });
  revalidatePath(`/dashboard/mitgliedsantrag/${antragId}`);
  revalidatePath("/dashboard", "layout");
  return {
    error: null,
    ok: "Dein Mitgliedsantrag wurde abgeschickt.",
    versand: versand?.an_verein ? "verein" : versand?.kopie ? "kopie" : "app",
  };
}
