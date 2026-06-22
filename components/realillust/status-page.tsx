import type React from "react";
import type { LucideIcon } from "lucide-react";

import { AppShell } from "@/components/realillust/app-shell";
import { PageSection } from "@/components/realillust/primitives";
import { StatusPanel } from "@/components/realillust/status-panel";

export function StatusPage({
  icon,
  label,
  title,
  description,
  actions,
  iconClassName,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  iconClassName?: string;
}) {
  return (
    <AppShell>
      <PageSection className="flex min-h-[58vh] items-center py-14 sm:py-20">
        <StatusPanel
          icon={icon}
          label={label}
          title={title}
          description={description}
          actions={actions}
          iconClassName={iconClassName}
        />
      </PageSection>
    </AppShell>
  );
}
