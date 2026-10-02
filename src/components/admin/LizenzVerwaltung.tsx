"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, KeyRound, PowerOff, Shield, UserPlus } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { NutzerAvatar } from "@/components/ui/NutzerAvatar";
import { PersonenSuche } from "@/components/admin/PersonenSuche";
import { freischalten, freischaltungBeenden, freischaltungVerlaengern, lizenzenPerson, type LaufendeLizenz } from "@/app/dashboard/admin/lizenzen/actions";
import { LIZENZART_LABEL, ANBIETER_KURZ, lizenzStatus } from "@/lib/lizenz";

export type LizenzZeile = {
  userId: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  email: string | null;
  tarif: string;
  status: string;
  start: string | null;
  ablauf: string | null;
  zahlungsart: string | null;
  lizenzart: string | null;
  aboId: string | null;
  aboManuell: boolean;
  team: boolean;
  moderator: boolean;
  verein: string | null;
  notiz: string | null;
};

type Person = { userId: string; name: string; handle: string | null; avatarUrl: string | null; email: string | null; tarif: string };

const datum = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "–");
const heute = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

function Freischaltkarte({ person, onFertig }: { person: Person; onFertig: (r: AktionsErgebnis) => void }) {
  const [tarif, setTarif] = useState<"free" | "basic" | "verein">("basic");
  const [art, setArt] = useState<"kostenlos" | "bezahlt">("kostenlos");
  const [befristet, setBefristet] = useState(false);
  const [bis, setBis] = useState("");
  const [notiz, setNotiz] = useState("");
  const [laufend, setLaufend] = useState<LaufendeLizenz[] | null>(null);
  const [fehler, setFehler] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  useEffect(() => {
    lizenzenPerson(person.userId).then(setLaufend);
  }, [person.userId]);

  const knopf = tarif === "free" ? "Auf FREE zurückstufen" : art === "kostenlos" ? "Kostenlos freischalten" : "Freischalten (regulär bezahlt)";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-2xl bg-brand-bg p-3">
        <NutzerAvatar name={person.name} avatarUrl={person.avatarUrl} groesse={48} />
        <div className="min-w-0">
          <p className="truncate text-[16px] font-bold text-brand-ink">{person.handle ? `@${person.handle}` : person.name}</p>
          <p className="truncate text-[12.5px] text-brand-ink-soft">
            {person.name}
            {person.email ? ` · ${person.email}` : ""}
          </p>
          <p className="text-[12.5px] text-brand-ink">
            Aktueller Tarif: <strong>{person.tarif ? person.tarif.toUpperCase() : "–"}</strong>
          </p>
        </div>
      </div>

      {laufend && laufend.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-brand-ink-faint">Laufende Lizenzen</p>
          {laufend.map((l) => (
            <div key={l.aboId} className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-line px-3 py-2 text-[13px]">
              <span className="font-semibold text-brand-ink">{LIZENZART_LABEL[l.lizenzart] ?? l.lizenzart}</span>
              <span className="text-brand-ink-soft">
                {l.verein ? `${l.verein} · ` : ""}
                {ANBIETER_KURZ[l.anbieter] ?? l.anbieter} · seit {datum(l.start)} · {l.ablauf ? `bis ${datum(l.ablauf)}` : "unbefristet"}
              </span>
            </div>
          ))}
        </div>
      )}

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-[13px] font-semibold text-brand-ink">Neuer Zugang</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["free", "basic", "verein"] as const).map((t) => (
            <label key={t} className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border text-[14px] font-bold ${tarif === t ? "border-brand-red bg-brand-red-wash text-brand-red" : "border-brand-line"}`}>
              <input type="radio" name="tarif" className="sr-only" checked={tarif === t} onChange={() => setTarif(t)} />
              {t.toUpperCase()}
            </label>
          ))}
        </div>
        {tarif === "verein" && <p className="text-[12px] text-brand-ink-soft">Die Vereinslizenz gilt für den Verein dieser Person (alle aktiven Mitglieder).</p>}
        {tarif === "free" && (
          <p className="text-[12px] text-brand-ink-soft">Beendet manuelle Freischaltungen. Bezahlte Abos, Team-BASIC und Vereinslizenzen bleiben unberührt.</p>
        )}
      </fieldset>

      {tarif !== "free" && (
        <>
          <fieldset className="flex flex-wrap gap-4 text-[14px]">
            <legend className="mb-1 w-full text-[13px] font-semibold text-brand-ink">Freischaltung</legend>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={art === "kostenlos"} onChange={() => setArt("kostenlos")} className="accent-[#e11d2e]" /> Kostenlos manuell
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={art === "bezahlt"} onChange={() => setArt("bezahlt")} className="accent-[#e11d2e]" /> Regulär bezahlt
            </label>
          </fieldset>
          <fieldset className="flex flex-wrap items-center gap-4 text-[14px]">
            <legend className="mb-1 w-full text-[13px] font-semibold text-brand-ink">Gültigkeit</legend>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={!befristet} onChange={() => setBefristet(false)} className="accent-[#e11d2e]" /> Unbefristet
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={befristet} onChange={() => setBefristet(true)} className="accent-[#e11d2e]" /> Befristet bis
            </label>
            {befristet && (
              <input type="date" value={bis} min={heute()} onChange={(e) => setBis(e.target.value)} className="rounded-lg border border-brand-line px-2 py-1.5" aria-label="Gültig bis" />
            )}
          </fieldset>
        </>
      )}
      <label className="field">
        Interne Notiz
        <input value={notiz} maxLength={500} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. Pilotnutzerin, Partner, Kulanz …" />
      </label>
      {fehler?.error && <Meldung ergebnis={fehler} />}
      <button
        type="button"
        disabled={laeuft}
        onClick={() => {
          if (tarif !== "free" && befristet && !bis) return setFehler({ error: "Bitte ein Enddatum wählen." });
          starte(async () => {
            const r = await freischalten({ userId: person.userId, tarif, art, bis: befristet ? bis : null, notiz });
            if (r.error) setFehler(r);
            else onFertig(r);
          });
        }}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-red px-4 text-[15px] font-bold text-white disabled:opacity-60"
      >
        <KeyRound size={17} /> {laeuft ? "Einen Moment …" : knopf}
      </button>
      <p className="text-[12px] text-brand-ink-soft">
        Eine kostenlose Freischaltung (MANUAL_FREE) macht niemanden zum Teammitglied oder Moderator und wird nicht öffentlich angezeigt. Für die Person sieht es
        wie ein normaler Zugang aus.
      </p>
    </div>
  );
}

export function LizenzVerwaltung({ zeilen }: { zeilen: LizenzZeile[] }) {
  const router = useRouter();
  const [suche, setSuche] = useState(false);
  const [karte, setKarte] = useState<Person | null>(null);
  const [verlaengern, setVerlaengern] = useState<LizenzZeile | null>(null);
  const [neuBis, setNeuBis] = useState("");
  const [beenden, setBeenden] = useState<LizenzZeile | null>(null);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();

  function fertig(r: AktionsErgebnis) {
    setMeldung(r);
    setKarte(null);
    setVerlaengern(null);
    setBeenden(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setSuche(true)} className="btn-primary mt-0 inline-flex min-h-11 items-center gap-1.5">
          <UserPlus size={17} /> Nutzer freischalten
        </button>
        {meldung && <Meldung ergebnis={meldung} />}
      </div>

      {zeilen.length === 0 ? (
        <p className="rounded-xl bg-brand-bg px-3.5 py-3 text-[13.5px] text-brand-ink-soft">Keine Einträge gefunden.</p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {zeilen.map((z) => {
            const st = lizenzStatus(z.tarif, z.ablauf);
            return (
              <li key={z.userId} className="flex flex-col gap-2 rounded-2xl border border-brand-line bg-white p-3">
                <div className="flex items-center gap-3">
                  <NutzerAvatar name={z.name} avatarUrl={z.avatarUrl} groesse={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-brand-ink">{z.name}</p>
                    <p className="truncate text-[12px] text-brand-ink-soft">
                      {z.handle ? `@${z.handle}` : ""}
                      {z.email ? ` · ${z.email}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-ink px-2.5 py-0.5 text-[12px] font-bold text-white">{z.tarif.toUpperCase()}</span>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px] sm:grid-cols-3">
                  <div>
                    <dt className="text-brand-ink-faint">Status</dt>
                    <dd className="font-semibold text-brand-ink">{st.text}</dd>
                  </div>
                  <div>
                    <dt className="text-brand-ink-faint">Start</dt>
                    <dd className="text-brand-ink">{datum(z.start)}</dd>
                  </div>
                  <div>
                    <dt className="text-brand-ink-faint">Ablauf</dt>
                    <dd className="text-brand-ink">{z.lizenzart ? (z.ablauf ? datum(z.ablauf) : "unbefristet") : "–"}</dd>
                  </div>
                  <div>
                    <dt className="text-brand-ink-faint">Freischaltung</dt>
                    <dd className="text-brand-ink">{z.lizenzart ? (LIZENZART_LABEL[z.lizenzart] ?? z.lizenzart) : "–"}</dd>
                  </div>
                  <div>
                    <dt className="text-brand-ink-faint">Zahlungsart</dt>
                    <dd className="text-brand-ink">{z.zahlungsart ? (ANBIETER_KURZ[z.zahlungsart] ?? z.zahlungsart) : z.tarif === "verein" ? "Vereinslizenz" : "–"}</dd>
                  </div>
                  <div>
                    <dt className="text-brand-ink-faint">Verein</dt>
                    <dd className="truncate text-brand-ink">{z.verein ?? "–"}</dd>
                  </div>
                </dl>
                {(z.team || z.notiz) && (
                  <p className="text-[12px] text-brand-ink-soft">
                    {z.team && <span className="font-semibold text-brand-blue">🛡 TanzRaum Team{z.moderator ? " · Moderator" : ""}</span>}
                    {z.team && z.notiz ? " · " : ""}
                    {z.notiz && <span className="italic">Notiz: {z.notiz}</span>}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setKarte({ userId: z.userId, name: z.name, handle: z.handle, avatarUrl: z.avatarUrl, email: z.email, tarif: z.tarif })}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-brand-line px-2.5 text-[12.5px] font-semibold hover:bg-brand-bg"
                  >
                    <KeyRound size={14} /> Tarif ändern / freischalten
                  </button>
                  {z.aboId && z.aboManuell && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setNeuBis("");
                          setVerlaengern(z);
                        }}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-brand-line px-2.5 text-[12.5px] font-semibold hover:bg-brand-bg"
                      >
                        <CalendarPlus size={14} /> Verlängern
                      </button>
                      <button
                        type="button"
                        onClick={() => setBeenden(z)}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-brand-line px-2.5 text-[12.5px] font-semibold text-brand-red hover:bg-brand-red-wash"
                      >
                        <PowerOff size={14} /> Freischaltung deaktivieren
                      </button>
                    </>
                  )}
                  <Link
                    href={`/dashboard/admin/team?user=${z.userId}`}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-brand-line px-2.5 text-[12.5px] font-semibold hover:bg-brand-bg"
                  >
                    <Shield size={14} /> {z.team ? "Rechte verwalten" : "Zum TanzRaum Team"}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {suche && (
        <Dialog titel="Nutzer freischalten" untertitel="Person auswählen" onSchliessen={() => setSuche(false)}>
          <PersonenSuche
            onWahl={(p) => {
              setSuche(false);
              setKarte({ userId: p.userId, name: p.name, handle: p.handle, avatarUrl: p.avatarUrl, email: p.email, tarif: p.tarif });
            }}
          />
        </Dialog>
      )}
      {karte && (
        <Dialog titel="Nutzer freischalten" onSchliessen={() => setKarte(null)}>
          <Freischaltkarte person={karte} onFertig={fertig} />
        </Dialog>
      )}
      {verlaengern && (
        <Dialog
          titel="Freischaltung verlängern"
          untertitel={`${verlaengern.name} · ${verlaengern.lizenzart ? (LIZENZART_LABEL[verlaengern.lizenzart] ?? "") : ""} · bisher ${verlaengern.ablauf ? `bis ${datum(verlaengern.ablauf)}` : "unbefristet"}`}
          onSchliessen={() => setVerlaengern(null)}
          fuss={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={laeuft}
                onClick={() => starte(async () => fertig(await freischaltungVerlaengern(verlaengern.aboId!, null)))}
                className="min-h-11 rounded-xl border border-brand-line px-4 text-[14px] font-semibold"
              >
                Unbefristet
              </button>
              <button
                type="button"
                disabled={laeuft || !neuBis}
                onClick={() => starte(async () => fertig(await freischaltungVerlaengern(verlaengern.aboId!, neuBis)))}
                className="min-h-11 rounded-xl bg-brand-red px-4 text-[14px] font-bold text-white disabled:opacity-50"
              >
                Bis Datum verlängern
              </button>
            </div>
          }
        >
          <label className="field">
            Neues Enddatum
            <input type="date" value={neuBis} min={heute()} onChange={(e) => setNeuBis(e.target.value)} />
          </label>
        </Dialog>
      )}
      {beenden && (
        <Dialog
          titel="Freischaltung deaktivieren?"
          untertitel={beenden.name}
          onSchliessen={() => setBeenden(null)}
          fuss={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setBeenden(null)} className="min-h-11 rounded-xl border border-brand-line px-4 text-[14px] font-semibold">
                Abbrechen
              </button>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => starte(async () => fertig(await freischaltungBeenden(beenden.aboId!)))}
                className="min-h-11 rounded-xl bg-brand-red px-4 text-[14px] font-bold text-white disabled:opacity-60"
              >
                Deaktivieren
              </button>
            </div>
          }
        >
          <p className="text-[14px] text-brand-ink">
            Die {beenden.lizenzart ? (LIZENZART_LABEL[beenden.lizenzart] ?? "manuelle Freischaltung") : "manuelle Freischaltung"} endet sofort. Danach gilt die bestehende
            Tariflogik (ohne weitere Lizenz: FREE). Das Benutzerkonto bleibt bestehen.
          </p>
        </Dialog>
      )}
    </div>
  );
}
