import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";

import { objectParticle } from "@/components/settings/confirm-phrase-field";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/ui/copy-text";
import { toast } from "@/lib/ui/toast";

export function CopyBlock({
  label,
  value,
  inline = false,
  text,
}: {
  label: string;
  value: string;
  inline?: boolean;
  text?: { copy: string; copied: string; failed: string };
}) {
  const t = useTranslations("common");
  const words = text ?? {
    copy: t("copyBlock.copy", { label }),
    copied: t("copyBlock.copied", { label, particle: objectParticle(label) }),
    failed: t("copyBlock.failed"),
  };
  const copy = () => {
    void copyText(value)
      .then(() => toast.success(words.copied))
      .catch(() => toast.error(words.failed));
  };
  if (inline) {
    return (
      <div className="flex items-center gap-2 rounded-block bg-[var(--el-canvas-soft)] py-2 pr-2 pl-3.5">
        <pre className="min-w-0 flex-1 font-mono text-xs whitespace-pre-wrap break-words text-[var(--el-ink)]">
          {value}
        </pre>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-[var(--el-muted)] hover:text-[var(--el-ink)]"
          aria-label={words.copy}
          onClick={copy}
        >
          <Copy className="size-3.5" />
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--el-muted)]">{label}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          aria-label={words.copy}
          onClick={copy}
        >
          <Copy className="size-3.5" />
          {t("actions.copy")}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-block bg-[var(--el-canvas-soft)] p-3 font-mono text-xs whitespace-pre-wrap break-all text-[var(--el-ink)]">
        {value}
      </pre>
    </div>
  );
}
