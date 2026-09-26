"use client";

import { useTransition } from "react";
import { antworteAufEinladung } from "@/app/juryraum/actions";

export function EinladungAntwort({ zusageId }: { zusageId: string }) {
  const [pending, startTransition] = useTransition();

  function antworten(status: "zugesagt" | "abgesagt") {
    startTransition(async () => {
      await antworteAufEinladung(zusageId, status);
    });
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        type="button"
        className="btn-primary"
        style={{ padding: "6px 14px", fontSize: 13 }}
        disabled={pending}
        onClick={() => antworten("zugesagt")}
      >
        Annehmen
      </button>
      <button
        type="button"
        className="btn-secondary"
        style={{ padding: "6px 14px" }}
        disabled={pending}
        onClick={() => antworten("abgesagt")}
      >
        Ablehnen
      </button>
    </div>
  );
}
