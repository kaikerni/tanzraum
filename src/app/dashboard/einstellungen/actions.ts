"use server";

import { redirect } from "next/navigation";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { authFehlerText } from "@/lib/auth/fehler";
import { basisUrl } from "@/lib/url";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/einstellungen");
  return { supabase, user };
}

// E-Mail-Adresse aendern: Supabase Auth verschickt die Bestaetigungslinks (ueber den Send Email Hook / Brevo).
// Die Adresse wechselt erst, wenn die Aenderung bestaetigt wurde.
export async function emailAendern(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const neu = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(neu)) return { error: "Bitte gib eine gültige E-Mail-Adresse ein." };

  const { supabase, user } = await sitzung();
  if (neu === (user.email ?? "").toLowerCase()) return { error: "Das ist bereits deine aktuelle E-Mail-Adresse." };

  const { error } = await supabase.auth.updateUser(
    { email: neu },
    { emailRedirectTo: `${await basisUrl()}/dashboard/einstellungen?email=geaendert` },
  );
  if (error) return { error: authFehlerText(error, "Die E-Mail-Adresse konnte nicht geändert werden. Bitte versuche es später erneut.") };
  return {
    error: null,
    ok: `Fast geschafft: Wir haben Bestätigungslinks an ${user.email} und an ${neu} geschickt. Die neue Adresse gilt erst, wenn du die Änderung bestätigt hast.`,
  };
}

// Passwort aendern (angemeldet): aktuelles Passwort wird zuerst geprueft – mit einer separaten, nicht
// gespeicherten Anmeldung, damit die laufende Sitzung unberuehrt bleibt.
export async function passwortAendern(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const aktuell = String(formData.get("aktuell") ?? "");
  const neu = String(formData.get("neu") ?? "");
  const wiederholung = String(formData.get("wiederholung") ?? "");
  if (!aktuell) return { error: "Bitte gib dein aktuelles Passwort ein." };
  if (neu.length < 8) return { error: "Das neue Passwort muss mindestens 8 Zeichen lang sein." };
  if (neu !== wiederholung) return { error: "Die beiden neuen Passwörter stimmen nicht überein." };
  if (neu === aktuell) return { error: "Das neue Passwort muss sich von deinem bisherigen Passwort unterscheiden." };

  const { supabase, user } = await sitzung();
  if (!user.email) return { error: "Für dein Konto ist keine E-Mail-Adresse hinterlegt." };

  const pruefer = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: pruefFehler } = await pruefer.auth.signInWithPassword({ email: user.email, password: aktuell });
  if (pruefFehler) {
    return { error: pruefFehler.status === 429 ? authFehlerText(pruefFehler) : "Dein aktuelles Passwort ist nicht korrekt." };
  }
  await pruefer.auth.signOut({ scope: "local" });

  const { error } = await supabase.auth.updateUser({ password: neu });
  if (error) return { error: authFehlerText(error, "Das Passwort konnte nicht geändert werden. Bitte versuche es erneut.") };

  // Andere Geraete abmelden, diese Sitzung bleibt bestehen
  await supabase.auth.signOut({ scope: "others" });
  return { error: null, ok: "Dein Passwort wurde geändert. Auf anderen Geräten wurdest du zur Sicherheit abgemeldet." };
}

// Privates Konto: nicht in Suchen (Messenger, Netzwerk) auffindbar; Vereinsmitglieder sehen das Profil weiterhin.
export async function kontoPrivatSetzen(privat: boolean): Promise<AktionsErgebnis> {
  const { supabase, user } = await sitzung();
  const { error } = await supabase.from("profiles").update({ konto_privat: privat }).eq("id", user.id);
  if (error) return { error: "Die Einstellung konnte nicht gespeichert werden." };
  return { error: null, ok: privat ? "Dein Konto ist jetzt privat." : "Dein Konto ist jetzt öffentlich auffindbar." };
}
