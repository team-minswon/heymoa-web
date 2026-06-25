import { redirect } from "next/navigation";

import { DashboardAuthRequired } from "@/components/dashboard/dashboard-auth-required";
import { getOrganizationsForSsr } from "@/lib/organization/server";
import {
  OrganizationApiError,
  type OrganizationSummary,
} from "@/lib/organization/types";

export default async function DashboardIndexPage() {
  let organizations: OrganizationSummary[] | undefined;
  let unauthorized = false;

  try {
    organizations = await getOrganizationsForSsr();
  } catch (error) {
    if (error instanceof OrganizationApiError && error.status === 401) {
      unauthorized = true;
    } else {
      throw error;
    }
  }

  if (unauthorized) {
    return <DashboardAuthRequired />;
  }

  const firstOrganization = organizations?.[0];

  if (firstOrganization) {
    redirect(`/dashboard/${firstOrganization.publicId}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--clay-canvas)] p-6">
      <section className="w-full max-w-sm rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6">
        <h1 className="text-xl font-semibold">조직을 찾을 수 없습니다</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--clay-muted)]">
          가입 후 생성된 organization이 없습니다.
        </p>
      </section>
    </main>
  );
}
