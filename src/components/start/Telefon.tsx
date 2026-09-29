import { Bell, CalendarDays, Check, ChevronRight, Home, MessageCircle, Plus, Trophy, Users, X } from "lucide-react";

// Smartphone-Mockups fuer die Startseite – ausschliesslich Demo-Inhalte, keine echten Daten.

export function Telefon({ children, className = "", titel }: { children: React.ReactNode; className?: string; titel?: string }) {
  return (
    <div className={`relative mx-auto w-[250px] shrink-0 rounded-[2.6rem] border-[9px] border-brand-navy bg-brand-navy shadow-[0_30px_60px_-25px_rgba(27,33,48,0.55)] ${className}`}>
      <div className="absolute left-1/2 top-2 z-10 h-[18px] w-[76px] -translate-x-1/2 rounded-full bg-brand-navy" aria-hidden="true" />
      <div className="relative h-[500px] overflow-hidden rounded-[2rem] bg-brand-bg">
        <div className="flex items-center justify-between px-5 pb-1 pt-2.5 text-[10px] font-semibold text-brand-ink">
          <span>9:41</span>
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-1.5 w-3 rounded-sm bg-brand-ink" />
            <span className="h-1.5 w-1.5 rounded-full bg-brand-ink" />
          </span>
        </div>
        {titel && <p className="px-4 pb-1 pt-3 text-[15px] font-extrabold text-brand-ink">{titel}</p>}
        <div className="px-3">{children}</div>
      </div>
    </div>
  );
}

function Mini({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-brand-line bg-white p-2.5 text-[11px] text-brand-ink shadow-sm ${className}`}>{children}</div>;
}

function Leiste() {
  const icons = [Home, CalendarDays, MessageCircle, Users];
  return (
    <div className="absolute inset-x-3 bottom-3 flex justify-around rounded-2xl border border-brand-line bg-white py-2 shadow" aria-hidden="true">
      {icons.map((I, i) => (
        <I key={i} size={16} className={i === 0 ? "text-brand-red" : "text-brand-ink-faint"} />
      ))}
    </div>
  );
}

export function DashboardScreen() {
  return (
    <>
      <p className="px-1 pb-2 pt-3 text-[15px] font-extrabold">Hallo Mia! 👋</p>
      <div className="grid grid-cols-2 gap-2">
        <Mini>
          <p className="text-[18px] font-extrabold text-brand-red">2</p>
          <p className="text-brand-ink-soft">Trainings heute</p>
        </Mini>
        <Mini>
          <p className="text-[18px] font-extrabold text-brand-green">12</p>
          <p className="text-brand-ink-soft">Tänzer dabei</p>
        </Mini>
      </div>
      <Mini className="mt-2">
        <p className="font-bold">Heute</p>
        <p className="mt-1 flex justify-between">
          <span>Juniorengarde</span>
          <span className="text-brand-ink-soft">18:00</span>
        </p>
        <p className="mt-0.5 flex justify-between">
          <span>Showtanz</span>
          <span className="text-brand-ink-soft">19:30</span>
        </p>
      </Mini>
      <Mini className="mt-2 flex items-center gap-2">
        <Trophy size={14} className="text-brand-gold" />
        <span className="flex-1">Turnier am Samstag</span>
        <ChevronRight size={12} className="text-brand-ink-faint" />
      </Mini>
      <Mini className="mt-2 flex items-center gap-2">
        <Bell size={14} className="text-brand-blue" />
        <span className="flex-1">3 neue Benachrichtigungen</span>
      </Mini>
      <Leiste />
    </>
  );
}

export function KalenderScreen() {
  const tage = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  return (
    <>
      <div className="grid grid-cols-7 gap-1 text-center text-[9.5px] text-brand-ink-soft">
        {tage.map((t) => (
          <span key={t}>{t}</span>
        ))}
        {Array.from({ length: 28 }, (_, i) => (
          <span
            key={i}
            className={`rounded-md py-1 text-[10px] ${i === 11 ? "bg-brand-red font-bold text-white" : [2, 9, 16, 23].includes(i) ? "bg-brand-red-wash text-brand-red" : i === 19 ? "bg-brand-gold-wash text-brand-gold" : "text-brand-ink"}`}
          >
            {i + 1}
          </span>
        ))}
      </div>
      {[
        { t: "Training Juniorengarde", z: "Mi · 18:00", f: "bg-brand-red" },
        { t: "Kostümprobe", z: "Sa · 10:00", f: "bg-brand-purple" },
        { t: "Turnier – Landesmeisterschaft", z: "So · 09:00", f: "bg-brand-gold" },
      ].map((e) => (
        <Mini key={e.t} className="mt-2 flex items-center gap-2">
          <span className={`h-7 w-1 rounded-full ${e.f}`} />
          <span>
            <span className="block font-semibold">{e.t}</span>
            <span className="text-brand-ink-soft">{e.z}</span>
          </span>
        </Mini>
      ))}
      <Leiste />
    </>
  );
}

export function TrainingScreen() {
  return (
    <>
      <Mini className="mt-1">
        <p className="font-bold">Juniorengarde · heute 18:00</p>
        <p className="text-brand-ink-soft">Sporthalle Nord</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <span className="flex items-center justify-center gap-1 rounded-lg bg-brand-green py-1.5 font-semibold text-white">
            <Check size={12} /> Dabei
          </span>
          <span className="flex items-center justify-center gap-1 rounded-lg border border-brand-line py-1.5 font-semibold">
            <X size={12} /> Abmelden
          </span>
        </div>
      </Mini>
      <Mini className="mt-2">
        <p className="mb-1.5 font-bold">Anwesenheit</p>
        <div className="h-2 overflow-hidden rounded-full bg-brand-bg">
          <div className="h-full w-[85%] rounded-full bg-brand-green" />
        </div>
        <p className="mt-1 text-brand-ink-soft">12 von 14 angemeldet</p>
      </Mini>
      <Mini className="mt-2">
        <p className="font-bold">Info vom Trainer</p>
        <p className="text-brand-ink-soft">Bitte Gardestiefel mitbringen 👢</p>
      </Mini>
      <Leiste />
    </>
  );
}

export function ChatScreen() {
  return (
    <>
      <div className="flex flex-col gap-2 pt-1">
        <p className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[11px] shadow-sm">Wer fährt am Samstag mit? 🚗</p>
        <p className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-red px-3 py-2 text-[11px] text-white">Ich hab noch 2 Plätze frei!</p>
        <p className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[11px] shadow-sm">Super, danke 🙌</p>
        <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white p-2 text-[11px] shadow-sm">
          <div className="mb-1 h-16 rounded-lg bg-gradient-to-br from-brand-red-wash to-brand-gold-wash" />
          Neues Kostümfoto 📷
        </div>
        <p className="ml-auto rounded-full bg-brand-green-wash px-2.5 py-1 text-[10px] font-semibold text-brand-green">Neue Nachricht</p>
      </div>
      <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-2xl border border-brand-line bg-white px-3 py-2 text-[11px] text-brand-ink-faint">
        <Plus size={14} /> Nachricht schreiben …
      </div>
    </>
  );
}

export function SpotlightScreen() {
  return (
    <>
      <div className="flex gap-2 overflow-hidden pt-1">
        {["Garde", "Show", "Solo", "Team"].map((n, i) => (
          <div key={n} className="flex flex-col items-center gap-1">
            <span className={`h-12 w-12 rounded-full p-[2px] ${i === 0 ? "bg-gradient-to-tr from-brand-red to-brand-gold" : "bg-brand-line"}`}>
              <span className="block h-full w-full rounded-full border-2 border-white bg-gradient-to-br from-brand-gold-wash to-brand-red-wash" />
            </span>
            <span className="text-[9.5px] text-brand-ink-soft">{n}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl border border-brand-line bg-white">
        <div className="relative h-44 bg-gradient-to-br from-brand-navy via-brand-red-deep to-brand-gold">
          <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-brand-ink">Spotlight ✨</span>
        </div>
        <p className="p-2.5 text-[11px]">Unser neuer Showtanz ist fertig! 💃</p>
      </div>
      <Leiste />
    </>
  );
}

export function VereinScreen() {
  return (
    <>
      <Mini className="mt-1 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gold-wash text-[14px]">🎭</span>
        <span>
          <span className="block font-bold">TSC Beispielstadt</span>
          <span className="text-brand-ink-soft">86 Mitglieder · 6 Gruppen</span>
        </span>
      </Mini>
      {[
        ["Mitglieder", "86"],
        ["Tanzgruppen", "6"],
        ["Mitgliedsanträge", "2 neu"],
        ["Saisonplanung", "14 Termine"],
      ].map(([t, w]) => (
        <Mini key={t} className="mt-2 flex items-center justify-between">
          <span className="font-semibold">{t}</span>
          <span className="text-brand-ink-soft">{w}</span>
        </Mini>
      ))}
      <Leiste />
    </>
  );
}

// Installationsschritte als Mini-Ablauf im Telefon
export function InstallScreen({ schritte, farbe }: { schritte: string[]; farbe: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 pt-6">
      {schritte.map((s, i) => (
        <div key={s} className="flex w-full flex-col items-center gap-1.5">
          <div
            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-[12px] font-semibold ${i === schritte.length - 1 ? `border-transparent text-white ${farbe}` : "border-brand-line bg-white text-brand-ink"}`}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-bg text-[9px] text-brand-ink">{i + 1}</span>
            {s}
          </div>
          {i < schritte.length - 1 && <span className="text-brand-ink-faint">↓</span>}
        </div>
      ))}
    </div>
  );
}
