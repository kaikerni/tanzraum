import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Heart, MessageCircle, Plus, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { AngebotKarte } from "@/components/boerse/AngebotKarte";
import { EigeneAktionen } from "@/components/boerse/AngebotAktionen";
import { STATUS_LABEL, bilderSignieren, getKategorien, type Angebot, type BoerseStatus } from "@/lib/boerse";

export const metadata = { title: "Meine Börse – TanzRaum" };

const GRUPPEN: { titel: string; status: BoerseStatus[] }[] = [
  { titel: "Aktiv & reserviert", status: ["aktiv", "reserviert"] },
  { titel: "Pausiert", status: ["pausiert"] },
  { titel: "Abgeschlossen", status: ["verkauft", "verschenkt", "getauscht", "beendet"] },
  { titel: "Von der Moderation deaktiviert", status: ["gesperrt"] },
];

export default async function MeineBoerse({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/boerse/meine");
  const { tab } = await searchParams;
  const favoriten = tab === "favoriten";

  const [{ data }, kategorien] = await Promise.all([supabase.rpc("boerse_meine", { p_bereich: favoriten ? "favoriten" : "angebote" }), getKategorien(supabase)]);
  const liste = (data ?? []) as Angebot[];
  const katName = new Map(kategorien.map((k) => [k.schluessel, k.name]));
  const bilder = await bilderSignieren(supabase, liste.map((a) => a.bilder[0]).filter(Boolean));

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <Link href="/dashboard/boerse" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Zur TanzRaum Börse
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Meine Börse</h1>
        <Link href="/dashboard/boerse/neu" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-red px-4 text-[14px] font-semibold text-white hover:bg-brand-red-deep">
          <Plus size={17} /> Angebot einstellen
        </Link>
      </div>
      <nav className="flex gap-2" aria-label="Bereich">
        <Link
          href="/dashboard/boerse/meine"
          className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold ${!favoriten ? "bg-brand-ink text-white" : "bg-white text-brand-ink ring-1 ring-brand-line"}`}
        >
          <Store size={15} /> Meine Angebote
        </Link>
        <Link
          href="/dashboard/boerse/meine?tab=favoriten"
          className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold ${favoriten ? "bg-brand-ink text-white" : "bg-white text-brand-ink ring-1 ring-brand-line"}`}
        >
          <Heart size={15} /> Meine Favoriten
        </Link>
      </nav>

      {liste.length === 0 ? (
        <section className={`${KARTE} flex flex-col items-center gap-3 py-12 text-center`}>
          <p className="text-[16px] font-bold text-brand-ink">{favoriten ? "Noch keine Favoriten" : "Du hast noch nichts eingestellt"}</p>
          <p className="max-w-md text-[14px] text-brand-ink-soft">
            {favoriten ? "Tippe bei einem Angebot auf das Herz, um es dir hier zu merken." : "Kostüme, Schuhe, Requisiten – was bei dir im Schrank liegt, sucht vielleicht jemand anderes."}
          </p>
        </section>
      ) : favoriten ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {liste.map((a) => (
            <AngebotKarte key={a.id} a={a} bild={bilder.get(a.bilder[0])} kategorie={katName.get(a.unterkategorie ?? a.kategorie)} />
          ))}
        </div>
      ) : (
        GRUPPEN.map((g) => {
          const teil = liste.filter((a) => g.status.includes(a.status));
          if (teil.length === 0) return null;
          return (
            <section key={g.titel} className="flex flex-col gap-3">
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-brand-ink-soft">
                {g.titel} ({teil.length})
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {teil.map((a) => (
                  <div key={a.id} className={`${KARTE} flex gap-3 !p-3`}>
                    <Link href={`/dashboard/boerse/${a.id}`} className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-brand-bg">
                      {bilder.get(a.bilder[0]) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={bilder.get(a.bilder[0])} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[24px]" aria-hidden>
                          🎭
                        </span>
                      )}
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Link href={`/dashboard/boerse/${a.id}`} className="line-clamp-2 break-words text-[14.5px] font-bold text-brand-ink hover:text-brand-red">
                        {a.titel}
                      </Link>
                      <p className="text-[12.5px] text-brand-ink-soft">
                        {STATUS_LABEL[a.status]}
                        {typeof a.favoriten === "number" && a.favoriten > 0 ? ` · ${a.favoriten}× gemerkt` : ""}
                        {a.kontakte ? (
                          <span className="inline-flex items-center gap-1">
                            <span aria-hidden>&nbsp;·</span> <MessageCircle size={12} /> {a.kontakte} {a.kontakte === 1 ? "Anfrage" : "Anfragen"}
                          </span>
                        ) : null}
                      </p>
                      {a.status === "gesperrt" && a.sperrgrund && <p className="text-[12px] text-brand-red">{a.sperrgrund}</p>}
                      <div className="mt-auto pt-1">
                        <EigeneAktionen id={a.id} status={a.status} zurueck={false} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
      {!favoriten && liste.some((a) => (a.kontakte ?? 0) > 0) && (
        <p className="text-[12.5px] text-brand-ink-soft">
          Anfragen zu deinen Angeboten findest du in deinen{" "}
          <Link href="/dashboard/nachrichten" className="font-semibold text-brand-red">
            Nachrichten
          </Link>{" "}
          (gekennzeichnet mit „Börse“).
        </p>
      )}
    </div>
  );
}
