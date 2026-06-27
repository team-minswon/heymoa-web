import { redirect } from "next/navigation";
import { DashboardAuthRequired } from "@/components/dashboard/dashboard-auth-required";
import { getOrganizationsForSsr } from "@/lib/organization/server";
import {
  OrganizationApiError,
  type OrganizationSummary,
} from "@/lib/organization/types";

export const dynamic = "force-dynamic";

export default async function DashboardIndexPage() {
  let organizations: OrganizationSummary[] | undefined;
  let unauthorized = false;

  try {
    organizations = await getOrganizationsForSsr();
  } catch (error) {
    if (
      error instanceof OrganizationApiError &&
      (error.status === 401 || error.status === 503)
    ) {
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
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
      <p className="font-mono text-sm text-muted-foreground">Dashboard</p>
      <h1 className="mt-4 text-3xl font-semibold">No organization found</h1>
      <p className="mt-4 text-muted-foreground">
        The account does not have an organization available yet.
      </p>
    </main>
  );
}
