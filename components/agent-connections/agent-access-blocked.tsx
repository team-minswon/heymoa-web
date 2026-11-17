import { Info } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const AGENT_ACCESS_DISABLED = "AGENT_ACCESS_DISABLED";

export function useWorkspaceOptionLabel() {
  const t = useTranslations("agents.blocked");
  return (workspace: { name: string; agentAccessAllowed?: boolean }) =>
    workspace.agentAccessAllowed === false
      ? t("name", { name: workspace.name })
      : workspace.name;
}

export function AgentAccessBlockedNotice({
  onRecheck,
  rechecking,
  className,
}: {
  onRecheck: () => void;
  rechecking: boolean;
  className?: string;
}) {
  const t = useTranslations("agents.blocked");
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-3.5 text-left text-xs",
        className
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]" />
      <div className="min-w-0 flex-1">
        <p className="leading-relaxed text-[var(--el-muted)]">
          {t("message")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-[30px]"
          loading={rechecking}
          disabled={rechecking}
          onClick={onRecheck}
        >
          {t("recheck")}
        </Button>
      </div>
    </div>
  );
}
