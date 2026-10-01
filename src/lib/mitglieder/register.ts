import type { SupabaseClient } from "@supabase/supabase-js";

// Vereinsmitglieder aus den Stammdaten (public.mitglieder), z. B. importiert – mit TanzRaum-Kontostatus.
// konto: mit einem TanzRaum-Konto verbunden · eingeladen: persoenliche Einladung offen · ohne: noch kein Konto
export type KontoStatus = "konto" | "eingeladen" | "ohne";

export type RegisterEintrag = {
  id: string;
  vorname: string;
  nachname: string;
  name: string;
  email: string | null;
  mitgliedsnummer: string | null;
  geschlecht: string | null;
  gruppeId: string | null;
  gruppeName: string | null;
  vmId: string | null;
  status: KontoStatus;
  einladungId: string | null;
  token: string | null;
  einladungErstellt: string | null;
  gesendetAm: string | null;
  gueltigBis: string | null;
  einladungAbgelaufen: boolean;
};

export async function getRegister(supabase: SupabaseClient, vereinId: string): Promise<RegisterEintrag[]> {
  const { data, error } = await supabase.rpc("mitglieder_register", { p_verein_id: vereinId });
  if (error || !data) return [];
  // deno-lint-ignore no-explicit-any
  return (data as any[]).map((m) => ({
    id: m.id,
    vorname: m.vorname,
    nachname: m.nachname,
    name: `${m.vorname} ${m.nachname}`.trim(),
    email: m.email,
    mitgliedsnummer: m.mitgliedsnummer,
    geschlecht: m.geschlecht,
    gruppeId: m.gruppe_id,
    gruppeName: m.gruppe_name,
    vmId: m.vereins_mitglied_id,
    status: m.status as KontoStatus,
    einladungId: m.einladung_id,
    token: m.einladung_token,
    einladungErstellt: m.einladung_erstellt,
    gesendetAm: m.gesendet_am,
    gueltigBis: m.gueltig_bis,
    einladungAbgelaufen: !!m.einladung_abgelaufen,
  }));
}

export function einladungsLink(basis: string, token: string) {
  return `${basis.replace(/\/+$/, "")}/einladung/${token}`;
}

export function datumKurz(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }) : "";
}
