import { redirect } from "next/navigation";

// Schnellaktion "Fahrgemeinschaft erstellen" -> Seite mit geoeffnetem Formular
export default function NeueFahrt() {
  redirect("/dashboard/fahrgemeinschaften?neu=1#neu");
}
