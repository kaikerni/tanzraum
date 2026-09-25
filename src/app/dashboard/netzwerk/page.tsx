import Link from "next/link";
import { redirect } from "next/navigation";
import { Map as MapIcon, Users, Sparkles, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { darfNetzwerk, getMapPunkte } from "@/lib/netzwerk/tanzraumNetzwerk";
import { NetzwerkMap } from "@/components/netzwerk/NetzwerkMap";
import { NetzwerkListe } from "@/components/netzwerk/NetzwerkListe";
import { KARTE } from "@/components/dashboard/Karten";

export const metadata = { title: "TanzRaum-Netzwerk" };

type Ansicht = "map" | "liste" | "spotlights";

export default async function NetzwerkSeite({ searchParams }: { searchParams: Promise<{ ansicht?: string; verein?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/netzwerk");

  if (!(await darfNetzwerk(supabase))) {
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">TanzRaum-Netzwerk</h1>
        <section className={KARTE}>
          <p className="text-[14px] text-brand-ink">
            Map, Netzwerk und Spotlights gibt es ab dem <strong>Basic-Tarif</strong> – oder automatisch über einen Verein mit Vereinslizenz.
          </p>
          <p className="mt-2 text-[13.5px] text-brand-ink-soft">
            Mit Free kannst du im TanzRaum-Messenger Kontaktanfragen senden und annehmen.
          </p>
          <Link href="/dashboard/nachrichten" className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-brand-red px-4 text-[13.5px] font-semibold text-white">
            Zu den Kontakten
          </Link>
        </section>
      </div>
    );
  }

  const { ansicht: roh, verein } = await searchParams;
  // Die Map ist immer die Standardansicht
  const ansicht: Ansicht = roh === "liste" || roh === "spotlights" ? roh : "map";
  const [punkte, { data: map }] = await Promise.all([
    ansicht === "map" ? getMapPunkte(supabase) : Promise.resolve([]),
    ansicht === "map" ? supabase.rpc("meine_map_einstellungen") : Promise.resolve({ data: null }),
  ]);
  // deno-lint-ignore no-explicit-any
  const ichAufMap = !!((map ?? []) as any[])[0]?.wird_angezeigt;

  const tab = (wert: Ansicht, titel: string, Icon: typeof MapIcon) => (
    <Link
      href={wert === "map" ? "/dashboard/netzwerk" : `/dashboard/netzwerk?ansicht=${wert}`}
      aria-current={ansicht === wert ? "page" : undefined}
      className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-[13.5px] font-semibold transition-colors sm:flex-none sm:px-4 ${
        ansicht === wert ? "bg-white text-brand-ink shadow-sm" : "text-brand-ink-soft hover:text-brand-ink"
      }`}
    >
      <Icon size={16} className={ansicht === wert ? "text-brand-red" : ""} /> {titel}
    </Link>
  );

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
            <Globe size={24} className="text-brand-red" /> TanzRaum-Netzwerk
          </h1>
          <p className="text-[14px] text-brand-ink-soft">
            {ansicht === "map" ? "Wo ist TanzRaum?" : ansicht === "liste" ? "Wer und welche Vereine gehören zu TanzRaum?" : "Was teilen die Menschen bei TanzRaum gerade?"}
          </p>
        </div>
        <nav className="flex w-full gap-1 rounded-xl bg-brand-bg p-1 sm:w-auto" aria-label="Ansicht">
          {tab("map", "Map", MapIcon)}
          {tab("liste", "Liste", Users)}
          {tab("spotlights", "Spotlights", Sparkles)}
        </nav>
      </div>

      {ansicht === "map" && <NetzwerkMap punkte={punkte} fokusVerein={verein} ichAufMap={ichAufMap} />}
      {ansicht === "liste" && <NetzwerkListe />}
      {ansicht === "spotlights" && (
        <section className={KARTE}>
          <p className="text-[14px] text-brand-ink-soft">Spotlights folgen im nächsten Schritt.</p>
        </section>
      )}
    </div>
  );
}
