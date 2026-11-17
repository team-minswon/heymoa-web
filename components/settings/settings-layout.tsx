import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function SettingsHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const heading = (
    <>
      <h2 className="flex items-center gap-1.5 text-3xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-sm text-[var(--el-muted)]">{description}</p>
      ) : null}
    </>
  );
  return action ? (
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>{heading}</div>
      {action}
    </header>
  ) : (
    <header className="mb-8">{heading}</header>
  );
}

export const SETTINGS_LIST =
  "divide-y divide-[var(--el-hairline)] overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-white";
export const SETTINGS_LIST_ROW =
  "flex min-h-[52px] items-center gap-3 px-4 py-2.5";

export const SETTINGS_CARD =
  "rounded-panel border border-[var(--el-hairline)] bg-white p-4";
export const SETTINGS_CARD_ICON =
  "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-control";

export function SkeletonLine({
  size = "sm",
  className,
}: {
  size?: "sm" | "xs";
  className?: string;
}) {
  return (
    <span className={cn("flex items-center", size === "sm" ? "h-5" : "h-4")}>
      <Skeleton
        className={cn(size === "sm" ? "h-3.5" : "h-3", "w-24", className)}
      />
    </span>
  );
}

export function SkeletonCardIcon() {
  return <Skeleton className={cn(SETTINGS_CARD_ICON, "rounded-control")} />;
}
