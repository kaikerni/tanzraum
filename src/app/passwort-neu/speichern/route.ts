import type { NextRequest } from "next/server";
import { feld, gleicherUrsprung, routeClient, weiterleiten } from "@/lib/auth/formularRoute";

// Setzt das neue Passwort (POST aus dem Formular auf /passwort-neu). Erlaubt nur in einer frischen Sitzung aus einem
// Zuruecksetzen-Link (DB: ist_recovery_sitzung). Die Passwortverwaltung selbst liegt vollstaendig bei Supabase Auth.
// Das Passwort steht nie in einer Adresse; Fehler werden nur als Kennung (?fehler=...) zurueckgegeben.
export async function POST(request: NextRequest) {
  if (!gleicherUrsprung(request)) return weiterleiten("/passwort-neu?fehler=abgelaufen");
  const daten = await request.formData();
  const passwort = feld(daten, "passwort");
  const wiederholung = feld(daten, "wiederholung");
  if (passwort.length < 8) return weiterleiten("/passwort-neu?fehler=kurz");
  if (passwort !== wiederholung) return weiterleiten("/passwort-neu?fehler=ungleich");

  const { supabase, neueCookies } = routeClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: recovery } = user ? await supabase.rpc("ist_recovery_sitzung") : { data: false };
  if (!user || recovery !== true) return weiterleiten("/passwort-neu?fehler=abgelaufen", neueCookies);

  const { error } = await supabase.auth.updateUser({ password: passwort });
  if (error) {
    const kennung = error.code === "weak_password" || error.code === "same_password" ? error.code : "speichern";
    return weiterleiten(`/passwort-neu?fehler=${kennung}`, neueCookies);
  }

  // Nach dem Zuruecksetzen alle Sitzungen beenden (auch auf anderen Geraeten) und neu anmelden lassen
  await supabase.auth.signOut({ scope: "global" });
  return weiterleiten("/login?hinweis=passwort-geaendert", neueCookies);
}
