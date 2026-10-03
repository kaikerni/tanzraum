"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Nur Plattform-Admins (RLS auf plattform_ankuendigungen)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEIN_RECHT = "Nur für die TanzRaum-Administration.";

function neuLaden() {
  revalidatePath("/dashboard/admin/ankuendigungen");
  revalidatePath("/dashboard", "layout");
}

export async function ankuendigungAnlegen(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const titel = String(fd.get("titel") ?? "").trim().slice(0, 150);
  if (!titel) return { error: "Bitte einen Titel angeben." };
  const art = String(fd.get("art") ?? "info");
  const zielgruppe = String(fd.get("zielgruppe") ?? "alle");
  if (!["info", "wartung", "neuheit"].includes(art) || !["alle", "verantwortliche", "ab16"].includes(zielgruppe)) return { error: "Ungültige Auswahl." };
  const ab = String(fd.get("sichtbar_ab") ?? "");
  const bis = String(fd.get("sichtbar_bis") ?? "");
  const abDatum = ab ? new Date(ab) : new Date();
  const bisDatum = bis ? new Date(bis) : null;
  if (Number.isNaN(abDatum.getTime()) || (bisDatum && Number.isNaN(bisDatum.getTime()))) return { error: "Bitte gültige Zeiten angeben." };
  if (bisDatum && bisDatum <= abDatum) return { error: "„Sichtbar bis“ muss nach „Sichtbar ab“ liegen." };
  const bildPfad = String(fd.get("bild_pfad") ?? "").trim();
  if (bildPfad && !/^[0-9]{4}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(bildPfad)) return { error: "Das Bild konnte nicht zugeordnet werden." };
  const linkUrl = String(fd.get("link_url") ?? "").trim();
  if (linkUrl && !/^https:\/\/\S+$/.test(linkUrl)) return { error: "Der Link muss mit https:// beginnen." };
  const linkText = String(fd.get("link_text") ?? "").trim().slice(0, 40);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plattform_ankuendigungen")
    .insert({
      bild_pfad: bildPfad || null,
      link_url: linkUrl || null,
      link_text: linkUrl ? linkText || null : null,
      titel,
      text: String(fd.get("text") ?? "").trim().slice(0, 5000),
      art,
      zielgruppe,
      wichtig: fd.get("wichtig") === "on",
      push: fd.get("push") === "on",
      sichtbar_ab: abDatum.toISOString(),
      sichtbar_bis: bisDatum ? bisDatum.toISOString() : null,
    })
    .select("id");
  if (error) return { error: error.code === "42501" ? KEIN_RECHT : freundlicherFehler(error) };
  if (!data?.length) return { error: KEIN_RECHT };
  neuLaden();
  return { error: null, ok: "Ankündigung angelegt." };
}

export async function ankuendigungBeenden(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Ankündigung." };
  const supabase = await createClient();
  const jetzt = new Date();
  const { data: a } = await supabase.from("plattform_ankuendigungen").select("sichtbar_ab").eq("id", id).maybeSingle();
  if (!a) return { error: KEIN_RECHT };
  // Noch nicht gestartete Ankuendigungen: Ende knapp nach dem Start, damit die Pruefung (bis > ab) erfuellt bleibt
  const ende = new Date(Math.max(jetzt.getTime(), new Date(a.sichtbar_ab).getTime() + 1000));
  const { error } = await supabase.from("plattform_ankuendigungen").update({ sichtbar_bis: ende.toISOString() }).eq("id", id);
  if (error) return { error: freundlicherFehler(error) };
  neuLaden();
  return { error: null, ok: "Beendet." };
}

export async function ankuendigungLoeschen(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Ankündigung." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("plattform_ankuendigungen").delete().eq("id", id).select("id, bild_pfad");
  if (error) return { error: freundlicherFehler(error) };
  if (!data?.length) return { error: KEIN_RECHT };
  // Bild mit entfernen (Storage-Policy: nur Plattform-Admins)
  if (data[0].bild_pfad) await supabase.storage.from("ankuendigungen").remove([data[0].bild_pfad]);
  neuLaden();
  return { error: null, ok: "Gelöscht." };
}
