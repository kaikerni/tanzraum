"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authFehlerText } from "@/lib/auth/fehler";

export type NeuState = { error: string | null };

// Setzt das neue Passwort. Erlaubt nur in einer frischen Sitzung aus einem Zuruecksetzen-Link
// (DB: ist_recovery_sitzung). Die Passwortverwaltung selbst liegt vollstaendig bei Supabase Auth.
export async function neuesPasswortSpeichern(_prev: NeuState, formData: FormData): Promise<NeuState> {
  const passwort = String(formData.get("passwort") ?? "");
  const wiederholung = String(formData.get("wiederholung") ?? "");
  if (passwort.length < 8) return { error: "Das Passwort muss mindestens 8 Zeichen lang sein." };
  if (passwort !== wiederholung) return { error: "Die beiden Passwörter stimmen nicht überein." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: recovery } = user ? await supabase.rpc("ist_recovery_sitzung") : { data: false };
  if (!user || recovery !== true) {
    return { error: "Dein Link ist abgelaufen. Bitte fordere über „Passwort vergessen?“ einen neuen an." };
  }

  const { error } = await supabase.auth.updateUser({ password: passwort });
  if (error) return { error: authFehlerText(error, "Das Passwort konnte nicht gespeichert werden. Bitte versuche es erneut.") };

  // Nach dem Zuruecksetzen alle Sitzungen beenden (auch auf anderen Geraeten) und neu anmelden lassen
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?hinweis=passwort-geaendert");
}
