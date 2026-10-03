"use client";

import { usePathname } from "next/navigation";
import { Fusszeile } from "./RechtsLinks";

// Im Messenger und im TanzRaum Chat fuellt der Chat die volle Hoehe; dort ist das Rechtliche ueber Einstellungen/Hilfe erreichbar.
export function AppFusszeile({ className = "" }: { className?: string }) {
  const pfad = usePathname();
  if (pfad.startsWith("/dashboard/nachrichten") || pfad === "/dashboard/chat") return null;
  return <Fusszeile className={className} />;
}
