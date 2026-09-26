import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profil } = await supabase
    .from("profiles")
    .select("gesperrt")
    .eq("id", user.id)
    .maybeSingle();
  if (profil?.gesperrt) redirect("/gesperrt");

  return (
    <div className="flex min-h-screen flex-col items-center bg-brand-bg px-4 py-10">
      <Image
        src="/tanzraum-logo-banner.webp"
        alt="TanzRaum"
        width={180}
        height={47}
        className="mb-8 h-11 w-auto"
        priority
      />
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
