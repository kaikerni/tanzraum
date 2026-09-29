import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Nur fuer die TanzRaum-Administration; die Datenbankfunktionen pruefen zusaetzlich selbst.
export async function adminSitzung(weiter = "/dashboard/admin") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=${encodeURIComponent(weiter)}`);
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");
  return { supabase, user };
}

export type PlattformStatistik = {
  nutzer_gesamt: number;
  free: number;
  basic: number;
  verein_zugang: number;
  mit_zuordnung: number;
  ohne_zuordnung: number;
  online_jetzt: number;
  aktiv_24h: number;
  neu_7_tage: number;
  neu_30_tage: number;
  registrierungen: { monat: string; neu: number; gesamt: number }[];
  vereine_gesamt: number;
  lizenzen_aktiv: number;
  lizenzen_inaktiv: number;
  vereine_verlauf: { monat: string; gesamt: number }[];
  gruppen_gesamt: number;
  nachrichten_wochen: { woche: string; anzahl: number }[];
  nachrichten_30_tage: number;
};

export type Vereinskarte = {
  verein_id: string;
  name: string;
  logo_url: string | null;
  ort: string | null;
  lizenz_aktiv: boolean;
  nutzer: number;
  gruppen: number;
  online: number;
  module_aus: string[];
  erstellt_am: string;
};

const MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
export const monatKurz = (ym: string) => MONATE[Number(ym.slice(5, 7)) - 1] ?? ym;
