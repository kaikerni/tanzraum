"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

// Freiwillige Profilangabe "Verein, in dem ich tanze" -- keine offizielle Vereinszuordnung, keine Rechte
export async function vereinAngabeSetzen(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const loeschen = formData.get("aktion") === "loeschen";
  const wert = loeschen ? "" : String(formData.get("verein_angabe") ?? "").replace(/\s+/g, " ").trim();
  if (wert.length > 100) return { error: "Bitte höchstens 100 Zeichen." };
  const { supabase, user } = await sitzung();
  const { error } = await supabase.from("profiles").update({ verein_angabe: wert || null }).eq("id", user.id);
  if (error) return { error: "Die Angabe konnte nicht gespeichert werden." };
  return { error: null, ok: wert ? "Gespeichert." : "Angabe entfernt." };
}

// Online-Status fuer Kontakte und Vereinsmitglieder mit Namen zeigen (Opt-in)
export async function onlineSichtbarSetzen(sichtbar: boolean): Promise<AktionsErgebnis> {
  const { supabase } = await sitzung();
  const { error } = await supabase.rpc("online_sichtbar_setzen", { p_sichtbar: sichtbar });
  if (error) return { error: "Die Einstellung konnte nicht gespeichert werden." };
  return { error: null, ok: sichtbar ? "Kontakte sehen jetzt, wenn du online bist." : "Dein Online-Status ist jetzt verborgen." };
}

// Push-Kategorien (welche Benachrichtigungen dieses Konto bekommt); RLS: nur eigene Zeilen
const PUSH_KATEGORIEN = ["chat", "anrufe", "training", "trainingsaenderung", "abmeldung", "news", "wichtige_news", "turniere", "fahrgemeinschaften"];

export async function pushKategorieSetzen(kategorie: string, aktiv: boolean): Promise<AktionsErgebnis> {
  if (!PUSH_KATEGORIEN.includes(kategorie)) return { error: "Unbekannte Kategorie." };
  const { supabase, user } = await sitzung();
  const { error } = await supabase
    .from("push_einstellungen")
    .upsert({ user_id: user.id, kategorie, aktiv, geaendert_am: new Date().toISOString() }, { onConflict: "user_id,kategorie" });
  if (error) return { error: "Die Einstellung konnte nicht gespeichert werden." };
  return { error: null, ok: "Gespeichert." };
}

// Konto loeschen: Passwort bestaetigen, Antrag in der Datenbank (prueft Hindernisse, sperrt das Konto sofort,
// endgueltige Loeschung nach 14 Tagen), danach Mail mit Widerrufslink ueber die Edge Function "konto-loeschung".
export async function kontoLoeschenBeantragen(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const passwort = String(formData.get("passwort") ?? "");
  const bestaetigung = String(formData.get("bestaetigung") ?? "").trim();
  if (bestaetigung !== "LÖSCHEN") return { error: "Bitte tippe zur Bestätigung LÖSCHEN in das Feld." };
  if (!passwort) return { error: "Bitte gib dein Passwort ein." };

  const { supabase, user } = await sitzung();
  if (!user.email) return { error: "Für dein Konto ist keine E-Mail-Adresse hinterlegt. Bitte wende dich an den Support." };
  const pruefer = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: pruefFehler } = await pruefer.auth.signInWithPassword({ email: user.email, password: passwort });
  if (pruefFehler) {
    return { error: pruefFehler.status === 429 ? authFehlerText(pruefFehler) : "Das Passwort ist nicht korrekt." };
  }
  await pruefer.auth.signOut({ scope: "local" });

  const { data: loeschenAb, error } = await supabase.rpc("konto_loeschung_beantragen");
  if (error) return { error: error.code === "P0001" && error.message ? error.message : "Die Löschung konnte nicht beantragt werden." };

  // Bestaetigung mit Widerrufslink an die Anmeldeadresse (Empfaenger und Inhalt legt der Server fest)
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/konto-loeschung`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      body: JSON.stringify({ art: "bestaetigung", user_id: user.id }),
      cache: "no-store",
    });
  } catch {
    // Antrag bleibt gueltig; Widerruf ist auch ueber den Support moeglich
  }
  await supabase.auth.signOut({ scope: "local" });
  redirect(`/konto/geloescht?ab=${encodeURIComponent(String(loeschenAb ?? ""))}`);
}

// „Meine Navigation“: speichert nur die Reihenfolge (Menue-Kennungen). Was angezeigt und geoeffnet werden darf,
// entscheidet weiterhin allein die Berechtigungslogik – die Datenbank prueft nur das Format.
export async function navigationSpeichern(reihenfolge: string[] | null): Promise<AktionsErgebnis> {
  const { supabase } = await sitzung();
  const liste = reihenfolge
    ? reihenfolge.filter((x) => typeof x === "string" && /^\/[a-z0-9/#_-]{1,80}$/.test(x)).slice(0, 100)
    : null;
  const { error } = await supabase.rpc("navigation_speichern", { p_reihenfolge: liste && liste.length ? liste : null });
  if (error) return { error: "Die Navigation konnte nicht gespeichert werden." };
  revalidatePath("/dashboard", "layout");
  return { error: null, ok: liste && liste.length ? "Deine Navigation ist gespeichert – auf allen Geräten." : "Die TanzRaum-Standardreihenfolge gilt wieder." };
}

// TanzRaum-Admin: Punkte der eigenen Admin-Navigation ausblenden (nur Anzeige – die Datenbank prueft das Admin-Recht)
export async function adminNavigationAusblenden(hrefs: string[]): Promise<AktionsErgebnis> {
  const { supabase } = await sitzung();
  const liste = hrefs.filter((x) => typeof x === "string" && /^\/[a-z0-9/#_-]{1,80}$/.test(x)).slice(0, 100);
  const { error } = await supabase.rpc("admin_navigation_ausblenden", { p_hrefs: liste });
  if (error) return { error: error.code === "42501" ? "Nur für die TanzRaum-Administration." : "Die Admin-Navigation konnte nicht gespeichert werden." };
  revalidatePath("/dashboard", "layout");
  return { error: null, ok: "Deine Admin-Navigation ist gespeichert. Deine Berechtigungen bleiben unverändert." };
}
