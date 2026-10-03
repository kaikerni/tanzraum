import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NachrichtenStart } from "@/components/chat/NachrichtenStart";

// „Gruppenchats“ (ab BASIC): die Liste links zeigt nur Vereins-, Tanzgruppen- und eigene Gruppenchats
export default async function GruppenchatsSeite() {
  const supabase = await createClient();
  const [{ data: tarif }, { data: admin }] = await Promise.all([supabase.rpc("mein_tarif"), supabase.rpc("ist_plattform_admin_aktuell")]);
  if (tarif !== "basic" && tarif !== "verein" && admin !== true) redirect("/dashboard/nachrichten");
  return <NachrichtenStart gruppen />;
}
