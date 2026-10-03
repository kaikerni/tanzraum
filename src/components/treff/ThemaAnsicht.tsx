"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  Flag,
  ImagePlus,
  Lock,
  LockOpen,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Send,
  Shield,
  Star,
  ThumbsUp,
  Trash2,
  UserX,
  FolderInput,
} from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { AutorZeile, SchreibHinweis } from "@/components/treff/TreffBausteine";
import { treffHochladen } from "@/components/treff/TreffDatei";
import {
  antworten,
  beitragBearbeiten,
  beitragLoeschen,
  besteAntwort,
  empfehlen,
  folgen,
  hilfreichSetzen,
  melden,
  moderieren,
  nutzerEntfernen,
  nutzerSperren,
  themaBearbeiten,
  themaLoeschen,
} from "@/app/dashboard/treff/actions";
import { MELDEGRUENDE, type Beitrag, type Kategorie, type ThemaDetail, type TreffStatus } from "@/lib/treff/treff";

const FELD = "w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 text-[14.5px] text-brand-ink outline-none focus:border-brand-red";
const KLEIN = "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold hover:bg-brand-bg disabled:opacity-50";

type Rechte = {
  admin: boolean;
  themaBearbeiten: boolean;
  themaLoeschen: boolean;
  beitragBearbeiten: boolean;
  beitragLoeschen: boolean;
  schliessen: boolean;
  oeffnen: boolean;
  anpinnen: boolean;
  entpinnen: boolean;
  verschieben: boolean;
  empfehlen: boolean;
  sperren: boolean;
  entfernen: boolean;
  wissen: boolean;
};

type Dialoge =
  | { art: "melden"; ziel: "thema" | "beitrag" | "nutzer"; id: string }
  | { art: "loeschen"; ziel: "thema" | "beitrag"; id: string }
  | { art: "sperren"; userId: string; handle: string }
  | { art: "entfernen"; userId: string; handle: string }
  | { art: "verschieben" }
  | { art: "hinweis" }
  | null;

export function ThemaAnsicht({
  thema,
  urls,
  status,
  rechte,
  kategorien,
  userId,
}: {
  thema: ThemaDetail;
  urls: Record<string, string>;
  status: TreffStatus;
  rechte: Rechte;
  kategorien: Kategorie[];
  userId: string;
}) {
  const router = useRouter();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [dialog, setDialog] = useState<Dialoge>(null);
  const [grund, setGrund] = useState("spam");
  const [text, setText] = useState("");
  const [bis, setBis] = useState("");
  const [zielKategorie, setZielKategorie] = useState(thema.kategorie_id);
  const [bearbeite, setBearbeite] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState({ titel: thema.titel, inhalt: thema.inhalt, link: thema.link ?? "" });
  const [antwort, setAntwort] = useState("");
  const [antwortBild, setAntwortBild] = useState<{ pfad: string; url: string } | null>(null);
  const [hilfreich, setHilfreich] = useState<Record<string, { an: boolean; n: number }>>(() =>
    Object.fromEntries(thema.beitraege.map((b) => [b.id, { an: b.ich_hilfreich, n: b.hilfreich }])),
  );
  const [modMenu, setModMenu] = useState(false);
  const [laeuft, starte] = useTransition();
  const bildInput = useRef<HTMLInputElement>(null);

  const tun = (f: () => Promise<AktionsErgebnis>, danach?: () => void) =>
    starte(async () => {
      const r = await f();
      setMeldung(r);
      if (!r.error) {
        setDialog(null);
        danach?.();
        router.refresh();
      }
    });

  const autorId = thema.autor?.user_id ?? null;
  const istModerator = rechte.schliessen || rechte.oeffnen || rechte.anpinnen || rechte.entpinnen || rechte.verschieben || rechte.empfehlen || rechte.wissen || rechte.themaLoeschen || rechte.themaBearbeiten;
  const beste = thema.beitraege.find((b) => b.id === thema.beste_antwort_id) ?? null;
  const darfBeste = thema.ich_autor || rechte.admin;

  function personAktionen(uid: string | null, handle: string | null) {
    if (!uid || uid === userId) return null;
    return (
      <>
        {rechte.sperren && (
          <button type="button" className={`${KLEIN} text-brand-red`} onClick={() => setDialog({ art: "sperren", userId: uid, handle: handle ?? "" })}>
            <Shield size={13} /> Sperren
          </button>
        )}
        {rechte.entfernen && (
          <button type="button" className={`${KLEIN} text-brand-red`} onClick={() => setDialog({ art: "entfernen", userId: uid, handle: handle ?? "" })}>
            <UserX size={13} /> Aus dem Treff entfernen
          </button>
        )}
      </>
    );
  }

  function beitragKarte(b: Beitrag, hervorheben = false) {
    const istBeste = b.id === thema.beste_antwort_id;
    const h = hilfreich[b.id] ?? { an: false, n: 0 };
    const eigen = b.ich_autor;
    return (
      <article
        id={hervorheben ? undefined : `beitrag-${b.id}`}
        className={`flex flex-col gap-2.5 rounded-2xl border bg-white p-3.5 ${istBeste ? "border-brand-green/60 ring-1 ring-brand-green/30" : b.empfohlen ? "border-brand-gold/60" : "border-brand-line"}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <AutorZeile handle={b.autor?.handle ?? null} avatarUrl={b.autor?.avatar_url ?? null} verein={b.autor?.verein ?? null} kennzeichen={b.autor?.kennzeichen ?? null} zeit={b.erstellt_am} bearbeitet={b.bearbeitet_am} />
          <div className="flex flex-wrap gap-1.5 text-[11.5px] font-bold">
            {istBeste && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-green-wash px-2 py-0.5 text-brand-green">
                <CheckCircle2 size={12} /> Beste Antwort
              </span>
            )}
            {b.empfohlen && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-gold-wash px-2 py-0.5 text-brand-ink">
                <Star size={12} /> TanzRaum empfiehlt
              </span>
            )}
          </div>
        </div>
        {bearbeite === b.id ? (
          <div className="flex flex-col gap-2">
            <textarea rows={5} className={FELD} defaultValue={b.inhalt} id={`bearbeiten-${b.id}`} maxLength={10000} aria-label="Beitrag bearbeiten" />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={laeuft}
                onClick={() => tun(() => beitragBearbeiten(b.id, thema.id, (document.getElementById(`bearbeiten-${b.id}`) as HTMLTextAreaElement).value), () => setBearbeite(null))}
                className="min-h-10 rounded-xl bg-brand-red px-4 text-[13.5px] font-bold text-white"
              >
                Speichern
              </button>
              <button type="button" onClick={() => setBearbeite(null)} className="min-h-10 rounded-xl border border-brand-line px-4 text-[13.5px] font-semibold">
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <p className={`whitespace-pre-wrap text-[14.5px] leading-relaxed text-brand-ink [overflow-wrap:anywhere] ${hervorheben ? "line-clamp-4" : ""}`}>{b.inhalt}</p>
        )}
        {b.bild_pfad && urls[b.bild_pfad] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urls[b.bild_pfad]} alt="" className="max-h-[360px] w-fit max-w-full rounded-xl border border-brand-line object-contain" />
        )}
        {!hervorheben && (
          <div className="-mx-1 flex flex-wrap items-center gap-1 border-t border-brand-line pt-2">
            <button
              type="button"
              disabled={laeuft || eigen || !status.schreiben}
              aria-pressed={h.an}
              title={eigen ? "Eigene Beiträge kannst du nicht als hilfreich markieren" : !status.schreiben ? "Hilfreich markieren ab BASIC" : "Hilfreich"}
              onClick={() =>
                starte(async () => {
                  const r = await hilfreichSetzen(b.id, !h.an);
                  if (r.error) setMeldung(r);
                  else setHilfreich((alt) => ({ ...alt, [b.id]: { an: !h.an, n: r.anzahl ?? h.n } }));
                })
              }
              className={`${KLEIN} ${h.an ? "bg-brand-blue-wash text-brand-blue" : "text-brand-ink-soft"}`}
            >
              <ThumbsUp size={14} /> Hilfreich {h.n > 0 && <span className="font-bold">{h.n}</span>}
            </button>
            {darfBeste && !eigen && (
              <button type="button" disabled={laeuft} onClick={() => tun(() => besteAntwort(thema.id, istBeste ? null : b.id))} className={`${KLEIN} ${istBeste ? "text-brand-green" : "text-brand-ink-soft"}`}>
                <CheckCircle2 size={14} /> {istBeste ? "Beste Antwort entfernen" : "Als beste Antwort markieren"}
              </button>
            )}
            {rechte.empfehlen && (
              <button type="button" disabled={laeuft} onClick={() => tun(() => empfehlen(thema.id, b.id, !b.empfohlen))} className={`${KLEIN} text-brand-ink-soft`}>
                <Star size={14} /> {b.empfohlen ? "Empfehlung entfernen" : "TanzRaum empfiehlt"}
              </button>
            )}
            {(eigen ? status.schreiben : rechte.beitragBearbeiten) && (
              <button type="button" onClick={() => setBearbeite(b.id)} className={`${KLEIN} text-brand-ink-soft`}>
                <Pencil size={13} /> Bearbeiten
              </button>
            )}
            {(eigen || rechte.beitragLoeschen) && (
              <button type="button" onClick={() => setDialog({ art: "loeschen", ziel: "beitrag", id: b.id })} className={`${KLEIN} text-brand-red`}>
                <Trash2 size={13} /> Löschen
              </button>
            )}
            {!eigen && (
              <button type="button" onClick={() => setDialog({ art: "melden", ziel: "beitrag", id: b.id })} className={`${KLEIN} text-brand-ink-soft`}>
                <Flag size={13} /> Melden
              </button>
            )}
            {!eigen && b.autor?.user_id && (
              <button type="button" onClick={() => setDialog({ art: "melden", ziel: "nutzer", id: b.autor!.user_id })} className={`${KLEIN} text-brand-ink-soft`}>
                <UserX size={13} /> Nutzer melden
              </button>
            )}
            {personAktionen(b.autor?.user_id ?? null, b.autor?.handle ?? null)}
          </div>
        )}
      </article>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {thema.geschlossen && (
        <p className="flex items-center gap-2 rounded-2xl bg-brand-bg px-4 py-3 text-[14px] font-semibold text-brand-ink">
          <Lock size={16} /> Dieses Thema ist geschlossen. Lesen bleibt möglich, neue Antworten nicht.
        </p>
      )}

      <article className="flex flex-col gap-3 rounded-3xl border border-brand-line bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
          <Link href={`/dashboard/treff/kategorie/${thema.kategorie_id}`} className="rounded-full bg-brand-bg px-2.5 py-0.5 text-brand-ink-soft hover:text-brand-ink">
            {thema.kategorie?.emoji} {thema.kategorie?.name}
          </Link>
          {thema.angepinnt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-red-wash px-2 py-0.5 text-brand-red">
              <Pin size={11} /> Angepinnt
            </span>
          )}
          {thema.empfohlen && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-gold-wash px-2 py-0.5 text-brand-ink">
              <Star size={11} /> TanzRaum empfiehlt
            </span>
          )}
        </div>
        {bearbeite === "thema" ? (
          <div className="flex flex-col gap-2">
            <input className={FELD} value={entwurf.titel} maxLength={160} onChange={(e) => setEntwurf({ ...entwurf, titel: e.target.value })} aria-label="Titel" />
            <textarea rows={8} className={FELD} value={entwurf.inhalt} maxLength={10000} onChange={(e) => setEntwurf({ ...entwurf, inhalt: e.target.value })} aria-label="Inhalt" />
            <input className={FELD} value={entwurf.link} placeholder="Link (optional)" onChange={(e) => setEntwurf({ ...entwurf, link: e.target.value })} aria-label="Link" />
            <div className="flex gap-2">
              <button type="button" disabled={laeuft} onClick={() => tun(() => themaBearbeiten(thema.id, entwurf.titel, entwurf.inhalt, entwurf.link), () => setBearbeite(null))} className="min-h-10 rounded-xl bg-brand-red px-4 text-[13.5px] font-bold text-white">
                Speichern
              </button>
              <button type="button" onClick={() => setBearbeite(null)} className="min-h-10 rounded-xl border border-brand-line px-4 text-[13.5px] font-semibold">
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-brand-ink [overflow-wrap:anywhere] sm:text-[26px]">{thema.titel}</h1>
            <AutorZeile handle={thema.autor?.handle ?? null} avatarUrl={thema.autor?.avatar_url ?? null} verein={thema.autor?.verein ?? null} kennzeichen={thema.autor?.kennzeichen ?? null} zeit={thema.erstellt_am} bearbeitet={thema.bearbeitet_am} />
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-brand-ink [overflow-wrap:anywhere]">{thema.inhalt}</p>
          </>
        )}
        {thema.bild_pfad && urls[thema.bild_pfad] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urls[thema.bild_pfad]} alt="" className="max-h-[420px] w-fit max-w-full rounded-xl border border-brand-line object-contain" />
        )}
        <div className="flex flex-wrap gap-2">
          {thema.datei_pfad && urls[thema.datei_pfad] && (
            <a href={urls[thema.datei_pfad]} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-line px-3 text-[13px] font-semibold hover:bg-brand-bg">
              <FileText size={15} className="text-brand-red" /> {thema.datei_name ?? "PDF"}
            </a>
          )}
          {thema.link && (
            <a href={thema.link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-10 max-w-full items-center gap-1.5 truncate rounded-xl border border-brand-line px-3 text-[13px] font-semibold hover:bg-brand-bg">
              <ExternalLink size={14} /> {thema.link.replace(/^https?:\/\//, "").slice(0, 60)}
            </a>
          )}
        </div>
        {thema.wissen && thema.wissen.length > 0 && (
          <div className="flex flex-col gap-1 rounded-2xl bg-brand-purple-wash p-3 text-[13.5px]">
            <span className="font-bold text-brand-purple">📚 Daraus ist ein Wissensbeitrag im TanzRaum Treff entstanden:</span>
            {thema.wissen.map((w) => (
              <Link key={w.id} href={`/dashboard/treff/wissen/${w.id}`} className="font-semibold text-brand-ink hover:underline">
                {w.titel} →
              </Link>
            ))}
          </div>
        )}

        <div className="-mx-1 flex flex-wrap items-center gap-1 border-t border-brand-line pt-2">
          {status.schreiben && (
            <button type="button" disabled={laeuft} onClick={() => tun(() => folgen(thema.id, !thema.ich_folge))} className={`${KLEIN} ${thema.ich_folge ? "bg-brand-blue-wash text-brand-blue" : "text-brand-ink-soft"}`}>
              {thema.ich_folge ? <BellOff size={14} /> : <Bell size={14} />} {thema.ich_folge ? "Nicht mehr folgen" : "🔔 Thema folgen"}
            </button>
          )}
          {thema.ich_autor && status.schreiben && bearbeite !== "thema" && (
            <button type="button" onClick={() => setBearbeite("thema")} className={`${KLEIN} text-brand-ink-soft`}>
              <Pencil size={13} /> Bearbeiten
            </button>
          )}
          {thema.ich_autor && (
            <button type="button" onClick={() => setDialog({ art: "loeschen", ziel: "thema", id: thema.id })} className={`${KLEIN} text-brand-red`}>
              <Trash2 size={13} /> Löschen
            </button>
          )}
          {!thema.ich_autor && (
            <button type="button" onClick={() => setDialog({ art: "melden", ziel: "thema", id: thema.id })} className={`${KLEIN} text-brand-ink-soft`}>
              <Flag size={13} /> Thema melden
            </button>
          )}
          {!thema.ich_autor && autorId && (
            <button type="button" onClick={() => setDialog({ art: "melden", ziel: "nutzer", id: autorId })} className={`${KLEIN} text-brand-ink-soft`}>
              <UserX size={13} /> Nutzer melden
            </button>
          )}
          {istModerator && (
            <button type="button" onClick={() => setModMenu(!modMenu)} aria-expanded={modMenu} className={`${KLEIN} ml-auto text-brand-blue`}>
              <MoreHorizontal size={15} /> Moderation
            </button>
          )}
        </div>
        {istModerator && modMenu && (
          <div className="flex flex-wrap gap-1 rounded-2xl bg-brand-blue-wash/60 p-2">
            {thema.geschlossen
              ? rechte.oeffnen && (
                  <button type="button" disabled={laeuft} onClick={() => tun(() => moderieren(thema.id, "oeffnen"))} className={KLEIN}>
                    <LockOpen size={14} /> Öffnen
                  </button>
                )
              : rechte.schliessen && (
                  <button type="button" disabled={laeuft} onClick={() => tun(() => moderieren(thema.id, "schliessen"))} className={KLEIN}>
                    <Lock size={14} /> Schließen
                  </button>
                )}
            {thema.angepinnt
              ? rechte.entpinnen && (
                  <button type="button" disabled={laeuft} onClick={() => tun(() => moderieren(thema.id, "entpinnen"))} className={KLEIN}>
                    <PinOff size={14} /> Entpinnen
                  </button>
                )
              : rechte.anpinnen && (
                  <button type="button" disabled={laeuft} onClick={() => tun(() => moderieren(thema.id, "anpinnen"))} className={KLEIN}>
                    <Pin size={14} /> Anpinnen
                  </button>
                )}
            {rechte.verschieben && (
              <button type="button" onClick={() => setDialog({ art: "verschieben" })} className={KLEIN}>
                <FolderInput size={14} /> Verschieben
              </button>
            )}
            {rechte.empfehlen && (
              <button type="button" disabled={laeuft} onClick={() => tun(() => empfehlen(thema.id, null, !thema.empfohlen))} className={KLEIN}>
                <Star size={14} /> {thema.empfohlen ? "Empfehlung entfernen" : "TanzRaum empfiehlt"}
              </button>
            )}
            {rechte.themaBearbeiten && !thema.ich_autor && (
              <button type="button" onClick={() => setBearbeite("thema")} className={KLEIN}>
                <Pencil size={14} /> Bearbeiten
              </button>
            )}
            {rechte.themaLoeschen && !thema.ich_autor && (
              <button type="button" onClick={() => setDialog({ art: "loeschen", ziel: "thema", id: thema.id })} className={`${KLEIN} text-brand-red`}>
                <Trash2 size={14} /> Löschen
              </button>
            )}
            {rechte.wissen && (
              <Link href={`/dashboard/treff/wissen/neu?thema=${thema.id}`} className={KLEIN}>
                <BookOpen size={14} /> Wissensbeitrag erstellen
              </Link>
            )}
            {personAktionen(autorId, thema.autor?.handle ?? null)}
          </div>
        )}
      </article>

      {meldung && <Meldung ergebnis={meldung} />}

      {beste && thema.beitraege.length > 2 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 text-[15px] font-bold text-brand-green">
            <CheckCircle2 size={16} /> Beste Antwort
          </h2>
          <a href={`#beitrag-${beste.id}`}>
            {beitragKarte(beste, true)}
          </a>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-[17px] font-bold text-brand-ink">
          {thema.beitraege.length} Antwort{thema.beitraege.length === 1 ? "" : "en"}
        </h2>
        {thema.beitraege.map((b) => (
          <div key={b.id}>{beitragKarte(b)}</div>
        ))}
      </section>

      {thema.geschlossen ? null : status.schreiben ? (
        <form
          className="flex flex-col gap-2 rounded-3xl border border-brand-line bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            tun(() => antworten(thema.id, antwort, antwortBild?.pfad ?? null), () => {
              setAntwort("");
              setAntwortBild(null);
            });
          }}
        >
          <label htmlFor="antwort" className="text-[14px] font-bold text-brand-ink">
            Deine Antwort
          </label>
          <textarea id="antwort" rows={4} maxLength={10000} value={antwort} onChange={(e) => setAntwort(e.target.value)} className={FELD} placeholder="Teile deine Erfahrung …" />
          <div className="flex flex-wrap items-center gap-2">
            {antwortBild ? (
              <span className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={antwortBild.url} alt="Bild" className="h-16 w-24 rounded-lg object-cover" />
                <button type="button" aria-label="Bild entfernen" onClick={() => setAntwortBild(null)} className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-brand-red shadow">
                  <Trash2 size={12} />
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => bildInput.current?.click()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-dashed border-brand-line px-3 text-[13px] font-semibold hover:bg-brand-bg">
                <ImagePlus size={15} /> Bild
              </button>
            )}
            <input
              ref={bildInput}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = await treffHochladen(userId, f);
                if ("fehler" in r) setMeldung({ error: r.fehler });
                else setAntwortBild({ pfad: r.pfad, url: URL.createObjectURL(f) });
              }}
            />
            <button type="submit" disabled={laeuft || !antwort.trim()} className="btn-primary ml-auto mt-0 inline-flex min-h-11 items-center gap-1.5 disabled:opacity-50">
              <Send size={16} /> Antworten
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => setDialog({ art: "hinweis" })} className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-xl border border-brand-line bg-white px-4 text-[14px] font-semibold hover:bg-brand-bg">
            <Send size={16} /> Antworten
          </button>
        </div>
      )}

      {dialog?.art === "hinweis" && (
        <Dialog titel="Antworten im TanzRaum Treff" onSchliessen={() => setDialog(null)}>
          <SchreibHinweis unter16={status.unter_16} gesperrtBis={status.gesperrt_bis} />
        </Dialog>
      )}
      {dialog?.art === "melden" && (
        <Dialog
          titel={dialog.ziel === "nutzer" ? "Nutzer melden" : dialog.ziel === "thema" ? "Thema melden" : "Beitrag melden"}
          untertitel="Eine Meldung löst keine automatische Sperre aus – das TanzRaum-Team prüft sie."
          onSchliessen={() => setDialog(null)}
          fuss={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDialog(null)} className="min-h-11 rounded-xl border border-brand-line px-4 text-[14px] font-semibold">
                Abbrechen
              </button>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => tun(() => melden(dialog.ziel, dialog.id, grund, text), () => setText(""))}
                className="min-h-11 rounded-xl bg-brand-red px-4 text-[14px] font-bold text-white disabled:opacity-60"
              >
                Melden
              </button>
            </div>
          }
        >
          <fieldset className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {MELDEGRUENDE.map((g) => (
              <label key={g.id} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[13.5px] ${grund === g.id ? "border-brand-red bg-brand-red-wash" : "border-brand-line"}`}>
                <input type="radio" name="grund" checked={grund === g.id} onChange={() => setGrund(g.id)} className="accent-[#e11d2e]" /> {g.label}
              </label>
            ))}
          </fieldset>
          <label className="field mt-3">
            Weitere Angaben (optional)
            <textarea rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} className={FELD} />
          </label>
        </Dialog>
      )}
      {dialog?.art === "loeschen" && (
        <Dialog
          titel={dialog.ziel === "thema" ? "Thema löschen?" : "Beitrag löschen?"}
          onSchliessen={() => setDialog(null)}
          fuss={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDialog(null)} className="min-h-11 rounded-xl border border-brand-line px-4 text-[14px] font-semibold">
                Abbrechen
              </button>
              <button
                type="button"
                disabled={laeuft}
                onClick={() =>
                  dialog.ziel === "thema" ? tun(() => themaLoeschen(dialog.id), () => router.push("/dashboard/treff")) : tun(() => beitragLoeschen(dialog.id, thema.id))
                }
                className="min-h-11 rounded-xl bg-brand-red px-4 text-[14px] font-bold text-white disabled:opacity-60"
              >
                Löschen
              </button>
            </div>
          }
        >
          <p className="text-[14px] text-brand-ink">{dialog.ziel === "thema" ? "Das Thema wird mit allen Antworten ausgeblendet." : "Der Beitrag wird ausgeblendet."}</p>
        </Dialog>
      )}
      {dialog?.art === "verschieben" && (
        <Dialog
          titel="Thema verschieben"
          untertitel="Der Inhalt bleibt erhalten."
          onSchliessen={() => setDialog(null)}
          fuss={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDialog(null)} className="min-h-11 rounded-xl border border-brand-line px-4 text-[14px] font-semibold">
                Abbrechen
              </button>
              <button
                type="button"
                disabled={laeuft || zielKategorie === thema.kategorie_id}
                onClick={() => tun(() => moderieren(thema.id, "verschieben", zielKategorie))}
                className="min-h-11 rounded-xl bg-brand-red px-4 text-[14px] font-bold text-white disabled:opacity-50"
              >
                Verschieben
              </button>
            </div>
          }
        >
          <label className="field">
            Neue Kategorie
            <select value={zielKategorie} onChange={(e) => setZielKategorie(e.target.value)}>
              {kategorien.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.emoji} {k.name}
                  {k.aktiv ? "" : " (inaktiv)"}
                </option>
              ))}
            </select>
          </label>
        </Dialog>
      )}
      {dialog?.art === "sperren" && (
        <Dialog
          titel={`@${dialog.handle} im Treff sperren`}
          untertitel="Gesperrte können weiter lesen, aber nicht mehr schreiben, antworten oder folgen."
          onSchliessen={() => setDialog(null)}
          fuss={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDialog(null)} className="min-h-11 rounded-xl border border-brand-line px-4 text-[14px] font-semibold">
                Abbrechen
              </button>
              <button type="button" disabled={laeuft} onClick={() => tun(() => nutzerSperren(dialog.userId, bis || null, text))} className="min-h-11 rounded-xl bg-brand-red px-4 text-[14px] font-bold text-white disabled:opacity-60">
                Sperren
              </button>
            </div>
          }
        >
          <label className="field">
            Gesperrt bis (leer = unbefristet)
            <input type="date" value={bis} onChange={(e) => setBis(e.target.value)} />
          </label>
          <label className="field mt-3">
            Grund
            <input value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
          </label>
        </Dialog>
      )}
      {dialog?.art === "entfernen" && (
        <Dialog
          titel={`@${dialog.handle} aus dem Treff entfernen?`}
          onSchliessen={() => setDialog(null)}
          fuss={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDialog(null)} className="min-h-11 rounded-xl border border-brand-line px-4 text-[14px] font-semibold">
                Abbrechen
              </button>
              <button type="button" disabled={laeuft} onClick={() => tun(() => nutzerEntfernen(dialog.userId, text))} className="min-h-11 rounded-xl bg-brand-red px-4 text-[14px] font-bold text-white disabled:opacity-60">
                Endgültig entfernen
              </button>
            </div>
          }
        >
          <p className="text-[14px] text-brand-ink">
            Alle Themen und Beiträge dieser Person im Treff werden ausgeblendet und das Schreiben im Treff wird dauerhaft gesperrt. Das TanzRaum-Konto selbst bleibt
            bestehen. Die Aktion wird protokolliert.
          </p>
          <label className="field mt-3">
            Grund
            <input value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
          </label>
        </Dialog>
      )}
    </div>
  );
}
