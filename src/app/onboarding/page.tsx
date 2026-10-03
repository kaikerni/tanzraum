import { redirect } from "next/navigation";
import { ladeOnboardingStatus } from "./actions";

export default async function OnboardingIndexPage() {
  const status = await ladeOnboardingStatus();

  if (!status || status.completed) redirect("/dashboard");
  if (status.current_step >= 3) redirect("/onboarding/fertig");
  if (status.current_step >= 2) redirect("/onboarding/verein");
  redirect("/onboarding/tarif");
}
