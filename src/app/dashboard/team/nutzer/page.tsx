import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { NutzerAvatar } from "@/components/ui/NutzerAvatar";
import { KontoSperre } from "@/components/team/KontoSperre";
import { darfTeam, meineTeamRechte } from "@/lib/team/rechte";

export const metadata = { title: "Nutzerverwaltung – TanzRaum Team" };

// Nur @Nutzername, Tarif, Sperrstatus – keine E-Mail, keine Vereins- oder Mitgliederdaten, keine Chats
export default async function TeamNutzer({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const r = await meineTeamRechte(supabase);
  if (!darfTeam(r, "nutzer.ansehen") && !darfTeam(r, "nutzer.sperren")) redirect("/dashboard/team");
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const { data } = q.replace(/^@/, "").length >= 2 ? await supabase.rpc("team_nutzer_suche", { p_q: q }) : { data: [] };
  const treffer = (data ?? []) as { user_id: string; name: string; handle: string; avatar_url: string | null; tarif: string; gesperrt: boolean; team: boolean }[];
  const sperren = darfTeam(r, "nutzer.sperren");

  return (
    <div className="mx-auto flex max-w-[800px] flex-col gap-4">
      <Link href="/dashboard/team" className="text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        ← TanzRaum Team
      </Link>
      <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
        <Users size={24} className="text-brand-blue" /> Nutzerverwaltung
      </h1>
      <section className={KARTE}>
        <form action="/dashboard/team/nutzer" className="flex gap-2">
          <label className="field min-w-0 flex-1">
            <span className="sr-only">@Nutzername</span>
            <input name="q" defaultValue={q} placeholder="@Nutzername (mindestens 2 Zeichen)" autoComplete="off" />
          </label>
          <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-ink px-4 text-[13.5px] font-semibold text-white">
            <Search size={16} /> Suchen
          </button>
        </form>
        <ul className="mt-2 divide-y divide-brand-line">
          {q && treffer.length === 0 && <li className="py-3 text-[13.5px] text-brand-ink-soft">Niemand gefunden.</li>}
          {treffer.map((t) => (
            <li key={t.user_id} className="flex flex-wrap items-center gap-3 py-2.5">
              <NutzerAvatar name={t.handle} avatarUrl={t.avatar_url} groesse={36} />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-brand-ink">@{t.handle}</span>
                <span className="block text-[12px] text-brand-ink-soft">
                  {t.tarif.toUpperCase()}
                  {t.gesperrt ? " · 🔒 gesperrt" : ""}
                  {t.team ? " · 🛡 Team" : ""}
                </span>
              </span>
              {sperren && !t.team && <KontoSperre userId={t.user_id} handle={t.handle} gesperrt={t.gesperrt} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
