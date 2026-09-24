"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  ImagePlus,
  BarChart3,
  X,
  Reply,
  Copy,
  Trash2,
  Check,
  CheckCheck,
  Megaphone,
  Plus,
  Lock,
  Bell,
  BellOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { alsNachricht, type ChatKopf, type ChatNachricht, type Umfrage } from "@/lib/chat/getChat";
import { chatEinstellung, chatStummSetzen, nachrichtLoeschen, umfrageAbstimmen } from "@/app/dashboard/nachrichten/actions";
import { ChatAvatar } from "./ChatAvatar";

const NAMENSFARBEN = ["text-brand-red", "text-brand-blue", "text-brand-green", "text-brand-purple", "text-brand-gold", "text-brand-navy-soft"];
const tagBerlin = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(iso));
const uhrzeit = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

function namensFarbe(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return NAMENSFARBEN[Math.abs(h) % NAMENSFARBEN.length];
}

function tagesTrenner(iso: string) {
  const tag = tagBerlin(iso);
  if (tag === tagBerlin(new Date().toISOString())) return "Heute";
  if (tag === tagBerlin(new Date(Date.now() - 864e5).toISOString())) return "Gestern";
  return new Date(iso).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });
}

// Text mit klickbaren Links, Zeilenumbrueche bleiben erhalten.
function MitLinks({ text }: { text: string }) {
  const teile = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {teile.map((t, i) =>
        /^https?:\/\//.test(t) ? (
          <a key={i} href={t} target="_blank" rel="noopener noreferrer" className="text-brand-blue underline [overflow-wrap:anywhere]" onClick={(e) => e.stopPropagation()}>
            {t}
          </a>
        ) : (
          <Fragment key={i}>{t}</Fragment>
        ),
      )}
    </>
  );
}

async function bildVerkleinern(datei: File): Promise<Blob> {
  if (datei.type === "image/gif") return datei;
  const bild = await createImageBitmap(datei);
  const faktor = Math.min(1, 1600 / Math.max(bild.width, bild.height));
  const leinwand = document.createElement("canvas");
  leinwand.width = Math.round(bild.width * faktor);
  leinwand.height = Math.round(bild.height * faktor);
  leinwand.getContext("2d")!.drawImage(bild, 0, 0, leinwand.width, leinwand.height);
  return new Promise((ok, fehler) => leinwand.toBlob((b) => (b ? ok(b) : fehler(new Error("Bild"))), "image/jpeg", 0.82));
}

function UmfrageAnsicht({ n, onAbgestimmt }: { n: ChatNachricht & { umfrage: Umfrage }; onAbgestimmt: () => void }) {
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const u = n.umfrage;
  const gesamt = Math.max(1, u.stimmen.reduce((a, b) => a + b, 0));

  function waehlen(i: number) {
    const neu = u.mehrfach ? (u.meine.includes(i) ? u.meine.filter((x) => x !== i) : [...u.meine, i]) : u.meine.includes(i) ? [] : [i];
    starte(async () => {
      const e = await umfrageAbstimmen(n.id, neu);
      setFehler(e.error);
      onAbgestimmt();
    });
  }

  return (
    <div className="flex min-w-[220px] flex-col gap-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start gap-2 text-[14.5px] font-semibold text-brand-ink">
        <BarChart3 size={16} className="mt-0.5 shrink-0 text-brand-ink-soft" />
        {u.frage}
      </div>
      <div className="text-[11.5px] text-brand-ink-soft">{u.mehrfach ? "Mehrere Antworten möglich" : "Eine Antwort wählen"}</div>
      {u.optionen.map((o, i) => {
        const gewaehlt = u.meine.includes(i);
        const anteil = Math.round((u.stimmen[i] / gesamt) * 100);
        return (
          <button
            key={i}
            type="button"
            disabled={laeuft}
            onClick={() => waehlen(i)}
            aria-pressed={gewaehlt}
            className="flex flex-col gap-1 rounded-lg px-1 py-1 text-left hover:bg-black/[0.03] disabled:opacity-60"
          >
            <span className="flex items-center gap-2 text-[13.5px] text-brand-ink">
              <span
                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center border-2 ${u.mehrfach ? "rounded-[5px]" : "rounded-full"} ${
                  gewaehlt ? "border-brand-green bg-brand-green text-white" : "border-brand-ink-faint"
                }`}
              >
                {gewaehlt && <Check size={12} strokeWidth={3} />}
              </span>
              <span className="flex-1">{o}</span>
              <span className="text-[12px] text-brand-ink-soft">{u.stimmen[i]}</span>
            </span>
            <span className="ml-[26px] h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
              <span className="block h-full rounded-full bg-brand-green" style={{ width: `${anteil}%` }} />
            </span>
          </button>
        );
      })}
      <div className="text-[11.5px] text-brand-ink-soft">
        {u.teilnehmer === 1 ? "1 Person hat abgestimmt" : `${u.teilnehmer} Personen haben abgestimmt`}
      </div>
      {fehler && <p className="form-error">{fehler}</p>}
    </div>
  );
}

function UmfrageFormular({ onSenden, onSchliessen }: { onSenden: (u: { frage: string; optionen: string[]; mehrfach: boolean }) => void; onSchliessen: () => void }) {
  const [frage, setFrage] = useState("");
  const [optionen, setOptionen] = useState(["", ""]);
  const [mehrfach, setMehrfach] = useState(false);
  const gueltig = frage.trim() && optionen.filter((o) => o.trim()).length >= 2;
  return (
    <div className="flex flex-col gap-2 border-t border-brand-line bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-bold text-brand-ink">Umfrage erstellen</span>
        <button type="button" onClick={onSchliessen} aria-label="Schließen" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-brand-bg">
          <X size={18} />
        </button>
      </div>
      <input
        value={frage}
        onChange={(e) => setFrage(e.target.value)}
        maxLength={300}
        placeholder="Frage stellen"
        aria-label="Frage"
        className="min-h-10 rounded-lg border border-brand-line px-3 text-[14px] outline-none focus:border-brand-red"
      />
      {optionen.map((o, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={o}
            onChange={(e) => setOptionen(optionen.map((x, j) => (j === i ? e.target.value : x)))}
            maxLength={100}
            placeholder={`Antwort ${i + 1}`}
            aria-label={`Antwort ${i + 1}`}
            className="min-h-10 flex-1 rounded-lg border border-brand-line px-3 text-[14px] outline-none focus:border-brand-red"
          />
          {optionen.length > 2 && (
            <button type="button" onClick={() => setOptionen(optionen.filter((_, j) => j !== i))} aria-label="Antwort entfernen" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-brand-bg">
              <X size={16} />
            </button>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {optionen.length < 12 ? (
          <button type="button" onClick={() => setOptionen([...optionen, ""])} className="inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-brand-blue">
            <Plus size={15} /> Antwort hinzufügen
          </button>
        ) : (
          <span />
        )}
        <label className="flex min-h-9 items-center gap-2 text-[13px] text-brand-ink">
          <input type="checkbox" checked={mehrfach} onChange={(e) => setMehrfach(e.target.checked)} className="h-4 w-4 accent-brand-red" />
          Mehrere Antworten erlauben
        </label>
      </div>
      <button
        type="button"
        disabled={!gueltig}
        onClick={() => onSenden({ frage: frage.trim(), optionen: optionen.map((o) => o.trim()).filter(Boolean), mehrfach })}
        className="min-h-10 rounded-xl bg-brand-red text-[14px] font-semibold text-white disabled:opacity-50"
      >
        Umfrage senden
      </button>
    </div>
  );
}

export function ChatFenster({
  kopf: startKopf,
  start,
  startBilder,
  userId,
  freigabeFehlt = false,
  stumm: startStumm = false,
}: {
  kopf: ChatKopf;
  start: ChatNachricht[];
  startBilder: Record<string, string>;
  userId: string;
  freigabeFehlt?: boolean;
  stumm?: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [kopf, setKopf] = useState(startKopf);
  const [aktuell, setAktuell] = useState(start);
  const [aeltere, setAeltere] = useState<ChatNachricht[]>([]);
  const [mehrVorhanden, setMehrVorhanden] = useState(start.length >= 60);
  const [bilder, setBilder] = useState(startBilder);
  const [text, setText] = useState("");
  const [antwort, setAntwort] = useState<ChatNachricht | null>(null);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [bild, setBild] = useState<{ datei: File; vorschau: string } | null>(null);
  const [umfrageOffen, setUmfrageOffen] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [einstellungLaeuft, starteEinstellung] = useTransition();
  const [stumm, setStumm] = useState(startStumm);
  const liste = useRef<HTMLDivElement>(null);
  const eingabe = useRef<HTMLTextAreaElement>(null);
  const amEnde = useRef(true);
  const dateiEingabe = useRef<HTMLInputElement>(null);

  const nachrichten = useMemo(() => {
    const karte = new Map<string, ChatNachricht>();
    for (const n of [...aeltere, ...aktuell]) karte.set(n.id, n);
    return [...karte.values()].sort((a, b) => a.gesendetAm.localeCompare(b.gesendetAm));
  }, [aeltere, aktuell]);

  const laden = useCallback(async () => {
    const { data } = await supabase.rpc("chat_nachrichten", { p_gespraech_id: kopf.id, p_vor: null, p_anzahl: 60 });
    // deno-lint-ignore no-explicit-any
    if (data) setAktuell((data as any[]).map(alsNachricht));
  }, [supabase, kopf.id]);

  const kopfLaden = useCallback(async () => {
    const { data } = await supabase.rpc("chat_kopf", { p_gespraech_id: kopf.id });
    // deno-lint-ignore no-explicit-any
    const k = (data as any[] | null)?.[0];
    if (k) setKopf((alt) => ({ ...alt, partnerGelesenBis: k.partner_gelesen_bis, darfSchreiben: k.darf_schreiben, nurLeitungSchreibt: k.nur_leitung_schreibt }));
  }, [supabase, kopf.id]);

  const gelesen = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    await supabase.rpc("chat_gelesen", { p_gespraech_id: kopf.id });
    router.refresh();
  }, [supabase, kopf.id, router]);

  // Live: neue/geloeschte Nachrichten und Lesestatus des Gegenuebers.
  useEffect(() => {
    const kanal = supabase
      .channel(`chat-${kopf.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "nachrichten", filter: `gespraech_id=eq.${kopf.id}` }, () => laden())
      .on("postgres_changes", { event: "*", schema: "public", table: "gespraech_teilnehmer", filter: `gespraech_id=eq.${kopf.id}` }, () => kopfLaden())
      .subscribe();
    const sichtbar = () => document.visibilityState === "visible" && gelesen();
    document.addEventListener("visibilitychange", sichtbar);
    return () => {
      supabase.removeChannel(kanal);
      document.removeEventListener("visibilitychange", sichtbar);
    };
  }, [supabase, kopf.id, laden, kopfLaden, gelesen]);

  // Beim Oeffnen und bei neuen fremden Nachrichten als gelesen markieren.
  const letzteFremde = [...aktuell].reverse().find((n) => !n.eigene)?.id;
  useEffect(() => {
    gelesen();
  }, [letzteFremde, gelesen]);

  // Signierte Bild-URLs fuer neue Bilder nachladen.
  useEffect(() => {
    const fehlend = nachrichten.map((n) => n.bildPfad).filter((p): p is string => !!p && !bilder[p]);
    if (fehlend.length === 0) return;
    supabase.storage
      .from("chat-bilder")
      .createSignedUrls(fehlend, 3600)
      .then(({ data }) => {
        const neu: Record<string, string> = {};
        for (const e of data ?? []) if (e.path && e.signedUrl) neu[e.path] = e.signedUrl;
        setBilder((alt) => ({ ...alt, ...neu }));
      });
  }, [nachrichten, bilder, supabase]);

  // Automatisch nach unten scrollen, wenn man ohnehin unten ist.
  useLayoutEffect(() => {
    const el = liste.current;
    if (el && amEnde.current) el.scrollTop = el.scrollHeight;
  }, [aktuell]);

  async function aeltereLaden() {
    const erste = nachrichten[0];
    if (!erste) return;
    const el = liste.current;
    const hoeheVorher = el?.scrollHeight ?? 0;
    const { data } = await supabase.rpc("chat_nachrichten", { p_gespraech_id: kopf.id, p_vor: erste.gesendetAm, p_anzahl: 60 });
    // deno-lint-ignore no-explicit-any
    const neu = ((data ?? []) as any[]).map(alsNachricht);
    setMehrVorhanden(neu.length >= 60);
    setAeltere((alt) => [...neu, ...alt]);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - hoeheVorher;
    });
  }

  async function senden(extra?: { umfrage?: { frage: string; optionen: string[]; mehrfach: boolean } }) {
    const inhalt = text.trim();
    if (sendet || (!inhalt && !bild && !extra?.umfrage)) return;
    setSendet(true);
    setFehler(null);
    try {
      let bildPfad: string | null = null;
      if (bild && !extra?.umfrage) {
        const blob = await bildVerkleinern(bild.datei);
        const endung = blob.type === "image/gif" ? "gif" : "jpg";
        bildPfad = `${kopf.id}/${crypto.randomUUID()}.${endung}`;
        const { error } = await supabase.storage.from("chat-bilder").upload(bildPfad, blob, { contentType: blob.type || "image/jpeg" });
        if (error) throw new Error("Das Bild konnte nicht hochgeladen werden (max. 5 MB).");
      }
      const { error } = await supabase.from("nachrichten").insert({
        gespraech_id: kopf.id,
        sender_id: userId,
        inhalt: extra?.umfrage ? "" : inhalt,
        bild_pfad: bildPfad,
        umfrage: extra?.umfrage ?? null,
        antwort_auf: antwort?.id ?? null,
      });
      if (error) throw new Error(error.code === "42501" ? "Du darfst in diesem Chat nicht schreiben." : "Die Nachricht konnte nicht gesendet werden.");
      if (!extra?.umfrage) {
        setText("");
        setBild(null);
      }
      setUmfrageOffen(false);
      setAntwort(null);
      amEnde.current = true;
      await laden();
      eingabe.current?.focus();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Die Nachricht konnte nicht gesendet werden.");
    } finally {
      setSendet(false);
    }
  }

  const ausgewaehlt = nachrichten.find((n) => n.id === auswahl) ?? null;
  const istGruppe = kopf.typ !== "dm";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Kopf */}
      <header className="flex min-h-[60px] items-center gap-3 border-b border-brand-line bg-white px-2 py-2 sm:px-4">
        <Link href="/dashboard/nachrichten" aria-label="Zurück zu allen Chats" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-brand-bg lg:hidden">
          <ArrowLeft size={20} />
        </Link>
        <ChatAvatar typ={kopf.typ} name={kopf.name} avatarUrl={kopf.avatarUrl} groesse={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15.5px] font-bold text-brand-ink">{kopf.name}</div>
          <div className="truncate text-[12px] text-brand-ink-soft">
            {kopf.untertitel ?? "Privater Chat"}
            {kopf.nurLeitungSchreibt && istGruppe ? " · nur Leitung schreibt" : ""}
          </div>
        </div>
        {kopf.typ !== "platform" && (
          <button
            type="button"
            onClick={async () => {
              const neu = !stumm;
              setStumm(neu);
              const e = await chatStummSetzen(kopf.id, neu);
              if (e.error) {
                setStumm(!neu);
                setFehler(e.error);
              }
            }}
            aria-pressed={stumm}
            aria-label={stumm ? "Stummschaltung aufheben" : "Chat stummschalten"}
            title={stumm ? "Stummschaltung aufheben" : kopf.nurLeitungSchreibt ? "Stummschalten (Ankündigungen kommen trotzdem)" : "Chat stummschalten"}
            className={`flex h-10 w-10 items-center justify-center rounded-full hover:bg-brand-bg ${stumm ? "text-brand-ink-faint" : "text-brand-ink-soft"}`}
          >
            {stumm ? <BellOff size={18} /> : <Bell size={18} />}
          </button>
        )}
        {kopf.istLeitung && (
          <button
            type="button"
            disabled={einstellungLaeuft}
            onClick={() =>
              starteEinstellung(async () => {
                const e = await chatEinstellung(kopf.id, !kopf.nurLeitungSchreibt);
                if (e.error) setFehler(e.error);
                await kopfLaden();
              })
            }
            title={kopf.nurLeitungSchreibt ? "Allen das Schreiben erlauben" : "Nur Vorstand, Trainer und Betreuer schreiben lassen"}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold disabled:opacity-60 ${
              kopf.nurLeitungSchreibt ? "border-brand-red bg-brand-red-wash text-brand-red-deep" : "border-brand-line text-brand-ink-soft hover:bg-brand-bg"
            }`}
          >
            <Megaphone size={14} /> <span className="hidden sm:inline">{kopf.nurLeitungSchreibt ? "Nur Leitung" : "Alle schreiben"}</span>
          </button>
        )}
      </header>

      {/* Verlauf mit blasser Taenzer-Illustration im Hintergrund */}
      <div className="relative min-h-0 flex-1 bg-[#f7f5f1]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[url('/tanzraum-chat-hintergrund.webp')] bg-[length:min(92%,620px)] bg-center bg-no-repeat opacity-70 mix-blend-multiply"
        />
        <div
          ref={liste}
          onScroll={(e) => {
            const el = e.currentTarget;
            amEnde.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          className="relative h-full overflow-y-auto px-2 py-3 sm:px-6"
          aria-live="polite"
        >
          {mehrVorhanden && (
            <div className="mb-3 flex justify-center">
              <button type="button" onClick={aeltereLaden} className="rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-semibold text-brand-ink shadow-sm hover:bg-white">
                Ältere Nachrichten laden
              </button>
            </div>
          )}
          {nachrichten.length === 0 && (
            <div className="mx-auto mt-6 max-w-[320px] rounded-xl bg-white/90 px-4 py-3 text-center text-[13px] text-brand-ink-soft shadow-sm">
              <Lock size={13} className="mr-1 inline" />
              Noch keine Nachrichten. Schreib die erste!
            </div>
          )}
          {nachrichten.map((n, i) => {
            const vorher = nachrichten[i - 1];
            const neuerTag = !vorher || tagBerlin(vorher.gesendetAm) !== tagBerlin(n.gesendetAm);
            const neuerAbsender = neuerTag || !vorher || vorher.senderId !== n.senderId;
            const gewaehlt = auswahl === n.id;
            const gelesenVonPartner = kopf.typ === "dm" && kopf.partnerGelesenBis && kopf.partnerGelesenBis >= n.gesendetAm;
            return (
              <Fragment key={n.id}>
                {neuerTag && (
                  <div className="sticky top-1 z-10 my-3 flex justify-center">
                    <span className="rounded-lg bg-white/95 px-3 py-1 text-[11.5px] font-semibold text-brand-ink-soft shadow-sm">{tagesTrenner(n.gesendetAm)}</span>
                  </div>
                )}
                <div className={`flex ${n.eigene ? "justify-end" : "justify-start"} ${neuerAbsender ? "mt-2" : "mt-0.5"}`}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-pressed={gewaehlt}
                    onClick={() => setAuswahl(gewaehlt ? null : n.id)}
                    onKeyDown={(e) => e.key === "Enter" && setAuswahl(gewaehlt ? null : n.id)}
                    className={`relative max-w-[82%] cursor-pointer rounded-2xl px-3 pb-1.5 pt-2 text-[14.5px] leading-snug shadow-[0_1px_1px_rgba(27,33,48,0.08)] sm:max-w-[65%] ${
                      n.eigene ? "bg-[#fde4e6] text-brand-ink" : "bg-white text-brand-ink"
                    } ${neuerAbsender ? (n.eigene ? "rounded-tr-md" : "rounded-tl-md") : ""} ${gewaehlt ? "ring-2 ring-brand-red/50" : ""}`}
                  >
                    {istGruppe && !n.eigene && neuerAbsender && (
                      <div className={`mb-0.5 text-[12.5px] font-bold ${namensFarbe(n.senderId)}`}>{n.senderName}</div>
                    )}
                    {n.antwortAuf && (
                      <div className="mb-1.5 rounded-lg border-l-4 border-brand-red bg-black/[0.04] px-2 py-1">
                        <div className="text-[12px] font-bold text-brand-red">{n.antwortSender ?? "Unbekannt"}</div>
                        <div className="line-clamp-2 text-[12.5px] text-brand-ink-soft">{n.antwortText}</div>
                      </div>
                    )}
                    {n.geloescht ? (
                      <span className="italic text-brand-ink-faint">Diese Nachricht wurde gelöscht.</span>
                    ) : (
                      <>
                        {n.bildPfad && (
                          <a href={bilder[n.bildPfad] ?? "#"} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="-mx-1.5 mb-1 block">
                            {bilder[n.bildPfad] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={bilder[n.bildPfad]} alt="Foto" className="max-h-[320px] w-full rounded-xl object-cover" />
                            ) : (
                              <span className="block h-40 w-60 animate-pulse rounded-xl bg-black/5" />
                            )}
                          </a>
                        )}
                        {n.umfrage && <UmfrageAnsicht n={n as ChatNachricht & { umfrage: Umfrage }} onAbgestimmt={laden} />}
                        {n.inhalt && (
                          <span className="whitespace-pre-wrap break-words">
                            <MitLinks text={n.inhalt} />
                          </span>
                        )}
                      </>
                    )}
                    <span className="float-right ml-2 mt-1.5 flex translate-y-0.5 items-center gap-0.5 text-[10.5px] text-brand-ink-faint">
                      {uhrzeit(n.gesendetAm)}
                      {n.eigene && kopf.typ === "dm" && !n.geloescht &&
                        (gelesenVonPartner ? <CheckCheck size={14} className="text-brand-blue" aria-label="gelesen" /> : <Check size={14} aria-label="gesendet" />)}
                    </span>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* Aktionen fuer die angetippte Nachricht */}
      {ausgewaehlt && !ausgewaehlt.geloescht && (
        <div className="flex items-center gap-1 border-t border-brand-line bg-white px-2 py-1.5">
          <span className="min-w-0 flex-1 truncate px-2 text-[12.5px] text-brand-ink-soft">
            {ausgewaehlt.eigene ? "Deine Nachricht" : ausgewaehlt.senderName} · {uhrzeit(ausgewaehlt.gesendetAm)}
          </span>
          {kopf.darfSchreiben && (
            <button
              type="button"
              onClick={() => {
                setAntwort(ausgewaehlt);
                setAuswahl(null);
                eingabe.current?.focus();
              }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg"
            >
              <Reply size={16} /> Antworten
            </button>
          )}
          {ausgewaehlt.inhalt && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(ausgewaehlt.inhalt).catch(() => {});
                setAuswahl(null);
              }}
              aria-label="Kopieren"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-brand-ink hover:bg-brand-bg"
            >
              <Copy size={16} />
            </button>
          )}
          {ausgewaehlt.darfLoeschen && (
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Nachricht für alle löschen?")) return;
                const e = await nachrichtLoeschen(ausgewaehlt.id);
                if (e.error) setFehler(e.error);
                setAuswahl(null);
                laden();
              }}
              aria-label="Löschen"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-brand-red hover:bg-brand-red-wash"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button type="button" onClick={() => setAuswahl(null)} aria-label="Auswahl aufheben" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-brand-bg">
            <X size={16} />
          </button>
        </div>
      )}

      {fehler && (
        <div className="border-t border-brand-line bg-white px-3 py-2">
          <p className="form-error">{fehler}</p>
        </div>
      )}

      {/* Eingabe */}
      {!kopf.darfSchreiben ? (
        <div className="flex min-h-14 items-center justify-center gap-2 border-t border-brand-line bg-white px-4 text-center text-[13px] text-brand-ink-soft">
          <Megaphone size={15} />
          {freigabeFehlt
            ? "Zum Schreiben müssen deine Eltern den Chat für dich freischalten."
            : kopf.typ === "platform"
            ? "Hier schreibt nur das TanzRaum-Team."
            : kopf.typ === "dm"
              ? "In diesem Chat kann nicht mehr geschrieben werden."
              : "Hier schreiben nur Vorstand, Trainer und Betreuer."}
        </div>
      ) : umfrageOffen ? (
        <UmfrageFormular onSchliessen={() => setUmfrageOffen(false)} onSenden={(u) => senden({ umfrage: u })} />
      ) : (
        <div className="border-t border-brand-line bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-3">
          {antwort && (
            <div className="mb-2 flex items-start gap-2 rounded-lg border-l-4 border-brand-red bg-brand-bg px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-bold text-brand-red">{antwort.eigene ? "Du" : antwort.senderName}</div>
                <div className="truncate text-[12.5px] text-brand-ink-soft">
                  {antwort.umfrage ? `📊 ${antwort.umfrage.frage}` : antwort.inhalt || "📷 Foto"}
                </div>
              </div>
              <button type="button" onClick={() => setAntwort(null)} aria-label="Antwort abbrechen" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white">
                <X size={15} />
              </button>
            </div>
          )}
          {bild && (
            <div className="mb-2 flex items-center gap-3 rounded-lg bg-brand-bg p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bild.vorschau} alt="Ausgewähltes Foto" className="h-16 w-16 rounded-lg object-cover" />
              <span className="flex-1 text-[12.5px] text-brand-ink-soft">Foto wird mit deiner Nachricht gesendet.</span>
              <button type="button" onClick={() => setBild(null)} aria-label="Foto entfernen" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white">
                <X size={16} />
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              senden();
            }}
            className="flex items-end gap-1.5"
          >
            <button type="button" onClick={() => dateiEingabe.current?.click()} aria-label="Foto senden" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-ink-soft hover:bg-brand-bg">
              <ImagePlus size={21} />
            </button>
            <input
              ref={dateiEingabe}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const datei = e.target.files?.[0];
                e.target.value = "";
                if (!datei) return;
                if (datei.size > 15 * 1024 * 1024) return setFehler("Das Foto ist zu groß.");
                setBild({ datei, vorschau: URL.createObjectURL(datei) });
              }}
            />
            <button type="button" onClick={() => setUmfrageOffen(true)} aria-label="Umfrage erstellen" className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-ink-soft hover:bg-brand-bg sm:flex">
              <BarChart3 size={20} />
            </button>
            <label className="sr-only" htmlFor={`eingabe-${kopf.id}`}>
              Nachricht
            </label>
            <textarea
              id={`eingabe-${kopf.id}`}
              ref={eingabe}
              value={text}
              rows={1}
              maxLength={4000}
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 132)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                  e.preventDefault();
                  senden();
                }
              }}
              placeholder="Nachricht"
              className="max-h-[132px] min-h-11 flex-1 resize-none rounded-3xl border border-brand-line bg-brand-bg px-4 py-2.5 text-[15px] text-brand-ink outline-none focus:border-brand-red"
            />
            {text.trim() || bild ? (
              <button type="submit" disabled={sendet} aria-label="Senden" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-red text-white hover:bg-brand-red-deep disabled:opacity-60">
                <Send size={19} />
              </button>
            ) : (
              <button type="button" onClick={() => setUmfrageOffen(true)} aria-label="Umfrage erstellen" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-red text-white sm:hidden">
                <BarChart3 size={19} />
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
