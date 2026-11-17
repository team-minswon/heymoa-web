import { ChevronDown, Loader2 } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LoadMoreButton({
  loading,
  loadingLabel,
  children,
  className,
  variant = "outline",
  size = "sm",
  ...props
}: Omit<ButtonProps, "loading"> & { loading: boolean; loadingLabel: string }) {
  const Icon = loading ? Loader2 : ChevronDown;
  return (
    <>
      <Button
        variant={variant}
        size={size}
        aria-busy={loading || undefined}
        disabled={loading}
        className={cn(
          "group/more rounded-full disabled:opacity-100 disabled:text-[var(--el-muted)]",
          className
        )}
        {...props}
      >
        {children}
        <Icon
          aria-hidden
          data-icon="inline-end"
          className={cn(
            loading
              ? "animate-spin"
              : "transition-transform duration-200 ease-out group-hover/more:translate-y-0.5 group-focus-visible/more:translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover/more:translate-y-0 motion-reduce:group-focus-visible/more:translate-y-0"
          )}
        />
      </Button>
      <span role="status" className="sr-only">
        {loading ? loadingLabel : ""}
      </span>
    </>
  );
}
