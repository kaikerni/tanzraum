import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { MeldungKarte, type TreffMeldung } from "@/components/treff/MeldungKarte";
import { treffStatus } from "@/lib/treff/laden";

export const metadata = { title: "Treff-Meldungen – TanzRaum" };

// Nur TanzRaum-Admin und Teammitglieder mit „Meldungen bearbeiten“ – Vereinsadmins nie
export default async function TreffMeldungen({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const status = await treffStatus(supabase);
  if (!status.rechte.includes("treff.meldungen_bearbeiten")) redirect("/dashboard/treff");
  const filter = (await searchParams).status;
  const aktiv = ["offen", "in_pruefung", "erledigt", "keine_massnahme"].includes(filter ?? "") ? filter! : "";
  const { data } = await supabase.rpc("treff_meldungen", { p_status: aktiv || null });
  const liste = (data ?? []) as TreffMeldung[];
  const reiter = (a: boolean) => `rounded-full px-3 py-1 text-[13px] font-semibold ${a ? "bg-brand-ink text-white" : "border border-brand-line bg-white text-brand-ink-soft"}`;
  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href="/dashboard/treff" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={14} /> TanzRaum Treff
      </Link>
      <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
        <Flag size={24} className="text-brand-red" /> Treff-Meldungen
      </h1>
      <p className="text-[13.5px] text-brand-ink-soft">
        Meldungen lösen keine automatische Sanktion aus. Die meldende Person wird nicht angezeigt; sie erfährt nur das Ergebnis.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {[
          ["", "Alle"],
          ["offen", "Offen"],
          ["in_pruefung", "In Prüfung"],
          ["erledigt", "Erledigt"],
          ["keine_massnahme", "Keine Maßnahme"],
        ].map(([k, v]) => (
          <Link key={k} href={k ? `/dashboard/treff/meldungen?status=${k}` : "/dashboard/treff/meldungen"} className={reiter(aktiv === k)}>
            {v}
          </Link>
        ))}
      </div>
      {liste.length === 0 ? (
        <p className={`${KARTE} text-[14px] text-brand-ink-soft`}>Keine Meldungen.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {liste.map((m) => (
            <MeldungKarte key={m.id} m={m} darfSperren={status.rechte.includes("treff.nutzer_sperren")} />
          ))}
        </ul>
      )}
    </div>
  );
}
