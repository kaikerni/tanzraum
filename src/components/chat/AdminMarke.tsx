// Deutliche Kennzeichnung, wenn die TanzRaum-Administration schreibt (DB: chat_liste -> untertitel "TanzRaum Admin")
export const ADMIN_KENNUNG = "TanzRaum Admin";

export function AdminMarke() {
  return (
    <span className="ml-1.5 inline-flex shrink-0 items-center rounded-full bg-brand-red px-1.5 py-px align-middle text-[10.5px] font-bold uppercase tracking-wide text-white">
      TanzRaum Admin
    </span>
  );
}
