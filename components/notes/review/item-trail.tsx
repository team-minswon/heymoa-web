"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { Collapse } from "@/components/heymoa/collapse";
import { PersonAvatar } from "@/components/heymoa/person-avatar";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import { okData } from "@/lib/api/ok-data";
import type { TranscriptResponseDataSegmentsItem } from "@/lib/api/generated/models";
import { useGetProposalRevisions } from "@/lib/api/generated/proposals/proposals";
import type { ReviewItem } from "@/lib/notes/review/sections";
import { CITATION_ROLE_LABEL, trailOf, type TrailStep } from "@/lib/notes/review/trail";
import { formatOffset } from "@/lib/transcription/presentation";
import type { SpeakerIdentity } from "@/lib/transcription/speaker-identity";
import { cn } from "@/lib/utils";

export type ResolveSpeaker = (
  label: string | null,
  participantId: string | null
) => SpeakerIdentity | null;

/**
 * 수정 기록 → 스크립트. 회의 중에 이 항목이 어떻게 생기고 바뀌었는지를 최근 것부터 세우고,
 * 단계를 펼치면 그 말이 나온 스크립트 줄이 앞뒤 한 줄과 함께 선다. 줄을 누르면 스크립트 탭의 그 줄로 간다.
 */
export function ItemTrail({
  noteId,
  item,
  segments,
  scriptState = "ready",
  onRetryScript,
  resolveSpeaker,
  onOpenScript,
}: {
  noteId: string;
  item: ReviewItem;
  segments: readonly TranscriptResponseDataSegmentsItem[];
  /** 스크립트 조회 상태. 오는 중이거나 실패했는데 단계마다 「스크립트 없음」이라 적으면 없는 것처럼 읽힌다 */
  scriptState?: "pending" | "ready" | "failed";
  onRetryScript?: () => void;
  resolveSpeaker: ResolveSpeaker;
  onOpenScript: (segmentId: string) => void;
}) {
  const proposalId = item.originalProposalRef?.proposalId ?? "";
  const revisionsQuery = useGetProposalRevisions(noteId, proposalId, {
    query: { enabled: Boolean(proposalId) },
  });
  const revisions = okData(revisionsQuery.data)?.revisions ?? null;

  const steps = useMemo(
    () =>
      trailOf({
        revisions: revisions ?? [],
        segments,
        currentContent: item.content,
        edited: item.edited,
      }),
    [revisions, segments, item.content, item.edited]
  );
  const firstScript = steps.find((step) => step.lines.length > 0);
  const [openKeys, setOpenKeys] = useState<Set<string> | null>(null);
  const opened = openKeys ?? new Set(firstScript ? [firstScript.key] : []);
  const allOpen = steps.every((step) => step.lines.length === 0 || opened.has(step.key));

  const toggle = (key: string) =>
    setOpenKeys(() => {
      const next = new Set(opened);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (!proposalId) {
    return (
      <TrailHeader count={steps.length}>
        <p className="py-1 text-[12.5px] text-[var(--el-muted)]">
          직접 추가한 항목이라 회의 중 기록이 없습니다.
        </p>
      </TrailHeader>
    );
  }

  if (revisionsQuery.isLoading || scriptState === "pending") {
    return (
      <TrailHeader>
        <div aria-label="수정 기록 불러오는 중" className="space-y-2 py-1">
          {["72%", "58%", "64%"].map((width) => (
            <Skeleton key={width} className="h-9 rounded-control" style={{ width }} />
          ))}
        </div>
      </TrailHeader>
    );
  }

  // 스크립트를 못 읽었는데 단계를 그리면 단계마다 「스크립트 없음」이라 적혀 없는 것처럼 읽힌다.
  if (scriptState === "failed" && onRetryScript) {
    return (
      <TrailHeader count={revisions ? steps.length : undefined}>
        <InlineRetry
          variant="line"
          label="스크립트를 불러오지 못했습니다."
          onRetry={onRetryScript}
          className="py-1 text-[12.5px] text-[var(--el-muted)]"
        />
      </TrailHeader>
    );
  }

  if (!revisions) {
    return (
      <TrailHeader>
        <InlineRetry
          variant="line"
          label="수정 기록을 불러오지 못했습니다."
          onRetry={() => void revisionsQuery.refetch()}
          className="py-1 text-[12.5px] text-[var(--el-muted)]"
        />
      </TrailHeader>
    );
  }

  return (
    <TrailHeader
      count={steps.length}
      actions={
        <>
          <button
            type="button"
            className="text-xs text-[var(--el-muted)] hover:text-[var(--el-ink)]"
            onClick={() =>
              setOpenKeys(allOpen ? new Set() : new Set(steps.map((step) => step.key)))
            }
          >
            {allOpen ? "모두 접기" : "모두 펼치기"}
          </button>
          {firstScript ? (
            <button
              type="button"
              className="text-xs text-[var(--el-ink)] underline underline-offset-[3px]"
              onClick={() => onOpenScript(firstScript.lines.find((line) => line.role)?.segmentId ?? firstScript.lines[0].segmentId)}
            >
              스크립트에서 열기
            </button>
          ) : null}
        </>
      }
    >
      <ol>
        {steps.map((step) => (
          <TrailNode
            key={step.key}
            step={step}
            open={opened.has(step.key)}
            onToggle={() => toggle(step.key)}
            resolveSpeaker={resolveSpeaker}
            onOpenScript={onOpenScript}
          />
        ))}
      </ol>
    </TrailHeader>
  );
}

function TrailHeader({
  count,
  actions,
  children,
}: {
  count?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <b className="text-[12.5px] font-semibold text-[var(--el-ink)]">수정 기록</b>
        {count ? <span className="font-mono text-[11px] text-[var(--el-muted-soft)]">{count}</span> : null}
        {actions ? <span className="ml-auto flex items-baseline gap-3">{actions}</span> : null}
      </div>
      {children}
    </div>
  );
}

function TrailNode({
  step,
  open,
  onToggle,
  resolveSpeaker,
  onOpenScript,
}: {
  step: TrailStep;
  open: boolean;
  onToggle: () => void;
  resolveSpeaker: ResolveSpeaker;
  onOpenScript: (segmentId: string) => void;
}) {
  const hasScript = step.lines.length > 0;
  return (
    <li className="border-t border-[var(--el-hairline-soft)] first:border-t-0">
      <button
        type="button"
        disabled={!hasScript}
        aria-expanded={hasScript ? open : undefined}
        onClick={onToggle}
        className={cn(
          "grid w-full grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-x-2 px-2 py-2.5 text-left transition-colors duration-200 ease-out disabled:cursor-default",
          open && hasScript ? "rounded-t-control bg-[var(--el-canvas-soft)]" : "rounded-control hover:bg-[var(--el-canvas-soft)]"
        )}
      >
        <span aria-hidden className="flex size-[18px] items-center justify-center text-[var(--el-muted-soft)]">
          {hasScript ? (
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none",
                open ? "text-[var(--el-ink)]" : "-rotate-90"
              )}
            />
          ) : (
            <span className="size-1.5 rounded-full bg-[var(--el-hairline-strong)]" />
          )}
        </span>
        <span className="min-w-0">
          <b className="block text-[12.5px] font-semibold text-[var(--el-ink)]">{step.label}</b>
          <span className="mt-0.5 block text-[13.5px] leading-5 break-keep text-[var(--el-ink)]">
            {step.content}
          </span>
        </span>
        <span className="flex items-baseline gap-3 pt-px text-[11.5px] whitespace-nowrap text-[var(--el-muted)]">
          {hasScript ? `스크립트 ${step.lines.length}줄` : "스크립트 없음"}
          {step.startedAtMs !== null ? (
            <span className="font-mono text-[10.5px] text-[var(--el-muted-soft)]">
              {formatOffset(step.startedAtMs)}
            </span>
          ) : null}
        </span>
      </button>
      {hasScript ? (
        <Collapse open={open} lazy>
          <div className="relative rounded-b-control bg-[var(--el-canvas-soft)] pt-1 pr-2 pb-2.5 pl-[34px] before:absolute before:top-0 before:bottom-3.5 before:left-4 before:w-px before:bg-[var(--el-hairline-strong)]">
            <p className="relative pt-0.5 pb-1 text-[11.5px] font-semibold text-[var(--el-body)] before:absolute before:top-2.5 before:-left-[18px] before:h-px before:w-3 before:bg-[var(--el-hairline-strong)]">
              스크립트
            </p>
            <ul className="space-y-0.5">
              {step.lines.map((line) => {
                const speaker = resolveSpeaker(line.speakerLabel, line.assignedParticipantId);
                const role = line.role ? CITATION_ROLE_LABEL[line.role] : undefined;
                return (
                  <li key={line.segmentId}>
                    <button
                      type="button"
                      onClick={() => onOpenScript(line.segmentId)}
                      className="grid w-full grid-cols-[56px_minmax(0,1fr)] items-start gap-x-2.5 rounded-chip bg-[var(--el-surface-card)] px-2.5 py-1 text-left hover:bg-[var(--el-surface-strong)] sm:grid-cols-[56px_96px_minmax(0,1fr)]"
                    >
                      <span className="pt-[3px] font-mono text-[10.5px] text-[var(--el-muted-soft)]">
                        {formatOffset(line.startedAtMs)}
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5 pt-0.5 text-[11.5px] font-medium text-[var(--el-muted)] max-sm:hidden">
                        {speaker ? <PersonAvatar name={speaker.avatarName} size={16} /> : null}
                        <span className="truncate">{speaker?.displayName ?? "화자 없음"}</span>
                      </span>
                      <span
                        className={cn(
                          "text-[13.5px] leading-[21px] break-keep",
                          line.role ? "text-[var(--el-ink)]" : "text-[var(--el-muted)]"
                        )}
                      >
                        {line.role ? (
                          <mark className="bg-[linear-gradient(to_top,var(--el-highlight)_0.62em,transparent_0.62em)] bg-transparent text-inherit [box-decoration-break:clone]">
                            {line.text}
                          </mark>
                        ) : (
                          line.text
                        )}
                        {role ? (
                          <span className="ml-1.5 inline-flex h-[17px] items-center rounded-[5px] border border-[var(--el-ink)] bg-[var(--el-surface-card)] px-1.5 align-[1px] text-[10.5px] font-medium whitespace-nowrap text-[var(--el-ink)]">
                            {role}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </Collapse>
      ) : null}
    </li>
  );
}
