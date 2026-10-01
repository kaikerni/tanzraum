import Image from "next/image";
import Link from "next/link";
import { Lock, Users } from "lucide-react";

// Startflaeche rechts neben der Chatliste (ab BASIC)
export function NachrichtenStart({ gruppen = false }: { gruppen?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#f7f5f1] p-8 text-center">
      <Image src="/tanzraum-chat-hintergrund.webp" alt="" width={900} height={650} className="w-full max-w-[420px] select-none mix-blend-multiply" priority />
      <div>
        <h2 className="text-[20px] font-bold text-brand-ink">{gruppen ? "Gruppenchats" : "Nachrichten"}</h2>
        <p className="mt-1 max-w-[380px] text-[13.5px] text-brand-ink-soft">
          {gruppen
            ? "Vereinschat, Tanzgruppen und eigene Gruppenchats – wähle links einen Chat oder erstelle einen neuen Gruppenchat."
            : "Privatchats, Vereinschat und Gruppenchats – wähle links einen Chat oder starte einen neuen."}
        </p>
        {gruppen && (
          <Link href="/dashboard/nachrichten/gruppe-neu" className="btn-primary mt-3 inline-flex">
            <Users size={16} /> Neuer Gruppenchat
          </Link>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-[12px] text-brand-ink-faint">
        <Lock size={12} /> Private Chats sieht nur, wer mitschreibt – auch nicht die TanzRaum-Administration.
      </p>
    </div>
  );
}
