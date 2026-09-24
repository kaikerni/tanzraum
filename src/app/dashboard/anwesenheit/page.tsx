import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTrainingKalender, getAnwesenheitListe, heuteBerlin, plusTage } from "@/lib/training/getTraining";
import { KARTE } from "@/components/dashboard/Karten";
import { AnwesenheitErfassung } from "@/components/training/AnwesenheitErfassung";

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function datumText(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

export default async function AnwesenheitSeite({
  searchParams,
}: {
  searchParams: Promise<{ gruppe?: string; datum?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Auswahl: Trainings der letzten 7 Tage bis heute, fuer die man Anwesenheit erfassen darf.
  const heute = heuteBerlin();
  const alle = await getTrainingKalender(supabase, plusTage(heute, -7), heute);
  const erfassbar = alle.filter((t) => t.darfAnwesenheit).reverse();

  const { gruppe, datum } = await searchParams;
  const gewaehlt =
    (gruppe && datum && DATUM.test(datum) ? erfassbar.find((t) => t.gruppeId === gruppe && t.datum === datum) : undefined) ??
    erfassbar.find((t) => t.datum === heute) ??
    erfassbar[0];

  const liste = gewaehlt ? await getAnwesenheitListe(supabase, gewaehlt.gruppeId, gewaehlt.datum) : null;

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Anwesenheit</h1>
        <p className="text-[14px] text-brand-ink-soft">Anwesenheit schnell erfassen – auch nachträglich für die letzten 7 Tage.</p>
      </div>

      {erfassbar.length === 0 ? (
        <p className={`${KARTE} text-[14px] text-brand-ink-soft`}>
          In den letzten 7 Tagen gab es kein Training, für das du Anwesenheit erfassen darfst. Dafür brauchst du den Bereich
          „Anwesenheit“ und musst der Gruppe als Trainer oder Betreuer zugeordnet sein.
        </p>
      ) : (
        <>
          <nav aria-label="Training wählen" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {erfassbar.map((t) => {
              const aktiv = gewaehlt && t.gruppeId === gewaehlt.gruppeId && t.datum === gewaehlt.datum;
              return (
                <Link
                  key={`${t.terminId}-${t.datum}`}
                  href={`/dashboard/anwesenheit?gruppe=${t.gruppeId}&datum=${t.datum}`}
                  aria-current={aktiv ? "page" : undefined}
                  className={`flex min-h-11 shrink-0 flex-col justify-center rounded-xl border px-3.5 py-1.5 text-left ${
                    aktiv ? "border-brand-red bg-brand-red text-white" : "border-brand-line bg-white text-brand-ink hover:bg-brand-bg"
                  }`}
                >
                  <span className="text-[13px] font-semibold">{t.gruppeName}</span>
                  <span className={`text-[11.5px] ${aktiv ? "text-white/85" : "text-brand-ink-soft"}`}>
                    {t.datum === heute ? "Heute" : datumText(t.datum)} · {t.von}
                  </span>
                </Link>
              );
            })}
          </nav>

          {gewaehlt && (
            <section className={KARTE}>
              <div className="mb-3 flex items-center gap-2.5">
                <ClipboardCheck size={20} className="text-brand-ink" />
                <div>
                  <h2 className="text-[16px] font-bold text-brand-ink">
                    {gewaehlt.gruppeName} – {gewaehlt.datum === heute ? "heute" : datumText(gewaehlt.datum)}, {gewaehlt.von} Uhr
                  </h2>
                  <p className="text-[12.5px] text-brand-ink-soft">
                    {gewaehlt.vereinName}
                    {gewaehlt.halle ? ` · ${gewaehlt.halle}` : ""}
                  </p>
                </div>
              </div>
              {liste === null ? (
                <p className="form-error">Dafür fehlt dir die Berechtigung.</p>
              ) : (
                <AnwesenheitErfassung
                  key={`${gewaehlt.gruppeId}-${gewaehlt.datum}`}
                  vereinId={gewaehlt.vereinId}
                  gruppeId={gewaehlt.gruppeId}
                  datum={gewaehlt.datum}
                  eintraege={liste}
                />
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
