import type React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Home, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

export function StatusPanel({
  icon: Icon,
  label,
  title,
  description,
  actions,
  className,
  iconClassName,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-xl flex-col items-center rounded-3xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] px-6 py-10 text-center sm:px-10 sm:py-12",
        className
      )}
    >
      <div className="grid size-14 place-items-center rounded-2xl bg-[var(--clay-brand-mint)] text-[var(--clay-primary)]">
        <Icon className={cn("size-7", iconClassName)} />
      </div>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--clay-muted)]">
        {label}
      </p>
      <h1 className="mt-3 text-3xl font-medium tracking-[-0.04em] text-[var(--clay-primary)] sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-[var(--clay-body)] sm:text-base">
        {description}
      </p>
      {actions ? (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function StatusLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        variant === "primary"
          ? "bg-[var(--clay-primary)] text-white hover:bg-[var(--clay-brand-teal)]"
          : "border border-[var(--clay-hairline)] bg-[var(--clay-canvas)] text-[var(--clay-primary)] hover:bg-[var(--clay-surface-soft)]"
      )}
    >
      {children}
    </Link>
  );
}

export function DefaultStatusActions() {
  return (
    <>
      <StatusLink href="/">
        <Home className="size-4" />
        홈으로
      </StatusLink>
      <StatusLink href="/settings" variant="secondary">
        <Settings className="size-4" />내 정보
      </StatusLink>
    </>
  );
}
