import Link from "next/link";
import { ArrowLeft, Building2, Radio, Users, UsersRound } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { VEREINS_MODULE } from "@/lib/navigation";
import { adminSitzung, type Vereinskarte } from "@/lib/admin/zugang";
import { VereinAnlegenAdmin } from "@/components/admin/VereinVerwaltungAdmin";

export const metadata = { title: "Vereine – TanzRaum-Administration" };

// Vereinskarten nur mit Zahlen (Mitglieder, Gruppen, online) – keine Namen von Mitgliedern
export default async function AdminVereineSeite() {
  const { supabase } = await adminSitzung("/dashboard/admin/vereine");
  const [{ data }, { data: lizenzen }] = await Promise.all([supabase.rpc("admin_vereinskarten"), supabase.rpc("admin_vereinslizenzen")]);
  const vereine = (data ?? []) as Vereinskarte[];
  // Lizenzstatus je Verein (Lizenztyp Verein): Aktiv / Test (mit Enddatum) bzw. Abgelaufen / Deaktiviert / ohne Lizenz
  const lizenzInfo = new Map(
    ((lizenzen ?? []) as { verein_id: string; lizenz?: boolean; bis?: string | null; abo_status?: string | null }[]).map((l) => [l.verein_id, l]),
  );
  const statusText = (id: string, aktiv: boolean) => {
    const l = lizenzInfo.get(id);
    const bis = l?.bis ? ` bis ${new Date(`${l.bis}T12:00:00Z`).toLocaleDateString("de-DE", { timeZone: "UTC" })}` : "";
    if (aktiv) return `Verein · ${l?.abo_status === "trialing" ? "Test" : "Aktiv"}${bis}`;
    if (l?.bis) return "Abgelaufen";
    if (l?.abo_status === "expired") return "Deaktiviert";
    return "ohne Lizenz";
  };
  const label = (id: string) => VEREINS_MODULE.find((m) => m.id === id)?.label ?? id;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
      <div>
        <Link href="/dashboard/admin" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
          <ArrowLeft size={14} /> Administration
        </Link>
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <Building2 size={24} className="text-brand-gold" /> Vereine
        </h1>
        <p className="text-[13.5px] text-brand-ink-soft">{vereine.length} Vereine · nur zusammengefasste Zahlen, keine Mitgliederdaten.</p>
      </div>
      <VereinAnlegenAdmin />
      {vereine.length === 0 ? (
        <p className={`${KARTE} text-[14px] text-brand-ink-soft`}>Noch keine Vereine registriert.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {vereine.map((v) => (
            <Link key={v.verein_id} href={`/dashboard/admin/tarife/verein/${v.verein_id}`} className={`${KARTE} flex flex-col gap-3 transition-all hover:-translate-y-0.5 hover:border-brand-red/40`}>
              <div className="flex items-center gap-3">
                {v.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-xl object-contain" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gold-wash text-brand-gold">
                    <Building2 size={20} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15.5px] font-bold text-brand-ink">{v.name}</div>
                  <div className="text-[12.5px] text-brand-ink-soft">{v.ort ?? "Ort nicht angegeben"}</div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${v.lizenz_aktiv ? "bg-brand-green-wash text-brand-green" : "bg-brand-bg text-brand-ink-soft"}`}
                >
                  {statusText(v.verein_id, v.lizenz_aktiv)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-brand-bg py-2">
                  <Users size={14} className="mx-auto text-brand-ink-soft" />
                  <div className="text-[17px] font-extrabold tabular-nums text-brand-ink">{v.nutzer}</div>
                  <div className="text-[11px] text-brand-ink-soft">Mitglieder</div>
                </div>
                <div className="rounded-xl bg-brand-bg py-2">
                  <UsersRound size={14} className="mx-auto text-brand-ink-soft" />
                  <div className="text-[17px] font-extrabold tabular-nums text-brand-ink">{v.gruppen}</div>
                  <div className="text-[11px] text-brand-ink-soft">Gruppen</div>
                </div>
                <div className="rounded-xl bg-brand-bg py-2">
                  <Radio size={14} className="mx-auto text-brand-green" />
                  <div className="text-[17px] font-extrabold tabular-nums text-brand-ink">{v.online}</div>
                  <div className="text-[11px] text-brand-ink-soft">online</div>
                </div>
              </div>
              {v.module_aus.length > 0 && (
                <p className="text-[12px] text-brand-ink-soft">Ausgeblendet: {v.module_aus.map(label).join(", ")}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
