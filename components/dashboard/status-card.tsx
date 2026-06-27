import { Card, CardContent } from "@/components/ui/card";

export function StatusCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <Card className="rounded-xl border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-5 shadow-none ring-0">
      <CardContent className="p-0">
        <p className="text-sm font-semibold text-[var(--clay-muted)]">{label}</p>
        <p className="mt-2 break-words text-2xl font-semibold">{value}</p>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-[var(--clay-muted)]">
            {description}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
