import Link from "next/link";
import { Lock } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";

// Hinweis, wenn jemand (unter 16 oder gesperrt) keine Angebote einstellen darf
export function HandelnHinweis({ grund }: { grund: string }) {
  return (
    <section className={`${KARTE} flex flex-col items-center gap-3 py-10 text-center`}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-bg text-brand-ink-soft">
        <Lock size={26} />
      </div>
      <p className="text-[16px] font-bold text-brand-ink">{grund === "unter_16" ? "Erst ab 16 Jahren" : "Börse eingeschränkt"}</p>
      <p className="max-w-md text-[14px] text-brand-ink-soft">
        {grund === "unter_16"
          ? "Angebote einstellen und Anbietende kontaktieren geht in der TanzRaum Börse ab 16 Jahren. Stöbern und Favoriten merken kannst du trotzdem – frag deine Eltern, ob sie etwas für dich einstellen."
          : "Du kannst die TanzRaum Börse derzeit nicht nutzen. Bei Fragen: info@tanzraum.app"}
      </p>
      <Link href="/dashboard/boerse" className="mt-1 text-[13.5px] font-semibold text-brand-red">
        Zur Börse
      </Link>
    </section>
  );
}
