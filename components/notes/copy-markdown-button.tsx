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

/** 체크 표시가 남는 시간. 토스트가 사라진 뒤에도 버튼이 "방금 눌렸다"를 잠깐 들고 있는다. */
const COPIED_MS = 2_000;

/**
 * 전사·요약을 마크다운으로 클립보드에 넣는다.
 *
 * **문자열은 누를 때 만든다.** 진행 중인 회의에서는 전사가 계속 자라는데 렌더마다 미리
 * 조립하면 그 비용을 한 글자마다 낸다. `build`를 늦게 부르면 누른 순간의 화면이 그대로
 * 복사된다.
 *
 * 복사본은 지금 화면 언어로 만든다. `build` 가 그 언어(`doc`)를 받는다.
 */
export function CopyMarkdownButton({
  kind,
  build,
  disabled,
  iconOnly = false,
  className,
}: {
  /** 무엇을 복사하나. 노트 탭 이름(`notes.panel.tabs`)으로 번역해 토스트와 아이콘 버튼 이름에 넣는다. */
  kind: "transcript" | "summary" | "timeline";
  build: (doc: DocLanguage) => string;
  /** 아직 복사할 것이 확정되지 않았다. 숨기지 않는 이유는 자리가 흔들리기 때문이다. */
  disabled?: boolean;
  /** 섹션 머리처럼 이름이 바로 옆에 있는 자리. 아이콘만 서고 이름은 `○○ 복사` 로 읽힌다 */
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
      // 보안 컨텍스트가 아니거나 권한이 막히면 여기서 throw한다. 삼키면 사용자는 복사된
      // 줄 알고 빈 클립보드를 붙여넣는다.
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
