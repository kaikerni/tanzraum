import Link from "next/link";
import { RechtsLinks } from "@/components/recht/RechtsLinks";

export const metadata = { title: "Löschung beantragt – TanzRaum" };

export default async function KontoGeloeschtSeite({ searchParams }: { searchParams: Promise<{ ab?: string }> }) {
  const { ab } = await searchParams;
  const datum = ab && !Number.isNaN(Date.parse(ab))
    ? new Date(ab).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" })
    : null;
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="brand-font">Löschung beantragt</h1>
        <p className="subtitle">
          Dein Konto ist jetzt gesperrt und wird {datum ? `am ${datum}` : "in 14 Tagen"} endgültig gelöscht. Wir haben dir eine E-Mail mit einem
          Link geschickt, über den du die Löschung bis dahin widerrufen kannst.
        </p>
        <Link href="/login" className="btn-secondary w-full text-center">
          Zur Anmeldung
        </Link>
        <RechtsLinks className="mt-4 justify-center" />
      </div>
    </div>
  );
}
