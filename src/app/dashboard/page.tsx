import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, Trophy, Building2, Activity, ArrowRight, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import {
  getDashboardKpis,
  getNaechsteTermine,
  getMitgliederNachAltersklasse,
} from "@/lib/dashboard/getAdminOverview";

const TARIF_LABEL: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  verein: "Verein",
};

const WOCHENTAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function formatDatum(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const daten = await getDashboardData(supabase, user.id);
  if (!daten) redirect("/login");
  if (daten.gesperrt) redirect("/gesperrt");

  const [kpis, termine, altersklassen] = daten.istPlattformAdmin
    ? await Promise.all([
        getDashboardKpis(supabase),
        getNaechsteTermine(supabase, 6),
        getMitgliederNachAltersklasse(supabase),
      ])
    : [null, [], []];

  const maxAnzahl = Math.max(1, ...altersklassen.map((a) => a.anzahl));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {/* Hero */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl bg-brand-navy px-8 py-10 text-white shadow-sm">
          <h1 className="font-display text-3xl font-bold">
            Willkommen zurück, {daten.vorname ?? "bei TanzRaum"}!
          </h1>
          <p className="mt-2 max-w-md text-[14px] text-white/80">
            Hier hast du den kompletten Überblick über deine Vereine, Teams, Termine und alles
            Wichtige in TanzRaum.
          </p>
          <p className="mt-4 font-display text-[15px] italic text-brand-gold-light">
            Tanz verbindet – und du machst es möglich!
          </p>
        </div>
        <div className="flex flex-col justify-between rounded-2xl border border-brand-line bg-white p-6 shadow-sm">
          <div className="text-[13px] font-medium text-brand-ink-soft">
            {new Date().toLocaleDateString("de-DE", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </div>
          <p className="mt-4 font-display text-lg leading-snug text-brand-ink">
            „Disziplin heute – Erfolg morgen."
          </p>
        </div>
      </div>

      {/* KPI-Karten (nur fuer Plattform-Admin, plattformweit) */}
      {daten.istPlattformAdmin && kpis && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard icon={Users} farbe="green" wert={kpis.mitgliederGesamt} label="Mitglieder" />
          <KpiCard icon={Building2} farbe="navy" wert={kpis.vereineGesamt} label="Vereine" />
          <KpiCard
            icon={Trophy}
            farbe="gold"
            wert={kpis.turniereKommende30Tage}
            label="Turniere (30 Tage)"
          />
          <KpiCard
            icon={Activity}
            farbe="red"
            wert={
              kpis.trainingsbeteiligungProzent !== null ? `${kpis.trainingsbeteiligungProzent}%` : "–"
            }
            label="Trainingsbeteiligung"
            zusatz={
              kpis.trainingsbeteiligungProzent === null
                ? "Noch keine Daten"
                : "diesen Monat"
            }
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Naechste Termine */}
        <div className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-brand-ink">Nächste Termine</h2>
          </div>
          {termine.length === 0 ? (
            <p className="text-[13px] text-brand-ink-soft">Aktuell keine bevorstehenden Termine.</p>
          ) : (
            <div className="flex flex-col">
              {termine.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-brand-line py-3 last:border-0"
                >
                  <div className="flex h-11 w-11 flex-col items-center justify-center rounded-lg bg-brand-bg text-center">
                    {t.wiederholend ? (
                      <span className="text-[10px] font-semibold text-brand-ink-soft">
                        {WOCHENTAGE[(t.wochentag ?? 1) - 1]?.slice(0, 2) ?? "–"}
                      </span>
                    ) : (
                      <span className="text-[13px] font-bold text-brand-ink">
                        {formatDatum(t.datum)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-[13.5px] font-semibold text-brand-ink">{t.titel}</div>
                    <div className="text-[12px] text-brand-ink-soft">
                      {t.ort ?? "Ort offen"}
                      {t.wiederholend ? " · wöchentlich" : ""}
                    </div>
                  </div>
                  <span
                    className={`status-badge ${t.typ === "turnier" ? "vielleicht" : "kann"}`}
                  >
                    {t.typ === "turnier" ? "Turnier" : "Training"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mitglieder nach Altersklassen */}
        <div className="card">
          <h2 className="mb-3 font-display text-base font-bold text-brand-ink">
            Mitglieder nach Altersklassen
          </h2>
          {altersklassen.length === 0 ? (
            <p className="text-[13px] text-brand-ink-soft">Noch keine Mitgliederdaten.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {altersklassen.map((a) => (
                <div key={a.altersklasse}>
                  <div className="mb-1 flex justify-between text-[12.5px]">
                    <span className="font-medium text-brand-ink">{a.altersklasse}</span>
                    <span className="text-brand-ink-soft">{a.anzahl}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-brand-bg">
                    <div
                      className="h-full rounded-full bg-brand-red"
                      style={{ width: `${(a.anzahl / maxAnzahl) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deine Vereine */}
      <div className="card">
        <h2 className="mb-3 font-display text-base font-bold text-brand-ink">Deine Vereine</h2>
        {daten.vereine.length === 0 && (
          <p className="text-[13px] text-brand-ink-soft">Du bist aktuell in keinem Verein Mitglied.</p>
        )}
        {daten.vereine.map((v) => (
          <div
            key={v.vereinId}
            className="flex items-center justify-between border-b border-brand-line py-2.5 text-[13.5px] last:border-0"
          >
            <span>
              {v.vereinName}
              {v.rolleName ? ` · ${v.rolleName}` : ""}
            </span>
            <span className="text-brand-ink-soft">
              {v.vereinTarif ? (TARIF_LABEL[v.vereinTarif] ?? v.vereinTarif) : "—"}
              {v.vereinGesperrt ? " · gesperrt" : ""}
            </span>
          </div>
        ))}
      </div>

      {daten.istJuryMitglied && (
        <Link
          href="/juryraum/dashboard"
          className="card flex items-center justify-between hover:border-brand-gold"
        >
          <div>
            <span className="font-display text-[15px] font-bold text-brand-ink">JuryRaum öffnen</span>
            <span className="mt-0.5 block text-[12.5px] text-brand-ink-soft">
              Einsätze, Verfügbarkeit und Jury-Organisation
            </span>
          </div>
          <ArrowRight size={18} className="text-brand-gold" />
        </Link>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  farbe,
  wert,
  label,
  zusatz,
}: {
  icon: LucideIcon;
  farbe: "green" | "navy" | "gold" | "red";
  wert: number | string;
  label: string;
  zusatz?: string;
}) {
  const farben: Record<string, string> = {
    green: "bg-brand-green-wash text-brand-green",
    navy: "bg-brand-bg text-brand-navy",
    gold: "bg-brand-gold-wash text-brand-gold",
    red: "bg-brand-red-wash text-brand-red",
  };
  return (
    <div className="card">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${farben[farbe]}`}>
        <Icon size={19} strokeWidth={2.2} />
      </div>
      <div className="font-display text-2xl font-bold text-brand-ink">{wert}</div>
      <div className="text-[13px] text-brand-ink-soft">{label}</div>
      {zusatz && <div className="mt-1 text-[11.5px] text-brand-ink-faint">{zusatz}</div>}
    </div>
  );
}
