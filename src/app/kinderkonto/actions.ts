"use server";

import { createClient } from "@/lib/supabase/server";
import { elternMailSenden } from "@/lib/auth/elternMail";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Bestehendes Konto unter 16 ohne dokumentierte Elternzustimmung: Zustimmung anfordern. Die Datenbank sperrt das
// Login bis zur Zustimmung und beendet die Sitzungen.
export async function zustimmungAnfordern(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const elternEmail = String(fd.get("eltern_email") ?? "").trim().toLowerCase();
  if (!elternEmail) return { error: "Bitte gib die E-Mail-Adresse eines Elternteils ein." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Bitte melde dich erneut an." };
  const { error } = await supabase.rpc("eltern_zustimmung_anfordern", { p_eltern_email: elternEmail });
  if (error) return { error: error.code === "P0001" ? error.message : "Das hat nicht geklappt. Bitte versuche es später erneut." };
  const mail = await elternMailSenden({ art: "anfrage", kind_id: user.id });
  await supabase.auth.signOut();
  return {
    error: mail.ok ? null : (mail.error ?? null),
    ok: "Wir haben deinen Eltern eine E-Mail geschickt. Sobald ein Elternteil zugestimmt hat, kannst du dich wieder anmelden.",
  };
}
