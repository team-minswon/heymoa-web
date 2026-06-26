import { redirect } from "next/navigation";

import { DashboardAuthRequired } from "@/components/dashboard/dashboard-auth-required";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCurrentUserForSsr } from "@/lib/auth/server";
import { getOrganizationForSsr } from "@/lib/organization/server";
import {
  OrganizationApiError,
  type OrganizationDetail,
} from "@/lib/organization/types";

export const dynamic = "force-dynamic";

export default async function OrganizationDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationPublicId: string }>;
}) {
  const user = await getCurrentUserForSsr();

  if (!user) {
    return <DashboardAuthRequired />;
  }

  if (!user.onboardingCompleted) {
    redirect("/onboarding");
  }

  const { organizationPublicId } = await params;
  let organization: OrganizationDetail | undefined;
  let notFound = false;

  try {
    organization = await getOrganizationForSsr(organizationPublicId);
  } catch (error) {
    if (error instanceof OrganizationApiError && error.status === 404) {
      notFound = true;
    } else {
      throw error;
    }
  }

  if (notFound || !organization) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--clay-canvas)] p-6">
        <section className="w-full max-w-sm rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6">
          <h1 className="text-xl font-semibold">조직을 찾을 수 없습니다</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--clay-muted)]">
            조직이 없거나 접근 권한이 없습니다.
          </p>
        </section>
      </main>
    );
  }

  return (
    <DashboardShell organization={organization}>{children}</DashboardShell>
  );
}
