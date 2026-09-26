"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FELDER = new Set(["nachrichten_erlaubt", "map_erlaubt", "spotlights_nur_kontakte", "push_erlaubt"]);

// deno-lint-ignore no-explicit-any
function fehlerText(error: any, standard: string): string {
  return error?.code === "P0001" || error?.code === "42501" ? error.message : standard;
}

export async function elternCodeErzeugen(): Promise<AktionsErgebnis & { code?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("eltern_code_erzeugen");
  if (error) return { error: fehlerText(error, "Der Code konnte nicht erzeugt werden.") };
  return { error: null, code: String(data) };
}

export async function kindVerknuepfen(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const code = String(formData.get("code") ?? "").trim();
  if (code.replace(/[^A-Za-z0-9]/g, "").length !== 8) return { error: "Der Code hat 8 Zeichen." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("eltern_verknuepfen", { p_code: code });
  if (error) return { error: fehlerText(error, "Die Verknüpfung hat nicht geklappt. Bitte versuche es erneut.") };
  revalidatePath("/dashboard/einstellungen");
  return {
    error: null,
    ok:
      data === "wartet_verein"
        ? "Fast geschafft: Der Verein deines Kindes bestätigt die Verknüpfung noch. Du bekommst eine Benachrichtigung."
        : "Dein Kind ist jetzt mit deinem Konto verknüpft.",
  };
}

export async function kindEinstellungSetzen(kindId: string, feld: string, wert: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(kindId) || !FELDER.has(feld)) return { error: "Ungültige Auswahl." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("kind_einstellung_setzen", { p_kind: kindId, p_feld: feld, p_wert: wert });
  if (error) return { error: fehlerText(error, "Die Einstellung konnte nicht gespeichert werden.") };
  revalidatePath("/dashboard/einstellungen");
  return { error: null, ok: "Gespeichert." };
}

export async function elternVerknuepfungAufheben(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("eltern_verknuepfung_aufheben", { p_id: id });
  if (error) return { error: fehlerText(error, "Die Verknüpfung konnte nicht aufgehoben werden.") };
  revalidatePath("/dashboard/einstellungen");
  return { error: null, ok: "Die Verknüpfung wurde aufgehoben." };
}

export async function elternVerknuepfungEntscheiden(id: string, annehmen: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("eltern_verknuepfung_entscheiden", { p_id: id, p_annehmen: annehmen });
  if (error) return { error: fehlerText(error, "Das hat nicht geklappt.") };
  revalidatePath("/dashboard/mitglieder");
  return { error: null, ok: annehmen ? "Verknüpfung bestätigt." : "Verknüpfung abgelehnt." };
}
