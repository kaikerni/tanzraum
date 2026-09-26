"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Vereinsfunktionen (Vorstand, Haestraeger, Musiker ...) vergeben keine Rechte; die Rechte bleiben an den Systemrollen.
// Pflege nur mit Bereich "Mitglieder" (Datenbank prueft per RLS).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PFAD = "/dashboard/verein/funktionen";
const KEIN_RECHT = "Dafür fehlt dir die Berechtigung (Mitgliederverwaltung).";

function fehler(e: { code?: string; message?: string }): string {
  if (e.code === "23505") return "Diese Funktion gibt es schon.";
  if (e.code === "P0001" && e.message) return e.message;
  if (e.code === "42501") return KEIN_RECHT;
  return freundlicherFehler(e);
}

export async function funktionAnlegen(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const vereinId = String(fd.get("verein_id") ?? "");
  const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  if (!UUID.test(vereinId) || !name) return { error: "Bitte einen Namen angeben." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("verein_funktionen").insert({ verein_id: vereinId, name }).select("id");
  if (error) return { error: fehler(error) };
  if (!data?.length) return { error: KEIN_RECHT };
  revalidatePath(PFAD);
  return { error: null, ok: "Funktion angelegt." };
}

export async function funktionLoeschen(funktionId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(funktionId)) return { error: "Ungültige Funktion." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("verein_funktionen").delete().eq("id", funktionId).select("id");
  if (error) return { error: fehler(error) };
  if (!data?.length) return { error: KEIN_RECHT };
  revalidatePath(PFAD);
  return { error: null, ok: "Funktion gelöscht." };
}

export async function funktionZuordnen(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const funktionId = String(fd.get("funktion_id") ?? "");
  const vmId = String(fd.get("vm_id") ?? "");
  if (!UUID.test(funktionId) || !UUID.test(vmId)) return { error: "Bitte ein Mitglied auswählen." };
  const supabase = await createClient();
  const { error } = await supabase.from("mitglied_funktionen").insert({ funktion_id: funktionId, vereins_mitglied_id: vmId });
  if (error) return { error: error.code === "23505" ? "Diese Person hat die Funktion schon." : fehler(error) };
  revalidatePath(PFAD);
  return { error: null, ok: "Zugeordnet." };
}

export async function funktionEntfernen(funktionId: string, vmId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(funktionId) || !UUID.test(vmId)) return { error: "Ungültige Auswahl." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mitglied_funktionen")
    .delete()
    .eq("funktion_id", funktionId)
    .eq("vereins_mitglied_id", vmId)
    .select("funktion_id");
  if (error) return { error: fehler(error) };
  if (!data?.length) return { error: KEIN_RECHT };
  revalidatePath(PFAD);
  return { error: null, ok: "Entfernt." };
}
