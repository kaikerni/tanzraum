import { AlertTriangle } from "lucide-react";
import { speicherText } from "@/lib/speicher";

// Kontingent wurde unter die aktuelle Belegung gesenkt: nichts wird geloescht, aber neue Uploads sind gesperrt
export function SpeicherReduziert({ belegt, limit }: { belegt: number; limit: number }) {
  if (!(limit >= 0) || belegt <= limit) return null;
  return (
    <div role="status" className="flex gap-2.5 rounded-xl border border-brand-amber/40 bg-brand-gold-wash px-3.5 py-3 text-[13px] text-brand-ink">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-brand-amber" />
      <div>
        <p className="font-bold">Speicherlimit wurde reduziert.</p>
        <p>
          Aktuell verwendet: {speicherText(belegt)} · Neues Limit: {speicherText(limit)}
        </p>
        <p className="text-brand-ink-soft">Es müssen Dateien entfernt werden, bevor weitere Dateien hochgeladen werden können. Es wurde nichts gelöscht.</p>
      </div>
    </div>
  );
}
