import type React from "react";
import type { LucideIcon } from "lucide-react";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PageSection } from "@/components/realillust/primitives";
import { StatusPanel } from "@/components/realillust/status-panel";

export function StatusPage({
  icon,
  label,
  title,
  description,
  actions,
  iconClassName,
  withoutShell = false,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  iconClassName?: string;
  withoutShell?: boolean;
}) {
  const content = (
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
  );

  if (withoutShell) {
    return content;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--cg-cream)] text-[var(--cg-ink)]">
      <Navbar />
      <main className="flex-1 flex flex-col">{content}</main>
      <Footer />
    </div>
  );
}
