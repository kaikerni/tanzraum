"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Schreibrechte erzwingt die Datenbank: Rollen/Status/Bereiche/Eltern nur Vereinsadmin,
// Gruppenzuordnung Vereinsadmin + Trainer, Trigger pruefen Vereinstrennung und letzten Admin.

const BEREICHE = ["mitglieder", "anwesenheit", "beitraege", "material", "trainingsplan", "saison", "netzwerk", "beitritt"];

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

function fertig(ok: string): AktionsErgebnis {
  revalidatePath("/dashboard/mitglieder");
  return { error: null, ok };
}

function keineZeile(): AktionsErgebnis {
  return { error: "Dafür fehlt dir die Berechtigung." };
}

export async function rolleAendern(vmId: string, rolleId: string): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const { data, error } = await supabase.from("vereins_mitglieder").update({ rolle_id: rolleId }).eq("id", vmId).select("id");
  if (error) return { error: freundlicherFehler(error) };
  if (!data?.length) return keineZeile();
  return fertig("Rolle geändert.");
}

export async function aktivSetzen(vmId: string, aktiv: boolean): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const { data, error } = await supabase.from("vereins_mitglieder").update({ aktiv }).eq("id", vmId).select("id");
  if (error) return { error: freundlicherFehler(error) };
  if (!data?.length) return keineZeile();
  return fertig(aktiv ? "Mitglied wieder aktiviert." : "Mitglied deaktiviert.");
}

export async function bereicheSetzen(vmId: string, bereiche: string[]): Promise<AktionsErgebnis> {
  const gueltig = bereiche.filter((b) => BEREICHE.includes(b));
  const supabase = await sitzung();
  const { data, error } = await supabase
    .from("vereins_mitglieder")
    .update({ bereiche: gueltig.length > 0 ? gueltig : null })
    .eq("id", vmId)
    .select("id");
  if (error) return { error: freundlicherFehler(error) };
  if (!data?.length) return keineZeile();
  return fertig(gueltig.length > 0 ? "Individuelle Bereiche gespeichert." : "Standardrechte der Rolle gelten wieder.");
}

export async function gruppeZuordnen(vmId: string, gruppeId: string, funktion: string): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const { error } = await supabase.from("gruppen_mitglieder").insert({
    vereins_mitglied_id: vmId,
    gruppe_id: gruppeId,
    funktion: funktion === "trainer" || funktion === "betreuer" ? funktion : "mitglied",
  });
  if (error) return { error: freundlicherFehler(error) };
  return fertig("Zur Gruppe hinzugefügt.");
}

export async function gruppeEntfernen(vmId: string, gruppeId: string): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const { data, error } = await supabase
    .from("gruppen_mitglieder")
    .delete()
    .eq("vereins_mitglied_id", vmId)
    .eq("gruppe_id", gruppeId)
    .select("id");
  if (error) return { error: freundlicherFehler(error) };
  if (!data?.length) return keineZeile();
  return fertig("Aus der Gruppe entfernt.");
}

export async function elternKindVerknuepfen(vereinId: string, elternVmId: string, kindVmId: string): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const { error } = await supabase
    .from("eltern_kind_zuordnung")
    .insert({ verein_id: vereinId, eltern_vm_id: elternVmId, kind_vm_id: kindVmId });
  if (error) return { error: freundlicherFehler(error) };
  return fertig("Eltern-Kind-Verknüpfung gespeichert.");
}

export async function elternKindLoesen(elternVmId: string, kindVmId: string): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const { data, error } = await supabase
    .from("eltern_kind_zuordnung")
    .delete()
    .eq("eltern_vm_id", elternVmId)
    .eq("kind_vm_id", kindVmId)
    .select("id");
  if (error) return { error: freundlicherFehler(error) };
  if (!data?.length) return keineZeile();
  return fertig("Verknüpfung gelöst.");
}

export async function mitgliedEntfernen(vmId: string): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const { data, error } = await supabase.from("vereins_mitglieder").delete().eq("id", vmId).select("id");
  if (error) return { error: freundlicherFehler(error) };
  if (!data?.length) return keineZeile();
  return fertig("Mitglied aus dem Verein entfernt.");
}
