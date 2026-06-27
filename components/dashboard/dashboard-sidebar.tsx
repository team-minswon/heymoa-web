"use client";

import {
  BarChart3,
  KeyRound,
  LayoutDashboard,
  Settings,
  Users,
  Webhook,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const items = [
  { label: "Overview", href: "", icon: LayoutDashboard },
  { label: "API Keys", href: "/api-keys", icon: KeyRound },
  { label: "Webhooks", href: "/webhooks", icon: Webhook },
  { label: "Usage", href: "/usage", icon: BarChart3 },
  { label: "Members", href: "/members", icon: Users },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function DashboardSidebar({
  organizationPublicId,
}: {
  organizationPublicId: string;
}) {
  const pathname = usePathname();
  const base = `/dashboard/${organizationPublicId}`;

  return (
    <aside className="hidden w-64 shrink-0 border-r border-[var(--clay-hairline)] bg-[var(--clay-surface-soft)] p-4 md:block">
      <nav className="space-y-1">
        {items.map((item) => {
          const href = `${base}${item.href}`;
          const active = pathname === href;
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={href}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-[var(--clay-primary)] text-white"
                  : "text-[var(--clay-muted)] hover:bg-[var(--clay-surface-card)] hover:text-[var(--clay-primary)]"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
