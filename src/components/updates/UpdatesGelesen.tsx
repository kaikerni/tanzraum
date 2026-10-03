"use client";

import { useEffect } from "react";
import { ankuendigungGelesen } from "@/app/dashboard/news/actions";

// „Was ist neu?“ geoeffnet: angezeigte Neuheiten gelten als gelesen (Hinweis auf dem Dashboard verschwindet)
export function UpdatesGelesen({ ids }: { ids: string[] }) {
  const schluessel = ids.join(",");
  useEffect(() => {
    if (schluessel) void ankuendigungGelesen(schluessel.split(","));
  }, [schluessel]);
  return null;
}
