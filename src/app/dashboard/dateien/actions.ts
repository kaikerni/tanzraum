"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import { BUCKET } from "@/lib/dateien/getDateien";

// TeamCloud: Rechte und Speichergrenzen prueft die Datenbank (teamcloud_upload_vorbereiten/-abschliessen, RLS).
// Die Datei selbst laedt der Browser direkt in den Speicher – auf den vorher reservierten Pfad.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Eigene Meldungen der Datenbank (Speicher voll, keine Berechtigung ...) direkt anzeigen
function fehlerText(error: { code?: string; message?: string } | null) {
  return error && (error.code === "P0001" || error.code === "42501") && error.message ? error.message : freundlicherFehler(error);
}

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/dateien");
  return supabase;
}

export async function uploadVorbereiten(
  vereinId: string | null,
  name: string,
  groesse: number,
  mime: string,
  ordner: string,
): Promise<{ error: string } | { id: string; pfad: string }> {
  if (vereinId !== null && !UUID.test(vereinId)) return { error: "Verein nicht gefunden." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("teamcloud_upload_vorbereiten", {
    p_verein_id: vereinId,
    p_name: String(name).slice(0, 200),
    p_groesse: Math.floor(Number(groesse) || 0),
    p_mime: String(mime).slice(0, 120),
    p_ordner: String(ordner ?? "").slice(0, 120),
  });
  if (error || !data) return { error: fehlerText(error) };
  // deno-lint-ignore no-explicit-any
  const d = data as any;
  return { id: d.id, pfad: d.pfad };
}

export async function uploadAbschliessen(id: string): Promise<{ error: string | null }> {
  if (!UUID.test(id)) return { error: "Upload nicht gefunden." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("teamcloud_upload_abschliessen", { p_id: id });
  if (error) return { error: fehlerText(error) };
  revalidatePath("/dashboard/dateien");
  return { error: null };
}

export async function dateiLoeschen(formData: FormData) {
  const id = String(formData.get("datei_id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await sitzung();
  const { data: datei } = await supabase.from("dateien").select("id, storage_path").eq("id", id).maybeSingle();
  if (!datei) return;
  // Erst die Datei im Speicher, dann den Eintrag (beides nur mit Loeschrecht laut RLS)
  const { error } = await supabase.storage.from(BUCKET).remove([datei.storage_path]);
  if (error) return;
  await supabase.from("dateien").delete().eq("id", id);
  revalidatePath("/dashboard/dateien");
}
