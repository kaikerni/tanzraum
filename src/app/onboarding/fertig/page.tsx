import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { onboardingAbschliessen } from "../actions";

export default async function OnboardingFertigPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: status } = await supabase
    .from("onboarding_progress")
    .select("tarif, verein_id, vereine(name)")
    .eq("user_id", user.id)
    .maybeSingle();

  // deno-lint-ignore no-explicit-any
  const vereinName = (status as any)?.vereine?.name as string | undefined;

  const TARIF_LABEL: Record<string, string> = { free: "Free", basic: "Basic", verein: "Verein" };

  return (
    <div className="card text-center">
      <div className="mb-1 text-[12px] font-semibold text-brand-ink-soft">Schritt 3 von 3</div>
      <div className="mb-3 text-4xl">🎉</div>
      <h1 className="mb-2 font-display text-2xl font-bold text-brand-ink">Alles bereit!</h1>
      <div className="mb-5 flex flex-col gap-1 text-[13.5px] text-brand-ink-soft">
        <span>
          Gewählter Tarif: <strong className="text-brand-ink">{TARIF_LABEL[status?.tarif ?? "free"]}</strong>
        </span>
        {vereinName && (
          <span>
            Verein: <strong className="text-brand-ink">{vereinName}</strong>
          </span>
        )}
      </div>
      <form action={onboardingAbschliessen}>
        <button type="submit" className="btn-primary w-full">
          Los geht's →
        </button>
      </form>
    </div>
  );
}
