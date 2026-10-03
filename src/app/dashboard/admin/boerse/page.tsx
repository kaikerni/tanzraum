import Link from "next/link";
import { redirect } from "next/navigation";
import { Flag, Store, UserX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { BoerseModeration, SperreAufheben } from "@/components/admin/BoerseModeration";
import { bilderSignieren, preisText, type Angebot } from "@/lib/boerse";

export const metadata = { title: "Börse-Moderation – TanzRaum-Administration" };

type Daten = {
  // deno-lint-ignore no-explicit-any
  angebote: any[];
  gesperrte_angebote: Angebot[];
  sperren: { user_id: string; name: string; grund: string; bis: string | null; gesetzt_am: string }[];
  zahlen: { aktiv: number; gesamt: number; offene_meldungen: number };
};

export default async function BoerseModerationSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");
  const { data } = await supabase.rpc("admin_boerse_meldungen");
  const d = (data ?? { angebote: [], gesperrte_angebote: [], sperren: [], zahlen: { aktiv: 0, gesamt: 0, offene_meldungen: 0 } }) as Daten;
  const bilder = await bilderSignieren(supabase, d.angebote.map((a) => a.bilder?.[0]).filter(Boolean));

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
      <Link href="/dashboard/admin" className="text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        ← Administration
      </Link>
      <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
        <Store size={24} className="text-brand-red" /> TanzRaum Börse – Moderation
      </h1>
      <p className="text-[13.5px] text-brand-ink-soft">
        {d.zahlen.aktiv} aktive von {d.zahlen.gesamt} Angeboten · {d.zahlen.offene_meldungen} offene Meldungen. Sichtbar sind nur die für die Moderation nötigen
        Angaben (Angebot, Meldegründe, Name der anbietenden Person) – keine Vereins- oder Mitgliederdaten, keine Chats.
      </p>

      <section className={KARTE}>
        <KarteKopf icon={Flag} titel={`Gemeldete Angebote${d.angebote.length ? ` (${d.angebote.length})` : ""}`} untertitel="Deaktivieren benachrichtigt die anbietende Person mit dem Grund." />
        <BoerseModeration gemeldet={d.angebote} bilder={Object.fromEntries(bilder)} />
      </section>

      <section className={KARTE}>
        <KarteKopf icon={UserX} titel="Eingeschränkte Personen" untertitel="Können die Börse nicht nutzen (keine Angebote, keine Kontakte); ihre Angebote sind pausiert." />
        {d.sperren.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">Niemand eingeschränkt.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-brand-line">
            {d.sperren.map((s) => (
              <li key={s.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13.5px]">
                <span>
                  <strong>{s.name}</strong> – {s.grund}
                  <span className="text-brand-ink-soft"> · {s.bis ? `bis ${new Date(s.bis).toLocaleDateString("de-DE")}` : "unbefristet"}</span>
                </span>
                <SperreAufheben userId={s.user_id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {d.gesperrte_angebote.length > 0 && (
        <section className={KARTE}>
          <KarteKopf icon={Store} titel="Zuletzt deaktivierte Angebote" />
          <ul className="flex flex-col divide-y divide-brand-line">
            {d.gesperrte_angebote.map((a) => (
              <li key={a.id} className="py-2 text-[13.5px]">
                <Link href={`/dashboard/boerse/${a.id}`} className="font-semibold text-brand-ink hover:text-brand-red">
                  {a.titel}
                </Link>{" "}
                <span className="text-brand-ink-soft">
                  · {preisText(a)} · {a.anbieter?.name} · {a.sperrgrund}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
