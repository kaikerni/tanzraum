import Link from "next/link";
import type { OnlineUebersicht } from "@/lib/online/getOnline";
import { OnlineUsers } from "@/components/online/OnlineUsers";

function Kreis({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const initialen = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt=""
      className="h-8 w-8 rounded-full border-2 border-white object-cover"
    />
  ) : (
    <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brand-red-wash text-[11px] font-bold text-brand-red">
      {initialen}
    </span>
  );
}

// Online-Bereich der Tageskarte: zentrale OnlineUsers-Anzeige + Vereinszahl, Kontakt-Vorschau, Hinweise
export function OnlineAnzeige({
  online,
  admin,
}: {
  online: OnlineUebersicht;
  admin: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-brand-bg px-3 py-2.5">
      <OnlineUsers anzahl={online.gesamt} />
      {(online.hatVerein || (admin && online.aktiv24h !== undefined)) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-brand-ink-soft">
          {online.hatVerein && (
            <span>
              <strong className="tabular-nums">{online.verein}</strong> aus
              deinem Verein
            </span>
          )}
          {admin && online.aktiv24h !== undefined && (
            <span>
              <strong className="tabular-nums">{online.aktiv24h}</strong> aktiv
              in 24 h
            </span>
          )}
        </p>
      )}
      {online.kontakte.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {online.kontakte.slice(0, 6).map((k) => (
              <Link
                key={k.id}
                href={`/dashboard/netzwerk/person/${k.id}`}
                title={k.name}
              >
                <Kreis name={k.name} avatarUrl={k.avatarUrl} />
              </Link>
            ))}
          </div>
          <span className="min-w-0 truncate text-[12.5px] text-brand-ink-soft">
            {online.kontakte
              .slice(0, 3)
              .map((k) => k.name)
              .join(", ")}
            {online.kontakte.length > 3
              ? ` und ${online.kontakte.length - 3} weitere`
              : ""}
          </span>
        </div>
      )}
      {admin ? (
        <Link
          href="/dashboard/admin/statistik"
          className="text-[12px] font-semibold text-brand-red"
        >
          Zur Plattform-Statistik →
        </Link>
      ) : (
        !online.ichSichtbar && (
          <Link
            href="/dashboard/einstellungen#online"
            className="text-[12px] text-brand-ink-soft underline-offset-2 hover:underline"
          >
            Dein Online-Status ist verborgen – ändern
          </Link>
        )
      )}
    </div>
  );
}
