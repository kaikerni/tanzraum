"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// ✓✓ zugestellt: Sobald TanzRaum auf einem Geraet geoeffnet ist, gelten eingegangene Privat- und Gruppenchat-Nachrichten
// als zugestellt (DB: nachrichten_zugestellt). Zusaetzlich meldet der Service Worker beim Empfang eines Pushs.
export function NachrichtenZustellung({ userId }: { userId: string }) {
  useEffect(() => {
    const supabase = createClient();
    let zuletzt = 0;
    let wartet: ReturnType<typeof setTimeout> | null = null;
    const melden = () => {
      if (wartet) return;
      wartet = setTimeout(() => {
        wartet = null;
        zuletzt = Date.now();
        void supabase.rpc("nachrichten_zugestellt").then(() => undefined); // sendet erst mit then/await
      }, Math.max(0, 3000 - (Date.now() - zuletzt)));
    };
    melden();
    const kanal = supabase
      .channel("zustellung")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "nachrichten" }, ({ new: neu }) => {
        if ((neu as { sender_id?: string }).sender_id !== userId) melden();
      })
      .subscribe();
    const sichtbar = () => document.visibilityState === "visible" && melden();
    document.addEventListener("visibilitychange", sichtbar);
    return () => {
      if (wartet) clearTimeout(wartet);
      supabase.removeChannel(kanal);
      document.removeEventListener("visibilitychange", sichtbar);
    };
  }, [userId]);
  return null;
}
