import Link from "next/link";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import type { OrganizationDetail } from "@/lib/organization/types";

export function DashboardShell({
  organization,
  children,
}: {
  organization: OrganizationDetail;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--clay-canvas)] text-[var(--clay-primary)]">
      <header className="sticky top-0 z-30 border-b border-[var(--clay-hairline)] bg-[var(--clay-canvas)]/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
          <Link
            href={`/dashboard/${organization.publicId}`}
            className="shrink-0 text-sm font-semibold"
          >
            Realillust Dashboard
          </Link>
          <div className="min-w-0 max-w-[52vw] truncate rounded-full border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] px-3 py-1.5 text-xs font-semibold">
            {organization.name}
          </div>
        </div>
      </header>
      <div className="flex">
        <DashboardSidebar organizationPublicId={organization.publicId} />
        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
