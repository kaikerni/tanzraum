"use server";

import { geocode } from "@/lib/geo/geocode";

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

  // Standort fuer die TanzRaum Map (Vereinsadresse -> Koordinaten)
  const adresse = [
    [text(formData, "strasse"), text(formData, "hausnummer")].filter(Boolean).join(" "),
    [text(formData, "plz"), text(formData, "ort")].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  let mapHinweis = "";
  if (text(formData, "ort") || text(formData, "plz")) {
    const position = (await geocode(adresse)) ?? (await geocode([text(formData, "plz"), text(formData, "ort")].filter(Boolean).join(" ")));
    if (position) await supabase.rpc("verein_standort_setzen", { p_verein_id: vereinId, p_lat: position.lat, p_lng: position.lng });
    else mapHinweis = " Der Standort für die TanzRaum Map konnte gerade nicht ermittelt werden – bitte später noch einmal speichern.";
  } else {
    mapHinweis = " Tipp: Mit PLZ und Ort erscheint euer Verein auf der TanzRaum Map.";
  }

  revalidatePath("/dashboard/verein");
  return { error: null, ok: `Vereinsdaten gespeichert.${mapHinweis}` };
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
  // Von der Gruppenseite aus geloescht: zurueck zur Vereinsseite
  if (text(formData, "zurueck")) redirect("/dashboard/verein");
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
  // Naechster Schritt der Vereinsregistrierung: Verein-Lizenz abschliessen
  redirect(`/dashboard/tarif?verein=${data}#verein`);
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export async function einladungEinloesen(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  // Akzeptiert den kompletten Link oder nur den Code.
  const token = String(formData.get("token") ?? "").match(UUID)?.[0];
  if (!token) return { error: "Bitte einen gültigen Einladungslink oder -code eingeben." };

  // Person ist einem anderen Verein zugeordnet und hat dem Wechsel auf der Einladungsseite ausdruecklich zugestimmt
  const wechsel = formData.get("wechsel") === "ja";
  const { supabase } = await sitzung();
  const { data, error } = await supabase.rpc("invite_einloesen", { p_token: token, p_wechsel_bestaetigt: wechsel });
  if (error) return { error: error.message };
  // deno-lint-ignore no-explicit-any
  const ergebnis = data as any;
  if (!ergebnis?.success) {
    if (wechsel && typeof ergebnis?.error === "string" && ergebnis.error.startsWith("Danke")) return { error: null, ok: ergebnis.error };
    return { error: ergebnis?.error ?? "Einladung konnte nicht eingelöst werden." };
  }

  revalidatePath("/dashboard", "layout");
  // Verein verlangt einen Mitgliedsantrag: direkt dorthin
  if (typeof ergebnis.antrag_id === "string") redirect(`/dashboard/mitgliedsantrag/${ergebnis.antrag_id}`);
  redirect(`/dashboard/verein?verein=${ergebnis.verein_id}`);
}

// ---------- Gefuehrter Gruppen-Assistent ----------

export type AssistentPerson = { vmId: string; name: string; geschlecht: "weiblich" | "männlich" | "divers" | null; familie: string };

// Mitglieder des Vereins fuer die Auswahl (nur Vereinsadmin/Trainer; DB: gruppe_assistent_personen)
export async function gruppenPersonen(vereinId: string): Promise<{ error: string | null; liste: AssistentPerson[] }> {
  const { supabase } = await sitzung();
  const { data, error } = await supabase.rpc("gruppe_assistent_personen", { p_verein_id: vereinId });
  if (error) return { error: "Die Mitglieder konnten nicht geladen werden.", liste: [] };
  return {
    error: null,
    // deno-lint-ignore no-explicit-any
    liste: ((data ?? []) as any[]).map((p) => ({ vmId: p.vm_id, name: p.name ?? "Mitglied", geschlecht: p.geschlecht, familie: p.familie ?? "sonstige" })),
  };
}

// Aktuelle Besetzung einer Gruppe (fuer „Gruppe bearbeiten“)
export async function gruppenBesetzung(gruppeId: string): Promise<{ taenzer: string[]; trainer: string[]; betreuer: string[] }> {
  const { supabase } = await sitzung();
  const { data } = await supabase.from("gruppen_mitglieder").select("vereins_mitglied_id, funktion").eq("gruppe_id", gruppeId);
  const zeilen = (data ?? []) as { vereins_mitglied_id: string; funktion: string | null }[];
  return {
    taenzer: zeilen.filter((z) => !z.funktion || z.funktion === "mitglied").map((z) => z.vereins_mitglied_id),
    trainer: zeilen.filter((z) => z.funktion === "trainer").map((z) => z.vereins_mitglied_id),
    betreuer: zeilen.filter((z) => z.funktion === "betreuer").map((z) => z.vereins_mitglied_id),
  };
}

export type GruppeEingabe = {
  vereinId: string;
  gruppeId: string | null;
  name: string;
  altersklasseId: string | null;
  altersklasseFrei: string | null;
  disziplinId: string | null;
  taenzer: string[];
  trainer: string[];
  betreuer: string[];
  // false = „Schnell anlegen“ bzw. nur Stammdaten aendern (Personen bleiben unveraendert)
  personen: boolean;
};

// Speichert Gruppe + Tänzer/Trainer/Betreuer in einem Schritt; Pruefungen (Rechte, Lizenz, Disziplin je Altersklasse,
// Tanzpaar/Solist-Besetzung, nur eigener Verein) macht die Datenbank (gruppe_speichern)
export async function gruppeAssistentSpeichern(e: GruppeEingabe): Promise<AktionsErgebnis & { gruppeId?: string }> {
  const { supabase } = await sitzung();
  const { data, error } = await supabase.rpc("gruppe_speichern", {
    p_verein_id: e.vereinId,
    p_gruppe_id: e.gruppeId,
    p_name: e.name.slice(0, 80),
    p_altersklasse_id: e.altersklasseId,
    p_altersklasse_frei: e.altersklasseFrei?.slice(0, 40) ?? null,
    p_disziplin_id: e.disziplinId,
    p_taenzer: e.taenzer,
    p_trainer: e.trainer,
    p_betreuer: e.betreuer,
    p_personen: e.personen,
  });
  if (error) return { error: error.code === "P0001" || error.code === "42501" ? error.message : "Die Gruppe konnte nicht gespeichert werden." };
  revalidatePath("/dashboard/verein", "layout");
  revalidatePath("/dashboard/training");
  return { error: null, ok: e.gruppeId ? "Gruppe gespeichert." : "Gruppe erstellt.", gruppeId: String(data) };
}

// ---------- Verein suchen + Beitritt anfragen (Nutzer ohne Verein) ----------

export type VereinTreffer = { vereinId: string; name: string; ort: string | null; logoUrl: string | null };

export async function vereineSuchen(suche: string): Promise<VereinTreffer[]> {
  if (suche.trim().length < 2) return [];
  const { supabase } = await sitzung();
  const { data } = await supabase.rpc("vereine_suchen", { p_suche: suche.trim().slice(0, 60) });
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((v) => ({ vereinId: v.verein_id, name: v.name, ort: v.ort, logoUrl: v.logo_url }));
}

// Anfrage an den Verein – Mitglied wird man erst, wenn der Vereinsadmin annimmt
export async function beitrittAnfragen(vereinId: string, nachricht: string): Promise<AktionsErgebnis> {
  const { supabase } = await sitzung();
  const { error } = await supabase.rpc("beitritt_anfragen", { p_verein_id: vereinId, p_nachricht: nachricht.trim().slice(0, 500) || null });
  if (error) return { error: error.code === "P0001" ? error.message : "Die Anfrage konnte nicht gesendet werden." };
  revalidatePath("/dashboard/verein");
  return { error: null, ok: "Anfrage gesendet – der Verein entscheidet über deine Aufnahme." };
}

export async function beitrittZurueckziehen(id: string): Promise<AktionsErgebnis> {
  const { supabase } = await sitzung();
  const { error } = await supabase.rpc("beitritt_anfrage_zurueckziehen", { p_id: id });
  if (error) return { error: "Das hat nicht geklappt." };
  revalidatePath("/dashboard/verein");
  return { error: null, ok: "Anfrage zurückgezogen." };
}

// Vereinsadmin bzw. Bereich „Beitritt“: Anfrage annehmen (Person wird Mitglied) oder ablehnen
export async function beitrittsanfrageEntscheiden(id: string, annehmen: boolean, rolleId: string | null): Promise<AktionsErgebnis> {
  const { supabase } = await sitzung();
  const { error } = await supabase.rpc("beitrittsanfrage_entscheiden", { p_id: id, p_annehmen: annehmen, p_rolle_id: rolleId || null });
  if (error) return { error: error.code === "P0001" || error.code === "42501" ? error.message : "Das hat nicht geklappt." };
  revalidatePath("/dashboard/mitgliedsantraege");
  revalidatePath("/dashboard/mitglieder");
  return { error: null, ok: annehmen ? "Angenommen – die Person ist jetzt Mitglied." : "Abgelehnt." };
}

// ---------- Vereinswechsel: Zustimmung bzw. Ablehnung durch die Person selbst (DB: vereinswechsel_bestaetigen) ----------
export async function vereinswechselEntscheiden(anfrageId: string, annehmen: boolean): Promise<AktionsErgebnis> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(anfrageId)) return { error: "Ungültige Anfrage." };
  const { supabase } = await sitzung();
  const { data, error } = await supabase.rpc("vereinswechsel_bestaetigen", { p_anfrage_id: anfrageId, p_annehmen: annehmen });
  if (error) return { error: error.message };
  revalidatePath("/dashboard", "layout");
  const status = (data as { status?: string } | null)?.status;
  if (status === "abgelehnt") return { error: null, ok: "Anfrage abgelehnt – an deiner Vereinszuordnung ändert sich nichts." };
  if (status === "abgeschlossen") return { error: null, ok: "Erledigt – du bist jetzt dem neuen Verein zugeordnet." };
  return { error: null, ok: "Danke! Dein bisheriger Verein wurde um Freigabe gebeten." };
}
