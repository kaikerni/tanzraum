import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { darfTeam, meineTeamRechte } from "@/lib/team/rechte";
import { STATUS_LABEL, datumText } from "@/lib/workshops/workshops";

export const metadata = { title: "Workshops prüfen – TanzRaum" };

// Zentrale Freigabe: TanzRaum-Admin und Teammitglieder mit Workshop-Rechten
export default async function WorkshopsPruefen() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const r = await meineTeamRechte(supabase);
  if (!(darfTeam(r, "workshops.freigeben") || darfTeam(r, "workshops.ablehnen") || darfTeam(r, "workshops.ansehen") || darfTeam(r, "workshops.bearbeiten")))
    redirect("/dashboard/workshops");
  const { data } = await supabase.rpc("workshops_pruefen");
  const liste = (data ?? []) as { id: string; titel: string; datum: string; ort: string; bundesland: string; status: string; erstellt_am: string; eingereicht_von: string | null }[];
  const gruppen = [
    { titel: "Eingereicht – wartet auf Prüfung", status: "eingereicht" },
    { titel: "Abgelehnt", status: "abgelehnt" },
    { titel: "Entwürfe", status: "entwurf" },
  ];
  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href="/dashboard/workshops" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={14} /> Workshops
      </Link>
      <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
        <ClipboardCheck size={24} className="text-brand-blue" /> Workshops prüfen
      </h1>
      {gruppen.map((g) => {
        const eintraege = liste.filter((w) => w.status === g.status);
        if (g.status !== "eingereicht" && eintraege.length === 0) return null;
        return (
          <section key={g.status} className={KARTE}>
            <h2 className="mb-2 text-[16px] font-bold text-brand-ink">
              {g.titel} ({eintraege.length})
            </h2>
            {eintraege.length === 0 ? (
              <p className="text-[13.5px] text-brand-ink-soft">Alles geprüft – keine offenen Einreichungen.</p>
            ) : (
              <ul className="divide-y divide-brand-line">
                {eintraege.map((w) => (
                  <li key={w.id}>
                    <Link href={`/dashboard/workshops/${w.id}`} className="flex items-center gap-3 py-2.5 hover:bg-brand-bg">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-semibold text-brand-ink">{w.titel}</span>
                        <span className="block text-[12.5px] text-brand-ink-soft">
                          {datumText({ datum: w.datum, datum_bis: null })} · {w.ort} · {w.bundesland} · eingereicht {new Date(w.erstellt_am).toLocaleDateString("de-DE")}
                          {w.eingereicht_von ? ` von ${w.eingereicht_von}` : ""} · {STATUS_LABEL[w.status]}
                        </span>
                      </span>
                      <ChevronRight size={16} className="text-brand-ink-soft" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
