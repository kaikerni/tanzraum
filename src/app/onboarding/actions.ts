"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function getOrCreateProgress(userId: string) {
  const supabase = await createClient();
  const { data: bestehend } = await supabase
    .from("onboarding_progress")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (bestehend) return bestehend;

  const { data: neu } = await supabase
    .from("onboarding_progress")
    .insert({ user_id: userId, tarif: "free", current_step: 1, total_steps: 3 })
    .select()
    .single();
  return neu;
}

export async function ladeOnboardingStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return getOrCreateProgress(user.id);
}

export async function tarifWaehlen(tarif: "free" | "basic" | "verein", periode: "monat" | "jahr") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await getOrCreateProgress(user.id);
  await supabase
    .from("onboarding_progress")
    .update({
      tarif,
      current_step: 2,
      data: { periode },
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  redirect("/onboarding/verein");
}

export async function vereinAnlegen(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const kuerzel = String(formData.get("kuerzel") ?? "").trim();
  if (!name) return { error: "Bitte einen Vereinsnamen angeben." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verein + eigene Admin-Mitgliedschaft atomar in der DB (direktes Eintragen in fremde Vereine ist gesperrt).
  const { data: vereinId, error: vereinError } = await supabase.rpc("verein_anlegen", {
    p_name: name,
    p_kuerzel: kuerzel || null,
  });
  if (vereinError || !vereinId) return { error: vereinError?.message ?? "Verein konnte nicht angelegt werden." };

  await supabase
    .from("onboarding_progress")
    .update({ verein_id: vereinId as string, current_step: 3, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  redirect("/onboarding/fertig");
}

export async function vereinSchrittUeberspringen() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("onboarding_progress")
    .update({
      current_step: 3,
      skipped_steps: [2],
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  redirect("/onboarding/fertig");
}

export async function onboardingAbschliessen() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: fortschritt } = await supabase
    .from("onboarding_progress")
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select("tarif, data")
    .maybeSingle();

  // Bei gewuenschtem BASIC/VEREIN direkt zur Bezahlung -- aktiv wird der Tarif erst nach bestaetigter Zahlung
  const wunsch = fortschritt?.tarif;
  if (wunsch === "basic" || wunsch === "verein") {
    // deno-lint-ignore no-explicit-any
    const periode = (fortschritt?.data as any)?.periode === "jahr" ? "jahr" : "monat";
    redirect(`/dashboard/tarif?wunsch=${wunsch}&periode=${periode}${wunsch === "verein" ? "#verein" : ""}`);
  }
  redirect("/dashboard");
}
