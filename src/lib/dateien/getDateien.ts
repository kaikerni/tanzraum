import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "vereins-dateien";

export type Datei = {
  id: string;
  name: string;
  ordner: string | null;
  groesse: number;
  mime: string;
  istMedien: boolean;
  hochgeladenAm: string;
  pfad: string;
  url: string | null;
};

export type Speicher = { belegt: number; limit: number; dateien: number; darfHochladen: boolean };

export function groesseText(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

// Belegung + Rechte (DB: teamcloud_speicher). null = kein Zugriff
export async function getSpeicher(supabase: SupabaseClient, vereinId: string | null): Promise<Speicher | null> {
  const { data, error } = await supabase.rpc("teamcloud_speicher", { p_verein_id: vereinId });
  if (error || !data) return null;
  // deno-lint-ignore no-explicit-any
  const d = data as any;
  return { belegt: Number(d.belegt ?? 0), limit: Number(d.limit ?? 0), dateien: Number(d.dateien ?? 0), darfHochladen: !!d.darf_hochladen };
}

// Dateien eines Vereins bzw. eigene Dateien, mit kurzlebigen Download-Links (RLS: nur Berechtigte)
export async function getDateien(supabase: SupabaseClient, vereinId: string | null, userId: string): Promise<Datei[]> {
  let q = supabase
    .from("dateien")
    .select("id, name, ordner_pfad, groesse_bytes, mime_type, ist_medien, hochgeladen_am, storage_path")
    .order("ordner_pfad", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true })
    .limit(500);
  q = vereinId ? q.eq("verein_id", vereinId) : q.eq("user_id", userId).is("verein_id", null);
  const { data } = await q;
  // deno-lint-ignore no-explicit-any
  const zeilen = (data ?? []) as any[];
  if (zeilen.length === 0) return [];
  const { data: links } = await supabase.storage.from(BUCKET).createSignedUrls(
    zeilen.map((z) => z.storage_path),
    3600,
  );
  const url = new Map((links ?? []).map((l) => [l.path, l.signedUrl]));
  return zeilen.map((z) => ({
    id: z.id,
    name: z.name,
    ordner: z.ordner_pfad,
    groesse: Number(z.groesse_bytes ?? 0),
    mime: z.mime_type ?? "",
    istMedien: !!z.ist_medien,
    hochgeladenAm: z.hochgeladen_am,
    pfad: z.storage_path,
    url: url.get(z.storage_path) ?? null,
  }));
}
