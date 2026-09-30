import { cookies } from "next/headers";
import { ANSICHT_COOKIE, istAnsicht, type Ansicht } from "@/lib/admin/ansicht";

// Gewaehlte „Ansicht als …“ – nur wirksam fuer die Plattform-Administration (Aufrufer uebergibt istPlattformAdmin)
export async function aktiveAnsicht(istPlattformAdmin: boolean): Promise<Ansicht | null> {
  if (!istPlattformAdmin) return null;
  const wert = (await cookies()).get(ANSICHT_COOKIE)?.value;
  return istAnsicht(wert) ? wert : null;
}
