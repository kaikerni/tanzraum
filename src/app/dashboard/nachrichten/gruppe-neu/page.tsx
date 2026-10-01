import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { gruppenchatKandidaten } from "@/app/dashboard/nachrichten/actions";
import { NeuerGruppenchat } from "@/components/chat/Gruppenchat";

// Neuer Gruppenchat (ab BASIC, ab 16 – Pruefung in der Datenbank)
export default async function NeuerGruppenchatSeite() {
  const supabase = await createClient();
  const { data: tarif } = await supabase.rpc("mein_tarif");
  if (tarif !== "basic" && tarif !== "verein") redirect("/dashboard/nachrichten");
  return <NeuerGruppenchat kandidaten={await gruppenchatKandidaten()} />;
}
