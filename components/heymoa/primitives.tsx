import React from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        "gap-0 rounded-2xl border border-[var(--el-hairline)] bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]",
        className
      )}
      {...props}
    >
      {children}
    </Card>
  );
}
