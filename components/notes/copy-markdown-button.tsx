"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/lib/ui/toast";

/** 체크 표시가 남는 시간. 토스트가 사라진 뒤에도 버튼이 "방금 눌렸다"를 잠깐 들고 있는다. */
const COPIED_MS = 2_000;

/**
 * 전사·요약을 마크다운으로 클립보드에 넣는다.
 *
 * **문자열은 누를 때 만든다.** 진행 중인 회의에서는 전사가 계속 자라는데 렌더마다 미리
 * 조립하면 그 비용을 한 글자마다 낸다. `build`를 늦게 부르면 누른 순간의 화면이 그대로
 * 복사된다.
 */
export function CopyMarkdownButton({
  label,
  build,
  disabled,
  className,
}: {
  /** 토스트에 그대로 들어간다 — `전사`·`요약`. */
  label: string;
  build: () => string;
  /** 아직 복사할 것이 확정되지 않았다. 숨기지 않는 이유는 자리가 흔들리기 때문이다. */
  disabled?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      // 보안 컨텍스트가 아니거나 권한이 막히면 여기서 throw한다. 삼키면 사용자는 복사된
      // 줄 알고 빈 클립보드를 붙여넣는다.
      await navigator.clipboard.writeText(build());
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
      toast.success(`${label} 내용이 클립보드에 복사되었습니다.`, {
        id: `copy-${label}`,
      });
    } catch {
      toast.error("복사하지 못했습니다.", {
        id: `copy-${label}`,
        description: "브라우저가 클립보드 접근을 막았습니다.",
        action: { label: "다시 시도", onClick: () => void copy() },
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
            onClick={() => void copy()}
          >
            {copied ? <Check /> : <Copy />}
            복사
          </Button>
        }
      />
      <TooltipContent>마크다운으로 복사합니다</TooltipContent>
    </Tooltip>
  );
}
