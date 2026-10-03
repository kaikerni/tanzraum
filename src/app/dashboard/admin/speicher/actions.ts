"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Speicher & Kontingente speichern – Admin-Recht, Grenzen und Protokoll prueft die Datenbank (admin_speicher_speichern)
export async function speicherSpeichern(
  gesamtMb: number,
  technischMb: number | null,
  kontingente: { schluessel: string; limitMb: number; aktiv: boolean }[],
): Promise<AktionsErgebnis> {
  const ganz = (x: unknown) => (typeof x === "number" && Number.isInteger(x) ? x : NaN);
  const liste = (Array.isArray(kontingente) ? kontingente : [])
    .filter((k) => k && /^[a-z][a-z0-9_]{1,40}$/.test(String(k.schluessel)))
    .map((k) => ({ schluessel: String(k.schluessel), limit_mb: ganz(k.limitMb), aktiv: k.aktiv === true }));
  if (!Number.isInteger(gesamtMb) || gesamtMb < 1) return { error: "Bitte einen gültigen Gesamtspeicher in MB angeben." };
  if (technischMb !== null && (!Number.isInteger(technischMb) || technischMb < 1)) return { error: "Bitte einen gültigen technischen Speicher in MB angeben (oder leer lassen)." };
  if (liste.some((k) => Number.isNaN(k.limit_mb) || k.limit_mb < 0)) return { error: "Bitte für jeden Bereich eine ganze Zahl in MB angeben." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_speicher_speichern", { p_gesamt_mb: gesamtMb, p_technisch_mb: technischMb, p_kontingente: liste });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/admin/speicher");
  const n = (data as { aenderungen?: number } | null)?.aenderungen ?? 0;
  return { error: null, ok: n === 0 ? "Keine Änderungen." : `Gespeichert (${n} ${n === 1 ? "Änderung" : "Änderungen"}). Gilt sofort – ohne neuen Build.` };
}
