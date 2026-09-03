import * as React from "react";
import Link from "next/link";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-control border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none cursor-pointer focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        // 글자색이 배경 틴트와 다른 값이다 — 같은 `--el-error`를 둘 다 쓰면 10% 틴트 위에서
        // 명암비 4.13:1로 AA(4.5:1)에 못 미친다. `--el-error-strong`이 그 글자색이다.
        destructive:
          "bg-destructive/10 text-[var(--el-error-strong)] hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:text-destructive dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-control px-2 text-xs in-data-[slot=button-group]:rounded-control has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-control px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-control has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xl: "h-10 gap-2 px-4",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-control in-data-[slot=button-group]:rounded-control [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-control in-data-[slot=button-group]:rounded-control",
        "icon-lg": "size-9",
        "icon-xl": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends ButtonPrimitive.Props, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

/**
 * children을 감싸는 래퍼라 아이콘과 라벨은 버튼이 아니라 이 span의 flex 아이템이다 —
 * 버튼의 gap이 여기까지 내려오지 않으면 둘이 붙는다. `gap-inherit`은 Tailwind에 없는
 * 클래스라 계산값이 `normal`(0)이었다. 임의 속성으로 실제 상속시킨다.
 */
function ButtonLabel({
  hidden,
  children,
}: {
  hidden?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center [gap:inherit]",
        hidden && "opacity-0 pointer-events-none"
      )}
    >
      {children}
    </span>
  );
}

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading ? "" : undefined}
      aria-busy={loading || undefined}
      disabled={Boolean(disabled || loading)}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      <ButtonLabel hidden={loading}>{children}</ButtonLabel>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-4 animate-spin" />
        </span>
      )}
    </ButtonPrimitive>
  );
}

/**
 * 이동하는 CTA. `Button`에 `render={<Link/>}`를 주면 base-ui가 「앵커인데 nativeButton이
 * 참이다」라고 dev 경고를 내고, 그 경고를 끄려고 `nativeButton={false}`를 주면 이번엔
 * 앵커에 `role="button"`이 붙어 링크가 링크로 안 읽힌다. **이동은 링크다** — primitive를
 * 안 거치고 클래스만 쓴다.
 *
 * children 구조는 `Button`과 같다(같은 `ButtonLabel`). 옆 자리의 로딩 자리표시가 공용
 * `Button`이라 래퍼가 다르면 폭이 어긋난다.
 */
function LinkButton({
  className,
  variant,
  size,
  children,
  ...props
}: React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return (
    <Link
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      <ButtonLabel>{children}</ButtonLabel>
    </Link>
  );
}

export { Button, LinkButton, buttonVariants };
