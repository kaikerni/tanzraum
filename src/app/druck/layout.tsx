// Druckansichten (ohne Navigation). "Drucken / als PDF speichern" nutzt den Druckdialog des Browsers.
export default function DruckLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-brand-ink">
      <style>{`
        @page { size: A4; margin: 14mm 12mm; }
        @media print { .druck-aus { display: none !important; } body { background: #fff; } }
        .druck-tabelle { width: 100%; border-collapse: collapse; font-size: 11.5px; }
        .druck-tabelle th { text-align: left; background: #f5f6f9; font-weight: 700; }
        .druck-tabelle th, .druck-tabelle td { border: 1px solid #d9dce4; padding: 5px 7px; vertical-align: top; }
        .druck-tabelle tr { break-inside: avoid; }
      `}</style>
      <div className="mx-auto max-w-[1000px] px-5 py-6">{children}</div>
    </div>
  );
}
