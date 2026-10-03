"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { istGeschlecht } from "@/lib/geschlecht";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

async function speichern(formData: FormData): Promise<string | null> {
  const wert = String(formData.get("geschlecht") ?? "");
  if (!istGeschlecht(wert)) return "Bitte wähle ein Geschlecht aus.";
  const supabase = await createClient();
  const { error } = await supabase.rpc("geschlecht_setzen", { p_geschlecht: wert });
  if (error) return error.code === "P0001" ? error.message : "Die Angabe konnte nicht gespeichert werden.";
  return null;
}

// Einmalige Pflichtabfrage fuer Konten ohne Angabe
export async function geschlechtErfassen(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const fehler = await speichern(formData);
  if (fehler) return { error: fehler };
  redirect("/dashboard");
}

// Aenderung in den Einstellungen
export async function geschlechtAendern(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const fehler = await speichern(formData);
  if (fehler) return { error: fehler };
  revalidatePath("/dashboard", "layout");
  return { error: null, ok: "Gespeichert." };
}
