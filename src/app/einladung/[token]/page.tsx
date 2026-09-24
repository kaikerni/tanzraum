import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EinladungAnnehmen } from "./EinladungAnnehmen";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EinladungSeite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=/einladung/${encodeURIComponent(token)}`);

  const { data } = UUID.test(token)
    ? await supabase.rpc("einladung_info", { p_token: token }).maybeSingle()
    : { data: null };
  // deno-lint-ignore no-explicit-any
  const info = data as any;

  return (
    <div className="auth-page">
      <div className="auth-card flex flex-col gap-4">
        <Image src="/tanzraum-logo-header.webp" alt="TanzRaum" width={1864} height={458} className="h-10 w-auto self-start" />
        {!info ? (
          <>
            <h1>Einladung nicht gefunden</h1>
            <p className="subtitle">Der Link ist ungültig. Bitte frag im Verein nach einem neuen Einladungslink.</p>
          </>
        ) : !info.gueltig ? (
          <>
            <h1>Einladung nicht mehr gültig</h1>
            <p className="subtitle">{info.grund}</p>
          </>
        ) : (
          <>
            <h1>Einladung zu {info.verein_name}</h1>
            <p className="subtitle">
              Du wurdest als <strong>{info.rolle ?? "Mitglied"}</strong> eingeladen. Mit „Beitreten“ wirst du Mitglied
              dieses Vereins.
            </p>
            <EinladungAnnehmen token={token} />
          </>
        )}
        <Link href="/dashboard" className="text-center text-[13px] text-brand-ink-soft hover:text-brand-ink">
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
