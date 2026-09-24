"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import type { SuchTreffer } from "@/lib/chat/getChat";

// Alle Rechte prueft die Datenbank (RPCs mit SECURITY DEFINER + RLS). Hier nur Weiterleitung und Fehlermeldungen.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

export async function chatEinstellung(gespraechId: string, nurLeitung: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(gespraechId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("chat_einstellung", { p_gespraech_id: gespraechId, p_nur_leitung_schreibt: nurLeitung });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath(`/dashboard/nachrichten/${gespraechId}`);
  return { error: null, ok: nurLeitung ? "Jetzt schreiben nur noch Vorstand, Trainer und Betreuer." : "Jetzt dürfen alle schreiben." };
}

export async function nachrichtLoeschen(nachrichtId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(nachrichtId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data: bild, error } = await supabase.rpc("nachricht_loeschen", { p_nachricht_id: nachrichtId });
  if (error) return { error: freundlicherFehler(error) };
  if (bild) await supabase.storage.from("chat-bilder").remove([bild as string]);
  return { error: null };
}

export async function umfrageAbstimmen(nachrichtId: string, optionen: number[]): Promise<AktionsErgebnis> {
  if (!UUID.test(nachrichtId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("umfrage_abstimmen", { p_nachricht_id: nachrichtId, p_optionen: optionen });
  if (error) return { error: freundlicherFehler(error) };
  return { error: null };
}

export async function nutzerSuchen(suche: string): Promise<SuchTreffer[]> {
  const supabase = await sitzung();
  const { data } = await supabase.rpc("nutzer_suchen", { p_suche: suche.slice(0, 60) });
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((t) => ({
    userId: t.user_id,
    anzeige: t.anzeige,
    handle: t.handle,
    avatarUrl: t.avatar_url,
    status: t.status,
    darfSchreiben: t.darf_schreiben,
  }));
}

export async function chatStummSetzen(gespraechId: string, stumm: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(gespraechId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("chat_stumm_setzen", { p_gespraech_id: gespraechId, p_stumm: stumm });
  if (error) return { error: freundlicherFehler(error) };
  return { error: null };
}

export type KontaktErgebnis = AktionsErgebnis & {
  ergebnis?: "chat" | "anfrage_noetig" | "angefragt" | "eingehend" | "abgelehnt" | "nicht_moeglich";
  ichMinderjaehrig?: boolean;
};

// Privatchat oeffnen, wenn erlaubt; sonst sagt die Datenbank, ob eine Kontaktanfrage noetig ist.
export async function kontaktAufnehmen(userId: string): Promise<KontaktErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("kontakt_aufnehmen", { p_user_id: userId });
  if (error) return { error: freundlicherFehler(error) };
  // deno-lint-ignore no-explicit-any
  const r = ((data ?? []) as any[])[0];
  if (r?.ergebnis === "chat" && r.gespraech_id) redirect(`/dashboard/nachrichten/${r.gespraech_id}`);
  const texte: Record<string, string> = {
    angefragt: "Deine Kontaktanfrage ist noch offen.",
    eingehend: "Diese Person hat dir eine Kontaktanfrage geschickt – du findest sie oben in deiner Chatliste.",
    abgelehnt: "Diese Person hat deine Kontaktanfrage abgelehnt.",
    nicht_moeglich: "Eine Kontaktaufnahme mit dieser Person ist nicht möglich.",
  };
  return { error: r?.ergebnis === "anfrage_noetig" ? null : (texte[r?.ergebnis] ?? "Nicht möglich."), ergebnis: r?.ergebnis, ichMinderjaehrig: r?.ich_minderjaehrig };
}

export async function kontaktanfrageSenden(userId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("kontaktanfrage_senden", { p_user_id: userId });
  if (error) return { error: freundlicherFehler(error) };
  if (data === "direkt" || data === "angenommen") return kontaktAufnehmen(userId);
  revalidatePath("/dashboard/nachrichten", "layout");
  return { error: null, ok: "Kontaktanfrage gesendet. Sobald sie angenommen wird, könnt ihr chatten." };
}

export async function kontaktanfrageBeantworten(userId: string, aktion: "annehmen" | "ablehnen" | "blockieren"): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("kontaktanfrage_beantworten", { p_user_id: userId, p_aktion: aktion });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/nachrichten", "layout");
  if (aktion === "annehmen" && data) redirect(`/dashboard/nachrichten/${data}`);
  return { error: null, ok: aktion === "blockieren" ? "Person blockiert." : "Anfrage abgelehnt." };
}

export async function kontaktanfrageZurueckziehen(userId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("kontaktanfrage_zurueckziehen", { p_user_id: userId });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/nachrichten", "layout");
  return { error: null, ok: "Anfrage zurückgezogen." };
}

export async function nutzerBlockieren(userId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("nutzer_blockieren", { p_user_id: userId });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/nachrichten", "layout");
  return { error: null, ok: "Person blockiert." };
}

export async function nutzerFreigeben(userId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("nutzer_freigeben", { p_user_id: userId });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/nachrichten", "layout");
  return { error: null, ok: "Blockierung aufgehoben." };
}
