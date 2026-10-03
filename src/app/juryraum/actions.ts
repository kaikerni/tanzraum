"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function antworteAufEinladung(zusageId: string, status: "zugesagt" | "abgesagt") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { error } = await supabase
    .from("juryraum_einsatz_zusagen")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", zusageId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/juryraum/dashboard");
  return { error: null };
}

export async function setzeVerfuegbarkeit(
  turnierId: string,
  status: "kann" | "kann_nicht" | "vielleicht",
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { error } = await supabase
    .from("juryraum_verfuegbarkeiten")
    .upsert(
      { turnier_id: turnierId, user_id: user.id, status, updated_at: new Date().toISOString() },
      { onConflict: "turnier_id,user_id" },
    );

  if (error) return { error: error.message };

  revalidatePath("/juryraum/dashboard");
  revalidatePath("/juryraum/verfuegbarkeiten");
  return { error: null };
}
