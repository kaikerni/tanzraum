"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { netzwerkSuche, type NetzwerkStatus, type NetzwerkTreffer } from "@/lib/netzwerk/getNetzwerk";

// Wer wen finden und anfragen darf, entscheidet ausschliesslich die Datenbank (netzwerk_modus / netzwerk_sichtbar).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

function neuLaden(userId?: string) {
  revalidatePath("/dashboard/trainer-netzwerk");
  if (userId) revalidatePath(`/dashboard/trainer-netzwerk/${userId}`);
  revalidatePath("/dashboard/nachrichten", "layout");
}

function fehlerText(error: { code?: string; message: string }) {
  return error.code === "P0001" ? error.message : "Das hat leider nicht geklappt. Bitte versuche es erneut.";
}

export async function suchen(suche: string): Promise<NetzwerkTreffer[]> {
  const q = suche.trim().slice(0, 60);
  if (q.length < 2) return [];
  return netzwerkSuche(await sitzung(), q);
}

export type NetzwerkErgebnis = { error: string | null; status?: NetzwerkStatus; gespraechId?: string | null };

export async function anfrageSenden(userId: string): Promise<NetzwerkErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Person." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("netzwerk_anfrage_senden", { p_user_id: userId });
  if (error) return { error: fehlerText(error) };
  neuLaden(userId);
  return { error: null, status: data as NetzwerkStatus };
}

export async function anfrageBeantworten(userId: string, aktion: "annehmen" | "ablehnen" | "blockieren"): Promise<NetzwerkErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Person." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("netzwerk_anfrage_beantworten", { p_user_id: userId, p_aktion: aktion });
  if (error) return { error: fehlerText(error) };
  neuLaden(userId);
  return { error: null, status: aktion === "annehmen" ? "verbunden" : "keine", gespraechId: (data as string | null) ?? null };
}

export async function anfrageZurueckziehen(userId: string): Promise<NetzwerkErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Person." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("netzwerk_anfrage_zurueckziehen", { p_user_id: userId });
  if (error) return { error: fehlerText(error) };
  neuLaden(userId);
  return { error: null, status: "keine" };
}

export async function verbindungTrennen(userId: string): Promise<NetzwerkErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Person." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("netzwerk_verbindung_trennen", { p_user_id: userId });
  if (error) return { error: fehlerText(error) };
  neuLaden(userId);
  return { error: null, status: "keine" };
}

// Chat mit einer verbundenen Person oeffnen (legt den Privatchat bei Bedarf an)
export async function chatOeffnen(userId: string): Promise<NetzwerkErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Person." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("chat_dm_starten", { p_user_id: userId });
  if (error || !data) return { error: error ? fehlerText(error) : "Der Chat konnte nicht geöffnet werden." };
  redirect(`/dashboard/nachrichten/${data}`);
}
