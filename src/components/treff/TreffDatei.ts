"use client";

import { createClient } from "@/lib/supabase/client";
import { bildVerkleinern } from "@/lib/medien/bild";
import { speicherVorpruefung } from "@/lib/speicher";

// Bild (verkleinert) bzw. PDF in den privaten Treff-Speicher laden: <user_id>/<uuid>.<endung>
export async function treffHochladen(userId: string, datei: File): Promise<{ pfad: string; name: string } | { fehler: string }> {
  const pdf = datei.type === "application/pdf";
  if (!pdf && !datei.type.startsWith("image/")) return { fehler: "Bitte ein Bild oder ein PDF auswählen." };
  if (datei.size > 10 * 1024 * 1024) return { fehler: "Die Datei ist größer als 10 MB." };
  const inhalt: Blob = pdf ? datei : await bildVerkleinern(datei, 1600);
  const pfad = `${userId}/${crypto.randomUUID()}.${pdf ? "pdf" : "jpg"}`;
  const speicher = await speicherVorpruefung(createClient(), "treff", pfad, inhalt.size);
  if (speicher) return { fehler: speicher };
  const { error } = await createClient().storage.from("treff").upload(pfad, inhalt, { contentType: pdf ? "application/pdf" : "image/jpeg" });
  if (error) return { fehler: "Die Datei konnte nicht hochgeladen werden." };
  return { pfad, name: datei.name.slice(0, 120) };
}
