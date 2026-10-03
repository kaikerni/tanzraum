import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAnkuendigungen } from "@/lib/news/getNews";
import { nurUpdates } from "@/lib/updates/getUpdates";
import { UpdateKarte } from "@/components/updates/UpdateKarte";
import { UpdatesGelesen } from "@/components/updates/UpdatesGelesen";
import { KARTE } from "@/components/dashboard/Karten";
import { versionText } from "@/lib/version";

export const metadata = { title: "Was ist neu? – TanzRaum" };

// Eingeloggter Bereich: relevante Neuheiten (Updates & Neuigkeiten der TanzRaum-Administration)
export default async function WasIstNeuSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const liste = nurUpdates(await getAnkuendigungen(supabase));
  const ungelesen = liste.filter((u) => !u.gelesenAm).map((u) => u.id);

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4">
      <UpdatesGelesen ids={ungelesen} />
      <div>
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <Sparkles size={24} className="text-brand-gold" /> Was ist neu?
        </h1>
        <p className="text-[14px] text-brand-ink-soft">
          Neue Funktionen und Verbesserungen in TanzRaum. Updates kommen automatisch – du musst nichts installieren.
        </p>
      </div>
      {liste.length === 0 ? (
        <p className={`${KARTE} text-[14px] text-brand-ink-soft`}>Gerade gibt es keine neuen Hinweise.</p>
      ) : (
        liste.map((u) => (
          <UpdateKarte
            key={u.id}
            ausfuehrlich
            u={{
              id: u.id,
              version: u.version,
              titel: u.titel,
              kurztext: u.kurztext,
              text: u.text,
              kategorie: u.kategorie,
              datum: u.sichtbarAb,
              bildUrl: u.bildUrl,
              linkUrl: u.linkUrl,
              linkText: u.linkText,
            }}
          />
        ))
      )}
      <p className="text-[12px] text-brand-ink-faint">Du nutzt {versionText()}.</p>
    </div>
  );
}
