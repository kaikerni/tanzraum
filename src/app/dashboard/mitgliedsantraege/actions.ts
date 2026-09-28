"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import { antragFunktion } from "@/lib/antraege/edge";
import { datenAus, einstellungenAus, inhaltAus } from "@/lib/antraege/vorlage";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Vereinsseite der Mitgliedsantraege. Rechte prueft die Datenbank (darf_antraege: Vereinsadmin oder Bereich
// "Mitgliedsantraege"); alle Aufrufe laufen mit der Sitzung der angemeldeten Person.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

function neuLaden(antragId?: string) {
  revalidatePath("/dashboard/mitgliedsantraege");
  if (antragId) revalidatePath(`/dashboard/mitgliedsantraege/${antragId}`);
  revalidatePath("/dashboard/mitglieder");
}

export async function vorlageSpeichern(vereinId: string, inhaltRoh: unknown, einstellungenRoh: unknown): Promise<AktionsErgebnis> {
  if (!UUID.test(vereinId)) return { error: "Verein nicht gefunden." };
  const inhalt = inhaltAus(inhaltRoh);
  const einstellungen = einstellungenAus(einstellungenRoh);
  if (einstellungen.empfaenger_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(einstellungen.empfaenger_email)) {
    return { error: "Bitte eine gültige E-Mail-Adresse für eingehende Anträge angeben." };
  }
  const supabase = await sitzung();
  const { error } = await supabase
    .from("antrag_vorlagen")
    .upsert({ verein_id: vereinId, inhalt, einstellungen }, { onConflict: "verein_id" });
  if (error) {
    return { error: error.code === "42501" ? "Das Formular dürfen Vereinsadmins und Personen mit dem Bereich „Mitgliedsanträge“ ändern." : freundlicherFehler(error) };
  }
  revalidatePath("/dashboard/mitgliedsantraege/formular");
  return { error: null, ok: "Formular und Einstellungen gespeichert." };
}

export async function personHinzufuegen(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const vereinId = String(formData.get("verein_id") ?? "");
  const suche = String(formData.get("suche") ?? "").trim().slice(0, 200);
  const rolleId = String(formData.get("rolle_id") ?? "");
  const gruppeId = String(formData.get("gruppe_id") ?? "");
  if (!UUID.test(vereinId)) return { error: "Verein nicht gefunden." };
  if (suche.length < 2) return { error: "Bitte E-Mail-Adresse oder @Handle eingeben." };

  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("verein_person_hinzufuegen", {
    p_verein_id: vereinId,
    p_suche: suche,
    p_rolle_id: UUID.test(rolleId) ? rolleId : null,
    p_gruppe_id: UUID.test(gruppeId) ? gruppeId : null,
  });
  if (error) return { error: freundlicherFehler(error) };
  const r = (data ?? {}) as { status?: string; name?: string; antrag_id?: string | null; benachrichtigung?: string };
  neuLaden();
  switch (r.status) {
    case "nicht_gefunden":
      return {
        error:
          "Zu dieser Eingabe gibt es kein TanzRaum-Konto. Die Person muss sich zuerst bei TanzRaum registrieren – schick ihr dafür unter „Mitglied hinzufügen“ eine Einladung per E-Mail.",
      };
    case "schon_mitglied":
      return { error: "Diese Person ist eurem Verein bereits zugeordnet." };
    case "freigabe_angefragt":
      return {
        error: null,
        ok: `${r.name ?? "Die Person"} ist noch einem anderen Verein zugeordnet. Wir haben den bisherigen Verein um Freigabe gebeten – danach wird sie euch automatisch hinzugefügt.`,
      };
    case "hinzugefuegt": {
      if (r.antrag_id && r.benachrichtigung === "app_email") {
        await antragFunktion(supabase, { aktion: "benachrichtigen", antrag_id: r.antrag_id, anlass: "hinzugefuegt" });
      }
      return {
        error: null,
        ok: r.antrag_id
          ? `${r.name ?? "Die Person"} wurde hinzugefügt und ist jetzt „neu“. Sobald der Mitgliedsantrag eingeht, erscheint er hier.`
          : `${r.name ?? "Die Person"} wurde hinzugefügt.`,
      };
    }
    default:
      return { error: "Das hat nicht geklappt. Bitte versuche es erneut." };
  }
}

export async function freigabeEntscheiden(anfrageId: string, freigeben: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(anfrageId)) return { error: "Anfrage nicht gefunden." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("freigabe_entscheiden", { p_anfrage_id: anfrageId, p_freigeben: freigeben });
  if (error) return { error: freundlicherFehler(error) };
  const r = (data ?? {}) as { antrag_id?: string | null; benachrichtigung?: string };
  if (freigeben && r.antrag_id && r.benachrichtigung === "app_email") {
    await antragFunktion(supabase, { aktion: "benachrichtigen", antrag_id: r.antrag_id, anlass: "hinzugefuegt" });
  }
  neuLaden();
  return { error: null, ok: freigeben ? "Freigegeben – die Person wurde dem neuen Verein zugeordnet." : "Freigabe abgelehnt." };
}

export async function antragVerwaltungSpeichern(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const antragId = String(formData.get("antrag_id") ?? "");
  if (!UUID.test(antragId)) return { error: "Antrag nicht gefunden." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("antrag_verwaltung_speichern", {
    p_antrag_id: antragId,
    p_daten: null,
    p_mitgliedsnummer: String(formData.get("mitgliedsnummer") ?? "").slice(0, 40),
    p_familiennummer: String(formData.get("familiennummer") ?? "").slice(0, 40),
    p_notiz: String(formData.get("notiz") ?? "").slice(0, 2000),
    p_papier_vorliegend: formData.get("papier_vorliegend") === "on",
  });
  if (error) return { error: freundlicherFehler(error) };
  neuLaden(antragId);
  return { error: null, ok: "Gespeichert." };
}

// Verein bearbeitet die Angaben im Antrag (ohne Unterschriften)
export async function antragDatenBearbeiten(antragId: string, datenRoh: unknown): Promise<AktionsErgebnis> {
  if (!UUID.test(antragId)) return { error: "Antrag nicht gefunden." };
  const supabase = await sitzung();
  const { data: alt } = await supabase
    .from("beitrittsantraege")
    .select("mitgliedsnummer, familiennummer, notiz_intern, papier_vorliegend")
    .eq("id", antragId)
    .maybeSingle();
  if (!alt) return { error: "Antrag nicht gefunden." };
  const { error } = await supabase.rpc("antrag_verwaltung_speichern", {
    p_antrag_id: antragId,
    p_daten: datenAus(datenRoh),
    p_mitgliedsnummer: alt.mitgliedsnummer ?? "",
    p_familiennummer: alt.familiennummer ?? "",
    p_notiz: alt.notiz_intern ?? "",
    p_papier_vorliegend: alt.papier_vorliegend,
  });
  if (error) return { error: freundlicherFehler(error) };
  neuLaden(antragId);
  return { error: null, ok: "Angaben gespeichert." };
}

export async function antragEntscheiden(antragId: string, annehmen: boolean, grund: string): Promise<AktionsErgebnis> {
  if (!UUID.test(antragId)) return { error: "Antrag nicht gefunden." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("antrag_entscheiden", {
    p_antrag_id: antragId,
    p_annehmen: annehmen,
    p_grund: grund.slice(0, 1000) || null,
  });
  if (error) return { error: freundlicherFehler(error) };
  const r = (data ?? {}) as { benachrichtigung?: string; aufnahme_pdf?: boolean };
  // E-Mail an die Person und/oder Aufnahmedokument ablegen (je nach Vereinseinstellung)
  if (r.benachrichtigung === "app_email" || r.aufnahme_pdf) {
    await antragFunktion(supabase, { aktion: "benachrichtigen", antrag_id: antragId, anlass: "entschieden" });
  }
  neuLaden(antragId);
  return { error: null, ok: annehmen ? "Antrag angenommen." : "Antrag abgelehnt." };
}

export async function papierVermerken(antragId: string, pfad: string): Promise<AktionsErgebnis> {
  if (!UUID.test(antragId)) return { error: "Antrag nicht gefunden." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("antrag_papier_setzen", { p_antrag_id: antragId, p_pfad: pfad });
  if (error) return { error: freundlicherFehler(error) };
  neuLaden(antragId);
  revalidatePath(`/dashboard/mitgliedsantrag/${antragId}`);
  return { error: null, ok: "Datei gespeichert." };
}
