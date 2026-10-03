"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // „Ansicht als …“ endet mit der Abmeldung
  const speicher = await cookies();
  speicher.delete("tr_ansicht");
  speicher.delete("tr_vorschau");
  redirect("/login");
}
