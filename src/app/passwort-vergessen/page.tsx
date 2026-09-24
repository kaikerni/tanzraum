import Link from "next/link";
import { VergessenFormular } from "./VergessenFormular";

export const metadata = { title: "Passwort vergessen – TanzRaum" };

export default function PasswortVergessenSeite() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="brand-font">Passwort vergessen?</h1>
        <p className="subtitle">
          Kein Problem. Gib die E-Mail-Adresse deines TanzRaum-Kontos ein – wir schicken dir einen Link, mit dem du ein neues
          Passwort festlegen kannst.
        </p>
        <VergessenFormular />
        <p className="auth-switch">
          Doch wieder eingefallen? <Link href="/login">Zur Anmeldung</Link>
        </p>
      </div>
    </div>
  );
}
