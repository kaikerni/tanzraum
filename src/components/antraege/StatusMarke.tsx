import { STATUS_LABEL, type AntragStatus } from "@/lib/antraege/getAntraege";

const FARBE: Record<AntragStatus, string> = {
  eingereicht: "bg-brand-blue/10 text-brand-blue",
  offen: "bg-brand-gold-wash text-brand-gold",
  angenommen: "bg-brand-green-wash text-brand-green",
  abgelehnt: "bg-brand-red-wash text-brand-red-deep",
};

export function StatusMarke({ status }: { status: AntragStatus }) {
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${FARBE[status]}`}>{STATUS_LABEL[status]}</span>;
}
