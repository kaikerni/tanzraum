import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightLeft, FileSignature, Inbox, Settings2, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { datumKurz, getAntraegeListe, getAntragsVereine, getFreigabeAnfragen } from "@/lib/antraege/getAntraege";
import { StatusMarke } from "@/components/antraege/StatusMarke";
import { getAuswahllisten } from "@/lib/verein/getVerein";
import { VERFAHREN_LABEL } from "@/lib/antraege/vorlage";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { DruckKnopf, FreigabeKnoepfe, PersonHinzufuegen } from "@/components/antraege/VereinsAktionen";

export const metadata = { title: "Mitgliedsanträge – TanzRaum" };

type Filter = "eingang" | "offen" | "erledigt";

export default async function MitgliedsantraegeSeite({ searchParams }: { searchParams: Promise<{ verein?: string; filter?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/mitgliedsantraege");

  const vereine = await getAntragsVereine(supabase);
  if (vereine.length === 0) {
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Mitgliedsanträge</h1>
        <p className={`${KARTE} text-[14px] text-brand-ink-soft`}>
          Mitgliedsanträge verwalten Vereinsadmins und Personen mit dem Bereich „Mitgliedsanträge“ in Vereinen mit Vereinslizenz.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const verein = vereine.find((v) => v.vereinId === sp.verein) ?? vereine[0];
  const filter: Filter = sp.filter === "offen" || sp.filter === "erledigt" ? sp.filter : "eingang";
  const [antraege, anfragen, listen, { data: gruppen }] = await Promise.all([
    getAntraegeListe(supabase, verein.vereinId),
    getFreigabeAnfragen(supabase, verein.vereinId),
    getAuswahllisten(supabase),
    supabase.from("gruppen").select("id, name").eq("verein_id", verein.vereinId).order("name"),
  ]);
  const anzahl = {
    eingang: antraege.filter((a) => a.status === "eingereicht").length,
    offen: antraege.filter((a) => a.status === "offen").length,
    erledigt: antraege.filter((a) => a.status === "angenommen" || a.status === "abgelehnt").length,
  };
  const sichtbar = antraege.filter((a) =>
    filter === "eingang" ? a.status === "eingereicht" : filter === "offen" ? a.status === "offen" : a.status === "angenommen" || a.status === "abgelehnt",
  );
  const eingehend = anfragen.filter((w) => w.richtung === "eingehend");
  const ausgehend = anfragen.filter((w) => w.richtung === "ausgehend");
  const link = (f: Filter) => `/dashboard/mitgliedsantraege?${new URLSearchParams({ verein: verein.vereinId, filter: f })}`;

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Mitgliedsanträge</h1>
          <p className="text-[14px] text-brand-ink-soft">Eingehende Anträge prüfen, bearbeiten, drucken und annehmen.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DruckKnopf href={`/api/mitgliedsantrag/pdf?muster=${verein.vereinId}`} text="Leeres Formular drucken" />
          <Link
            href={`/dashboard/mitgliedsantraege/formular?verein=${verein.vereinId}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep"
          >
            <Settings2 size={16} /> Formular einstellen
          </Link>
        </div>
      </div>

      {vereine.length > 1 && (
        <nav className="flex gap-1.5 overflow-x-auto" aria-label="Verein">
          {vereine.map((v) => (
            <Link
              key={v.vereinId}
              href={`/dashboard/mitgliedsantraege?verein=${v.vereinId}`}
              aria-current={v.vereinId === verein.vereinId ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${v.vereinId === verein.vereinId ? "bg-brand-ink text-white" : "bg-white text-brand-ink-soft"}`}
            >
              {v.vereinName}
            </Link>
          ))}
        </nav>
      )}

      {eingehend.length > 0 && (
        <section className={`${KARTE} border-brand-red/30`}>
          <KarteKopf icon={ArrowRightLeft} titel="Freigabe angefragt" untertitel="Ein anderer Verein möchte ein Mitglied von euch aufnehmen. In TanzRaum gehört jede Person genau einem Verein an." />
          <ul className="flex flex-col divide-y divide-brand-line">
            {eingehend.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="text-[14px] text-brand-ink">
                  <strong>{w.person}</strong> <span className="text-brand-ink-soft">→ {w.andererVerein} · seit {datumKurz(w.erstelltAm)}</span>
                </span>
                <FreigabeKnoepfe anfrageId={w.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={KARTE}>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(
            [
              ["eingang", "Eingegangen", Inbox],
              ["offen", "Noch nicht ausgefüllt", FileSignature],
              ["erledigt", "Entschieden", FileSignature],
            ] as const
          ).map(([f, label, Icon]) => (
            <Link
              key={f}
              href={link(f)}
              aria-current={filter === f ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${filter === f ? "bg-brand-ink text-white" : "bg-brand-bg text-brand-ink-soft hover:text-brand-ink"}`}
            >
              <Icon size={14} /> {label} · {anzahl[f]}
            </Link>
          ))}
        </div>
        {sichtbar.length === 0 ? (
          <p className="py-6 text-center text-[13.5px] text-brand-ink-soft">
            {filter === "eingang" ? "Keine neuen Anträge." : filter === "offen" ? "Alle hinzugefügten Personen haben ihren Antrag ausgefüllt." : "Noch keine entschiedenen Anträge."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-brand-line">
            {sichtbar.map((a) => (
              <li key={a.id}>
                <Link href={`/dashboard/mitgliedsantraege/${a.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:bg-brand-bg/60">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-brand-ink">
                      {a.name}
                      {a.minderjaehrig && <span className="ml-2 text-[12px] font-normal text-brand-ink-soft">minderjährig</span>}
                    </span>
                    <span className="block text-[12.5px] text-brand-ink-soft">
                      {a.eingereichtAm ? `eingegangen am ${datumKurz(a.eingereichtAm)}` : `hinzugefügt am ${datumKurz(a.erstelltAm)}`}
                      {a.verfahren ? ` · ${VERFAHREN_LABEL[a.verfahren]}` : ""}
                      {a.verfahren === "papier" && !a.papierVorliegend ? " · Unterschrift fehlt noch" : ""}
                      {a.mitgliedsnummer ? ` · Nr. ${a.mitgliedsnummer}` : ""}
                    </span>
                  </span>
                  <StatusMarke status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={KARTE}>
        <KarteKopf
          icon={UserPlus}
          titel="Person hinzufügen"
          untertitel="Für Personen mit TanzRaum-Konto. Sie wird bei euch als „neu“ geführt und füllt den Mitgliedsantrag aus. Ohne Konto: Einladung unter „Mitglieder → Mitglied hinzufügen“."
        />
        <PersonHinzufuegen
          vereinId={verein.vereinId}
          rollen={listen.rollen.filter((r) => !/admin/i.test(r.name))}
          gruppen={(gruppen ?? []).map((g) => ({ id: g.id, name: g.name ?? "Gruppe" }))}
        />
        {ausgehend.length > 0 && (
          <div className="mt-4 rounded-xl bg-brand-bg p-3">
            <p className="text-[12.5px] font-semibold text-brand-ink-soft">Wartet auf Freigabe durch den bisherigen Verein</p>
            <ul className="mt-1 flex flex-col gap-1 text-[13.5px] text-brand-ink">
              {ausgehend.map((w) => (
                <li key={w.id}>
                  {w.person} <span className="text-brand-ink-soft">· bisher {w.andererVerein} · angefragt am {datumKurz(w.erstelltAm)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
