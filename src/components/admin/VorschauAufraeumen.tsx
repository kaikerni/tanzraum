"use client";

import { useEffect } from "react";

// Ohne aktive „Ansicht als …“ darf der Browser-Hinweis (nur lesen) nicht liegen bleiben
export function VorschauAufraeumen() {
  useEffect(() => {
    if (document.cookie.split("; ").includes("tr_vorschau=1")) document.cookie = "tr_vorschau=; Max-Age=0; path=/";
  }, []);
  return null;
}
