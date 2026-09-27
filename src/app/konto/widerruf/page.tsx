import { RechtsLinks } from "@/components/recht/RechtsLinks";
import { WiderrufFormular } from "./WiderrufFormular";

export const metadata = { title: "Löschung widerrufen – TanzRaum" };
export const dynamic = "force-dynamic";

export default async function WiderrufSeite({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="brand-font">Kontolöschung widerrufen</h1>
        {token ? (
          <>
            <p className="subtitle">Möchtest du dein TanzRaum-Konto behalten? Dann widerrufe die beantragte Löschung.</p>
            <WiderrufFormular token={token} />
          </>
        ) : (
          <p className="subtitle">Dieser Link ist unvollständig. Bitte öffne den Link aus der E-Mail erneut.</p>
        )}
        <RechtsLinks className="mt-4 justify-center" />
      </div>
    </div>
  );
}
