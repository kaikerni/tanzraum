import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { feld, gleicherUrsprung, routeClient, weiterleiten } from "@/lib/auth/formularRoute";
import { internerPfad } from "@/lib/url";
import { LINK_TYPEN } from "../typen";

// Loest den Link aus der E-Mail ein (POST aus dem Formular auf /auth/bestaetigen).
// Supabase Auth prueft Gueltigkeit, Ablauf und Einmaligkeit (token_hash). Bei Erfolg kommen die Sitzungs-Cookies
// mit der Weiterleitung (303) an den Browser.
export async function POST(request: NextRequest) {
  const daten = await request.formData();
  const tokenHash = feld(daten, "token_hash");
  const typ = feld(daten, "type");
  const weiter = internerPfad(feld(daten, "weiter"));
  const gueltigerTyp = (LINK_TYPEN as readonly string[]).includes(typ);
  const status = (s: string) => `/auth/bestaetigen?type=${encodeURIComponent(gueltigerTyp ? typ : "email")}&status=${s}`;

  if (!gleicherUrsprung(request)) return weiterleiten(status("fehler"));
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(tokenHash) || !gueltigerTyp) return weiterleiten(status("fehler"));

  const { supabase, neueCookies } = routeClient(request);
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: typ as EmailOtpType });
  // Fehlerdetails (abgelaufen / bereits verwendet / ungueltig) bleiben bewusst neutral
  if (error) {
    const gesperrt = error.code === "user_banned" || (error.message ?? "").toLowerCase().includes("banned");
    return weiterleiten(status(gesperrt ? "eltern" : "fehler"));
  }

  // Kinderkonto unter 16 ohne Zustimmung: keine Sitzung behalten (zusaetzlich zur Login-Sperre in Supabase Auth)
  const { data: kinderkonto } = await supabase.rpc("mein_kinderkonto_status");
  if (kinderkonto === "wartet" || kinderkonto === "zustimmung_noetig") {
    await supabase.auth.signOut();
    return weiterleiten(status("eltern"), neueCookies);
  }

  if (typ === "recovery") return weiterleiten("/passwort-neu", neueCookies);
  if (typ === "email_change") {
    // Sichere E-Mail-Aenderung: der erste von zwei Links liefert noch keine neue Sitzung
    if (!data.session) return weiterleiten(status("teilweise"), neueCookies);
    return weiterleiten("/dashboard/einstellungen?email=geaendert", neueCookies);
  }
  return weiterleiten(weiter, neueCookies);
}
