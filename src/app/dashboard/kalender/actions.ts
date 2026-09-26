"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Rechte erzwingt die Datenbank: private Termine nur ab BASIC und nur fuer sich selbst,
// Vereinstermine nur Vereinsadmin bzw. Bereich "saison" (mit Vereinslizenz), Zu-/Absagen nur per RPC
// fuer sich selbst oder eigene Kinder, Abo-Token nur ab BASIC.

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const ZEIT = /^\d{2}:\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ARTEN = ["veranstaltung", "auftritt", "sitzung", "sonstiges"];
const ZIELGRUPPEN = ["verein", "gruppen", "leitung"];

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function neuLaden() {
  revalidatePath("/dashboard/kalender", "layout");
  revalidatePath("/dashboard");
}

function text(formData: FormData, feld: string, max: number) {
  return String(formData.get(feld) ?? "").trim().slice(0, max);
}

export async function terminSpeichern(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const id = text(formData, "id", 36);
  const wo = text(formData, "wo", 36);
  const titel = text(formData, "titel", 120);
  const datum = text(formData, "datum", 10);
  const mehrtaegig = formData.get("mehrtaegig") === "on";
  const bisDatum = mehrtaegig ? text(formData, "bis_datum", 10) : "";
  const ganztags = formData.get("ganztags") === "on";
  const von = ganztags ? "" : text(formData, "von", 5);
  const bis = ganztags ? "" : text(formData, "bis", 5);
  const privat = wo === "privat";
  const art = privat ? "privat" : text(formData, "art", 20);
  const zielgruppe = privat ? "verein" : text(formData, "zielgruppe", 10);
  const gruppen = privat || zielgruppe !== "gruppen" ? [] : formData.getAll("gruppen").map(String).filter((g) => UUID.test(g));

  if (!id && !privat && !UUID.test(wo)) return { error: "Bitte wählen, wo der Termin eingetragen wird." };
  if (!titel) return { error: "Bitte einen Titel angeben." };
  if (!DATUM.test(datum)) return { error: "Bitte ein Datum wählen." };
  if (mehrtaegig && (!DATUM.test(bisDatum) || bisDatum <= datum)) return { error: "Das Enddatum muss nach dem Startdatum liegen." };
  if (!ganztags && !ZEIT.test(von)) return { error: "Bitte eine Beginnzeit angeben – oder „ganztägig“ wählen." };
  if (bis && !ZEIT.test(bis)) return { error: "Ungültige Endzeit." };
  if (bis && !mehrtaegig && bis <= von) return { error: "Das Ende muss nach dem Beginn liegen." };
  if (!privat && !ARTEN.includes(art)) return { error: "Bitte eine Terminart wählen." };
  if (!privat && !ZIELGRUPPEN.includes(zielgruppe)) return { error: "Bitte wählen, für wen der Termin ist." };
  if (zielgruppe === "gruppen" && gruppen.length === 0) return { error: "Bitte mindestens eine Gruppe wählen." };

  const felder = {
    art,
    titel,
    beschreibung: text(formData, "beschreibung", 2000) || null,
    ort: text(formData, "ort", 200) || null,
    datum,
    bis_datum: mehrtaegig ? bisDatum : null,
    von: von || null,
    bis: bis || null,
    zielgruppe,
    gruppe_ids: gruppen,
    rueckmeldung: !privat && formData.get("rueckmeldung") === "on",
  };

  const { supabase } = await sitzung();
  let terminId = id;
  if (id) {
    if (!UUID.test(id)) return { error: "Termin nicht gefunden." };
    const { data, error } = await supabase.from("termine").update(felder).eq("id", id).select("id");
    if (error) return { error: freundlicherFehler(error) };
    if (!data?.length) return { error: "Diesen Termin darfst du nicht bearbeiten." };
  } else {
    const { data, error } = await supabase
      .from("termine")
      .insert({ ...felder, verein_id: privat ? null : wo })
      .select("id")
      .single();
    if (error) {
      return {
        error:
          error.code === "42501"
            ? privat
              ? "Eigene Termine sind ab dem Tarif BASIC enthalten."
              : "Vereinstermine anlegen dürfen Vereinsadmins und Personen mit dem Bereich „Saisonplanung“."
            : freundlicherFehler(error),
      };
    }
    terminId = data.id;
  }
  neuLaden();
  redirect(`/dashboard/kalender/termin/${terminId}`);
}

export async function terminLoeschen(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Termin nicht gefunden." };
  const { supabase } = await sitzung();
  const { data, error } = await supabase.from("termine").delete().eq("id", id).select("datum");
  if (error) return { error: freundlicherFehler(error) };
  if (!data?.length) return { error: "Diesen Termin darfst du nicht löschen." };
  neuLaden();
  redirect(`/dashboard/kalender?monat=${String(data[0].datum).slice(0, 7)}`);
}

export async function rueckmelden(
  terminId: string,
  vmId: string,
  status: "zugesagt" | "abgesagt" | "vielleicht" | null,
): Promise<AktionsErgebnis> {
  if (!UUID.test(terminId) || !UUID.test(vmId)) return { error: "Ungültige Auswahl." };
  const { supabase } = await sitzung();
  const { error } = await supabase.rpc("termin_rueckmelden", { p_termin_id: terminId, p_vm_id: vmId, p_status: status });
  if (error) return { error: freundlicherFehler(error) };
  neuLaden();
  return { error: null, ok: status ? "Rückmeldung gespeichert." : "Rückmeldung zurückgenommen." };
}

export type AboLinks = { error: string | null; persoenlich?: string; turniere?: string };

export async function aboLinksHolen(neu: boolean): Promise<AboLinks> {
  const { supabase } = await sitzung();
  const { data, error } = await supabase.rpc("mein_ical_token", { p_neu: neu });
  if (error || !data) return { error: error ? freundlicherFehler(error) : "Der Abo-Link konnte nicht erstellt werden." };
  const basis = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ical-export?token=${encodeURIComponent(data as string)}`;
  return { error: null, persoenlich: basis, turniere: `${basis}&inhalt=turniere` };
}
