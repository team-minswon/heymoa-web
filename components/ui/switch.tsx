"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

/**
 * 켜고 끄는 것. **저장이 즉시 일어나는 자리에만** 쓴다 — 저장 버튼이 따로 있는 폼에서는
 * 체크박스를 쓴다. 스위치는 「지금 바뀌었다」로 읽히기 때문이다.
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors outline-none",
        "bg-[var(--el-hairline-strong)] data-[checked]:bg-[var(--el-primary)]",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-white transition-transform data-[checked]:translate-x-[18px]"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
