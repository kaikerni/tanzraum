import Link from "next/link";

// Inhaltsarten im TanzRaum Treff: Diskussionen und Wissensbeiträge (Wissen ist kein eigener Bereich)
export function TreffReiter({ aktiv }: { aktiv: "diskussionen" | "wissen" }) {
  const k = (a: boolean) => `inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold ${a ? "bg-brand-ink text-white" : "border border-brand-line bg-white text-brand-ink-soft hover:text-brand-ink"}`;
  return (
    <nav className="flex flex-wrap gap-2" aria-label="TanzRaum Treff">
      <Link href="/dashboard/treff" className={k(aktiv === "diskussionen")} aria-current={aktiv === "diskussionen" ? "page" : undefined}>
        💬 Diskussionen
      </Link>
      <Link href="/dashboard/treff/wissen" className={k(aktiv === "wissen")} aria-current={aktiv === "wissen" ? "page" : undefined}>
        📚 Wissensbeiträge
      </Link>
    </nav>
  );
}
