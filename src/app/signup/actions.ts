"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authFehlerText } from "@/lib/auth/fehler";
import { basisUrl, internerPfad } from "@/lib/url";
import { geburtsdatumFehler } from "@/lib/auth/geburtsdatum";
import { istKinderkontoAlter } from "@/lib/auth/alter";
import { elternMailSenden } from "@/lib/auth/elternMail";
import { istGeschlecht } from "@/lib/geschlecht";

export type SignupState = {
  error: string | null;
  emailBestaetigenNoetig: boolean;
  // Kinderkonto unter 16: wartet auf die Zustimmung eines Elternteils
  wartetAufEltern?: boolean;
  kindId?: string;
  mailFehler?: string | null;
};

const initialState: SignupState = { error: null, emailBestaetigenNoetig: false };
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

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
  const elternEmail = String(formData.get("eltern_email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const weiter = internerPfad(String(formData.get("weiter") ?? "/dashboard"));

  if (!vorname || !nachname || !email || !password || !geburtsdatum || !gender) {
    return { ...initialState, error: "Bitte alle Pflichtfelder ausfüllen." };
  }
  // Fuer die persoenliche Bezeichnung (z. B. Taenzerin/Taenzer); "divers" wird neutral bezeichnet
  if (!istGeschlecht(gender)) {
    return { ...initialState, error: "Bitte wähle ein Geschlecht aus." };
  }
  const gebFehler = geburtsdatumFehler(geburtsdatum);
  if (gebFehler) return { ...initialState, error: gebFehler };
  if (password.length < 8) {
    return { ...initialState, error: "Das Passwort muss mindestens 8 Zeichen lang sein." };
  }

  // Alter serverseitig aus dem Geburtsdatum (die Datenbank prueft zusaetzlich und legt das Kinderkonto gesperrt an)
  const kinderkonto = istKinderkontoAlter(geburtsdatum);
  if (kinderkonto) {
    if (!EMAIL.test(elternEmail) || elternEmail.length > 254) {
      return { ...initialState, error: "Unter 16 Jahren brauchen wir die E-Mail-Adresse eines Elternteils." };
    }
    if (elternEmail === email.toLowerCase()) {
      return { ...initialState, error: "Bitte gib die E-Mail-Adresse eines Elternteils an – nicht deine eigene." };
    }
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
        ...(kinderkonto ? { eltern_email: elternEmail } : {}),
      },
    },
  });

  if (error) {
    return { ...initialState, error: authFehlerText(error, "Die Registrierung hat nicht geklappt. Bitte versuche es später erneut.") };
  }

  if (kinderkonto) {
    // Konto ist bis zur Zustimmung gesperrt; der einmalige Link geht an das Elternteil
    const kindId = data.user?.id;
    const mail = kindId ? await elternMailSenden({ art: "anfrage", kind_id: kindId }) : { ok: true };
    return { ...initialState, wartetAufEltern: true, kindId, mailFehler: mail.ok ? null : (mail.error ?? null) };
  }

  if (data.session) {
    redirect(weiter);
  }

  return { error: null, emailBestaetigenNoetig: true };
}

// "E-Mail an meine Eltern erneut senden" (begrenzt: frühestens alle 5 Minuten, höchstens 5-mal)
export async function elternMailErneut(kindId: string): Promise<{ error: string | null; ok?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(kindId)) return { error: "Ungültige Anfrage." };
  const r = await elternMailSenden({ art: "anfrage", kind_id: kindId });
  return r.ok ? { error: null, ok: "Die E-Mail an deine Eltern wurde erneut verschickt." } : { error: r.error ?? "Das hat nicht geklappt." };
}
