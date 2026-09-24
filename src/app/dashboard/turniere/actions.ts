"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import type { StartRueckmeldung } from "@/lib/turniere/getTurniere";

// Alle Schreibzugriffe laufen mit der Sitzung des Nutzers. Rechte (Saisonplanung = Vereinsadmin oder
// Bereich "saison", Rueckmeldung nur fuer sich/eigene Kinder) prueft die Datenbank per RLS/Funktion.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function text(formData: FormData, feld: string): string | null {
  const wert = String(formData.get(feld) ?? "").trim();
  return wert === "" ? null : wert;
}

function uuid(formData: FormData, feld: string): string | null {
  const w = text(formData, feld);
  return w && UUID.test(w) ? w : null;
}

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Datenbankmeldungen aus unseren Pruefungen (P0001) sind fuer Nutzer formuliert, alles andere nicht.
function fehlerText(error: { code?: string; message: string }, standard: string): string {
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "Dafür fehlt dir die Berechtigung.";
  return standard;
}

function neuLaden(turnierId?: string | null) {
  revalidatePath("/dashboard/turniere");
  revalidatePath("/dashboard/saisonplanung");
  revalidatePath("/dashboard/kalender");
  if (turnierId) revalidatePath(`/dashboard/turniere/${turnierId}`);
}

// ---------------------------------------------------------------------------------------------
// Merkliste
// ---------------------------------------------------------------------------------------------
export async function merkenUmschalten(turnierId: string, merken: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(turnierId)) return { error: "Ungültiges Turnier." };
  const { supabase, user } = await sitzung();
  const { error } = merken
    ? await supabase.from("turnier_merkliste").upsert({ user_id: user.id, turnier_id: turnierId }, { ignoreDuplicates: true })
    : await supabase.from("turnier_merkliste").delete().eq("turnier_id", turnierId).eq("user_id", user.id);
  if (error) return { error: "Die Merkliste konnte nicht gespeichert werden." };
  neuLaden(turnierId);
  return { error: null };
}

// ---------------------------------------------------------------------------------------------
// Rueckmeldung (dabei / unsicher / nicht dabei) fuer sich oder das eigene Kind
// ---------------------------------------------------------------------------------------------
export async function startRueckmelden(startId: string, vmId: string, status: StartRueckmeldung | null): Promise<AktionsErgebnis> {
  if (!UUID.test(startId) || !UUID.test(vmId)) return { error: "Ungültige Angaben." };
  const { supabase } = await sitzung();
  const { error } = await supabase.rpc("turnier_start_rueckmelden", { p_start_id: startId, p_vm_id: vmId, p_status: status, p_kommentar: null });
  if (error) return { error: fehlerText(error, "Die Rückmeldung konnte nicht gespeichert werden.") };
  neuLaden();
  return { error: null };
}

// ---------------------------------------------------------------------------------------------
// Starts planen / bearbeiten / loeschen
// ---------------------------------------------------------------------------------------------
export async function startSpeichern(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const startId = uuid(formData, "start_id");
  const turnierId = uuid(formData, "turnier_id");
  const vereinId = uuid(formData, "verein_id");
  const tag = text(formData, "tag");
  const solisten = formData.getAll("solisten").map(String).filter((s) => UUID.test(s));
  const status = text(formData, "status") ?? "geplant";

  if (!startId && (!turnierId || !vereinId)) return { error: "Turnier oder Verein fehlt." };
  if (tag && !DATUM.test(tag)) return { error: "Ungültiger Tag." };
  if (!["geplant", "gemeldet", "abgesagt"].includes(status)) return { error: "Ungültiger Status." };

  const werte = {
    gruppe_id: uuid(formData, "gruppe_id"),
    bezeichnung: text(formData, "bezeichnung"),
    solisten,
    disziplin_id: uuid(formData, "disziplin_id"),
    altersklasse_id: uuid(formData, "altersklasse_id"),
    tag,
    startnummer: text(formData, "startnummer"),
    status,
    notiz: text(formData, "notiz"),
  };
  if (!werte.gruppe_id && !werte.bezeichnung && solisten.length === 0) {
    return { error: "Bitte eine Gruppe wählen oder Solisten/Bezeichnung angeben." };
  }

  const { supabase } = await sitzung();
  const { data, error } = startId
    ? await supabase.from("turnier_starts").update(werte).eq("id", startId).select("turnier_id")
    : await supabase.from("turnier_starts").insert({ ...werte, turnier_id: turnierId, verein_id: vereinId }).select("turnier_id");
  if (error) return { error: fehlerText(error, "Der Start konnte nicht gespeichert werden.") };
  if (!data || data.length === 0) return { error: "Dafür fehlt dir die Berechtigung." };

  neuLaden(data[0].turnier_id);
  return { error: null, ok: startId ? "Start gespeichert." : "Start eingeplant." };
}

export async function ergebnisSpeichern(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const startId = uuid(formData, "start_id");
  if (!startId) return { error: "Start fehlt." };
  const platzText = text(formData, "platz");
  const punkteText = text(formData, "punkte")?.replace(",", ".") ?? null;
  const platz = platzText ? Number(platzText) : null;
  const punkte = punkteText ? Number(punkteText) : null;
  if (platz !== null && (!Number.isInteger(platz) || platz < 1 || platz > 999)) return { error: "Der Platz muss eine Zahl zwischen 1 und 999 sein." };
  if (punkte !== null && (!Number.isFinite(punkte) || punkte < 0 || punkte > 99999)) return { error: "Ungültige Punktzahl." };

  const { supabase } = await sitzung();
  const { data, error } = await supabase
    .from("turnier_starts")
    .update({ platz, punkte, ergebnis_notiz: text(formData, "ergebnis_notiz") })
    .eq("id", startId)
    .select("turnier_id");
  if (error) return { error: fehlerText(error, "Das Ergebnis konnte nicht gespeichert werden.") };
  if (!data || data.length === 0) return { error: "Dafür fehlt dir die Berechtigung." };
  neuLaden(data[0].turnier_id);
  return { error: null, ok: "Ergebnis gespeichert." };
}

export async function startLoeschen(startId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(startId)) return { error: "Ungültiger Start." };
  const { supabase } = await sitzung();
  const { data, error } = await supabase.from("turnier_starts").delete().eq("id", startId).select("turnier_id");
  if (error || !data || data.length === 0) return { error: "Der Start konnte nicht gelöscht werden." };
  neuLaden(data[0].turnier_id);
  return { error: null };
}

// ---------------------------------------------------------------------------------------------
// Vereinseigene Turniere (nur fuer den eigenen Verein sichtbar)
// ---------------------------------------------------------------------------------------------
export async function vereinsturnierSpeichern(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const turnierId = uuid(formData, "turnier_id");
  const vereinId = uuid(formData, "verein_id");
  const name = text(formData, "name");
  const ort = text(formData, "ort");
  const tage = formData
    .getAll("tage")
    .map(String)
    .filter((d) => DATUM.test(d));
  const meldeschluss = text(formData, "meldeschluss");
  const url = text(formData, "ausschreibung_url");

  if (!turnierId && !vereinId) return { error: "Verein fehlt." };
  if (!name) return { error: "Bitte einen Namen angeben." };
  if (!ort) return { error: "Bitte einen Ort angeben." };
  if (tage.length === 0) return { error: "Bitte mindestens einen Tag angeben." };
  if (meldeschluss && !DATUM.test(meldeschluss)) return { error: "Ungültiger Meldeschluss." };
  if (url && !/^https?:\/\//i.test(url)) return { error: "Der Link muss mit http:// oder https:// beginnen." };

  const werte = {
    name,
    ort,
    adresse: text(formData, "adresse"),
    ausrichter: text(formData, "ausrichter"),
    ausschreibung_url: url,
    kategorie: text(formData, "kategorie") ?? "Turnier",
    typ: "Vereinsturnier",
    meldeschluss,
    tage: [...new Set(tage)].sort().map((datum) => ({ datum })),
  };

  const { supabase } = await sitzung();
  const { data, error } = turnierId
    ? await supabase.from("turniere").update(werte).eq("id", turnierId).not("verein_id", "is", null).select("id")
    : await supabase.from("turniere").insert({ ...werte, verein_id: vereinId }).select("id");
  if (error) return { error: fehlerText(error, "Das Turnier konnte nicht gespeichert werden.") };
  if (!data || data.length === 0) return { error: "Dafür fehlt dir die Berechtigung." };

  neuLaden(data[0].id);
  if (!turnierId) redirect(`/dashboard/turniere/${data[0].id}`);
  return { error: null, ok: "Turnier gespeichert." };
}

export async function vereinsturnierLoeschen(turnierId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(turnierId)) return { error: "Ungültiges Turnier." };
  const { supabase } = await sitzung();
  const { data, error } = await supabase.from("turniere").delete().eq("id", turnierId).not("verein_id", "is", null).select("id");
  if (error || !data || data.length === 0) return { error: "Das Turnier konnte nicht gelöscht werden." };
  neuLaden();
  redirect("/dashboard/saisonplanung");
}
