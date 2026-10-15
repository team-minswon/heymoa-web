"use client";

import { Copy, FileText, Mail, Share2, FileType2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { track } from "@/lib/analytics/track";
import { renderExport, type ExportFormat } from "@/lib/notes/review/markdown";
import { copyText } from "@/lib/ui/copy-text";
import { toast } from "@/lib/ui/toast";

const COPY_FORMATS: ReadonlyArray<{
  format: ExportFormat;
  label: string;
  hint: string;
}> = [
  { format: "text", label: "텍스트로 복사", hint: "기호 없이 글만 복사합니다" },
  {
    format: "markdown",
    label: "마크다운(.md)으로 복사",
    hint: "Notion·Obsidian·LLM에 잘 맞는 형식입니다",
  },
];

/**
 * 아직 연결되지 않은 내보내기·공유 대상. **틀만 있다**(APP-1108) — 누르면 「준비 중」을 알리고 수요만 센다.
 * 대상을 더할 때는 [target] 을 이벤트 속성으로 그대로 쓰므로 영문 소문자 식별자로 둔다.
 */
const EXPORT_TARGETS = [
  { group: "파일로 내보내기", items: [
    { target: "pdf", label: "PDF로 내보내기", icon: FileText },
    { target: "word", label: "Word로 내보내기", icon: FileType2 },
    { target: "email", label: "이메일로 보내기", icon: Mail },
  ] },
  { group: "공유하기", items: [
    { target: "slack", label: "Slack으로 공유하기", icon: Share2 },
    { target: "teams", label: "Microsoft Teams에 공유하기", icon: Share2 },
    { target: "notion", label: "Notion에 저장하기", icon: Share2 },
  ] },
] as const;

/**
 * 요약 탭 머리의 복사 · 내보내기 · 공유. **문서는 누를 때 만든다** — 확정 전 요약은 계속 바뀌고, 렌더마다 미리
 * 조립하면 그 비용을 매번 낸다. [build] 가 마크다운 한 벌을 돌려주면 형식은 여기서 갈린다.
 */
export function ReviewActions({
  build,
  disabled,
}: {
  build: () => string;
  /** 복사할 문서가 아직 없다. 숨기지 않는 이유는 자리가 흔들리기 때문이다. */
  disabled?: boolean;
}) {
  const copy = async (format: ExportFormat) => {
    try {
      await copyText(renderExport(format, build()));
      track("summary_copied", { format });
      toast.success("요약이 클립보드에 복사되었습니다.", { id: "copy-summary" });
    } catch {
      toast.error("복사하지 못했습니다.", {
        id: "copy-summary",
        description: "브라우저가 클립보드 접근을 막았습니다.",
        action: { label: "다시 시도", onClick: () => void copy(format) },
      });
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              // 옆 전환 컨트롤(보기)이 32px 알약이라 높이와 모서리를 맞춘다 — 낮은 네모 버튼이 같은 줄에서 따로 놀았다.
              className="h-8 rounded-full px-3"
              disabled={disabled}
              aria-label="요약 복사"
            />
          }
        >
          <Copy aria-hidden />
          <span className="hidden sm:inline">복사</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {COPY_FORMATS.map(({ format, label, hint }) => (
            <DropdownMenuItem
              key={format}
              className="flex-col items-start gap-0 py-1.5"
              onClick={() => void copy(format)}
            >
              <span className="font-medium">{label}</span>
              <span className="text-xs text-muted-foreground">{hint}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              // 옆 전환 컨트롤(보기)이 32px 알약이라 높이와 모서리를 맞춘다 — 낮은 네모 버튼이 같은 줄에서 따로 놀았다.
              className="h-8 rounded-full px-3"
              aria-label="내보내기·공유"
            />
          }
        >
          <Share2 aria-hidden />
          <span className="hidden sm:inline">공유하기</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {EXPORT_TARGETS.map(({ group, items }, index) => (
            <div key={group}>
              {index > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuGroup>
                <DropdownMenuLabel>{group}</DropdownMenuLabel>
                {items.map(({ target, label, icon: Icon }) => (
                  <DropdownMenuItem
                    key={target}
                    onClick={() => {
                      track("export_requested", { target });
                      toast.info(`${label}는 준비 중입니다.`, { id: "export-soon" });
                    }}
                  >
                    <Icon aria-hidden />
                    <span className="flex-1 whitespace-nowrap">{label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">준비 중</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
