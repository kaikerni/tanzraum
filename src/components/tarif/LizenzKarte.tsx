import { AlertTriangle, PauseCircle } from "lucide-react";
import { AboKuendigen } from "@/components/tarif/AboKuendigen";
import { ABO_STATUS_LABEL, TARIF_LABEL, VERLAENGERUNG_LABEL, datum, euro, tageBis, type AboInfo } from "@/lib/tarife";

const KUENDBAR = ["active", "trialing", "past_due", "paused_by_organization"];

const BADGE: Record<string, string> = {
  active: "border-brand-green/40 bg-brand-green-wash text-brand-green",
  trialing: "border-brand-green/40 bg-brand-green-wash text-brand-green",
  cancelled: "border-brand-gold/40 bg-brand-gold-wash text-brand-ink",
  paused_by_organization: "border-brand-line bg-brand-bg text-brand-ink-soft",
  past_due: "border-brand-red/40 bg-brand-red-wash text-brand-red",
  pending: "border-brand-line bg-brand-bg text-brand-ink-soft",
};

function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11.5px] font-bold uppercase tracking-wide text-brand-ink-soft">{label}</span>
      <span className="text-[14.5px] font-bold text-brand-ink">{children}</span>
    </div>
  );
}

// Aktive Lizenz: Tarif + Laufzeit, Status, gueltig bis, Resttage, wie sie sich verlaengert, Kuendigen
export function LizenzKarte({ abo, kopf, tarif }: { abo: AboInfo; kopf: string; tarif: string }) {
  const bis = abo.gekuendigt_zum ?? abo.laeuft_bis;
  const tage = tageBis(bis);
  const laufzeit = abo.periode === "jahr" ? "Jahreslizenz" : abo.periode === "monat" ? "Monatslizenz" : "unbefristet";
  const verlaengerung =
    abo.status === "cancelled"
      ? "keine – gekündigt"
      : abo.status === "paused_by_organization"
        ? "pausiert (Vereinslizenz)"
        : (VERLAENGERUNG_LABEL[abo.anbieter] ?? abo.anbieter);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-brand-line bg-white p-4">
      <div className="flex items-start justify-between gap-3 border-b border-brand-line pb-3">
        <div className="min-w-0">
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-brand-ink-soft">{kopf}</div>
          <div className="text-[17px] font-extrabold text-brand-ink">
            {TARIF_LABEL[tarif] === "VEREIN" ? "Verein" : TARIF_LABEL[tarif] === "BASIC" ? "Basic" : tarif} — {laufzeit}
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-[12.5px] font-bold ${BADGE[abo.status] ?? BADGE.pending}`}>
          {abo.status === "active" ? "✓ " : ""}
          {ABO_STATUS_LABEL[abo.status] ?? abo.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {abo.periode !== "unbefristet" && <Feld label="Gültig bis">{bis ? datum(bis) : "–"}</Feld>}
        {tage !== null && abo.periode !== "unbefristet" && <Feld label="Noch">{tage === 1 ? "1 Tag" : `${tage} Tage`}</Feld>}
        <Feld label="Verlängerung">{verlaengerung}</Feld>
        {abo.anbieter !== "manuell" && <Feld label="Preis">{`${euro(abo.preis_cent)} / ${abo.periode === "jahr" ? "Jahr" : "Monat"}`}</Feld>}
      </div>

      {abo.anbieter === "ueberweisung" && abo.status === "active" && (
        <p className="text-[12.5px] text-brand-ink-soft">
          Rund 30 Tage vor Ablauf bekommst du automatisch eine Zahlungsaufforderung für das nächste Jahr. Ohne Zahlung endet die Lizenz zum
          Stichtag.
        </p>
      )}
      {abo.status === "paused_by_organization" && (
        <p className="flex items-center gap-1.5 text-[12.5px] text-brand-ink-soft">
          <PauseCircle size={14} /> Pausiert seit {datum(abo.pausiert_am)}
          {abo.pause_verein ? `, weil ${abo.pause_verein} eine Vereinslizenz hat` : ""}. Es wird nichts abgebucht; nach dem Ende der
          Vereinsabdeckung läuft deine Lizenz automatisch weiter.
        </p>
      )}
      {abo.status === "cancelled" && bis && <p className="text-[12.5px] text-brand-ink-soft">Gekündigt – der Tarif bleibt bis {datum(bis)} aktiv.</p>}
      {abo.status === "past_due" && (
        <p className="flex items-center gap-1.5 text-[12.5px] text-brand-red">
          <AlertTriangle size={14} /> Die letzte Zahlung ist fehlgeschlagen. Bitte prüfe deine Zahlungsart beim Anbieter.
        </p>
      )}

      {KUENDBAR.includes(abo.status) && abo.anbieter !== "manuell" && (
        <AboKuendigen aboId={abo.id} text="Kündigen" frage="Lizenz wirklich kündigen? Sie bleibt bis zum Ende des bezahlten Zeitraums aktiv." />
      )}
      {KUENDBAR.includes(abo.status) && abo.anbieter === "manuell" && (
        <span className="text-[12.5px] text-brand-ink-soft">Kündigung über info@tanzraum.app</span>
      )}
    </div>
  );
}
