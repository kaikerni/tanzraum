"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Alle Rechte prueft die Datenbank (Vereinsmitgliedschaft, Vereinslizenz, Bereich an, Eltern-Sperre).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PFAD = "/dashboard/fahrgemeinschaften";

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=${PFAD}`);
  return supabase;
}

function fehler(e: { code?: string; message?: string }): string {
  if ((e.code === "P0001" || e.code === "42501") && e.message) return e.message;
  return freundlicherFehler(e);
}

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function fahrtSpeichern(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const id = text(fd, "id");
  const uhrzeit = text(fd, "uhrzeit");
  const { error } = await supabase.rpc("fahrgemeinschaft_speichern", {
    p_id: UUID.test(id) ? id : null,
    p_art: text(fd, "art"),
    p_anlass: text(fd, "anlass"),
    p_ziel: text(fd, "ziel"),
    p_datum: text(fd, "datum") || null,
    p_uhrzeit: /^\d{2}:\d{2}$/.test(uhrzeit) ? uhrzeit : null,
    p_treffpunkt: text(fd, "treffpunkt"),
    p_richtung: text(fd, "richtung") || "hin_rueck",
    p_plaetze: Number(fd.get("plaetze") ?? 1),
    p_notiz: text(fd, "notiz"),
  });
  if (error) return { error: fehler(error) };
  revalidatePath(PFAD);
  return { error: null, ok: UUID.test(id) ? "Änderungen gespeichert." : "Fahrt eingetragen – dein Verein sieht sie jetzt." };
}

export async function reagieren(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const fahrtId = text(fd, "fahrt_id");
  if (!UUID.test(fahrtId)) return { error: "Ungültige Fahrt." };
  const art = text(fd, "art");
  const { error } = await supabase.rpc("fahrgemeinschaft_reagieren", {
    p_fahrt_id: fahrtId,
    p_art: art,
    p_personen: Number(fd.get("personen") ?? 1),
    p_text: text(fd, "text"),
  });
  if (error) return { error: fehler(error) };
  revalidatePath(PFAD);
  return {
    error: null,
    ok: art === "mitfahren" ? "Du bist eingetragen." : art === "anbieten" ? "Dein Angebot ist eingetragen." : "Nachricht gesendet.",
  };
}

export async function fahrtStatusSetzen(id: string, status: "offen" | "erledigt" | "abgesagt"): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Fahrt." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("fahrgemeinschaft_status_setzen", { p_id: id, p_status: status });
  if (error) return { error: fehler(error) };
  revalidatePath(PFAD);
  return { error: null, ok: status === "abgesagt" ? "Fahrt abgesagt – alle Eingetragenen wurden benachrichtigt." : "Status gespeichert." };
}

export async function fahrtLoeschen(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Fahrt." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("fahrgemeinschaft_loeschen", { p_id: id });
  if (error) return { error: fehler(error) };
  revalidatePath(PFAD);
  return { error: null, ok: "Fahrt gelöscht." };
}

export async function reaktionEntfernen(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültiger Eintrag." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("fahrgemeinschaft_reaktion_entfernen", { p_antwort_id: id });
  if (error) return { error: fehler(error) };
  revalidatePath(PFAD);
  return { error: null, ok: "Eintrag entfernt." };
}
