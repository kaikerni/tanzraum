import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { netzwerkZugang } from "@/lib/netzwerk/netzwerkZugang";
import { NetzwerkListe } from "@/components/netzwerk/NetzwerkListe";
import { NutzerSuche } from "@/components/netzwerk/NutzerSuche";
import { KARTE } from "@/components/dashboard/Karten";

export const metadata = { title: "Nutzer suchen – TanzRaum-Netzwerk" };

// Nutzer suchen: FREE per Name/@Nutzername (Profil ansehen, Nachricht senden), ab BASIC mit Kategorien und Ortsfilter
export default async function NutzerSuchenSeite() {
  const supabase = await createClient();
  const { voll } = await netzwerkZugang(supabase);
  if (voll) return <NetzwerkListe kategorien={["mitglieder", "trainer"]} platzhalter="Mitglieder und Trainer suchen …" />;
  return (
    <>
      <NutzerSuche />
      <section className={`${KARTE} text-[13.5px] text-brand-ink-soft`}>
        Mit FREE findest du TanzRaum-Nutzer, siehst ihre freigegebenen Profile und kannst ihnen eine Nachricht senden.
        Buddys, Map, Vereine entdecken, eigene Spotlights und den vollständigen Messenger mit Gruppenchats gibt es ab{" "}
        <Link href="/dashboard/tarif" className="font-semibold text-brand-red">
          BASIC
        </Link>{" "}
        – oder automatisch über einen Verein mit Vereinslizenz.
      </section>
    </>
  );
}
