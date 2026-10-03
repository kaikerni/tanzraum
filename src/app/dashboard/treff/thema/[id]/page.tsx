import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ThemaAnsicht } from "@/components/treff/ThemaAnsicht";
import { kategorienListe, treffStatus } from "@/lib/treff/laden";
import type { ThemaDetail } from "@/lib/treff/treff";

export const metadata = { title: "Thema – TanzRaum Treff" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TreffThema({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=/dashboard/treff/thema/${id}`);
  const [{ data }, status, kategorien] = await Promise.all([supabase.rpc("treff_thema", { p_id: id }), treffStatus(supabase), kategorienListe(supabase)]);
  if (!data) notFound();
  const thema = data as ThemaDetail;

  // Bilder/PDF liegen in einem privaten Speicher: kurzlebige Links
  const pfade = [thema.bild_pfad, thema.datei_pfad, ...thema.beitraege.map((b) => b.bild_pfad)].filter((p): p is string => !!p);
  const urls: Record<string, string> = {};
  if (pfade.length) {
    const { data: sig } = await supabase.storage.from("treff").createSignedUrls(pfade, 3600);
    for (const s of sig ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
  }
  const r = new Set(status.rechte);
  const rechte = {
    admin: status.admin,
    themaBearbeiten: r.has("treff.themen_bearbeiten"),
    themaLoeschen: r.has("treff.themen_loeschen"),
    beitragBearbeiten: r.has("treff.beitraege_bearbeiten"),
    beitragLoeschen: r.has("treff.beitraege_loeschen"),
    schliessen: r.has("treff.themen_schliessen"),
    oeffnen: r.has("treff.themen_oeffnen"),
    anpinnen: r.has("treff.themen_anpinnen"),
    entpinnen: r.has("treff.themen_entpinnen"),
    verschieben: r.has("treff.themen_verschieben"),
    empfehlen: r.has("treff.empfehlen"),
    sperren: r.has("treff.nutzer_sperren"),
    entfernen: r.has("treff.nutzer_entfernen"),
    wissen: false,
  };
  const { data: wissen } = await supabase.rpc("team_darf", { p_recht: "wissen.erstellen" });
  rechte.wissen = wissen === true;

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-4">
      <Link href="/dashboard/treff" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={14} /> TanzRaum Treff
      </Link>
      <ThemaAnsicht thema={thema} urls={urls} status={status} rechte={rechte} kategorien={kategorien} userId={user.id} />
    </div>
  );
}
