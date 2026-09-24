"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Rechte erzwingt die Datenbank (RLS + Konsistenz-Trigger): abmelden nur sich selbst/eigene Kinder
// bzw. als Gruppentrainer, Termine nur Vereinsadmin/Gruppentrainer, Anwesenheit nur mit Bereich "anwesenheit".

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const ZEIT = /^\d{2}:\d{2}$/;

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function neuLaden() {
  revalidatePath("/dashboard/training");
  revalidatePath("/dashboard/anwesenheit");
  revalidatePath("/dashboard");
}

export async function abmelden(
  vereinId: string,
  gruppeId: string,
  datum: string,
  vmId: string,
  grund: string,
): Promise<AktionsErgebnis> {
  if (!DATUM.test(datum)) return { error: "Ungültiges Datum." };
  const { supabase } = await sitzung();
  const { error } = await supabase.from("trainings_abmeldungen").insert({
    verein_id: vereinId,
    gruppe_id: gruppeId,
    datum,
    vereins_mitglied_id: vmId,
    grund: grund.trim().slice(0, 300) || null,
  });
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "Abmelden geht nur für heute oder später – und nur für dich selbst oder deine Kinder."
          : freundlicherFehler(error),
    };
  }
  neuLaden();
  return { error: null, ok: "Abgemeldet." };
}

export async function abmeldungZuruecknehmen(gruppeId: string, datum: string, vmId: string): Promise<AktionsErgebnis> {
  const { supabase } = await sitzung();
  const { data, error } = await supabase
    .from("trainings_abmeldungen")
    .delete()
    .eq("gruppe_id", gruppeId)
    .eq("datum", datum)
    .eq("vereins_mitglied_id", vmId)
    .select("id");
  if (error) return { error: freundlicherFehler(error) };
  if (!data?.length) return { error: "Dafür fehlt dir die Berechtigung." };
  neuLaden();
  return { error: null, ok: "Abmeldung zurückgenommen." };
}

export async function trainingAnlegen(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const [gruppeId, vereinId] = String(formData.get("gruppe") ?? "").split("|");
  const art = String(formData.get("art") ?? "woechentlich");
  const von = String(formData.get("von") ?? "");
  const bis = String(formData.get("bis") ?? "");
  const wochentag = Number(formData.get("wochentag"));
  const datum = String(formData.get("datum") ?? "");
  if (!gruppeId || !vereinId) return { error: "Bitte eine Gruppe wählen." };
  if (!ZEIT.test(von) || !ZEIT.test(bis)) return { error: "Bitte Beginn und Ende angeben." };
  if (art === "woechentlich" && !(wochentag >= 1 && wochentag <= 7)) return { error: "Bitte einen Wochentag wählen." };
  if (art === "einmalig" && !DATUM.test(datum)) return { error: "Bitte ein Datum wählen." };

  const { supabase, user } = await sitzung();
  const { error } = await supabase.from("trainingstermine").insert({
    verein_id: vereinId,
    gruppe_id: gruppeId,
    ist_wiederholend: art === "woechentlich",
    wochentag: art === "woechentlich" ? wochentag : null,
    datum: art === "einmalig" ? datum : null,
    von,
    bis,
    halle: String(formData.get("halle") ?? "").trim() || null,
    titel: String(formData.get("titel") ?? "").trim() || null,
    erstellt_von: user.id,
  });
  if (error) {
    return {
      error: error.code === "42501" ? "Trainings anlegen dürfen nur Vereinsadmin und Gruppentrainer." : freundlicherFehler(error),
    };
  }
  neuLaden();
  redirect("/dashboard/training");
}

export async function trainingLoeschen(terminId: string): Promise<AktionsErgebnis> {
  const { supabase } = await sitzung();
  const { data, error } = await supabase.from("trainingstermine").delete().eq("id", terminId).select("id");
  if (error) return { error: freundlicherFehler(error) };
  if (!data?.length) return { error: "Dafür fehlt dir die Berechtigung." };
  neuLaden();
  return { error: null, ok: "Trainingstermin gelöscht." };
}

export async function anwesenheitSpeichern(
  vereinId: string,
  gruppeId: string,
  datum: string,
  eintraege: { vmId: string; anwesend: boolean }[],
): Promise<AktionsErgebnis> {
  if (!DATUM.test(datum)) return { error: "Ungültiges Datum." };
  if (eintraege.length === 0) return { error: "Bitte zuerst Anwesenheiten markieren." };
  const { supabase, user } = await sitzung();
  const { error } = await supabase.from("trainings_anwesenheit").upsert(
    eintraege.map((e) => ({
      verein_id: vereinId,
      gruppe_id: gruppeId,
      datum,
      vereins_mitglied_id: e.vmId,
      anwesend: e.anwesend,
      erfasst_von: user.id,
      erfasst_am: new Date().toISOString(),
    })),
    { onConflict: "gruppe_id,datum,vereins_mitglied_id" },
  );
  if (error) {
    return {
      error: error.code === "42501" ? "Anwesenheit erfassen dürfen nur Betreuer dieser Gruppe mit dem Bereich „Anwesenheit“." : freundlicherFehler(error),
    };
  }
  neuLaden();
  return { error: null, ok: `Anwesenheit gespeichert (${eintraege.filter((e) => e.anwesend).length} von ${eintraege.length} da).` };
}
