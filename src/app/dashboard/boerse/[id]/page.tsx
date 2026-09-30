import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Heart, MapPin, Package, Repeat, Ruler, ShieldCheck, Sparkles, Truck, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { Galerie } from "@/components/boerse/Galerie";
import { FavoritKnopf } from "@/components/boerse/FavoritKnopf";
import { EigeneAktionen, KontaktKnopf, MeldenFormular } from "@/components/boerse/AngebotAktionen";
import { ART_LABEL, ART_STIL, STATUS_LABEL, ZUSTAND_LABEL, bilderSignieren, getKategorien, preisText, type Angebot } from "@/lib/boerse";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: "Angebot – TanzRaum Börse" };

function Zeile({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon size={17} className="mt-0.5 shrink-0 text-brand-ink-soft" />
      <div className="min-w-0">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-brand-ink-soft">{label}</div>
        <div className="break-words text-[14.5px] text-brand-ink">{children}</div>
      </div>
    </div>
  );
}

export default async function AngebotSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=/dashboard/boerse/${id}`);

  const [{ data }, kategorien] = await Promise.all([supabase.rpc("boerse_angebot", { p_id: id }), getKategorien(supabase)]);
  if (!data) notFound();
  const a = data as Angebot;
  const bilderKarte = await bilderSignieren(supabase, a.bilder);
  const bilder = a.bilder.map((p) => bilderKarte.get(p)).filter((u): u is string => !!u);
  const katName = new Map(kategorien.map((k) => [k.schluessel, `${k.emoji ? `${k.emoji} ` : ""}${k.name}`]));
  const kontaktHinweis =
    a.mein_status === "unter_16"
      ? "Anbietende kannst du erst ab 16 Jahren kontaktieren. Frag deine Eltern, ob sie sich für dich melden."
      : a.mein_status === "gesperrt"
        ? "Du kannst die TanzRaum Börse derzeit nicht nutzen."
        : !a.kontaktierbar
          ? a.status === "reserviert"
            ? "Dieses Angebot ist gerade reserviert."
            : "Diese Person kann über die Börse gerade nicht kontaktiert werden."
          : null;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
      <Link href="/dashboard/boerse" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Zur TanzRaum Börse
      </Link>

      {a.status === "gesperrt" && (
        <p className="form-error">
          Dieses Angebot wurde von der Moderation deaktiviert{a.sperrgrund ? `: ${a.sperrgrund}` : "."} Es ist für andere nicht sichtbar.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Galerie bilder={bilder} titel={a.titel} />

        <div className="flex flex-col gap-4">
          <section className={`${KARTE} flex flex-col gap-3`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${ART_STIL[a.art]}`}>{ART_LABEL[a.art]}</span>
              {a.status !== "aktiv" && <span className="rounded-full bg-brand-bg px-2.5 py-1 text-[12px] font-bold text-brand-ink">{STATUS_LABEL[a.status]}</span>}
              <span className="text-[12.5px] text-brand-ink-soft">{katName.get(a.unterkategorie ?? a.kategorie) ?? katName.get(a.kategorie)}</span>
            </div>
            <h1 className="break-words text-[24px] font-extrabold leading-tight tracking-tight text-brand-ink sm:text-[28px]">{a.titel}</h1>
            <p className="text-[28px] font-extrabold text-brand-red">{preisText(a)}</p>
            {!a.ist_meins && a.status !== "gesperrt" && <KontaktKnopf id={a.id} art={a.art} hinweis={kontaktHinweis} />}
            {!a.ist_meins && <FavoritKnopf id={a.id} favorit={a.favorit} gross />}
            {a.ist_meins && (
              <div className="rounded-xl bg-brand-bg p-3">
                <p className="mb-2 text-[13px] font-semibold text-brand-ink">
                  Dein Angebot{typeof a.favoriten === "number" && a.favoriten > 0 ? ` · ${a.favoriten}× gemerkt` : ""}
                </p>
                <EigeneAktionen id={a.id} status={a.status} />
              </div>
            )}
          </section>

          <section className={`${KARTE} divide-y divide-brand-line`}>
            {a.zustand && (
              <Zeile icon={Sparkles} label="Zustand">
                {ZUSTAND_LABEL[a.zustand]}
              </Zeile>
            )}
            {a.groesse && (
              <Zeile icon={Ruler} label="Größe">
                {a.groesse}
              </Zeile>
            )}
            {a.ort && (
              <Zeile icon={MapPin} label="Standort">
                {a.ort}
              </Zeile>
            )}
            <Zeile icon={Package} label="Übergabe">
              <span className="flex flex-wrap gap-x-3 gap-y-1">
                <span className={a.abholung ? "" : "text-brand-ink-faint line-through"}>Abholung</span>
                <span className={`inline-flex items-center gap-1 ${a.versand ? "" : "text-brand-ink-faint line-through"}`}>
                  <Truck size={14} /> Versand
                </span>
                <span className={`inline-flex items-center gap-1 ${a.tausch_moeglich ? "" : "text-brand-ink-faint line-through"}`}>
                  <Repeat size={14} /> Tausch
                </span>
              </span>
            </Zeile>
            <Zeile icon={CalendarDays} label="Eingestellt">
              {new Date(a.erstellt_am).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Berlin" })}
            </Zeile>
            {a.anbieter && (
              <Zeile icon={User} label={a.art === "suchen" ? "Sucht" : "Anbieter"}>
                <span className="font-semibold">{a.anbieter.name}</span>
                <span className="block text-[12.5px] text-brand-ink-soft">
                  {a.anbieter.seit ? `bei TanzRaum seit ${a.anbieter.seit}` : ""}
                  {a.anbieter.angebote > 0 ? ` · ${a.anbieter.angebote} ${a.anbieter.angebote === 1 ? "Angebot" : "Angebote"} in der Börse` : ""}
                </span>
              </Zeile>
            )}
          </section>
        </div>
      </div>

      {a.beschreibung && (
        <section className={KARTE}>
          <h2 className="mb-2 text-[16px] font-bold text-brand-ink">Beschreibung</h2>
          <p className="whitespace-pre-line break-words text-[14.5px] leading-relaxed text-brand-ink">{a.beschreibung}</p>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-[var(--radius-l)] border border-brand-line bg-brand-bg p-4 text-[12.5px] text-brand-ink-soft">
        <p className="flex items-start gap-2">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-green" />
          TanzRaum vermittelt nur den Kontakt und wickelt keine Zahlungen ab. Trefft euch zur Übergabe am besten an einem belebten Ort, zahlt bei
          Unbekannten nicht im Voraus und gebt keine Passwörter oder Codes weiter.
        </p>
        {!a.ist_meins && a.status !== "gesperrt" && <MeldenFormular id={a.id} />}
        {!a.ist_meins && (
          <p className="flex items-center gap-1.5">
            <Heart size={13} /> Gemerkte Angebote findest du unter{" "}
            <Link href="/dashboard/boerse/meine?tab=favoriten" className="font-semibold text-brand-red">
              Meine Favoriten
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}
