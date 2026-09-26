"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Verein anlegen, um danach direkt die Vereinslizenz zu kaufen (Kauf = Lizenz fuer den eigenen Verein)
export async function vereinFuerLizenzAnlegen(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const name = String(formData.get("name") ?? "").trim();
  const kuerzel = String(formData.get("kuerzel") ?? "").trim();
  if (!name) return { error: "Bitte einen Vereinsnamen angeben." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase.rpc("verein_anlegen", { p_name: name, p_kuerzel: kuerzel || null });
  if (error || !data) return { error: error?.message ?? "Verein konnte nicht angelegt werden." };
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/tarif?verein=${data}#verein`);
}
