"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// TanzRaum Team: Konten sperren/entsperren (Recht „nutzer.sperren“) – Pruefung und Protokoll in der Datenbank
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function kontoSperren(userId: string, gesperrt: boolean, grund: string): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Person." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("team_konto_sperren", { p_user_id: userId, p_gesperrt: gesperrt, p_grund: grund.slice(0, 500) });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/team/nutzer");
  return { error: null, ok: gesperrt ? "Konto gesperrt – die Person kann sich nicht mehr anmelden." : "Konto entsperrt." };
}
