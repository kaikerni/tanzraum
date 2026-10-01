"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { basisUrl } from "@/lib/url";
import { MAIL_FEHLER } from "@/lib/auth/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Vereinsverwaltung der TanzRaum-Administration. Alle Rechte prueft die Datenbank (nur Plattform-Admins).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const t = (fd: FormData, f: string) => String(fd.get(f) ?? "").trim();
const meldung = (e: { code?: string; message: string }) => (e.code === "P0001" || e.code === "42501" ? e.message : "Das hat nicht geklappt.");

function neuLaden(vereinId?: string) {
  revalidatePath("/dashboard/admin/vereine");
  revalidatePath("/dashboard/admin/tarife");
  if (vereinId) revalidatePath(`/dashboard/admin/tarife/verein/${vereinId}`);
}

export async function vereinAnlegenAdmin(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_verein_anlegen", {
    p_name: t(fd, "name"),
    p_kuerzel: t(fd, "kuerzel") || null,
    p_strasse: t(fd, "strasse") || null,
    p_hausnummer: t(fd, "hausnummer") || null,
    p_plz: t(fd, "plz") || null,
    p_ort: t(fd, "ort") || null,
    p_email: t(fd, "email") || null,
    p_telefon: t(fd, "telefon") || null,
    p_webseite: t(fd, "webseite") || null,
    p_ansprechpartner: t(fd, "ansprechpartner") || null,
  });
  if (error) return { error: meldung(error) };
  neuLaden();
  // Weiter zur Lizenz und zur Vereinsadmin-Einladung
  redirect(`/dashboard/admin/tarife/verein/${data}?neu=1`);
}

export async function lizenzSetzenAdmin(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const vereinId = t(fd, "verein_id");
  if (!UUID.test(vereinId)) return { error: "Verein fehlt." };
  const preis = Number(t(fd, "preis").replace(",", "."));
  const monate = Number(t(fd, "monate"));
  if (!Number.isFinite(preis) || preis < 0) return { error: "Bitte einen Preis angeben (0 für kostenlos)." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_vereinslizenz_setzen", {
    p_verein_id: vereinId,
    p_start: t(fd, "start"),
    p_monate: monate,
    p_preis_cent: Math.round(preis * 100),
    p_status: t(fd, "status") === "trialing" ? "trialing" : "active",
  });
  if (error) return { error: meldung(error) };
  neuLaden(vereinId);
  // deno-lint-ignore no-explicit-any
  const bis = (data as any)?.bis as string | undefined;
  return { error: null, ok: `Lizenz aktiviert${bis ? ` – gültig bis ${new Date(`${bis}T12:00:00Z`).toLocaleDateString("de-DE", { timeZone: "UTC" })}` : ""}.` };
}

export async function lizenzBeendenAdmin(vereinId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(vereinId)) return { error: "Verein fehlt." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_vereinslizenz_beenden", { p_verein_id: vereinId });
  if (error) return { error: meldung(error) };
  neuLaden(vereinId);
  return { error: null, ok: "Manuelle Lizenz beendet." };
}

// Einladung erzeugen (kein Konto!) und – falls die Lizenz aktiv ist – per E-Mail ueber den bestehenden Versand schicken
export async function vereinsadminEinladen(_prev: AktionsErgebnis & { link?: string }, fd: FormData): Promise<AktionsErgebnis & { link?: string }> {
  const vereinId = t(fd, "verein_id");
  const email = t(fd, "email").toLowerCase();
  if (!UUID.test(vereinId)) return { error: "Verein fehlt." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Bitte eine gültige E-Mail-Adresse angeben." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_vereinsadmin_einladen", { p_verein_id: vereinId, p_email: email });
  if (error) return { error: meldung(error) };
  // deno-lint-ignore no-explicit-any
  const e = ((data ?? []) as any[])[0];
  if (!e) return { error: "Die Einladung konnte nicht erstellt werden." };
  const link = `${await basisUrl()}/einladung/${e.token}`;
  neuLaden(vereinId);
  if (fd.get("senden") === "on") {
    const { error: mailFehler } = await supabase.functions.invoke("send-beitritt-einladung", { body: { einladung_id: e.einladung_id, email } });
    if (mailFehler) {
      return { error: null, ok: `Einladung erstellt. ${MAIL_FEHLER} Den Link kannst du auch selbst weitergeben.`, link };
    }
    return { error: null, ok: `Einladung an ${email} gesendet.`, link };
  }
  return { error: null, ok: "Einladung erstellt – Link kopieren und weitergeben.", link };
}

export async function einladungWiderrufenAdmin(id: string, vereinId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Einladung fehlt." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_einladung_widerrufen", { p_einladung_id: id });
  if (error) return { error: meldung(error) };
  neuLaden(vereinId);
  return { error: null, ok: "Einladung widerrufen." };
}
