import Link from "next/link";
import { ArrowLeft, ChevronRight, LifeBuoy } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { adminSitzung } from "@/lib/admin/zugang";

export const metadata = { title: "Fernwartung – TanzRaum-Administration" };

type Anfrage = {
  id: string;
  verein_id: string;
  verein_name: string;
  typ: string | null;
  beschreibung: string | null;
  fernzugriff: boolean;
  code: string | null;
  status: string;
  erstellt_am: string;
  laeuft_ab_am: string | null;
  aktiv: boolean;
};

const zeit = (iso: string) => new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" });

// Support-Anfragen der Vereine. Bearbeiten nur bei aktiver Freigabe (24 h, widerrufbar, protokolliert) –
// und ausschliesslich Konfiguration, nie Mitgliederdaten.
export default async function AdminFernwartungSeite() {
  const { supabase } = await adminSitzung("/dashboard/admin/fernwartung");
  const { data } = await supabase.rpc("admin_fernwartungen");
  const anfragen = (data ?? []) as Anfrage[];

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div>
        <Link href="/dashboard/admin" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
          <ArrowLeft size={14} /> Administration
        </Link>
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <LifeBuoy size={24} className="text-brand-red" /> Fernwartung
        </h1>
        <p className="text-[13.5px] text-brand-ink-soft">
          Nur nach Freigabe durch den Vereinsadmin, zeitlich begrenzt und protokolliert. Ihr bearbeitet Einstellungen – Mitglieder, Anträge und
          Chats bleiben gesperrt.
        </p>
      </div>
      {anfragen.length === 0 ? (
        <p className={`${KARTE} text-[14px] text-brand-ink-soft`}>Keine Anfragen.</p>
      ) : (
        <ul className={`${KARTE} divide-y divide-brand-line py-1`}>
          {anfragen.map((a) => {
            const inhalt = (
              <>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-brand-ink">
                    {a.verein_name} · {a.typ ?? "Sonstiges"}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${a.aktiv ? "bg-brand-green-wash text-brand-green" : "bg-brand-bg text-brand-ink-soft"}`}
                    >
                      {a.aktiv ? `freigegeben bis ${zeit(a.laeuft_ab_am!)}` : a.fernzugriff ? a.status : "ohne Fernzugriff"}
                    </span>
                  </div>
                  {a.beschreibung && <p className="text-[13px] text-brand-ink-soft">{a.beschreibung}</p>}
                  <p className="text-[12px] text-brand-ink-faint">
                    {zeit(a.erstellt_am)}
                    {a.code ? ` · Code ${a.code}` : ""}
                  </p>
                </div>
                {a.aktiv && <ChevronRight size={18} className="shrink-0 text-brand-ink-faint" />}
              </>
            );
            return (
              <li key={a.id}>
                {a.aktiv ? (
                  <Link href={`/dashboard/admin/fernwartung/${a.verein_id}`} className="flex items-center gap-3 py-3 text-[13.5px] hover:bg-brand-bg/50">
                    {inhalt}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 py-3 text-[13.5px]">{inhalt}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
