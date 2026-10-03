import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData, type VereinsMitgliedschaft } from "@/lib/dashboard/getDashboardData";
import { adminVereine, waehleVerein } from "./daten";

// Zugriff nur fuer Vereinsadmins (Vereine mit Vereinslizenz). Die Datenbank prueft zusaetzlich per RLS.
export async function ehrungsKontext(gewaehlt?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/vereinsverwaltung/ehrungen");
  const daten = await getDashboardData(supabase, user.id);
  if (!daten) redirect("/login");
  const alleAdmin = adminVereine(daten.vereine);
  const vereine = alleAdmin.filter((v) => v.vereinTarif === "verein");
  const verein: VereinsMitgliedschaft | null = waehleVerein(vereine, gewaehlt);
  return { supabase, user, vereine, verein, ohneLizenz: alleAdmin.length > 0 && vereine.length === 0 };
}
