"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DocLanguage } from "@/lib/i18n/translator";
import { useDocLanguage } from "@/lib/i18n/use-doc-language";
import { copyText } from "@/lib/ui/copy-text";
import { toast } from "@/lib/ui/toast";

const COPIED_MS = 2_000;

export function CopyMarkdownButton({
  kind,
  build,
  disabled,
  iconOnly = false,
  className,
}: {
  kind: "transcript" | "summary" | "timeline";
  build: (doc: DocLanguage) => string;
  disabled?: boolean;
  iconOnly?: boolean;
  className?: string;
}) {
  const t = useTranslations("notes.copy");
  const tActions = useTranslations("common.actions");
  const tTabs = useTranslations("notes.panel.tabs");
  const label = tTabs(kind);
  const doc = useDocLanguage();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      // 보안 컨텍스트가 아니거나 권한이 막히면 클립보드 API 가 throw 한다. 삼키면 사용자는 빈 클립보드를 붙여넣는다.
      await copyText(build(doc));
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
      toast.success(t("copied", { label }), {
        id: `copy-${kind}`,
      });
    } catch {
      toast.error(t("failed"), {
        id: `copy-${kind}`,
        description: t("blocked"),
        action: { label: tActions("retry"), onClick: () => void copy() },
      });
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={className}
            disabled={disabled}
            aria-label={iconOnly ? t("iconLabel", { label }) : undefined}
            onClick={() => void copy()}
          >
            {copied ? <Check /> : <Copy />}
            {iconOnly ? null : t("button")}
          </Button>
        }
      />
      <TooltipContent>{t("tooltip")}</TooltipContent>
    </Tooltip>
  );
}
