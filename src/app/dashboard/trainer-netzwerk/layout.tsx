import { ModulSchutz } from "@/components/verein/ModulSchutz";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ModulSchutz modul="trainer_netzwerk">{children}</ModulSchutz>;
}
