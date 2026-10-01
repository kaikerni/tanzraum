"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import { UPDATE_KATEGORIEN } from "@/lib/updates/getUpdates";

// Updates & Neuigkeiten = plattform_ankuendigungen mit art "neuheit" (RLS: nur Plattform-Admins schreiben)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEIN_RECHT = "Nur für die TanzRaum-Administration.";

function neuLaden() {
  revalidatePath("/dashboard/admin/updates");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/");
  revalidatePath("/neu");
}

export async function updateAnlegen(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const titel = String(fd.get("titel") ?? "").trim().slice(0, 150);
  if (!titel) return { error: "Bitte einen Titel angeben." };
  const version = String(fd.get("version") ?? "").trim();
  if (version && !/^\d+\.\d+\.\d+$/.test(version)) return { error: "Version bitte im Format 1.2.0 angeben." };
  const kategorie = String(fd.get("kategorie") ?? "neue_funktion");
  if (!UPDATE_KATEGORIEN.some((k) => k.wert === kategorie)) return { error: "Ungültige Kategorie." };
  const kurztext = String(fd.get("kurztext") ?? "").trim().slice(0, 300);
  if (!kurztext) return { error: "Bitte eine Kurzbeschreibung angeben." };
  const datum = String(fd.get("datum") ?? "");
  const ab = datum ? new Date(datum) : new Date();
  if (Number.isNaN(ab.getTime())) return { error: "Bitte ein gültiges Datum angeben." };
  const bildPfad = String(fd.get("bild_pfad") ?? "").trim();
  if (bildPfad && !/^[0-9]{4}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(bildPfad)) return { error: "Das Bild konnte nicht zugeordnet werden." };
  // Buttonziel: interner Bereich (/dashboard/…) oder https-Link
  const linkUrl = String(fd.get("link_url") ?? "").trim();
  if (linkUrl && !/^\/(?!\/)\S*$/.test(linkUrl) && !/^https:\/\/\S+$/.test(linkUrl)) {
    return { error: "Buttonziel bitte als Pfad (z. B. /dashboard/verein) oder mit https:// angeben." };
  }
  const landingpage = fd.get("auf_landingpage") === "on";
  const benutzerbereich = fd.get("im_benutzerbereich") === "on";
  if (!landingpage && !benutzerbereich) return { error: "Bitte mindestens „Landingpage“ oder „Benutzerbereich“ wählen." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plattform_ankuendigungen")
    .insert({
      art: "neuheit",
      zielgruppe: "alle",
      titel,
      version: version || null,
      kategorie,
      kurztext,
      text: String(fd.get("text") ?? "").trim().slice(0, 5000),
      sichtbar_ab: ab.toISOString(),
      auf_landingpage: landingpage,
      im_benutzerbereich: benutzerbereich,
      wichtig: fd.get("wichtig") === "on",
      kai_hinweis: fd.get("kai_hinweis") === "on",
      push: false,
      bild_pfad: bildPfad || null,
      link_url: linkUrl || null,
      link_text: linkUrl ? String(fd.get("link_text") ?? "").trim().slice(0, 40) || null : null,
    })
    .select("id");
  if (error) return { error: error.code === "42501" ? KEIN_RECHT : freundlicherFehler(error) };
  if (!data?.length) return { error: KEIN_RECHT };
  neuLaden();
  return { error: null, ok: "Update veröffentlicht." };
}

const SCHALTER = ["auf_landingpage", "im_benutzerbereich", "kai_hinweis", "wichtig"] as const;

export async function updateSchalten(id: string, feld: (typeof SCHALTER)[number], wert: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(id) || !SCHALTER.includes(feld)) return { error: "Ungültige Angabe." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("plattform_ankuendigungen").update({ [feld]: wert }).eq("id", id).eq("art", "neuheit").select("id");
  if (error) return { error: freundlicherFehler(error) };
  if (!data?.length) return { error: KEIN_RECHT };
  neuLaden();
  return { error: null, ok: "Gespeichert." };
}
