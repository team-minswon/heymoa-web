import { PersonAvatar } from "@/components/heymoa/person-avatar";
import type { ResolveSpeaker } from "@/components/notes/review/item-trail";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import type { Quote } from "@/lib/notes/review/moments";
import { formatOffset } from "@/lib/transcription/presentation";
import { cn } from "@/lib/utils";

/**
 * 근거 발언(APP-865). 이 항목이 인용한 줄은 먹색, 그 앞 맥락 줄은 회색으로 화자 · 때와 함께 선다.
 * 줄을 누르면 스크립트의 그 줄로 간다. 전사가 오는 중이거나 실패했는데 「발언이 없다」고 말하면 없는
 * 것처럼 읽히므로 따로 그린다.
 */
export function EvidenceQuotes({
  quotes,
  authored,
  scriptState,
  onRetryScript,
  resolveSpeaker,
  onOpenScript,
}: {
  quotes: readonly Quote[];
  /** 사람이 검토에서 더한 항목. 회의 중 발언이 원래 없다 */
  authored: boolean;
  scriptState: "pending" | "ready" | "failed";
  onRetryScript: () => void;
  resolveSpeaker: ResolveSpeaker;
  onOpenScript: (segmentId: string) => void;
}) {
  if (scriptState === "pending") {
    return (
      <div aria-label="근거 발언 불러오는 중" className="flex flex-col gap-2.5 rounded-[10px] border border-[var(--el-hairline)] px-3.5 py-3">
        {["72%", "56%"].map((width) => (
          <Skeleton key={width} className="h-4 rounded-chip" style={{ width }} />
        ))}
      </div>
    );
  }
  if (scriptState === "failed") {
    return (
      <InlineRetry
        variant="line"
        label="스크립트를 불러오지 못해 근거 발언을 보일 수 없습니다."
        onRetry={onRetryScript}
        className="text-xs text-[var(--el-muted)]"
      />
    );
  }
  if (quotes.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--el-muted)]">
        {authored ? "직접 추가한 항목이라 회의 중 발언이 없습니다." : "인용한 발언을 스크립트에서 찾지 못했습니다."}
      </p>
    );
  }

  return (
    <ul aria-label="근거 발언" className="flex flex-col gap-1 rounded-[10px] border border-[var(--el-hairline)] px-2 py-1.5">
      {quotes.map(({ segment, cited }) => {
        const speaker = resolveSpeaker(segment.speakerLabel, segment.assignedParticipantId);
        return (
          <li key={segment.segmentId}>
            <button
              type="button"
              onClick={() => onOpenScript(segment.segmentId)}
              className="grid w-full grid-cols-[20px_minmax(0,1fr)] gap-x-2.5 rounded-control px-1.5 py-1.5 text-left hover:bg-[var(--el-canvas-soft)] focus-visible:outline-2 focus-visible:outline-[var(--el-ink)]"
            >
              <span className="pt-0.5">
                {speaker ? <PersonAvatar name={speaker.avatarName} image={speaker.imageUrl} size={20} /> : null}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[12.5px] leading-5 text-[var(--el-muted-soft)]">
                  <span className="font-medium text-[var(--el-body)]">{speaker?.displayName ?? "화자 없음"}</span>
                  {" · "}
                  <span className="tabular-nums">{formatOffset(segment.startedAtMs)}</span>
                </span>
                <span
                  className={cn(
                    "text-sm leading-[22px] break-keep",
                    cited ? "text-[var(--el-ink)]" : "text-[var(--el-muted)]"
                  )}
                >
                  {segment.text}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
