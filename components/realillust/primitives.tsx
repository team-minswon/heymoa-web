import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PageSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8",
        className
      )}
    >
      {children}
    </section>
  );
}

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "gap-0 rounded-3xl border-0 py-0 shadow-none ring-1 ring-[var(--clay-hairline)]",
        className
      )}
    >
      {children}
    </Card>
  );
}
