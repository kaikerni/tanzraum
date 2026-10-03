import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard, Building2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { TarifKarten } from "@/components/tarif/TarifKarten";
import { LizenzKarte } from "@/components/tarif/LizenzKarte";
import { OffeneUeberweisung } from "@/components/tarif/OffeneUeberweisung";
import { TARIF_LABEL, datum, getPreise, type MeinTarifStatus } from "@/lib/tarife";
import { lizenzStatus, restTage } from "@/lib/lizenz";
import { speicherKontingente } from "@/lib/speicher";

// Vereinslizenz, ueber die man abgedeckt ist: Verein, Status, gueltig bis (Abrechnung ueber den Verein)
function VereinslizenzKarte({ verein, bis }: { verein: string | null; bis: string | null }) {
  const st = lizenzStatus("verein", bis);
  const tage = restTage(bis);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-gold/40 bg-brand-gold-wash/40 p-4">
      <div className="text-[11.5px] font-bold uppercase tracking-wide text-brand-ink-soft">Vereinslizenz</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <div>
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-brand-ink-soft">Verein</div>
          <div className="text-[14.5px] font-bold text-brand-ink">{verein ?? "–"}</div>
        </div>
        <div>
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-brand-ink-soft">Lizenz</div>
          <div className="text-[14.5px] font-bold text-brand-ink">VEREIN</div>
        </div>
        <div>
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-brand-ink-soft">Status</div>
          <div className="text-[14.5px] font-bold text-brand-ink">{st.text}</div>
        </div>
        <div>
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-brand-ink-soft">Gültig bis</div>
          <div className="text-[14.5px] font-bold text-brand-ink">{bis ? datum(bis) : "laufend"}</div>
        </div>
      </div>
      {st.stufe === "bald" && tage !== null && (
        <p className="text-[13px] font-semibold text-brand-ink">🟠 Die Vereinslizenz ist noch {tage === 1 ? "1 Tag" : `${tage} Tage`} gültig.</p>
      )}
      <p className="text-[12.5px] text-brand-ink-soft">Abrechnung über deinen Verein – für dich entstehen keine Kosten.</p>
    </div>
  );
}

export const metadata = { title: "Mein Tarif & Lizenz" };

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

  const [{ data: statusRoh }, preise, sp, speicher] = await Promise.all([supabase.rpc("mein_tarif_status"), getPreise(supabase), searchParams, speicherKontingente(supabase)]);
  const status = statusRoh as MeinTarifStatus | null;
  if (!status?.zugang) redirect("/dashboard");
  const z = status.zugang;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <CreditCard size={24} className="text-brand-red" /> Mein Tarif & Lizenz
        </h1>
        <p className="text-[14px] text-brand-ink-soft">Dein Tarif, seine Laufzeit und die Vereinslizenzen, die du verwaltest.</p>
      </div>

      {sp.zahlung === "erfolg" && (
        <p className="form-success">
          Danke! Sobald der Zahlungsanbieter die Zahlung bestätigt, wird dein Tarif freigeschaltet – bei Karte und PayPal
          meist innerhalb weniger Sekunden, bei SEPA-Lastschrift nach dem Zahlungseingang (in der Regel 3–5 Werktage).
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
        {z.vereinszugang && <VereinslizenzKarte verein={status.verein_name} bis={status.vereinslizenz_bis ?? null} />}
        {status.abos.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {status.abos.map((a) => (
              <LizenzKarte key={a.id} abo={a} tarif={a.tarif} kopf="Deine aktive Lizenz" />
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-brand-ink-soft">Du hast keine persönliche Lizenz.</p>
        )}
      </section>

      {status.admin_vereine.length > 0 && (
        <section className={`${KARTE} flex flex-col gap-3`}>
          <h2 className="text-[16px] font-bold text-brand-ink">Vereinslizenzen, die du verwaltest</h2>
          {status.admin_vereine.map((v) => (
            <div key={v.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-brand-ink">
                {v.lizenz ? <CheckCircle2 size={16} className="text-brand-green" /> : <AlertTriangle size={16} className="text-brand-amber" />}
                {v.name}: {v.lizenz ? `Lizenz aktiv${v.lizenz_bis ? ` bis ${datum(v.lizenz_bis)}` : ""}` : v.ueberweisung ? "Lizenz nach Zahlungseingang" : "keine Lizenz"}
                <Link href={`/dashboard/verein?verein=${v.id}`} className="ml-auto text-[12.5px] font-semibold text-brand-red">
                  Zum Verein →
                </Link>
              </div>
              {v.ueberweisung && <OffeneUeberweisung u={v.ueberweisung} bank={status.bank} verein={v.name} />}
              {v.abo && <LizenzKarte abo={v.abo} tarif="verein" kopf={`Vereinslizenz · ${v.name}`} />}
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
          adminVereine={status.admin_vereine.map((v) => ({ id: v.id, name: v.name, lizenz: v.lizenz || !!v.ueberweisung }))}
          ueberweisungMoeglich={status.ueberweisung_moeglich === true}
          startPeriode={sp.periode === "jahr" ? "jahr" : "monat"}
          vorgewaehlterVerein={sp.verein ?? null}
          wunsch={sp.wunsch === "basic" || sp.wunsch === "verein" ? sp.wunsch : null}
          speicher={speicher}
        />
      ) : (
        <p className="form-error">Die Preise konnten gerade nicht geladen werden. Bitte versuche es später erneut.</p>
      )}
    </div>
  );
}
