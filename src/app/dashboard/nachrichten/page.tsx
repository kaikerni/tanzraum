import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NachrichtenStart } from "@/components/chat/NachrichtenStart";

// Ab BASIC: Startflaeche neben der Chatliste. FREE: Hinweis (keine Chatuebersicht) mit Weg zur Nutzersuche.
export default async function NachrichtenSeite() {
  const supabase = await createClient();
  const [{ data: tarif }, { data: admin }] = await Promise.all([supabase.rpc("mein_tarif"), supabase.rpc("ist_plattform_admin_aktuell")]);
  if (tarif === "basic" || tarif === "verein" || admin === true) return <NachrichtenStart />;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-[#f7f5f1] p-8 text-center">
      <MessageCircle size={40} className="text-brand-red" />
      <h2 className="text-[20px] font-bold text-brand-ink">Nachrichten mit FREE</h2>
      <p className="max-w-[420px] text-[13.5px] text-brand-ink-soft">
        Mit FREE schreibst du einzelne Direktnachrichten: Suche eine Person, öffne ihr Profil und tippe auf „Nachricht senden“. Neue Nachrichten
        findest du auf deinem Dashboard. Chatübersicht, Gruppenchats und Buddys gibt es ab BASIC.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/dashboard/netzwerk/suche" className="btn-primary inline-flex">
          <Search size={16} /> Nutzer suchen
        </Link>
        <Link href="/dashboard/tarif" className="inline-flex min-h-11 items-center rounded-xl border border-brand-line bg-white px-4 text-[14px] font-semibold text-brand-ink">
          Tarife ansehen
        </Link>
      </div>
    </div>
  );
}
