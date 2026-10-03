import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Zentrale Anbieterangaben (Tabelle plattform_anbieter, gepflegt im Plattform-Admin).
// Impressum, Kontakt, Datenschutz, Nutzungsbedingungen und Rechnungen lesen ausschliesslich von hier.
export type Anbieter = {
  name: string;
  unternehmen: string | null;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  telefon: string | null;
  email: string;
  verantwortlichInhalt: string | null;
  kleinunternehmer: boolean;
  kleinunternehmerHinweis: string;
  ustId: string | null;
};

export const getAnbieter = cache(async (): Promise<Anbieter | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("plattform_anbieter_oeffentlich");
  // deno-lint-ignore no-explicit-any
  const a = ((data ?? []) as any[])[0];
  if (error || !a) return null;
  return {
    name: a.name,
    unternehmen: a.unternehmen,
    strasse: a.strasse,
    plz: a.plz,
    ort: a.ort,
    land: a.land,
    telefon: a.telefon,
    email: a.email,
    verantwortlichInhalt: a.verantwortlich_inhalt,
    kleinunternehmer: a.kleinunternehmer,
    kleinunternehmerHinweis: a.kleinunternehmer_hinweis,
    ustId: a.ust_id,
  };
});

// "Kai Kern, Taktmanufaktur, Jahnstraße 15, 67378 Zeiskam"
export function anbieterZeile(a: Anbieter): string {
  return [a.name, a.unternehmen, a.strasse, `${a.plz} ${a.ort}`].filter(Boolean).join(", ");
}

export function telefonLink(telefon: string): string {
  const ziffern = telefon.replace(/[^\d+]/g, "");
  return `tel:${ziffern.startsWith("0") ? `+49${ziffern.slice(1)}` : ziffern}`;
}
