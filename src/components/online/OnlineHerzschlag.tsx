"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Meldet "online", solange TanzRaum sichtbar geoeffnet ist (hoechstens einmal pro Minute; die DB drosselt zusaetzlich)
export function OnlineHerzschlag() {
  useEffect(() => {
    const supabase = createClient();
    const melden = () => {
      if (document.visibilityState === "visible") void supabase.rpc("online_melden");
    };
    melden();
    const takt = window.setInterval(melden, 60_000);
    document.addEventListener("visibilitychange", melden);
    return () => {
      window.clearInterval(takt);
      document.removeEventListener("visibilitychange", melden);
    };
  }, []);
  return null;
}
