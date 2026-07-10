import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PageSection({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8",
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function Panel({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        "gap-0 rounded-3xl border-0 py-0 shadow-none ring-1 ring-[var(--clay-hairline)]",
        className
      )}
      {...props}
    >
      {children}
    </Card>
  );
}
