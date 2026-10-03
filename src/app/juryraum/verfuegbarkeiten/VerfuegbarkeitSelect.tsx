"use client";

import { useTransition } from "react";
import { setzeVerfuegbarkeit } from "@/app/juryraum/actions";

const OPTIONEN = [
  { value: "kann", label: "🟢 Verfügbar" },
  { value: "vielleicht", label: "🟡 Eingeschränkt" },
  { value: "kann_nicht", label: "🔴 Nicht verfügbar" },
] as const;

export function VerfuegbarkeitSelect({
  turnierId,
  wert,
}: {
  turnierId: string;
  wert: "kann" | "kann_nicht" | "vielleicht" | null;
}) {
  const [pending, startTransition] = useTransition();

  function aendern(status: "kann" | "kann_nicht" | "vielleicht") {
    startTransition(async () => {
      await setzeVerfuegbarkeit(turnierId, status);
    });
  }

  return (
    <select
      value={wert ?? ""}
      disabled={pending}
      onChange={(e) => aendern(e.target.value as "kann" | "kann_nicht" | "vielleicht")}
      style={{
        padding: "6px 10px",
        borderRadius: "var(--radius-s)",
        border: "1px solid var(--line)",
        fontSize: 13,
      }}
    >
      <option value="" disabled>
        Noch nicht angegeben
      </option>
      {OPTIONEN.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
