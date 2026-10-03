"use client";

import { useEffect, useRef, useState } from "react";

// Blendet Inhalte beim Scrollen sanft ein. Ohne JavaScript bzw. bei "Bewegung reduzieren" sofort sichtbar.
export function Einblenden({ children, className = "", verzoegerung = 0 }: { children: React.ReactNode; className?: string; verzoegerung?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zustand, setZustand] = useState<"start" | "versteckt" | "sichtbar">("start");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    // Bereits sichtbare Inhalte nicht erst verstecken
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    setZustand("versteckt");
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        if (eintraege.some((e) => e.isIntersecting)) {
          setZustand("sichtbar");
          beobachter.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${zustand === "start" ? "" : "tr-einblenden"} ${zustand === "versteckt" ? "tr-versteckt" : ""} ${className}`}
      style={verzoegerung ? { transitionDelay: `${verzoegerung}ms` } : undefined}
    >
      {children}
    </div>
  );
}
