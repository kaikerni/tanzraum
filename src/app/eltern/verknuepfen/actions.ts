"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Elternkonto mit dem Kinderkonto verknuepfen (einmaliger Link aus der Bestaetigungs-Mail; die Datenbank prueft
// Link, Volljaehrigkeit und dass die Anmelde-Adresse der Adresse aus der Zustimmung entspricht).
export async function mitKindVerknuepfen(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const token = String(fd.get("token") ?? "");
  if (!token || token.length > 200) return { error: "Dieser Link ist ungültig." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("eltern_verknuepfen_mit_zustimmung", { p_token: token });
  if (error) return { error: error.code === "P0001" || error.code === "42501" ? error.message : "Die Verknüpfung hat nicht geklappt." };
  revalidatePath("/dashboard/einstellungen");
  return { error: null, ok: "Verknüpft! Unter Einstellungen → Familie verwaltest du jetzt die Schutzeinstellungen deines Kindes." };
}
