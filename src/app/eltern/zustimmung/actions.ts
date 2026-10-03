"use server";

import { createClient } from "@/lib/supabase/server";
import { basisUrl } from "@/lib/url";
import { elternMailSenden } from "@/lib/auth/elternMail";

export type ZustimmungsErgebnis = { error: string | null; ergebnis?: "zugestimmt" | "abgelehnt"; hinweis?: string | null };

// Entscheidung des Elternteils ueber den einmaligen Link (ohne TanzRaum-Konto). Die Datenbank prueft Link,
// Gueltigkeit, Textversion und Erklaerungen und dokumentiert die Zustimmung.
export async function zustimmungEntscheiden(_prev: ZustimmungsErgebnis, fd: FormData): Promise<ZustimmungsErgebnis> {
  const token = String(fd.get("token") ?? "");
  const zustimmen = fd.get("entscheidung") === "ja";
  const erklaerung = fd.get("erklaerung") === "ja";
  const kinderkonto = fd.get("kinderkonto") === "ja";
  const push = fd.get("push") === "ja";
  if (!token || token.length > 200) return { error: "Dieser Link ist ungültig." };
  if (zustimmen && (!erklaerung || !kinderkonto)) {
    return { error: "Bitte bestätige beide Pflichtangaben, um zuzustimmen." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("eltern_zustimmung_entscheiden", {
    p_token: token,
    p_zustimmen: zustimmen,
    p_volljaehrig: zustimmen && erklaerung,
    p_sorgeberechtigt: zustimmen && erklaerung,
    p_push: zustimmen && push,
    p_textversion: String(fd.get("textversion") ?? ""),
  });
  if (error) return { error: error.code === "P0001" ? error.message : "Das hat nicht geklappt. Bitte versuche es später erneut." };
  // deno-lint-ignore no-explicit-any
  const r = ((data ?? []) as any[])[0];
  if (r?.ergebnis !== "zugestimmt") return { error: null, ergebnis: "abgelehnt" };

  let hinweis: string | null = null;
  // Neu registriertes Kinderkonto: Bestaetigungs-Mail an das Kind erst jetzt
  if (r.kind_email_bestaetigen) {
    const { error: e } = await supabase.auth.resend({
      type: "signup",
      email: r.kind_email_bestaetigen,
      options: { emailRedirectTo: `${await basisUrl()}/dashboard` },
    });
    if (e) hinweis = "Die E-Mail an dein Kind zum Bestätigen seiner Adresse konnte gerade nicht versendet werden. Bitte wende dich an info@tanzraum.app.";
  }
  if (r.zustimmung_id) await elternMailSenden({ art: "bestaetigung", zustimmung_id: r.zustimmung_id });
  return { error: null, ergebnis: "zugestimmt", hinweis };
}
