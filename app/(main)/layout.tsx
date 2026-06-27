import { redirect } from "next/navigation";

import { PageTransition } from "@/components/layout/PageTransition";
import { getCurrentUserForSsr } from "@/lib/auth/server";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUserForSsr();

  if (user && !user.onboardingCompleted) {
    redirect("/onboarding");
  }

  return <PageTransition>{children}</PageTransition>;
}
