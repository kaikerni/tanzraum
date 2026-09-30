"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import { ARTEN, KOSTUEM_BUCKET, ZUSTAENDE, type KostuemArt, type KostuemZustand } from "@/lib/kostueme";

// Alle Rechte prueft die Datenbank (darf_kostueme_verwalten: Vereinsadmin bzw. Bereich "Kostueme", Vereinslizenz).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PFAD = "/dashboard/kostueme";

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=${PFAD}`);
  return supabase;
}

function fehler(e: { code?: string; message?: string }): string {
  if ((e.code === "P0001" || e.code === "42501") && e.message && !e.message.startsWith("new row")) return e.message;
  if (e.code === "42501") return "Dafür fehlt dir die Berechtigung.";
  if (e.code === "23514") return "Bitte die Eingaben prüfen (Bezeichnung 1–120 Zeichen, Anzahl 1–9999).";
  return freundlicherFehler(e);
}

const text = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);
const leerNull = (s: string) => (s === "" ? null : s);

export async function teilSpeichern(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const id = text(fd, "id");
  const vereinId = text(fd, "verein_id");
  const art = text(fd, "art") as KostuemArt;
  const zustand = text(fd, "zustand") as KostuemZustand;
  const satz = text(fd, "satz");
  const anzahl = Math.round(Number(text(fd, "anzahl") || "1"));
  const werte = {
    teil: text(fd, "teil", 120),
    art: ARTEN.includes(art) ? art : "kostuem",
    zustand: ZUSTAENDE.includes(zustand) ? zustand : "gut",
    groesse: leerNull(text(fd, "groesse", 40)),
    lagerort: leerNull(text(fd, "lagerort", 120)),
    notiz: leerNull(text(fd, "notiz", 1000)),
    anzahl: Number.isFinite(anzahl) ? Math.min(9999, Math.max(1, anzahl)) : 1,
    kostuem_gruppe_id: UUID.test(satz) ? satz : null,
  };
  if (!werte.teil) return { error: "Bitte eine Bezeichnung angeben." };

  if (UUID.test(id)) {
    const { error } = await supabase.from("kostueme").update(werte).eq("id", id);
    if (error) return { error: fehler(error) };
  } else {
    if (!UUID.test(vereinId)) return { error: "Kein Verein gewählt." };
    // Mehrere gleiche Teile (z. B. 12 Jacken in verschiedenen Groessen) als einzelne Stuecke anlegen
    const stueck = Math.min(50, Math.max(1, Math.round(Number(text(fd, "stueck") || "1")) || 1));
    const groessen = text(fd, "groessen", 400)
      .split(/[,;\n]/)
      .map((g) => g.trim().slice(0, 40))
      .filter(Boolean);
    const zeilen =
      groessen.length > 0
        ? groessen.slice(0, 50).map((g) => ({ ...werte, groesse: g, verein_id: vereinId }))
        : Array.from({ length: stueck }, () => ({ ...werte, verein_id: vereinId }));
    const { error } = await supabase.from("kostueme").insert(zeilen);
    if (error) return { error: fehler(error) };
    revalidatePath(PFAD);
    return { error: null, ok: zeilen.length === 1 ? "Gespeichert." : `${zeilen.length} Teile angelegt.` };
  }
  revalidatePath(PFAD);
  return { error: null, ok: "Gespeichert." };
}

export async function teilLoeschen(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data, error } = await supabase.from("kostueme").delete().eq("id", id).select("id");
  if (error) return { error: fehler(error) };
  if (!data?.length) return { error: "Ausgegebene Teile bitte zuerst zurücknehmen." };
  revalidatePath(PFAD);
  return { error: null, ok: "Gelöscht." };
}

export async function satzSpeichern(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const id = text(fd, "id");
  const farbe = text(fd, "farbe", 7);
  const werte = {
    name: text(fd, "name", 80),
    beschreibung: leerNull(text(fd, "beschreibung", 500)),
    farbe: /^#[0-9a-f]{6}$/i.test(farbe) ? farbe : null,
  };
  if (!werte.name) return { error: "Bitte einen Namen angeben." };
  const { error } = UUID.test(id)
    ? await supabase.from("kostuem_gruppen").update(werte).eq("id", id)
    : await supabase.from("kostuem_gruppen").insert({ ...werte, verein_id: text(fd, "verein_id") });
  if (error) return { error: fehler(error) };
  revalidatePath(PFAD);
  return { error: null, ok: "Kostümsatz gespeichert." };
}

export async function satzLoeschen(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  // Teile bleiben erhalten (ohne Satz)
  const { data, error } = await supabase.from("kostuem_gruppen").delete().eq("id", id).select("id");
  if (error) return { error: fehler(error) };
  if (!data?.length) return { error: "Dafür fehlt dir die Berechtigung." };
  revalidatePath(PFAD);
  return { error: null, ok: "Kostümsatz gelöscht – die Teile bleiben im Inventar." };
}

export async function ausgeben(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const id = text(fd, "id");
  const person = text(fd, "person");
  const bis = text(fd, "bis", 10);
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  if (!UUID.test(person)) return { error: "Bitte eine Person wählen." };
  const { error } = await supabase.rpc("kostuem_ausgeben", {
    p_id: id,
    p_vm_id: person,
    p_bis: /^\d{4}-\d{2}-\d{2}$/.test(bis) ? bis : null,
    p_notiz: text(fd, "notiz", 500),
  });
  if (error) return { error: fehler(error) };
  revalidatePath(PFAD);
  return { error: null, ok: "Ausgegeben." };
}

export async function zuruecknehmen(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const id = text(fd, "id");
  const zustand = text(fd, "zustand") as KostuemZustand;
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  const { error } = await supabase.rpc("kostuem_zuruecknehmen", {
    p_id: id,
    p_zustand: ZUSTAENDE.includes(zustand) ? zustand : null,
    p_notiz: text(fd, "notiz", 500),
  });
  if (error) return { error: fehler(error) };
  revalidatePath(PFAD);
  return { error: null, ok: "Zurückgenommen." };
}

// Foto setzen (nach dem Hochladen im Browser) oder entfernen; das alte Foto wird aus dem Speicher geloescht
export async function fotoSetzen(id: string, pfad: string | null): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data: teil } = await supabase.from("kostueme").select("verein_id, bild_pfad").eq("id", id).maybeSingle();
  if (!teil) return { error: "Teil nicht gefunden." };
  if (pfad !== null && !new RegExp(`^${teil.verein_id}/${id}/[0-9a-f-]{36}\\.jpg$`, "i").test(pfad)) return { error: "Ungültiges Foto." };
  const { data, error } = await supabase.from("kostueme").update({ bild_pfad: pfad }).eq("id", id).select("id");
  if (error) return { error: fehler(error) };
  if (!data?.length) return { error: "Dafür fehlt dir die Berechtigung." };
  if (teil.bild_pfad && teil.bild_pfad !== pfad) await supabase.storage.from(KOSTUEM_BUCKET).remove([teil.bild_pfad]);
  revalidatePath(PFAD);
  return { error: null, ok: pfad ? "Foto gespeichert." : "Foto entfernt." };
}
