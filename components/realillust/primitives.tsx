import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { decisionMeta, type Decision } from "@/lib/mock-data";

export function PageSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8", className)}>
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
        "gap-0 py-0 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.12)]",
        className
      )}
    >
      {children}
    </Card>
  );
}

export function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta: string;
  icon: React.ElementType;
}) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-black/55">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.01em]">{value}</p>
          <p className="mt-2 text-sm font-medium text-[var(--cg-green-accent)]">{delta}</p>
        </div>
        <span className="grid size-11 place-items-center rounded-full bg-[var(--cg-mint)] text-[var(--cg-green)]">
          <Icon className="size-5" />
        </span>
      </div>
    </Panel>
  );
}

export function DecisionBadge({ decision }: { decision: Decision }) {
  const meta = decisionMeta[decision];
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full px-3 py-1 font-semibold", meta.tone)}
    >
      {meta.label}
    </Badge>
  );
}
