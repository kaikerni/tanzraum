import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard, Building2, PauseCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { TarifKarten } from "@/components/tarif/TarifKarten";
import { AboKuendigen } from "@/components/tarif/AboKuendigen";
import {
  ABO_STATUS_LABEL,
  ANBIETER_LABEL,
  PERIODE_LABEL,
  TARIF_LABEL,
  datum,
  euro,
  getPreise,
  type AboInfo,
  type MeinTarifStatus,
} from "@/lib/tarife";

export const metadata = { title: "Mein Tarif" };

const KUENDBAR = ["active", "trialing", "past_due", "paused_by_organization"];

function AboZeile({ abo, titel }: { abo: AboInfo; titel: string }) {
  const bis = datum(abo.gekuendigt_zum ?? abo.laeuft_bis);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-brand-line p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5 text-[13.5px]">
        <span className="font-bold text-brand-ink">
          {titel} · {PERIODE_LABEL[abo.periode] ?? abo.periode}
          {abo.anbieter !== "manuell" && ` · ${euro(abo.preis_cent)}`}
        </span>
        <span className="text-brand-ink-soft">
          Status: <strong className="text-brand-ink">{ABO_STATUS_LABEL[abo.status] ?? abo.status}</strong> · {ANBIETER_LABEL[abo.anbieter] ?? abo.anbieter}
        </span>
        {abo.status === "paused_by_organization" && (
          <span className="flex items-center gap-1.5 text-brand-ink-soft">
            <PauseCircle size={14} /> Pausiert seit {datum(abo.pausiert_am)}
            {abo.pause_verein ? `, weil ${abo.pause_verein} eine Vereinslizenz hat` : ""}. Es wird nichts abgebucht; nach
            dem Ende der Vereinsabdeckung läuft dein Abo automatisch weiter.
          </span>
        )}
        {abo.status === "cancelled" && bis && <span className="text-brand-ink-soft">Gekündigt – der Tarif bleibt bis {bis} aktiv.</span>}
        {abo.status === "past_due" && (
          <span className="flex items-center gap-1.5 text-brand-red">
            <AlertTriangle size={14} /> Die letzte Zahlung ist fehlgeschlagen. Bitte prüfe deine Zahlungsart beim Anbieter.
          </span>
        )}
        {abo.status === "pending" && <span className="text-brand-ink-soft">Wir warten auf die Bestätigung des Zahlungsanbieters.</span>}
        {["active", "trialing"].includes(abo.status) && bis && <span className="text-brand-ink-soft">Nächste Verlängerung: {bis}</span>}
      </div>
      {KUENDBAR.includes(abo.status) && abo.anbieter !== "manuell" && (
        <AboKuendigen
          aboId={abo.id}
          frage={`${titel} wirklich kündigen? Der Tarif bleibt bis zum Ende des bezahlten Zeitraums aktiv.`}
        />
      )}
      {KUENDBAR.includes(abo.status) && abo.anbieter === "manuell" && (
        <span className="text-[12.5px] text-brand-ink-soft">Kündigung über info@tanzraum.app</span>
      )}
    </div>
  );
}

export default async function MeinTarifSeite({
  searchParams,
}: {
  searchParams: Promise<{ zahlung?: string; wunsch?: string; periode?: string; verein?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: statusRoh }, preise, sp] = await Promise.all([supabase.rpc("mein_tarif_status"), getPreise(supabase), searchParams]);
  const status = statusRoh as MeinTarifStatus | null;
  if (!status?.zugang) redirect("/dashboard");
  const z = status.zugang;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <CreditCard size={24} className="text-brand-red" /> Mein Tarif
        </h1>
        <p className="text-[14px] text-brand-ink-soft">Dein persönlicher Tarif und die Vereinslizenzen, die du verwaltest.</p>
      </div>

      {sp.zahlung === "erfolg" && (
        <p className="form-success">
          Danke! Sobald der Zahlungsanbieter die Zahlung bestätigt, wird dein Tarif freigeschaltet – meist innerhalb weniger
          Sekunden. Falls noch nichts zu sehen ist, lade die Seite gleich neu.
        </p>
      )}
      {sp.zahlung === "abgebrochen" && <p className="form-error">Die Zahlung wurde abgebrochen. Es wurde nichts berechnet.</p>}

      <section className={`${KARTE} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-semibold text-brand-ink-soft">Dein Zugang</span>
          <span className="rounded-full bg-brand-red px-3 py-1 text-[14px] font-extrabold tracking-wide text-white">
            {TARIF_LABEL[z.effektiv] ?? z.effektiv}
          </span>
          {z.vereinszugang && (
            <span className="flex items-center gap-1.5 text-[13px] text-brand-ink">
              <Building2 size={15} className="text-brand-gold" /> über die Vereinslizenz von <strong>{status.verein_name}</strong>
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 text-[13.5px] sm:grid-cols-2">
          <div>
            <span className="text-brand-ink-soft">Persönlicher Tarif: </span>
            <strong className="text-brand-ink">{TARIF_LABEL[z.persoenlicher_tarif] ?? z.persoenlicher_tarif}</strong>
          </div>
          <div>
            <span className="text-brand-ink-soft">Vereinslizenz: </span>
            <strong className="text-brand-ink">{z.vereinszugang ? "ja, du bist abgedeckt" : "keine"}</strong>
          </div>
        </div>
        {status.abos.length > 0 ? (
          <div className="flex flex-col gap-2">
            {status.abos.map((a) => (
              <AboZeile key={a.id} abo={a} titel={`${TARIF_LABEL[a.tarif] ?? a.tarif}-Abo`} />
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-brand-ink-soft">Du hast kein persönliches Abo.</p>
        )}
      </section>

      {status.admin_vereine.length > 0 && (
        <section className={`${KARTE} flex flex-col gap-3`}>
          <h2 className="text-[16px] font-bold text-brand-ink">Vereinslizenzen, die du verwaltest</h2>
          {status.admin_vereine.map((v) => (
            <div key={v.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-brand-ink">
                {v.lizenz ? <CheckCircle2 size={16} className="text-brand-green" /> : <AlertTriangle size={16} className="text-brand-amber" />}
                {v.name}: {v.lizenz ? `Lizenz aktiv${v.lizenz_bis ? ` bis ${datum(v.lizenz_bis)}` : ""}` : "keine Lizenz"}
                <Link href={`/dashboard/verein?verein=${v.id}`} className="ml-auto text-[12.5px] font-semibold text-brand-red">
                  Zum Verein →
                </Link>
              </div>
              {v.abo && <AboZeile abo={v.abo} titel={`Vereinslizenz ${v.name}`} />}
            </div>
          ))}
        </section>
      )}

      {preise ? (
        <TarifKarten
          preise={preise}
          effektiv={z.effektiv}
          persoenlich={z.persoenlicher_tarif}
          vereinszugang={z.vereinszugang}
          vereinName={status.verein_name}
          adminVereine={status.admin_vereine.map((v) => ({ id: v.id, name: v.name, lizenz: v.lizenz }))}
          startPeriode={sp.periode === "jahr" ? "jahr" : "monat"}
          vorgewaehlterVerein={sp.verein ?? null}
          wunsch={sp.wunsch === "basic" || sp.wunsch === "verein" ? sp.wunsch : null}
        />
      ) : (
        <p className="form-error">Die Preise konnten gerade nicht geladen werden. Bitte versuche es später erneut.</p>
      )}
    </div>
  );
}
