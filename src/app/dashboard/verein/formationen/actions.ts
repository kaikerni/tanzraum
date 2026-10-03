"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Rechte und Plausibilitaet (Verein, Altersklasse/Disziplin, Besetzungsgroesse) prueft die Datenbank (RLS + Trigger).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PFAD = "/dashboard/verein/formationen";

function id(fd: FormData, feld: string): string | null {
  const w = String(fd.get(feld) ?? "");
  return UUID.test(w) ? w : null;
}
function text(fd: FormData, feld: string, max: number): string | null {
  const w = String(fd.get(feld) ?? "").trim();
  return w ? w.slice(0, max) : null;
}
function fehler(e: { code?: string; message?: string }): string {
  if (e.code === "P0001" && e.message) return e.message;
  if (e.code === "42501") return "Dafür fehlt dir die Berechtigung (Vereinsadmin oder Trainer).";
  return freundlicherFehler(e);
}

export async function formationSpeichern(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const vereinId = id(fd, "verein_id");
  const formationId = id(fd, "id");
  const disziplinId = id(fd, "disziplin_id");
  const name = text(fd, "name", 120);
  if (!vereinId || !disziplinId || !name) return { error: "Bitte Name und Disziplin angeben." };
  const werte = {
    name,
    disziplin_id: disziplinId,
    altersklasse_id: id(fd, "altersklasse_id"),
    gruppe_id: id(fd, "gruppe_id"),
    thema: text(fd, "thema", 300),
    aktiv: fd.has("aktiv_feld") ? fd.get("aktiv") === "ja" : true,
  };
  const supabase = await createClient();
  const { data, error } = formationId
    ? await supabase.from("formationen").update(werte).eq("id", formationId).eq("verein_id", vereinId).select("id")
    : await supabase.from("formationen").insert({ ...werte, verein_id: vereinId }).select("id");
  if (error) return { error: fehler(error) };
  if (!data?.length) return { error: "Dafür fehlt dir die Berechtigung (Vereinsadmin oder Trainer)." };
  revalidatePath(PFAD);
  return { error: null, ok: formationId ? "Gespeichert." : "Formation angelegt." };
}

export async function formationLoeschen(formationId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(formationId)) return { error: "Ungültige Formation." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("formationen").delete().eq("id", formationId).select("id");
  if (error) return { error: fehler(error) };
  if (!data?.length) return { error: "Dafür fehlt dir die Berechtigung." };
  revalidatePath(PFAD);
  return { error: null, ok: "Formation gelöscht. Die Mitglieder bleiben unverändert im Verein." };
}

export async function formationMitgliedHinzufuegen(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const formationId = id(fd, "formation_id");
  const vmId = id(fd, "vm_id");
  if (!formationId || !vmId) return { error: "Bitte ein Mitglied auswählen." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("formation_mitglieder")
    .insert({ formation_id: formationId, vereins_mitglied_id: vmId, auftrittsname: text(fd, "auftrittsname", 80) });
  if (error) return { error: error.code === "23505" ? "Diese Person gehört schon zur Formation." : fehler(error) };
  revalidatePath(PFAD);
  return { error: null, ok: "Hinzugefügt." };
}

export async function formationMitgliedEntfernen(formationId: string, vmId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(formationId) || !UUID.test(vmId)) return { error: "Ungültige Auswahl." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("formation_mitglieder")
    .delete()
    .eq("formation_id", formationId)
    .eq("vereins_mitglied_id", vmId)
    .select("formation_id");
  if (error) return { error: fehler(error) };
  if (!data?.length) return { error: "Dafür fehlt dir die Berechtigung." };
  revalidatePath(PFAD);
  return { error: null, ok: "Entfernt." };
}
