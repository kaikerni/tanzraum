"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Schreibrechte erzwingt die Datenbank: Rollen/Status/Bereiche/Eltern nur Vereinsadmin,
// Gruppenzuordnung Vereinsadmin + Trainer, Trigger pruefen Vereinstrennung und letzten Admin.

const BEREICHE = ["mitglieder", "anwesenheit", "beitraege", "material", "saison", "netzwerk", "beitritt"];

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

// ── Mitglieder-Stammdaten: Import, Anlegen, persoenliche Einladungen ─────────────────────────────────
// Rechte prueft die Datenbank (nur Vereinsadmin des Vereins, Vereinslizenz). Ein Import oder eine Einladung
// erstellt nie ein TanzRaum-Konto – Mitglieder registrieren sich selbst ueber ihren persoenlichen Link.

export type ImportTreffer = { idx: number; treffer: "email" | "mitgliedsnummer" | "name"; zielArt: "register" | "konto"; zielId: string; zielName: string; aenderungen: Record<string, { alt: string | null; neu: string }> };
export type ImportErgebnis = { neu: number; aktualisiert: number; verknuepft: number; unveraendert: number; gruppenNeu: number; gruppenZugeordnet: number };
export type ImportGruppe = { aktion: "vorhanden"; gruppe_id: string } | { aktion: "neu" } | { aktion: "keine" };

export async function importPruefen(vereinId: string, zeilen: Record<string, unknown>[]): Promise<{ error: string | null; treffer?: ImportTreffer[] }> {
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("mitglieder_import_pruefen", { p_verein_id: vereinId, p_zeilen: zeilen });
  if (error) return { error: freundlicherFehler(error) };
  // deno-lint-ignore no-explicit-any
  const treffer = ((data ?? []) as any[]).map((t) => ({
    idx: t.idx,
    treffer: t.treffer,
    zielArt: t.ziel_art,
    zielId: t.ziel_id,
    zielName: t.ziel_name ?? "",
    aenderungen: t.aenderungen ?? {},
  }));
  return { error: null, treffer };
}

export async function importAusfuehren(
  vereinId: string,
  zeilen: Record<string, unknown>[],
  gruppen: Record<string, ImportGruppe> | null,
): Promise<{ error: string | null; ergebnis?: ImportErgebnis }> {
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("mitglieder_importieren", { p_verein_id: vereinId, p_zeilen: zeilen, p_gruppen: gruppen, p_quelle: "import" });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/mitglieder");
  const d = data as Record<string, number>;
  return {
    error: null,
    ergebnis: { neu: d.neu, aktualisiert: d.aktualisiert, verknuepft: d.verknuepft, unveraendert: d.unveraendert, gruppenNeu: d.gruppen_neu, gruppenZugeordnet: d.gruppen_zugeordnet },
  };
}

// „+ Mitglied anlegen“: Vereinsmitglied ohne TanzRaum-Konto (Stammdaten)
export async function mitgliedAnlegen(vereinId: string, _vorher: AktionsErgebnis | null, form: FormData): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const text = (k: string) => String(form.get(k) ?? "").trim();
  const zeile: Record<string, string> = { vorname: text("vorname"), nachname: text("nachname") };
  if (!zeile.vorname || !zeile.nachname) return { error: "Bitte Vor- und Nachnamen angeben." };
  for (const k of ["email", "mitgliedsnummer"]) if (text(k)) zeile[k] = text(k);
  const gruppeId = text("gruppe_id");
  if (zeile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(zeile.email)) return { error: "Bitte eine gültige E-Mail-Adresse eingeben." };
  const { data, error } = await supabase.rpc("mitglieder_importieren", { p_verein_id: vereinId, p_zeilen: [zeile], p_gruppen: null, p_quelle: "manuell" });
  if (error) return { error: freundlicherFehler(error) };
  const id = (data as { id?: string } | null)?.id;
  if (id && gruppeId) await supabase.rpc("mitglied_stammdaten_aendern", { p_mitglied_id: id, p_daten: { gruppe_id: gruppeId } });
  revalidatePath("/dashboard/mitglieder");
  return { error: null, ok: `${zeile.vorname} ${zeile.nachname} wurde als Vereinsmitglied angelegt. Ein TanzRaum-Konto wurde nicht erstellt – lade das Mitglied ein.` };
}

export async function stammdatenAendern(mitgliedId: string, daten: { email?: string; mitgliedsnummer?: string; gruppe_id?: string }): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const { error } = await supabase.rpc("mitglied_stammdaten_aendern", { p_mitglied_id: mitgliedId, p_daten: daten });
  if (error) return { error: freundlicherFehler(error) };
  return fertig("Gespeichert.");
}

export async function stammdatenEntfernen(mitgliedId: string): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const { error } = await supabase.rpc("mitglied_stammdaten_entfernen", { p_mitglied_id: mitgliedId });
  if (error) return { error: freundlicherFehler(error) };
  return fertig("Eintrag entfernt.");
}

export type EinladungsLink = { mitgliedId: string; einladungId: string; token: string; email: string | null };

// Persoenliche Links erzeugen bzw. die offenen liefern (zum Kopieren/Teilen)
export async function einladungsLinks(vereinId: string, mitgliedIds: string[]): Promise<{ error: string | null; links?: EinladungsLink[] }> {
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("mitglied_einladungen_erstellen", { p_verein_id: vereinId, p_mitglied_ids: mitgliedIds.slice(0, 500) });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/mitglieder");
  // deno-lint-ignore no-explicit-any
  return { error: null, links: ((data ?? []) as any[]).map((l) => ({ mitgliedId: l.mitglied_id, einladungId: l.einladung_id, token: l.token, email: l.email })) };
}

// E-Mail-Einladungen: je Mitglied persoenlicher Link, Versand ueber die bestehende Edge Function
export async function einladungenSenden(
  vereinId: string,
  mitgliedIds: string[],
): Promise<{ error: string | null; gesendet: number; ohneEmail: number; fehler: { mitgliedId: string; text: string }[] }> {
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("mitglied_einladungen_erstellen", { p_verein_id: vereinId, p_mitglied_ids: mitgliedIds.slice(0, 500) });
  if (error) return { error: freundlicherFehler(error), gesendet: 0, ohneEmail: 0, fehler: [] };
  let gesendet = 0;
  let ohneEmail = 0;
  const fehler: { mitgliedId: string; text: string }[] = [];
  // deno-lint-ignore no-explicit-any
  for (const l of (data ?? []) as any[]) {
    if (!l.email) {
      ohneEmail++;
      continue;
    }
    const { data: email, error: pruef } = await supabase.rpc("mitglied_einladung_versand", { p_einladung_id: l.einladung_id });
    if (pruef || !email) {
      fehler.push({ mitgliedId: l.mitglied_id, text: freundlicherFehler(pruef) });
      continue;
    }
    const { error: mail } = await supabase.functions.invoke("send-beitritt-einladung", { body: { einladung_id: l.einladung_id, email } });
    if (mail) {
      const status = (mail as { context?: { status?: number } }).context?.status;
      fehler.push({
        mitgliedId: l.mitglied_id,
        text: status === 429 ? "Versandlimit erreicht – bitte später erneut senden." : "Die E-Mail konnte nicht versendet werden.",
      });
      if (status === 429) break;
      continue;
    }
    await supabase.rpc("mitglied_einladung_gesendet", { p_einladung_id: l.einladung_id });
    gesendet++;
  }
  revalidatePath("/dashboard/mitglieder");
  return { error: null, gesendet, ohneEmail, fehler };
}

export async function einladungZurueckziehen(mitgliedId: string): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const { error } = await supabase.rpc("mitglied_einladung_widerrufen", { p_mitglied_id: mitgliedId });
  if (error) return { error: freundlicherFehler(error) };
  return fertig("Einladung zurückgezogen – der bisherige Link funktioniert nicht mehr.");
}
