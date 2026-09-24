"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const VEREINS_ADMIN_ROLLE_ID = "d8b4d77d-b91a-4b3d-9260-2c29ee7c09f9";

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

  const { data: verein, error: vereinError } = await supabase
    .from("vereine")
    .insert({ name, kuerzel: kuerzel || null })
    .select("id")
    .single();
  if (vereinError || !verein) return { error: vereinError?.message ?? "Verein konnte nicht angelegt werden." };

  const { error: mitgliedError } = await supabase.from("vereins_mitglieder").insert({
    user_id: user.id,
    verein_id: verein.id,
    rolle_id: VEREINS_ADMIN_ROLLE_ID,
  });
  if (mitgliedError) return { error: mitgliedError.message };

  await supabase
    .from("onboarding_progress")
    .update({ verein_id: verein.id, current_step: 3, updated_at: new Date().toISOString() })
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

  await supabase
    .from("onboarding_progress")
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq("user_id", user.id);

  redirect("/dashboard");
}
