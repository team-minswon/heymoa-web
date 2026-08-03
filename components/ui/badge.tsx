import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-chip border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        // 틴트 배경과 글자색을 **다른 값**으로 둔다 — 같은 색을 쓰면 10% 틴트 위에서
        // 명암비가 AA에 못 미친다. `*-strong`이 그 글자색이다(globals.css).
        destructive:
          "bg-destructive/10 text-[var(--el-error-strong)] focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:text-destructive dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        // destructive와 같은 짜임. 솔리드 채움은 이 시스템에서 primary만 쓴다 —
        // 상태 칩이 버튼보다 강해지면 안 된다.
        success:
          "bg-[var(--el-success)]/10 text-[var(--el-success-strong)] focus-visible:ring-[var(--el-success)]/20 [a]:hover:bg-[var(--el-success)]/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
