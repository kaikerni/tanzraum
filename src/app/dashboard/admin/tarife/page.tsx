import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { TarifZaehler, type TarifZaehlerDaten } from "@/components/admin/TarifZaehler";
import { SortierteListe, type ListenEintrag } from "@/components/admin/SortierteListe";
import { ABO_STATUS_LABEL, ANBIETER_LABEL, PERIODE_LABEL, datum } from "@/lib/tarife";

export const metadata = { title: "Tarife & Abos" };

type Person = {
  user_id: string;
  name: string;
  stufe: string;
  persoenlicher_tarif: string;
  abo_status: string | null;
  anbieter: string | null;
  periode: string | null;
  laeuft_bis: string | null;
  gekuendigt_zum: string | null;
  pause_verein: string | null;
  vereine: string | null;
  effektiv: string;
  registriert_am: string;
  seit: string | null;
};

type Verein = {
  verein_id: string;
  name: string;
  ort: string | null;
  lizenz: boolean;
  bis: string | null;
  abo_status: string | null;
  anbieter: string | null;
  periode: string | null;
  gekuendigt_zum: string | null;
  kaeufer: string | null;
  abgedeckt: number;
  seit: string | null;
};

const TITEL: Record<string, string> = { free: "FREE", basic: "BASIC", verein: "VEREIN" };

function aboText(p: Person): string {
  if (!p.abo_status) return "";
  const teile = [ABO_STATUS_LABEL[p.abo_status] ?? p.abo_status];
  if (p.periode) teile.push(PERIODE_LABEL[p.periode] ?? p.periode);
  if (p.anbieter) teile.push(ANBIETER_LABEL[p.anbieter] ?? p.anbieter);
  if (p.abo_status === "cancelled" && p.gekuendigt_zum) teile.push(`endet ${datum(p.gekuendigt_zum)}`);
  else if (p.laeuft_bis && ["active", "trialing", "past_due"].includes(p.abo_status)) teile.push(`bis ${datum(p.laeuft_bis)}`);
  if (p.abo_status === "paused_by_organization" && p.pause_verein) teile.push(`wegen ${p.pause_verein}`);
  return teile.join(" · ");
}

function PersonZeile({ p }: { p: Person }) {
  const abo = aboText(p);
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2.5 text-[13.5px] sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-brand-ink">{p.name}</div>
        <div className="text-[12.5px] text-brand-ink-soft">
          {p.effektiv}
          {abo && ` · ${abo}`}
          {p.vereine && ` · Vereine: ${p.vereine}`}
        </div>
      </div>
      <div className="shrink-0 text-[12px] text-brand-ink-soft">
        seit {datum(p.seit)} · registriert {datum(p.registriert_am)}
      </div>
    </div>
  );
}

function VereinZeile({ v }: { v: Verein }) {
  const abo = [
    v.abo_status ? (ABO_STATUS_LABEL[v.abo_status] ?? v.abo_status) : null,
    v.periode ? (PERIODE_LABEL[v.periode] ?? v.periode) : null,
    v.anbieter ? (ANBIETER_LABEL[v.anbieter] ?? v.anbieter) : null,
    v.abo_status === "cancelled" && v.gekuendigt_zum ? `endet ${datum(v.gekuendigt_zum)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link href={`/dashboard/admin/tarife/verein/${v.verein_id}`} className="flex items-center gap-3 px-3 py-2.5 text-[13.5px] hover:bg-brand-bg">
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-brand-ink">
          {v.name}
          {v.ort && <span className="font-normal text-brand-ink-soft"> · {v.ort}</span>}
        </div>
        <div className="text-[12.5px] text-brand-ink-soft">
          {v.lizenz ? `Lizenz aktiv${v.bis ? ` bis ${datum(v.bis)}` : ""}` : "keine Lizenz"} · {v.abgedeckt} aktive Mitglieder
          {abo && ` · ${abo}`}
          {v.kaeufer && ` · gekauft von ${v.kaeufer}`}
        </div>
      </div>
      <span className="shrink-0 text-[12px] text-brand-ink-soft">seit {datum(v.seit)}</span>
      <ChevronRight size={16} className="shrink-0 text-brand-ink-soft" />
    </Link>
  );
}

export default async function AdminTarifeSeite({ searchParams }: { searchParams: Promise<{ stufe?: string; ansicht?: string; alle?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");

  const sp = await searchParams;
  const stufe = sp.stufe === "basic" || sp.stufe === "verein" ? sp.stufe : "free";
  const ansicht = stufe === "verein" && sp.ansicht === "personen" ? "personen" : "vereine";
  const alle = sp.alle === "1";

  const [{ data: zRoh }, { data: personenRoh }, { data: vereineRoh }, { data: kaeufe }] = await Promise.all([
    supabase.rpc("admin_tarif_zaehler"),
    supabase.rpc("admin_tarif_uebersicht"),
    stufe === "verein" ? supabase.rpc("admin_vereinslizenzen") : Promise.resolve({ data: [] }),
    supabase
      .from("benachrichtigungen")
      .select("id, text, erstellt_am, gelesen")
      .eq("user_id", user.id)
      .eq("typ", "tarif_kauf")
      .order("erstellt_am", { ascending: false })
      .limit(8),
  ]);
  // Kauf-Meldungen gelten mit dem Oeffnen dieser Seite als gelesen
  const ungelesen = ((kaeufe ?? []) as { id: string; gelesen: boolean }[]).filter((k) => !k.gelesen).map((k) => k.id);
  if (ungelesen.length > 0) await supabase.from("benachrichtigungen").update({ gelesen: true }).in("id", ungelesen);
  const zRow = ((zRoh ?? []) as TarifZaehlerDaten[])[0];
  const z: TarifZaehlerDaten = {
    free: Number(zRow?.free ?? 0),
    basic: Number(zRow?.basic ?? 0),
    verein: Number(zRow?.verein ?? 0),
    vereine_mit_lizenz: Number(zRow?.vereine_mit_lizenz ?? 0),
    basic_pausiert: Number(zRow?.basic_pausiert ?? 0),
  };

  const personen = ((personenRoh ?? []) as Person[]).filter((p) => p.stufe === stufe);
  const personenEintraege: ListenEintrag[] = personen.map((p) => ({ id: p.user_id, name: p.name, seit: p.seit, inhalt: <PersonZeile p={p} /> }));
  const vereine = ((vereineRoh ?? []) as Verein[]).filter((v) => alle || v.lizenz);
  const vereinEintraege: ListenEintrag[] = vereine.map((v) => ({ id: v.verein_id, name: v.name, seit: v.seit, inhalt: <VereinZeile v={v} /> }));

  const reiter = (aktiv: boolean) =>
    `rounded-full px-3 py-1 text-[13px] font-semibold ${aktiv ? "bg-brand-ink text-white" : "border border-brand-line bg-white text-brand-ink-soft"}`;

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
      <div>
        <Link href="/dashboard/admin" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
          <ArrowLeft size={14} /> TanzRaum-Administration
        </Link>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Tarife & Abos</h1>
      </div>

      <TarifZaehler z={z} aktiv={stufe} />

      {(kaeufe ?? []).length > 0 && (
        <section className={`${KARTE} flex flex-col gap-2`}>
          <h2 className="text-[16px] font-bold text-brand-ink">Letzte Käufe</h2>
          <ul className="flex flex-col gap-1 text-[13.5px]">
            {((kaeufe ?? []) as { id: string; text: string; erstellt_am: string; gelesen: boolean }[]).map((k) => (
              <li key={k.id} className="flex flex-wrap gap-x-2">
                {!k.gelesen && <span className="font-bold text-brand-red">neu</span>}
                <span className="text-brand-ink">{k.text}</span>
                <span className="text-brand-ink-soft">· {datum(k.erstellt_am)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${KARTE} flex flex-col gap-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-[16px] font-bold text-brand-ink">
            {stufe === "verein" && ansicht === "vereine" ? (alle ? "Alle Vereine" : "Vereine mit Lizenz") : `Mitglieder mit ${TITEL[stufe]}`}
          </h2>
          {stufe === "verein" && (
            <>
              <Link href="/dashboard/admin/tarife?stufe=verein" className={reiter(ansicht === "vereine")}>
                Vereine
              </Link>
              <Link href="/dashboard/admin/tarife?stufe=verein&ansicht=personen" className={reiter(ansicht === "personen")}>
                Personen
              </Link>
            </>
          )}
        </div>
        {stufe === "verein" && ansicht === "vereine" ? (
          <>
            <SortierteListe eintraege={vereinEintraege} leer="Keine Vereine gefunden." suchText="Verein suchen …" />
            <Link href={alle ? "/dashboard/admin/tarife?stufe=verein" : "/dashboard/admin/tarife?stufe=verein&alle=1"} className="text-[12.5px] font-semibold text-brand-red">
              {alle ? "Nur Vereine mit Lizenz anzeigen" : "Alle Vereine anzeigen (auch ohne Lizenz)"}
            </Link>
          </>
        ) : (
          <SortierteListe eintraege={personenEintraege} leer="Keine Mitglieder in diesem Tarif." />
        )}
        <p className="text-[12px] text-brand-ink-soft">
          „Neueste zuerst“ sortiert nach Beginn des aktuellen Tarifs (Abo-Beginn, Vereinsbeitritt bzw. Registrierung). Plattform-Admins
          werden nicht mitgezählt.
        </p>
      </section>
    </div>
  );
}
