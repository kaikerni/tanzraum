import { vorschauStatus } from "@/lib/supabase/server";
import type { Ansicht } from "@/lib/admin/ansicht";

// Gewaehlte „Ansicht als …“ – nur wirksam fuer die Plattform-Administration (Pruefung gegen die echte Datenbank)
export async function aktiveAnsicht(): Promise<Ansicht | null> {
  return (await vorschauStatus())?.ansicht ?? null;
}
