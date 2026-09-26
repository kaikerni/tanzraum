"use server";

// TanzRaum-Admin: Pflege des zentralen Verbandskatalogs (RLS: nur Plattform-Admins duerfen schreiben).
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

async function adminSitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");
  return { supabase, user };
}
const t = (fd: FormData, f: string, max = 2000) => {
  const w = String(fd.get(f) ?? "").trim();
  return w ? w.slice(0, max) : null;
};
const d = (fd: FormData, f: string) => {
  const w = String(fd.get(f) ?? "").trim();
  return DATUM.test(w) ? w : null;
};
function neu() {
  revalidatePath("/dashboard/admin/ehrungen", "layout");
  revalidatePath("/dashboard/vereinsverwaltung/ehrungen", "layout");
}

// Pruefstatus, Quelle, Link, Bemerkung, naechste Pruefung, aktiv – fuer Organisation oder Auszeichnung
export async function pruefungSpeichern(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const id = String(fd.get("id") ?? "");
  const tabelle = fd.get("tabelle") === "organisation" ? "ehrungs_organisationen" : "ehrungsarten";
  const status = String(fd.get("pruefstatus") ?? "");
  if (!UUID.test(id) || !["nicht_geprueft", "geprueft", "bestaetigt"].includes(status)) return { error: "Ungültige Angaben." };
  const url = t(fd, "quelle_url", 500);
  if (url && !/^https:\/\//i.test(url)) return { error: "Der Link muss mit https:// beginnen." };
  const { supabase, user } = await adminSitzung();
  const { error } = await supabase
    .from(tabelle)
    .update({
      pruefstatus: status,
      geprueft_am: status === "nicht_geprueft" ? null : (d(fd, "geprueft_am") ?? new Date().toISOString().slice(0, 10)),
      geprueft_von: status === "nicht_geprueft" ? null : user.id,
      quelle: t(fd, "quelle", 500),
      quelle_url: url,
      pruef_bemerkung: t(fd, "pruef_bemerkung"),
      naechste_pruefung: d(fd, "naechste_pruefung"),
      aktiv: fd.get("aktiv") === "ja",
    })
    .eq("id", id);
  if (error) return { error: "Die Prüfung konnte nicht gespeichert werden." };
  neu();
  return { error: null, ok: "Gespeichert." };
}

export async function organisationAnlegen(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const name = t(fd, "name", 200);
  const art = String(fd.get("art") ?? "regionalverband");
  if (!name) return { error: "Bitte einen Namen angeben." };
  if (!["dachverband", "regionalverband", "traditionsverband", "sonstige"].includes(art)) return { error: "Ungültige Art." };
  const { supabase } = await adminSitzung();
  const { error } = await supabase.from("ehrungs_organisationen").insert({
    name,
    kuerzel: t(fd, "kuerzel", 20),
    art,
    beschreibung: t(fd, "beschreibung"),
    quelle: t(fd, "quelle", 500),
    pruefstatus: "nicht_geprueft",
  });
  if (error) return { error: error.code === "23505" ? "Diese Organisation gibt es bereits." : "Die Organisation konnte nicht angelegt werden." };
  neu();
  return { error: null, ok: "Organisation angelegt." };
}

export async function verbandAuszeichnungSpeichern(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const id = String(fd.get("id") ?? "");
  const orgId = String(fd.get("organisation_id") ?? "");
  const name = t(fd, "name", 200);
  const nr = String(fd.get("stufe_nr") ?? "").trim();
  if (!name) return { error: "Bitte einen Namen angeben." };
  if (nr && !/^\d{1,3}$/.test(nr)) return { error: "Die Stufen-Nummer muss eine Zahl sein." };
  const werte = {
    name,
    serie: t(fd, "serie", 200),
    stufe: t(fd, "stufe", 100),
    stufe_nr: nr ? Number(nr) : null,
    kategorie: t(fd, "kategorie", 100),
    beschreibung: t(fd, "beschreibung"),
    voraussetzungen: t(fd, "voraussetzungen"),
    regel_verknuepfung: fd.get("regel_verknuepfung") === "alle" ? "alle" : "eine",
    automatische_vorschlaege: fd.get("automatische_vorschlaege") === "ja",
    bestellung_erforderlich: fd.get("bestellung_erforderlich") === "ja",
    antrag_erforderlich: fd.get("antrag_erforderlich") === "ja",
  };
  const { supabase } = await adminSitzung();
  if (UUID.test(id)) {
    const { error } = await supabase.from("ehrungsarten").update(werte).eq("id", id).eq("typ", "verband");
    if (error) return { error: "Die Auszeichnung konnte nicht gespeichert werden." };
    neu();
    return { error: null, ok: "Gespeichert. Bereits verliehene Ehrungen bleiben unverändert." };
  }
  if (!UUID.test(orgId)) return { error: "Ungültige Organisation." };
  const { data, error } = await supabase
    .from("ehrungsarten")
    .insert({ ...werte, typ: "verband", organisation_id: orgId, pruefstatus: "nicht_geprueft" })
    .select("id")
    .single();
  if (error) return { error: "Die Auszeichnung konnte nicht angelegt werden." };
  neu();
  redirect(`/dashboard/admin/ehrungen/${data.id}`);
}
