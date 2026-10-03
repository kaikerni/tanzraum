"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import { RECHTSTEXT_VERSION } from "@/lib/recht/versionen";

export async function rechtstexteBestaetigen(_prev: { error: string | null }, fd: FormData): Promise<{ error: string | null }> {
  if (fd.get("rechtstexte") !== "on") return { error: "Bitte bestätige die Nutzungsbedingungen und die Datenschutzhinweise." };
  const supabase = await createClient();
  // Die Datenbank prueft, dass genau die aktuelle Fassung bestaetigt wird, und speichert den Nachweis (einwilligungen)
  const { error } = await supabase.rpc("rechtstexte_bestaetigen", {
    p_nutzungsbedingungen: RECHTSTEXT_VERSION.nutzungsbedingungen,
    p_datenschutz: RECHTSTEXT_VERSION.datenschutz,
  });
  if (error) return { error: error.code === "P0001" && error.message ? error.message : freundlicherFehler(error) };
  redirect("/dashboard");
}
