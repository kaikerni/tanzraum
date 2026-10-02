import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { TeamVerwaltung, type TeamMitglied } from "@/components/team/TeamVerwaltung";

export const metadata = { title: "TanzRaum Team – TanzRaum-Administration" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 🛡 TanzRaum Team: interne Rolle mit einzeln vergebenen Rechten – nur der TanzRaum-Admin verwaltet sie
export default async function TeamSeite({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");

  const { data } = await supabase.rpc("admin_team_liste");
  // deno-lint-ignore no-explicit-any
  const mitglieder: TeamMitglied[] = ((data ?? []) as any[]).map((m) => ({
    userId: m.user_id,
    name: m.name,
    handle: m.handle,
    avatarUrl: m.avatar_url,
    moderator: m.moderator,
    kennzeichnen: m.kennzeichnen,
    alleRechte: m.alle_rechte,
    rechte: m.rechte ?? [],
    notiz: m.notiz,
    seit: m.hinzugefuegt_am,
    teamBasic: m.team_basic === true,
    teamBasicBis: m.team_basic_bis,
    tarif: m.tarif ?? "free",
    verein: m.verein,
  }));

  // Direkt aus der Lizenzuebersicht: „Zum TanzRaum Team“ / „Rechte verwalten“
  const ziel = (await searchParams).user;
  let start = null;
  if (ziel && UUID.test(ziel)) {
    const m = mitglieder.find((x) => x.userId === ziel);
    if (m) start = { userId: m.userId, name: m.name, handle: m.handle, avatarUrl: m.avatarUrl, email: null, tarif: m.tarif, team: true, verein: m.verein };
    else {
      const { data: p } = await supabase.from("profiles").select("id, vorname, nachname, handle, avatar_url").eq("id", ziel).maybeSingle();
      if (p)
        start = {
          userId: p.id,
          name: [p.vorname, p.nachname].filter(Boolean).join(" ") || `@${p.handle}`,
          handle: p.handle,
          avatarUrl: p.avatar_url,
          email: null,
          tarif: "",
          team: false,
          verein: null,
        };
    }
  }

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
      <Link href="/dashboard/admin" className="text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        ← Administration
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <Shield size={24} className="text-brand-red" /> TanzRaum Team
        </h1>
        <p className="text-[13.5px] text-brand-ink-soft">
          Teammitglieder erhalten ausschließlich die Rechte, die du hier vergibst. Moderator ist eine Funktion im Team. Ein Teammitglied ist nie TanzRaum-Admin –
          und ein Vereinsadmin ist nie automatisch Moderator.
        </p>
      </div>
      <section className={KARTE}>
        <TeamVerwaltung mitglieder={mitglieder} start={start} />
      </section>
    </div>
  );
}
