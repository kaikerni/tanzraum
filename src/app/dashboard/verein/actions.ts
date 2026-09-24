"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import { MAIL_FEHLER } from "@/lib/auth/fehler";

// Alle Schreibzugriffe laufen mit der Sitzung des Nutzers -- RLS entscheidet, ob er darf
// (Vereinsdaten: nur Vereinsadmin; Gruppen: Vereinsadmin/Trainer; Einladungen: Vereinsadmin).

function text(formData: FormData, feld: string): string | null {
  const wert = String(formData.get(feld) ?? "").trim();
  return wert === "" ? null : wert;
}

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function vereinsdatenSpeichern(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const vereinId = text(formData, "verein_id");
  const name = text(formData, "name");
  if (!vereinId) return { error: "Verein fehlt." };
  if (!name) return { error: "Der Vereinsname darf nicht leer sein." };

  const webseite = text(formData, "webseite");
  if (webseite && !/^https?:\/\//i.test(webseite)) {
    return { error: "Die Webseite muss mit http:// oder https:// beginnen." };
  }

  const { supabase } = await sitzung();
  const { data, error } = await supabase
    .from("vereine")
    .update({
      name,
      kuerzel: text(formData, "kuerzel"),
      beschreibung: text(formData, "beschreibung"),
      ansprechpartner: text(formData, "ansprechpartner"),
      email: text(formData, "email"),
      telefon: text(formData, "telefon"),
      webseite,
      strasse: text(formData, "strasse"),
      hausnummer: text(formData, "hausnummer"),
      plz: text(formData, "plz"),
      ort: text(formData, "ort"),
      verband_id: text(formData, "verband_id"),
    })
    .eq("id", vereinId)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Nur der Vereinsadmin darf die Vereinsdaten ändern." };

  revalidatePath("/dashboard/verein");
  return { error: null, ok: "Vereinsdaten gespeichert." };
}

export async function logoSpeichern(vereinId: string, logoUrl: string): Promise<AktionsErgebnis> {
  const { supabase } = await sitzung();
  const { data, error } = await supabase.from("vereine").update({ logo_url: logoUrl }).eq("id", vereinId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Nur der Vereinsadmin darf das Logo ändern." };
  revalidatePath("/dashboard/verein");
  return { error: null, ok: "Logo gespeichert." };
}

export async function gruppeSpeichern(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const vereinId = text(formData, "verein_id");
  const gruppeId = text(formData, "gruppe_id");
  const name = text(formData, "name");
  if (!vereinId) return { error: "Verein fehlt." };
  if (!name) return { error: "Bitte einen Gruppennamen angeben." };

  const felder = {
    name,
    altersklasse_id: text(formData, "altersklasse_id"),
    disziplin_id: text(formData, "disziplin_id"),
    thema: text(formData, "thema"),
  };

  const { supabase } = await sitzung();
  const { data, error } = gruppeId
    ? await supabase.from("gruppen").update(felder).eq("id", gruppeId).eq("verein_id", vereinId).select("id")
    : await supabase.from("gruppen").insert({ ...felder, verein_id: vereinId }).select("id");

  if (error) {
    return {
      error: error.code === "42501" ? "Nur Vereinsadmin und Trainer dürfen Gruppen verwalten." : error.message,
    };
  }
  if (!data || data.length === 0) return { error: "Nur Vereinsadmin und Trainer dürfen Gruppen verwalten." };

  revalidatePath("/dashboard/verein");
  return { error: null, ok: gruppeId ? "Gruppe gespeichert." : "Gruppe angelegt." };
}

export async function gruppeLoeschen(formData: FormData): Promise<void> {
  const gruppeId = text(formData, "gruppe_id");
  if (!gruppeId) return;
  const { supabase } = await sitzung();
  await supabase.from("gruppen").delete().eq("id", gruppeId);
  revalidatePath("/dashboard/verein");
}

export async function einladungErstellen(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const vereinId = text(formData, "verein_id");
  const rolleId = text(formData, "rolle_id");
  const tage = Math.min(Math.max(Number(formData.get("tage") ?? 14) || 14, 1), 90);
  const anzahl = Math.min(Math.max(Number(formData.get("anzahl") ?? 1) || 1, 1), 200);
  if (!vereinId || !rolleId) return { error: "Bitte eine Rolle auswählen." };

  const { supabase, user } = await sitzung();
  const { error } = await supabase.from("einladungen").insert({
    verein_id: vereinId,
    rolle_id: rolleId,
    gruppe_id: text(formData, "gruppe_id"),
    created_by: user.id,
    expires_at: new Date(Date.now() + tage * 86400000).toISOString(),
    max_uses: anzahl,
  });
  if (error) {
    if (error.code === "42501") return { error: "Nur der Vereinsadmin darf einladen." };
    if (error.message.includes("Gruppe")) return { error: "Die Gruppe gehört nicht zu diesem Verein." };
    return { error: "Die Einladung konnte nicht erstellt werden." };
  }

  revalidatePath("/dashboard/verein");
  revalidatePath("/dashboard/mitglieder/neu");
  return { error: null, ok: "Einladung erstellt – unten per E-Mail senden oder den Link kopieren." };
}

// Versand ueber die Edge Function send-beitritt-einladung: Rechte, Empfaenger, Inhalt und Absender prueft/setzt
// ausschliesslich der Server. Die Funktion liefert nur eigene, neutrale Meldungen zurueck.
export async function einladungPerEmail(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const einladungId = text(formData, "einladung_id");
  const email = text(formData, "email");
  if (!einladungId) return { error: "Einladung fehlt." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Bitte gib eine gültige E-Mail-Adresse ein." };

  const { supabase } = await sitzung();
  const { error } = await supabase.functions.invoke("send-beitritt-einladung", { body: { einladung_id: einladungId, email } });
  if (error) {
    let meldung = MAIL_FEHLER;
    try {
      // deno-lint-ignore no-explicit-any
      const antwort = await (error as any).context?.json?.();
      if (typeof antwort?.error === "string") meldung = antwort.error;
    } catch {
      /* neutrale Meldung */
    }
    return { error: meldung };
  }
  return { error: null, ok: `Einladung an ${email} gesendet.` };
}

export async function einladungWiderrufen(formData: FormData): Promise<void> {
  const id = text(formData, "einladung_id");
  if (!id) return;
  const { supabase } = await sitzung();
  await supabase.from("einladungen").update({ revoked: true }).eq("id", id);
  revalidatePath("/dashboard/verein");
  revalidatePath("/dashboard/mitglieder/neu");
}

export async function vereinNeuAnlegen(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const name = text(formData, "name");
  if (!name) return { error: "Bitte einen Vereinsnamen angeben." };
  const { supabase } = await sitzung();
  const { data, error } = await supabase.rpc("verein_anlegen", { p_name: name, p_kuerzel: text(formData, "kuerzel") });
  if (error || !data) return { error: error?.message ?? "Verein konnte nicht angelegt werden." };
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/verein?verein=${data}`);
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export async function einladungEinloesen(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  // Akzeptiert den kompletten Link oder nur den Code.
  const token = String(formData.get("token") ?? "").match(UUID)?.[0];
  if (!token) return { error: "Bitte einen gültigen Einladungslink oder -code eingeben." };

  const { supabase } = await sitzung();
  const { data, error } = await supabase.rpc("invite_einloesen", { p_token: token });
  if (error) return { error: error.message };
  // deno-lint-ignore no-explicit-any
  const ergebnis = data as any;
  if (!ergebnis?.success) return { error: ergebnis?.error ?? "Einladung konnte nicht eingelöst werden." };

  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/verein?verein=${ergebnis.verein_id}`);
}
