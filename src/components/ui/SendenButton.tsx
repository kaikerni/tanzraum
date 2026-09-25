"use client";

import { useFormStatus } from "react-dom";

export function SendenButton({
  children,
  laedtText = "Wird gespeichert …",
  variante = "primaer",
  className = "",
}: {
  children: React.ReactNode;
  laedtText?: string;
  variante?: "primaer" | "sekundaer" | "gefahr";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const stil =
    variante === "primaer"
      ? "bg-brand-red text-white hover:bg-brand-red-deep"
      : variante === "gefahr"
        ? "border border-brand-red/40 bg-white text-brand-red hover:bg-brand-red-wash"
        : "border border-brand-line bg-white text-brand-ink hover:bg-brand-bg";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-semibold transition-colors disabled:opacity-60 ${stil} ${className}`}
    >
      {pending ? laedtText : children}
    </button>
  );
}

export type AktionsErgebnis = { error: string | null; ok?: string | null };
export const LEERES_ERGEBNIS: AktionsErgebnis = { error: null, ok: null };

export function Meldung({ ergebnis }: { ergebnis: AktionsErgebnis }) {
  if (ergebnis.error) return <p className="form-error">{ergebnis.error}</p>;
  if (ergebnis.ok) return <p className="rounded-lg bg-brand-green-wash px-3 py-2 text-[13px] text-brand-green">{ergebnis.ok}</p>;
  return null;
}
