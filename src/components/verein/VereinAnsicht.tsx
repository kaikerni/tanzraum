import Link from "next/link";
import {
  Building2,
  MapPin,
  Mail,
  Phone,
  Globe,
  Pencil,
  Users,
  UserRound,
  Layers,
  Ticket,
  BadgeCheck,
  AlertTriangle,
} from "lucide-react";
import type {
  Auswahl,
  OffeneEinladung,
  VereinsDetails,
  VereinUebersicht,
} from "@/lib/verein/getVerein";
import type { VereinsMitgliedschaft } from "@/lib/dashboard/getDashboardData";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { GruppenVerwaltung } from "@/components/verein/GruppenVerwaltung";
import { EinladungsVerwaltung } from "@/components/verein/EinladungsVerwaltung";
import { LogoUpload } from "@/components/verein/LogoUpload";

const TARIF_LABEL: Record<string, string> = { free: "Free", basic: "Basic", verein: "Verein" };

export function VereinAnsicht({
  vereine,
  vereinId,
  verein,
  uebersicht,
  auswahl,
  einladungen,
  basis,
  istAdmin,
  darfGruppen,
}: {
  vereine: VereinsMitgliedschaft[];
  vereinId: string;
  verein: VereinsDetails;
  uebersicht: VereinUebersicht;
  auswahl: { altersklassen: Auswahl[]; disziplinen: Auswahl[]; rollen: Auswahl[] };
  einladungen: OffeneEinladung[];
  basis: string;
  istAdmin: boolean;
  darfGruppen: boolean;
}) {
  const adresse = [
    [verein.strasse, verein.hausnummer].filter(Boolean).join(" "),
    [verein.plz, verein.ort].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const initialen = verein.kuerzel
    ? verein.kuerzel.slice(0, 4).toUpperCase()
    : verein.name
        .split(/\s+/)
        .map((w) => w[0])
        .slice(0, 3)
        .join("")
        .toUpperCase();

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Mein Verein</h1>
          <p className="text-[14px] text-brand-ink-soft">Vereinsdaten, Gruppen und Ansprechpartner.</p>
        </div>
        {vereine.length > 1 && (
          <nav aria-label="Verein wählen" className="flex flex-wrap gap-2">
            {vereine.map((v) => (
              <Link
                key={v.vereinId}
                href={`/dashboard/verein?verein=${v.vereinId}`}
                aria-current={v.vereinId === vereinId ? "page" : undefined}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${
                  v.vereinId === vereinId
                    ? "border-brand-red bg-brand-red text-white"
                    : "border-brand-line bg-white text-brand-ink hover:bg-brand-bg"
                }`}
              >
                {v.vereinName}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {/* Vereinsprofil */}
      <section className={`${KARTE} flex flex-col gap-5 md:flex-row`}>
        <div className="flex shrink-0 flex-col items-center gap-3">
          {verein.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={verein.logoUrl}
              alt={`Logo ${verein.name}`}
              className="h-28 w-28 rounded-2xl border border-brand-line bg-white object-contain p-2"
            />
          ) : (
            <span className="flex h-28 w-28 items-center justify-center rounded-2xl bg-brand-red-wash text-[28px] font-extrabold text-brand-red">
              {initialen}
            </span>
          )}
          {istAdmin && <LogoUpload vereinId={vereinId} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[22px] font-extrabold leading-tight text-brand-ink">{verein.name}</h2>
              <p className="text-[13px] text-brand-ink-soft">
                {[verein.kuerzel, verein.verbandName].filter(Boolean).join(" · ") || "Kein Verband hinterlegt"}
              </p>
            </div>
            {istAdmin && (
              <Link
                href={`/dashboard/verein/bearbeiten?verein=${vereinId}`}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-line bg-white px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
              >
                <Pencil size={15} /> Vereinsdaten bearbeiten
              </Link>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {uebersicht.lizenz ? (
              <span className="status-badge zugesagt">
                <BadgeCheck size={13} /> Vereinslizenz aktiv
              </span>
            ) : (
              <span className="status-badge offen">
                <AlertTriangle size={13} /> Keine Vereinslizenz ({TARIF_LABEL[verein.tarif ?? "free"] ?? verein.tarif})
              </span>
            )}
            <span className="status-badge bg-brand-bg text-brand-ink">
              <Users size={13} /> {uebersicht.mitgliederAnzahl} Mitglieder
            </span>
          </div>

          {verein.beschreibung && <p className="mt-3 whitespace-pre-line text-[14px] text-brand-ink">{verein.beschreibung}</p>}

          <dl className="mt-4 grid grid-cols-1 gap-2.5 text-[13.5px] sm:grid-cols-2">
            {adresse && (
              <div className="flex items-start gap-2">
                <MapPin size={15} className="mt-0.5 shrink-0 text-brand-ink-soft" />
                <dd>{adresse}</dd>
              </div>
            )}
            {verein.email && (
              <div className="flex items-start gap-2">
                <Mail size={15} className="mt-0.5 shrink-0 text-brand-ink-soft" />
                <dd>
                  <a href={`mailto:${verein.email}`} className="text-brand-red hover:underline">
                    {verein.email}
                  </a>
                </dd>
              </div>
            )}
            {verein.telefon && (
              <div className="flex items-start gap-2">
                <Phone size={15} className="mt-0.5 shrink-0 text-brand-ink-soft" />
                <dd>{verein.telefon}</dd>
              </div>
            )}
            {verein.webseite && (
              <div className="flex items-start gap-2">
                <Globe size={15} className="mt-0.5 shrink-0 text-brand-ink-soft" />
                <dd>
                  {/^https?:\/\//i.test(verein.webseite) ? (
                    <a href={verein.webseite} target="_blank" rel="noopener noreferrer" className="text-brand-red hover:underline">
                      {verein.webseite.replace(/^https?:\/\//i, "")}
                    </a>
                  ) : (
                    verein.webseite
                  )}
                </dd>
              </div>
            )}
            {verein.ansprechpartner && (
              <div className="flex items-start gap-2">
                <UserRound size={15} className="mt-0.5 shrink-0 text-brand-ink-soft" />
                <dd>Ansprechpartner: {verein.ansprechpartner}</dd>
              </div>
            )}
          </dl>
          {!adresse && !verein.email && !verein.telefon && !verein.webseite && (
            <p className="mt-4 text-[13px] text-brand-ink-soft">
              {istAdmin ? "Noch keine Kontaktdaten hinterlegt – über „Vereinsdaten bearbeiten“ ergänzen." : "Noch keine Kontaktdaten hinterlegt."}
            </p>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={KARTE}>
          <KarteKopf icon={Building2} titel="Meine Mitgliedschaft" />
          <dl className="flex flex-col gap-2 text-[13.5px]">
            <div className="flex justify-between gap-3">
              <dt className="text-brand-ink-soft">Rolle</dt>
              <dd className="font-semibold text-brand-ink">{uebersicht.meineRolle ?? "–"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-brand-ink-soft">Gruppen</dt>
              <dd className="text-right font-semibold text-brand-ink">
                {uebersicht.meineGruppen.length > 0 ? uebersicht.meineGruppen.join(", ") : "noch keiner Gruppe zugeordnet"}
              </dd>
            </div>
          </dl>
        </section>

        <section className={KARTE}>
          <KarteKopf icon={UserRound} titel="Ansprechpartner" untertitel="Vereinsadmins und Trainer" />
          {uebersicht.ansprechpartner.length === 0 ? (
            <p className="text-[13px] text-brand-ink-soft">Keine Ansprechpartner hinterlegt.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-brand-line">
              {uebersicht.ansprechpartner.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
                  <span className="truncate font-semibold text-brand-ink">{a.name}</span>
                  <span className="shrink-0 text-brand-ink-soft">{a.rolle}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={KARTE}>
        <KarteKopf
          icon={Layers}
          titel="Gruppen"
          untertitel={darfGruppen ? "Als Vereinsadmin/Trainer kannst du Gruppen anlegen und bearbeiten." : undefined}
        />
        <GruppenVerwaltung
          vereinId={vereinId}
          gruppen={uebersicht.gruppen}
          darfVerwalten={darfGruppen}
          altersklassen={auswahl.altersklassen}
          disziplinen={auswahl.disziplinen}
        />
      </section>

      {istAdmin && (
        <section className={KARTE}>
          <KarteKopf
            icon={Ticket}
            titel="Mitglieder einladen"
            untertitel="Einladung erstellen und direkt per E-Mail senden oder den Link kopieren (z. B. für WhatsApp). Wer die Einladung annimmt, wird mit der gewählten Rolle Mitglied – und bei gewählter Gruppe direkt Teil dieser Gruppe."
          />
          <EinladungsVerwaltung
            vereinId={vereinId}
            rollen={auswahl.rollen}
            gruppen={uebersicht.gruppen.map((g) => ({ id: g.id, name: g.name ?? "Gruppe" }))}
            einladungen={einladungen}
            basisUrl={basis}
          />
        </section>
      )}
    </div>
  );
}
