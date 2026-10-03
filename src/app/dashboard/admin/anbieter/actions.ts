"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Nur Plattform-Admins (RLS auf plattform_anbieter); Pruefung der Pflichtfelder im Trigger plattform_anbieter_pruefen
// IBAN-Pruefsumme (ISO 13616, mod 97)
function ibanGueltig(iban: string): boolean {
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const umgestellt = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const ziffer of umgestellt) rest = (rest * 10 + Number(ziffer)) % 97;
  return rest === 1;
}

export async function anbieterSpeichern(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const t = (k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);
  const iban = t("iban", 42).replace(/\s/g, "").toUpperCase();
  if (iban && !ibanGueltig(iban)) return { error: "Die IBAN ist ungültig – bitte prüfen." };
  if (iban && !t("bank_inhaber", 120)) return { error: "Bitte den Kontoinhaber zur IBAN angeben." };
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
      bank_inhaber: t("bank_inhaber", 120),
      bank_name: t("bank_name", 120),
      iban,
      bic: t("bic", 11).replace(/\s/g, "").toUpperCase(),
    })
    .eq("id", true)
    .select("id");
  if (error) return { error: error.code === "P0001" && error.message ? error.message : freundlicherFehler(error) };
  if (!data?.length) return { error: "Dafür fehlt dir die Berechtigung." };
  for (const pfad of ["/impressum", "/datenschutz", "/nutzungsbedingungen", "/kontakt", "/lizenz", "/dashboard/admin/anbieter"]) revalidatePath(pfad);
  return { error: null, ok: "Gespeichert. Impressum, Kontakt, Rechtstexte und neue Rechnungen verwenden ab sofort diese Angaben." };
}
