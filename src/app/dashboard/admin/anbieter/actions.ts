"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Nur Plattform-Admins (RLS auf plattform_anbieter); Pruefung der Pflichtfelder im Trigger plattform_anbieter_pruefen
export async function anbieterSpeichern(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const t = (k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plattform_anbieter")
    .update({
      name: t("name"),
      unternehmen: t("unternehmen"),
      strasse: t("strasse"),
      plz: t("plz", 10),
      ort: t("ort"),
      land: t("land", 60) || "Deutschland",
      telefon: t("telefon", 40),
      email: t("email"),
      verantwortlich_inhalt: t("verantwortlich_inhalt", 300),
      kleinunternehmer: fd.get("kleinunternehmer") === "on",
      kleinunternehmer_hinweis: t("kleinunternehmer_hinweis", 500),
      ust_id: t("ust_id", 30),
      steuernummer: t("steuernummer", 30),
    })
    .eq("id", true)
    .select("id");
  if (error) return { error: error.code === "P0001" && error.message ? error.message : freundlicherFehler(error) };
  if (!data?.length) return { error: "Dafür fehlt dir die Berechtigung." };
  for (const pfad of ["/impressum", "/datenschutz", "/nutzungsbedingungen", "/kontakt", "/lizenz", "/dashboard/admin/anbieter"]) revalidatePath(pfad);
  return { error: null, ok: "Gespeichert. Impressum, Kontakt, Rechtstexte und neue Rechnungen verwenden ab sofort diese Angaben." };
}
