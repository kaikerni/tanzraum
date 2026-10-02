import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { LizenzVerwaltung, type LizenzZeile } from "@/components/admin/LizenzVerwaltung";
import { lizenzStatus } from "@/lib/lizenz";

export const metadata = { title: "Nutzer freischalten & Lizenzen – TanzRaum-Administration" };

const FILTER: { id: string; label: string }[] = [
  { id: "", label: "Alle" },
  { id: "MANUAL_FREE", label: "Kostenlos manuell" },
  { id: "TEAM_FREE", label: "Team" },
  { id: "PAID_BASIC", label: "Bezahlt" },
  { id: "VEREIN", label: "Verein" },
  { id: "bald", label: "Läuft bald ab" },
];

export default async function LizenzenSeite({ searchParams }: { searchParams: Promise<{ q?: string; art?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const art = FILTER.some((f) => f.id === sp.art) ? (sp.art ?? "") : "";
  const { data } = await supabase.rpc("admin_lizenzen", { p_q: q || null });
  // deno-lint-ignore no-explicit-any
  const alle: LizenzZeile[] = ((data ?? []) as any[]).map((z) => ({
    userId: z.user_id,
    name: z.name,
    handle: z.handle,
    avatarUrl: z.avatar_url,
    email: z.email_maskiert,
    tarif: z.tarif ?? "free",
    status: z.status,
    start: z.start,
    ablauf: z.ablauf,
    zahlungsart: z.zahlungsart,
    lizenzart: z.lizenzart,
    aboId: z.abo_id,
    aboManuell: z.abo_manuell === true,
    team: z.team === true,
    moderator: z.moderator === true,
    verein: z.verein,
    notiz: z.notiz,
  }));
  const zeilen = alle.filter((z) => !art || (art === "bald" ? lizenzStatus(z.tarif, z.ablauf).stufe === "bald" : z.lizenzart === art));

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <Link href="/dashboard/admin" className="text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        ← Administration
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <KeyRound size={24} className="text-brand-red" /> Nutzer freischalten & Lizenzen
        </h1>
        <p className="text-[13.5px] text-brand-ink-soft">
          Kostenlose Freischaltungen (MANUAL_FREE) sind unabhängig vom TanzRaum Team (TEAM_FREE) und von bezahlten Lizenzen. Bezahlte Abos bleiben unberührt; jede
          Aktion wird protokolliert. Übersicht und Preise: <Link href="/dashboard/admin/tarife" className="font-semibold text-brand-red">Tarife & Lizenzen</Link>.
        </p>
      </div>
      <section className={`${KARTE} flex flex-col gap-3`}>
        <form action="/dashboard/admin/lizenzen" className="flex gap-2">
          <label className="field min-w-0 flex-1">
            <span className="sr-only">Suche</span>
            <input name="q" defaultValue={q} placeholder="Name, @Nutzername oder E-Mail – leer: alle mit Lizenz oder Teamrolle" autoComplete="off" />
          </label>
          {art && <input type="hidden" name="art" value={art} />}
          <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-ink px-4 text-[13.5px] font-semibold text-white">
            <Search size={16} /> Suchen
          </button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {FILTER.map((f) => (
            <Link
              key={f.id}
              href={`/dashboard/admin/lizenzen?${new URLSearchParams({ ...(q ? { q } : {}), ...(f.id ? { art: f.id } : {}) })}`}
              className={`rounded-full px-3 py-1 text-[13px] font-semibold ${art === f.id ? "bg-brand-ink text-white" : "border border-brand-line bg-white text-brand-ink-soft"}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <LizenzVerwaltung zeilen={zeilen} />
      </section>
    </div>
  );
}
