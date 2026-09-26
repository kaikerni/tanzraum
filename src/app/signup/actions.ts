"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authFehlerText } from "@/lib/auth/fehler";
import { basisUrl, internerPfad } from "@/lib/url";
import { geburtsdatumFehler } from "@/lib/auth/geburtsdatum";

export type SignupState = { error: string | null; emailBestaetigenNoetig: boolean };

const GESCHLECHTER = ["weiblich", "männlich", "divers"];

const initialState: SignupState = { error: null, emailBestaetigenNoetig: false };

export async function signUp(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const vorname = String(formData.get("vorname") ?? "").trim();
  const nachname = String(formData.get("nachname") ?? "").trim();
  const handle = String(formData.get("handle") ?? "").trim();
  const gender = String(formData.get("gender") ?? "");
  const geburtsdatum = String(formData.get("geburtsdatum") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const weiter = internerPfad(String(formData.get("weiter") ?? "/dashboard"));

  if (!vorname || !nachname || !email || !password || !geburtsdatum || !gender) {
    return { ...initialState, error: "Bitte alle Pflichtfelder ausfüllen." };
  }
  // Fuer die persoenliche Anrede (z. B. Taenzerin/Taenzer); "divers" wird neutral angesprochen
  if (!GESCHLECHTER.includes(gender)) {
    return { ...initialState, error: "Bitte wähle ein Geschlecht aus." };
  }
  const gebFehler = geburtsdatumFehler(geburtsdatum);
  if (gebFehler) return { ...initialState, error: gebFehler };
  if (password.length < 8) {
    return { ...initialState, error: "Das Passwort muss mindestens 8 Zeichen lang sein." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Link in der Bestaetigungs-E-Mail fuehrt ueber /auth/bestaetigen hierher zurueck (z. B. zur Einladung)
      emailRedirectTo: `${await basisUrl()}${weiter}`,
      data: {
        vorname,
        nachname,
        handle: handle || null,
        gender,
        geburtsdatum,
      },
    },
  });

  if (error) {
    return { ...initialState, error: authFehlerText(error, "Die Registrierung hat nicht geklappt. Bitte versuche es später erneut.") };
  }

  if (data.session) {
    redirect(weiter);
  }

  return { error: null, emailBestaetigenNoetig: true };
}
