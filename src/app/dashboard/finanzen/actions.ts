"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import { BELEG_BUCKET, RHYTHMEN, ZAHLUNGSARTEN, betragLesen } from "@/lib/finanzen";

// Alle Rechte prueft die Datenbank (darf_finanzen: Vereinsadmin bzw. Bereich "Finanzen", Vereinslizenz).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const PFAD = "/dashboard/finanzen";

function fehler(e: { code?: string; message?: string } | null): string {
  if (e && (e.code === "P0001" || e.code === "42501") && e.message && !e.message.startsWith("new row")) return e.message;
  if (e?.code === "42501") return "Dafür fehlt dir die Berechtigung.";
  if (e?.code === "23514") return "Bitte die Eingaben prüfen (Betrag, Textlänge).";
  return freundlicherFehler(e);
}

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=${PFAD}`);
  return supabase;
}

const text = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);

// ---------- Kassenbuch ----------
export async function buchungSpeichern(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const id = text(fd, "id");
  const vereinId = text(fd, "verein_id");
  const typ = text(fd, "typ") === "ausgabe" ? "ausgabe" : "einnahme";
  const betrag = betragLesen(text(fd, "betrag", 20));
  const datum = text(fd, "datum", 10);
  if (!Number.isFinite(betrag) || betrag <= 0) return { error: "Bitte einen Betrag größer als 0 angeben." };
  if (!DATUM.test(datum)) return { error: "Bitte ein Datum angeben." };
  const beleg = text(fd, "beleg_pfad", 300);
  const werte: Record<string, unknown> = {
    typ,
    datum,
    betrag,
    kategorie: text(fd, "kategorie", 60) || null,
    beschreibung: text(fd, "beschreibung", 300) || null,
    zahlungsart: text(fd, "zahlungsart", 40) || null,
  };
  if (beleg) {
    werte.beleg_pfad = beleg;
    werte.beleg_name = text(fd, "beleg_name", 160) || null;
  }
  const { error } = UUID.test(id)
    ? await supabase.from("kassenbuch_eintraege").update(werte).eq("id", id)
    : UUID.test(vereinId)
      ? await supabase.from("kassenbuch_eintraege").insert({ ...werte, verein_id: vereinId })
      : { error: { message: "Kein Verein gewählt." } };
  if (error) return { error: fehler(error) };
  revalidatePath(PFAD);
  return { error: null, ok: "Gespeichert." };
}

export async function buchungLoeschen(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data, error } = await supabase.from("kassenbuch_eintraege").delete().eq("id", id).select("beleg_pfad");
  if (error) return { error: fehler(error) };
  if (!data?.length) return { error: "Dafür fehlt dir die Berechtigung." };
  if (data[0].beleg_pfad) await supabase.storage.from(BELEG_BUCKET).remove([data[0].beleg_pfad]);
  revalidatePath(PFAD);
  return { error: null, ok: "Gelöscht." };
}

// ---------- Beitragsarten ----------
export async function beitragsartSpeichern(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const id = text(fd, "id");
  const betrag = betragLesen(text(fd, "betrag", 20));
  const rhythmus = text(fd, "rhythmus");
  const werte = {
    name: text(fd, "name", 80),
    betrag: Number.isFinite(betrag) && betrag >= 0 ? betrag : NaN,
    rhythmus: (RHYTHMEN as readonly string[]).includes(rhythmus) ? rhythmus : "jährlich",
    aktiv: fd.has("aktiv_gesetzt") ? fd.get("aktiv") === "1" : true,
  };
  if (!werte.name) return { error: "Bitte einen Namen angeben." };
  if (!Number.isFinite(werte.betrag)) return { error: "Bitte einen gültigen Betrag angeben." };
  const { error } = UUID.test(id)
    ? await supabase.from("beitragstypen").update(werte).eq("id", id)
    : await supabase.from("beitragstypen").insert({ ...werte, verein_id: text(fd, "verein_id") });
  if (error) return { error: fehler(error) };
  revalidatePath(PFAD);
  return { error: null, ok: "Beitragsart gespeichert." };
}

export async function beitragsartLoeschen(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  // Bereits angelegte Beitraege bleiben (mit Namen) erhalten
  const { data, error } = await supabase.from("beitragstypen").delete().eq("id", id).select("id");
  if (error) return { error: fehler(error) };
  if (!data?.length) return { error: "Dafür fehlt dir die Berechtigung." };
  revalidatePath(PFAD);
  return { error: null, ok: "Beitragsart gelöscht – bestehende Beiträge bleiben erhalten." };
}

// ---------- Beitraege ----------
export async function beitraegeErzeugen(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const typ = text(fd, "typ");
  const faellig = text(fd, "faellig", 10);
  if (!UUID.test(typ)) return { error: "Bitte eine Beitragsart wählen." };
  if (!DATUM.test(faellig)) return { error: "Bitte ein Fälligkeitsdatum angeben." };
  const auswahl = fd.get("fuer") === "auswahl" ? fd.getAll("personen").map(String).filter((x) => UUID.test(x)) : null;
  if (auswahl && auswahl.length === 0) return { error: "Bitte mindestens eine Person auswählen." };
  const { data, error } = await supabase.rpc("beitraege_erzeugen", { p_typ: typ, p_faellig: faellig, p_vm_ids: auswahl });
  if (error) return { error: fehler(error) };
  revalidatePath(PFAD);
  const n = Number(data ?? 0);
  return { error: null, ok: n === 0 ? "Keine neuen Beiträge – für diese Fälligkeit gibt es schon alle." : `${n} ${n === 1 ? "Beitrag" : "Beiträge"} angelegt.` };
}

export async function beitragBezahlt(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const id = text(fd, "id");
  const datum = text(fd, "datum", 10);
  const weg = text(fd, "zahlungsweg", 40);
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  const { error } = await supabase.rpc("beitrag_bezahlt", {
    p_id: id,
    p_bezahlt: true,
    p_datum: DATUM.test(datum) ? datum : null,
    p_zahlungsweg: ZAHLUNGSARTEN.includes(weg) ? weg : null,
    p_kassenbuch: fd.get("kassenbuch") === "1",
  });
  if (error) return { error: fehler(error) };
  revalidatePath(PFAD);
  return { error: null, ok: "Als bezahlt markiert." };
}

export async function beitragOffen(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("beitrag_bezahlt", { p_id: id, p_bezahlt: false });
  if (error) return { error: fehler(error) };
  revalidatePath(PFAD);
  return { error: null, ok: "Wieder offen – die Kassenbuch-Buchung wurde entfernt." };
}

export async function beitragErinnern(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("beitrag_erinnern", { p_id: id });
  if (error) return { error: fehler(error) };
  revalidatePath(PFAD);
  return { error: null, ok: "Erinnerung verschickt." };
}

export async function beitragLoeschen(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data, error } = await supabase.from("beitraege").delete().eq("id", id).select("id");
  if (error) return { error: fehler(error) };
  if (!data?.length) return { error: "Dafür fehlt dir die Berechtigung." };
  revalidatePath(PFAD);
  return { error: null, ok: "Beitrag gelöscht." };
}
