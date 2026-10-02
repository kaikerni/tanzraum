"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// 📚 TanzRaum Wissen – erstellen/bearbeiten/veroeffentlichen/loeschen nur mit dem jeweiligen Team-Recht (DB prueft)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type WissenEingabe = {
  titel: string;
  kategorie_id: string;
  einleitung: string;
  inhalt: string;
  link: string;
  redaktionshinweis: string;
  treff_thema_id: string;
  bild_pfad: string | null;
};

export async function wissenSpeichern(id: string | null, e: WissenEingabe): Promise<AktionsErgebnis & { id?: string }> {
  if (id && !UUID.test(id)) return { error: "Ungültiger Beitrag." };
  if (e.titel.trim().length < 5) return { error: "Der Titel braucht mindestens 5 Zeichen." };
  if (e.inhalt.trim().length < 10) return { error: "Bitte schreib den Inhalt (mindestens 10 Zeichen)." };
  if (e.link.trim() && !/^https?:\/\/\S+$/.test(e.link.trim())) return { error: "Der Link muss mit https:// beginnen." };
  if ((e.kategorie_id && !UUID.test(e.kategorie_id)) || (e.treff_thema_id && !UUID.test(e.treff_thema_id))) return { error: "Ungültige Auswahl." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("wissen_speichern", {
    p_id: id,
    p: {
      titel: e.titel.trim().slice(0, 160),
      kategorie_id: e.kategorie_id || null,
      einleitung: e.einleitung.trim().slice(0, 1000),
      inhalt: e.inhalt.trim().slice(0, 30000),
      link: e.link.trim(),
      redaktionshinweis: e.redaktionshinweis.trim().slice(0, 500),
      treff_thema_id: e.treff_thema_id || null,
      bild_pfad: e.bild_pfad,
    },
  });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/treff/wissen", "layout");
  return { error: null, id: data as string, ok: "Gespeichert." };
}

export async function wissenVeroeffentlichen(id: string, an: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültiger Beitrag." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("wissen_veroeffentlichen", { p_id: id, p_an: an });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/treff/wissen", "layout");
  return { error: null, ok: an ? "Veröffentlicht – für alle angemeldeten Nutzer sichtbar." : "Zurückgezogen – wieder ein Entwurf." };
}

export async function wissenLoeschen(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültiger Beitrag." };
  const supabase = await createClient();
  const { data: bild, error } = await supabase.rpc("wissen_loeschen", { p_id: id });
  if (error) return { error: freundlicherFehler(error) };
  if (typeof bild === "string" && bild) await supabase.storage.from("wissen").remove([bild]);
  revalidatePath("/dashboard/treff/wissen", "layout");
  return { error: null, ok: "Gelöscht." };
}
