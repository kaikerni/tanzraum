import type { KaiPose, KaiVariante } from "./typen";

// Bilder je Pose. Alle Bilder sind freigestellt (transparent) und aus dem Masterbild
// public/images/assistant/kai-master.png abgeleitet (scripts/kai-bilder.py).
// Eine neue Pose einbauen: Bild(er) nach public/images/assistant/ legen und hier den Eintrag austauschen –
// alle Stellen, die diese Pose nutzen, zeigen dann automatisch das neue Bild.

export type KaiBild = { voll: string; portrait: string; breite: number; hoehe: number };

const MASTER: KaiBild = {
  voll: "/images/assistant/kai.webp",
  portrait: "/images/assistant/kai-portrait.webp",
  breite: 512,
  hoehe: 768,
};

export const KAI_POSEN: Record<KaiPose, KaiBild> = {
  begruessung: MASTER,
  erklaeren: MASTER,
  hinweis: MASTER,
  idee: MASTER,
  erfolg: MASTER,
  warnung: MASTER,
  sport: MASTER,
  nachdenken: MASTER,
};

// Standard-Pose je Sprechblasen-Variante
export const POSE_FUER_VARIANTE: Record<KaiVariante, KaiPose> = {
  welcome: "begruessung",
  help: "erklaeren",
  info: "hinweis",
  success: "erfolg",
  warning: "warnung",
  point: "hinweis",
  setup: "erklaeren",
};

export function kaiBild(pose: KaiPose = "begruessung"): KaiBild {
  return KAI_POSEN[pose] ?? MASTER;
}
