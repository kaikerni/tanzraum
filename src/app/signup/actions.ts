"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignupState = { error: string | null; emailBestaetigenNoetig: boolean };

const initialState: SignupState = { error: null, emailBestaetigenNoetig: false };

export async function signUp(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const vorname = String(formData.get("vorname") ?? "").trim();
  const nachname = String(formData.get("nachname") ?? "").trim();
  const handle = String(formData.get("handle") ?? "").trim();
  const gender = String(formData.get("gender") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!vorname || !nachname || !email || !password) {
    return { ...initialState, error: "Bitte alle Pflichtfelder ausfüllen." };
  }
  if (password.length < 8) {
    return { ...initialState, error: "Das Passwort muss mindestens 8 Zeichen lang sein." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        vorname,
        nachname,
        handle: handle || null,
        gender: gender || null,
      },
    },
  });

  if (error) {
    return { ...initialState, error: error.message };
  }

  if (data.session) {
    redirect("/dashboard");
  }

  return { error: null, emailBestaetigenNoetig: true };
}
