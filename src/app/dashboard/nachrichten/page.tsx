import Image from "next/image";
import { Lock } from "lucide-react";

export default function NachrichtenStart() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#f7f5f1] p-8 text-center">
      <Image src="/tanzraum-chat-hintergrund.webp" alt="" width={900} height={650} className="w-full max-w-[420px] select-none mix-blend-multiply" priority />
      <div>
        <h2 className="text-[20px] font-bold text-brand-ink">TanzRaum-Messenger</h2>
        <p className="mt-1 max-w-[380px] text-[13.5px] text-brand-ink-soft">
          Vereinschat, Gruppenchats und Privatchats – wähle links einen Chat oder starte einen neuen Privatchat.
        </p>
      </div>
      <p className="flex items-center gap-1.5 text-[12px] text-brand-ink-faint">
        <Lock size={12} /> Private Chats sieht nur, wer mitschreibt – auch nicht die TanzRaum-Administration.
      </p>
    </div>
  );
}
