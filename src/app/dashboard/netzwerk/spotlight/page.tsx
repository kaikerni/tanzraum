import { redirect } from "next/navigation";

// Spotlight ist ein eigener Hauptbereich (frueher Unterpunkt des Netzwerks)
export default function AlteSpotlightSeite() {
  redirect("/dashboard/spotlight");
}
