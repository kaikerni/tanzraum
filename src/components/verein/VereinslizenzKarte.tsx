import Link from "next/link";
import {
  BadgeCheck,
  AlertTriangle,
  Users,
  PauseCircle,
  CreditCard,
} from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import {
  ABO_STATUS_LABEL,
  ANBIETER_LABEL,
  PERIODE_LABEL,
  datum,
  euro,
} from "@/lib/tarife";

export type VereinslizenzStatus = {
  aktiv: boolean;
  bis: string | null;
  abgedeckt: number;
  basic_pausiert: number;
  abo: {
    id: string;
    periode: string;
    preis_cent: number;
    anbieter: string;
    status: string;
    laeuft_bis: string | null;
    gekuendigt_zum: string | null;
    kaeufer: string | null;
  } | null;
};

// Nur fuer Vereinsadmins: Lizenzstatus, Laufzeit und abgedeckte Mitglieder
export function VereinslizenzKarte({
  status,
  vereinId,
  verwalten = true,
}: {
  status: VereinslizenzStatus;
  vereinId: string;
  verwalten?: boolean;
}) {
  const a = status.abo;
  return (
    <section className={`${KARTE} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[16px] font-bold text-brand-ink">Vereinslizenz</h2>
        {status.aktiv ? (
          <span className="status-badge zugesagt">
            <BadgeCheck size={13} /> aktiv
            {status.bis ? ` bis ${datum(status.bis)}` : ""}
          </span>
        ) : (
          <span className="status-badge offen">
            <AlertTriangle size={13} /> keine Lizenz
          </span>
        )}
      </div>

      {status.aktiv ? (
        <>
          <div className="grid grid-cols-1 gap-2 text-[13.5px] sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-brand-ink-soft" />{" "}
              <strong>{status.abgedeckt}</strong> aktive Mitglieder abgedeckt
              (unbegrenzt)
            </div>
            {status.basic_pausiert > 0 && (
              <div className="flex items-center gap-2">
                <PauseCircle size={15} className="text-brand-ink-soft" />{" "}
                {status.basic_pausiert} persönliche BASIC-Abos pausiert
              </div>
            )}
            {a && (
              <>
                <div>
                  <span className="text-brand-ink-soft">Abrechnung: </span>
                  {a.anbieter === "manuell"
                    ? "manuell (Support)"
                    : `${euro(a.preis_cent)} ${PERIODE_LABEL[a.periode] ?? a.periode} · ${ANBIETER_LABEL[a.anbieter] ?? a.anbieter}`}
                </div>
                <div>
                  <span className="text-brand-ink-soft">Status: </span>
                  {ABO_STATUS_LABEL[a.status] ?? a.status}
                  {a.status === "cancelled" && a.gekuendigt_zum
                    ? ` – endet am ${datum(a.gekuendigt_zum)}`
                    : ""}
                </div>
                {a.kaeufer && (
                  <div>
                    <span className="text-brand-ink-soft">Gekauft von: </span>
                    {a.kaeufer}
                  </div>
                )}
              </>
            )}
          </div>
          <p className="text-[12.5px] text-brand-ink-soft">
            Alle aktiven Mitglieder haben VEREIN-Zugang. Wer in „Mitglieder“
            deaktiviert bzw. aus dem Verein entfernt wird, verliert die
            Abdeckung sofort; ein pausiertes eigenes BASIC-Abo läuft dann
            automatisch weiter.
          </p>
        </>
      ) : (
        <p className="text-[13.5px] text-brand-ink-soft">
          Mit der Vereinslizenz erhalten alle aktiven Mitglieder VEREIN-Zugang –
          ohne Begrenzung der Mitgliederzahl.
        </p>
      )}
      {verwalten && (
        <div>
          <Link
            href={`/dashboard/tarif?verein=${vereinId}#verein`}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-line bg-white px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
          >
            <CreditCard size={15} />{" "}
            {status.aktiv ? "Lizenz verwalten" : "Vereinslizenz kaufen"}
          </Link>
        </div>
      )}
    </section>
  );
}
