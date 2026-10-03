import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { heuteBerlin } from "@/lib/training/getTraining";
import { getKalenderEintraege, getMeinTarif, monatsRaster } from "@/lib/kalender/getKalender";
import { KARTE } from "@/components/dashboard/Karten";
import { KalenderMonat } from "@/components/kalender/KalenderMonat";
import { KalenderAbo } from "@/components/kalender/KalenderAbo";

const MONAT = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function monatVerschieben(monat: string, schritt: number) {
  const [j, m] = monat.split("-").map(Number);
  const d = new Date(Date.UTC(j, m - 1 + schritt, 1));
  return d.toISOString().slice(0, 7);
}

export default async function KalenderSeite({ searchParams }: { searchParams: Promise<{ monat?: string; tag?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tarif = await getMeinTarif(supabase);
  if (tarif === "free") {
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Kalender</h1>
        <section className={`${KARTE} flex items-start gap-3`}>
          <Lock size={20} className="mt-0.5 shrink-0 text-brand-gold" />
          <div className="text-[14px] text-brand-ink-soft">
            Der Kalender mit eigenen Terminen und Kalender-Synchronisation ist ab dem Tarif <strong className="text-brand-ink">BASIC</strong>{" "}
            enthalten – oder automatisch, wenn dein Verein TanzRaum nutzt. Die Turniere findest du jederzeit unter{" "}
            <Link href="/dashboard/turniere" className="font-semibold text-brand-red">
              Turniere
            </Link>
            .
          </div>
        </section>
      </div>
    );
  }

  const heute = heuteBerlin();
  const { monat: monatParam, tag } = await searchParams;
  const startTag = tag && DATUM.test(tag) ? tag : null;
  const monat = monatParam && MONAT.test(monatParam) ? monatParam : (startTag ?? heute).slice(0, 7);
  const { von, bis } = monatsRaster(monat);
  const eintraege = await getKalenderEintraege(supabase, von, bis);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Kalender</h1>
          <p className="text-[14px] text-brand-ink-soft">Trainings, Vereinstermine, Turniere und deine eigenen Termine an einem Ort.</p>
        </div>
        <Link
          href="/dashboard/kalender/neu"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep"
        >
          <Plus size={16} /> Termin anlegen
        </Link>
      </div>

      <KalenderMonat
        key={`${monat}-${startTag ?? ""}`}
        monat={monat}
        rasterVon={von}
        eintraege={eintraege}
        heute={heute}
        vorherMonat={monatVerschieben(monat, -1)}
        naechsterMonat={monatVerschieben(monat, 1)}
        startTag={startTag && startTag.startsWith(monat) ? startTag : null}
      />

      <KalenderAbo />
    </div>
  );
}
