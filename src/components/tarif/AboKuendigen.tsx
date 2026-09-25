"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zahlungAufruf } from "./zahlungAufruf";

export function AboKuendigen({ aboId, text = "Abo kündigen", frage }: { aboId: string; text?: string; frage: string }) {
  const router = useRouter();
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function kuendigen() {
    if (!window.confirm(frage)) return;
    setLaedt(true);
    setFehler(null);
    const { fehler } = await zahlungAufruf("abo-verwalten", { abo_id: aboId, aktion: "kuendigen" });
    setLaedt(false);
    if (fehler) return setFehler(fehler);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={kuendigen}
        disabled={laedt}
        className="rounded-xl border border-brand-red/40 bg-white px-3 py-1.5 text-[13px] font-semibold text-brand-red hover:bg-brand-red-wash disabled:opacity-60"
      >
        {laedt ? "Wird gekündigt …" : text}
      </button>
      {fehler && <p className="form-error">{fehler}</p>}
    </div>
  );
}
