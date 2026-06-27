import Link from "next/link";
import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import type { OrganizationDetail } from "@/lib/organization/types";

type DashboardShellProps = {
  organization: OrganizationDetail;
  children: ReactNode;
};

export function DashboardShell({
  organization,
  children,
}: DashboardShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-16 w-full items-center justify-between gap-4 px-6">
          <div>
            <Link className="text-sm font-semibold" href="/">
              Realillust Dashboard
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">
              {organization.name} · {organization.role} ·{" "}
              {organization.planCode}
            </p>
          </div>
          <Link
            className="border border-border px-3 py-2 text-sm font-medium"
            href="/dashboard"
          >
            Switch organization
          </Link>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <DashboardSidebar organizationPublicId={organization.publicId} />
        <main className="min-w-0 flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
