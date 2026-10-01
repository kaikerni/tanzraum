import { redirect } from "next/navigation";
import { Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { netzwerkZugang } from "@/lib/netzwerk/netzwerkZugang";
import { NetzwerkReiter } from "@/components/netzwerk/NetzwerkReiter";

export const metadata = { title: "TanzRaum-Netzwerk" };

// TanzRaum-Netzwerk: der eine soziale Bereich (Nutzer suchen, Buddys, Buddy-Anfragen, Spotlight, Map, Vereine)
export default async function NetzwerkLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/netzwerk");
  const { erlaubt, voll } = await netzwerkZugang(supabase);
  let anfragen = 0;
  if (voll) {
    const { data } = await supabase.rpc("meine_kontaktanfragen");
    anfragen = ((data ?? []) as { richtung: string }[]).filter((a) => a.richtung === "eingehend").length;
  }

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-3">
      <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
        <Globe size={24} className="text-brand-red" /> TanzRaum-Netzwerk
      </h1>
      <NetzwerkReiter erlaubt={erlaubt} anfragen={anfragen} />
      {children}
    </div>
  );
}
