import { redirect } from "next/navigation";
import { getCurrentUserForSsr } from "@/lib/auth/server";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const user = await getCurrentUserForSsr();

  if (!user) {
    redirect("/");
  }

  if (user.onboardingCompleted) {
    redirect("/");
  }

  return <OnboardingWizard />;
}
