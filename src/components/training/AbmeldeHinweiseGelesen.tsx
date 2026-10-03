"use client";

import { useEffect } from "react";
import { abmeldeHinweiseGelesen } from "@/app/dashboard/training/actions";

// Beim Oeffnen des Bereichs Training: Hinweise „Neue Abmeldung“ als gelesen markieren (Badge im Menue verschwindet)
export function AbmeldeHinweiseGelesen({ anzahl }: { anzahl: number }) {
  useEffect(() => {
    if (anzahl > 0) void abmeldeHinweiseGelesen();
  }, [anzahl]);
  return null;
}
