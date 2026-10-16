"use client";

import { useState } from "react";
import { Copy, FileText, Mail, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MinutesExportDialog } from "@/components/notes/minutes/minutes-export-dialog";
import { track } from "@/lib/analytics/track";
import { renderExport, type ExportFormat } from "@/lib/notes/review/markdown";
import type { MinutesDocument, MinutesInclude } from "@/lib/notes/minutes/model";
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
 * 내보내기·공유 대상. **연결된 것만 메뉴에 세운다** — 아직 없는 대상(Word · Slack · Teams · Notion)을 「준비 중」으로
 * 늘어놓으면 쓸 수 있는 것이 그 사이에 묻혔다(APP-1108 이 틀로 두었던 것을 걷었다). 대상을 더할 때는 [target] 을
 * 이벤트 속성으로 그대로 쓰므로 영문 소문자 식별자로 둔다.
 */
const EXPORT_TARGETS = [
  { target: "pdf", label: "PDF로 내보내기", icon: FileText },
  // 발송 API 가 켜진 곳(onSendEmail 이 있을 때)에만 선다
  { target: "email", label: "이메일로 보내기", icon: Mail },
] as const;

/**
 * 요약 탭 머리의 복사 · 내보내기 · 공유. **문서는 누를 때 만든다** — 확정 전 요약은 계속 바뀌고, 렌더마다 미리
 * 조립하면 그 비용을 매번 낸다. [build] 가 마크다운 한 벌을 돌려주면 형식은 여기서 갈린다.
 */
export function ReviewActions({
  build,
  disabled,
  wider,
  material,
  onRetryMaterial,
  onSendEmail,
}: {
  build: () => string;
  /** 복사할 문서가 아직 없다. 숨기지 않는 이유는 자리가 흔들리기 때문이다. */
  disabled?: boolean;
  /**
   * 회의록 PDF. 요약 밖의 재료(녹취록 · 원장)까지 누를 때 읽어 오므로 비동기다. 없으면 PDF 를 열지 않는다 —
   * 왜 없는지는 [material] 이 말한다.
   */
  wider?: {
    minutes: (include: MinutesInclude) => Promise<MinutesDocument>;
  };
  /**
   * [wider] 가 아직 없는 까닭 — 녹취록을 받는 중이거나 받지 못했다. 둘 다 「준비 중」(기능이 없다)과 다르다:
   * 받는 중이면 PDF 를 막고, 못 받았으면 메뉴에서 다시 받는다. 없으면 기능이 없는 것이다
   */
  material?: "loading" | "failed";
  onRetryMaterial?: () => void;
  /** 「이메일로 보내기」를 연다. 없으면 그 항목은 다른 대상처럼 「준비 중」이다 */
  onSendEmail?: () => void;
}) {
  const [minutesOpen, setMinutesOpen] = useState(false);

  // 요약 탭은 요약만 복사한다 — 타임라인은 타임라인 탭, 녹취록은 스크립트 탭이 저마다 복사한다
  const copy = async (format: ExportFormat) => {
    try {
      await copyText(renderExport(format, build()));
      track("summary_copied", { format, scope: "summary" });
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
          {EXPORT_TARGETS.filter(({ target }) => target !== "email" || onSendEmail !== undefined).map(
            ({ target, label, icon: Icon }) => {
              // PDF 와 메일은 같은 회의록 재료를 쓰므로 녹취록이 와야 연다. 노트 머리조차 안 왔으면 받는 중과 같다
              const ready = wider !== undefined;
              const waiting = ready ? undefined : (material ?? "loading");
              return (
                <DropdownMenuItem
                  key={target}
                  // 요약이 아직 없으면 회의록 본문이 빈다 — 복사와 같이 막는다. 녹취록을 받는 중이어도 막는다
                  disabled={(ready && disabled) || waiting === "loading"}
                  onClick={() => {
                    track("export_requested", { target });
                    if (ready) {
                      if (target === "pdf") setMinutesOpen(true);
                      else onSendEmail?.();
                    } else if (waiting === "failed") {
                      onRetryMaterial?.();
                      toast.info("녹취록을 다시 불러옵니다. 잠시 후 다시 눌러 주세요.", { id: "export-material" });
                    }
                  }}
                >
                  <Icon aria-hidden />
                  <span className="flex-1 whitespace-nowrap">{label}</span>
                  {waiting ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {waiting === "loading" ? "불러오는 중" : "다시 불러오기"}
                    </span>
                  ) : null}
                </DropdownMenuItem>
              );
            }
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {wider ? (
        <MinutesExportDialog open={minutesOpen} onOpenChange={setMinutesOpen} build={wider.minutes} />
      ) : null}
    </div>
  );
}
