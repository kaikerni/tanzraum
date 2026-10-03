import { createClient } from "@/lib/supabase/server";
import { DatumUhrzeit } from "@/components/dashboard/DatumUhrzeit";
import { OnlineUsers } from "@/components/online/OnlineUsers";

// Kompakte Statuszeile fuer Dashboards ohne eigene Tageskarte (Administration, JuryRaum):
// Datum/Uhrzeit + zentrale Online-Anzeige (gleiche Zahl wie ueberall)
export async function DashboardStatus({ className = "" }: { className?: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("online_anzahl");
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 ${className}`}>
      <DatumUhrzeit variante="zeile" />
      <OnlineUsers anzahl={typeof data === "number" ? data : 0} />
    </div>
  );
}
