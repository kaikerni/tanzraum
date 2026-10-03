import { ModulSchutz } from "@/components/verein/ModulSchutz";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ModulSchutz modul="turniere">{children}</ModulSchutz>;
}
