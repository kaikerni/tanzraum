"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { geburtsdatumFehler } from "@/lib/auth/geburtsdatum";
import { elternMailSenden } from "@/lib/auth/elternMail";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

export async function geburtsdatumSpeichern(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const wert = String(formData.get("geburtsdatum") ?? "").trim();
  const elternEmail = String(formData.get("eltern_email") ?? "").trim().toLowerCase();
  const fehler = geburtsdatumFehler(wert);
  if (fehler) return { error: fehler };
  if (formData.get("bestaetigt") !== "ja") return { error: "Bitte bestätige, dass dein Geburtsdatum stimmt." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Unter 16 nur zusammen mit der Eltern-Adresse; das Konto wird dann bis zur Zustimmung gesperrt (Datenbank)
  const { data, error } = await supabase.rpc("geburtsdatum_setzen", { p_datum: wert, p_eltern_email: elternEmail || null });
  if (error) return { error: error.code === "P0001" ? error.message : "Das Geburtsdatum konnte nicht gespeichert werden." };
  if (data === "eltern_noetig") return { error: "Du bist unter 16. Bitte gib die E-Mail-Adresse eines Elternteils an." };
  if (data === "wartet") {
    const mail = await elternMailSenden({ art: "anfrage", kind_id: user.id });
    await supabase.auth.signOut();
    return {
      error: mail.ok ? null : (mail.error ?? null),
      ok: "Wir haben deinen Eltern eine E-Mail geschickt. Sobald ein Elternteil zugestimmt hat, kannst du dich wieder anmelden.",
    };
  }
  redirect("/dashboard");
}
