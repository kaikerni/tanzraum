"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSignature } from "lucide-react";
import type { MeinAntrag } from "@/lib/antraege/getAntraege";

// Hinweis oben im Dashboard: Ein Verein hat die Person (oder ein Kind) hinzugefuegt, der Antrag fehlt noch
export function AntragHinweis({ antraege }: { antraege: MeinAntrag[] }) {
  const pfad = usePathname();
  const sichtbar = antraege.filter((a) => !pfad.startsWith(`/dashboard/mitgliedsantrag/${a.id}`));
  if (sichtbar.length === 0) return null;
  return (
    <div className="mx-auto mb-4 flex w-full max-w-[1200px] flex-col gap-2">
      {sichtbar.map((a) => (
        <Link
          key={a.id}
          href={`/dashboard/mitgliedsantrag/${a.id}`}
          className="flex items-center gap-3 rounded-2xl border border-brand-red/30 bg-brand-red-wash px-4 py-3 text-[13.5px] text-brand-ink shadow-sm hover:border-brand-red"
        >
          <FileSignature size={20} className="shrink-0 text-brand-red" />
          <span className="min-w-0 flex-1">
            <strong>{a.vereinName}</strong> hat {a.fuerMichSelbst ? "dich" : (a.name ?? "dein Kind")} als neues Mitglied hinzugefügt.{" "}
            Bitte fülle den Mitgliedsantrag aus.
          </span>
          <span className="shrink-0 font-semibold text-brand-red">Ausfüllen →</span>
        </Link>
      ))}
    </div>
  );
}
