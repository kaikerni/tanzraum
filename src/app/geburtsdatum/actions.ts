"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { geburtsdatumFehler } from "@/lib/auth/geburtsdatum";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

export async function geburtsdatumSpeichern(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const wert = String(formData.get("geburtsdatum") ?? "").trim();
  const fehler = geburtsdatumFehler(wert);
  if (fehler) return { error: fehler };
  if (formData.get("bestaetigt") !== "ja") return { error: "Bitte bestätige, dass dein Geburtsdatum stimmt." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("geburtsdatum_setzen", { p_datum: wert });
  if (error) return { error: error.code === "P0001" ? error.message : "Das Geburtsdatum konnte nicht gespeichert werden." };
  redirect("/dashboard");
}
