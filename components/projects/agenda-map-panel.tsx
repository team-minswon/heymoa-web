"use client";

import { track } from "@/lib/analytics/track";
import { useState } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getGetMeetingReviewSummaryQueryOptions,
  useGetMeetingReviewSummary,
} from "@/lib/api/generated/meeting-review/meeting-review";
import type { MeetingReviewSummaryResponseDataAgendasItem } from "@/lib/api/generated/models";
import { okData } from "@/lib/api/ok-data";
import {
  meetingHeading,
  shortMeetingDate,
  type AgendaMap,
  type MapAgenda,
  type TopicRow,
} from "@/lib/projects/agenda-map";
import { cn } from "@/lib/utils";

/**
 * 고른 것. 안건을 고르면 그 안건이 든 주제 전체(갈래 포함)가 강조된다. 주소의 `?topic=` 으로 열면 안건 없이 주제만 고른다.
 */
export type Selection = {
  rowId: string | null;
  agendaId: string | null;
} | null;
export type Tab = "agenda" | "flow";

export const summaryHref = (workspaceId: string, noteId: string, agendaId?: string) =>
  `/w/${workspaceId}/notes/${noteId}?view=full&tab=summary${agendaId ? `#summary-agenda-${agendaId}` : ""}`;

/** 주제 하나가 이보다 길면 가운데를 접는다. 앞 `HEAD` 개와 뒤 `TAIL` 개만 보인다 */
const LONG_TOPIC = 7;
const HEAD = 2;
const TAIL = 3;

/** 오른쪽 사이드 탭. 「안건」은 고른 안건의 내용과 앞뒤 안건, 「흐름」은 고른 주제의 안건 순서(갈래 포함) */
export function SidePanel({
  workspaceId,
  map,
  rows,
  topicOf,
  rowOfAgenda,
  selection,
  siblings,
  tab,
  onTab,
  onPick,
  onClose,
  onFocusTopic,
}: {
  workspaceId: string;
  map: AgendaMap;
  rows: TopicRow[];
  topicOf: Map<string, string>;
  rowOfAgenda: Map<string, TopicRow>;
  selection: NonNullable<Selection>;
  /** 고른 안건과 같은 회의·같은 줄기에서 다룬 안건(고른 것 포함). 둘 이상이면 목록으로 보인다 */
  siblings: MapAgenda[];
  tab: Tab;
  onTab: (next: Tab) => void;
  onPick: (agenda: MapAgenda) => void;
  onClose: () => void;
  /** 이 줄기 하나를 크게 보는 포커스 화면으로 */
  onFocusTopic: () => void;
}) {
  const agenda = selection.agendaId ? map.agendaById.get(selection.agendaId) : undefined;
  const topic = selection.rowId ? topicOf.get(selection.rowId) : undefined;
  const topicRowsOf = topic ? rows.filter((row) => topicOf.get(row.id) === topic) : [];
  const main = topicRowsOf.find((row) => !row.branchOf);

  return (
    <aside
      aria-label="고른 안건"
      className="relative flex min-w-0 flex-col rounded-block border border-[var(--el-hairline)] bg-[var(--el-surface-card)] lg:sticky lg:top-4 lg:max-h-[calc(100vh-120px)] lg:self-start"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="닫기"
        title="닫기"
        onClick={onClose}
        className="absolute top-1.5 right-2 z-10 text-[var(--el-muted)]"
      >
        <X aria-hidden className="size-4" />
      </Button>
      <Tabs value={tab} onValueChange={(value) => onTab(value as Tab)} className="min-h-0 gap-0">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--el-hairline)] pr-14 pl-4">
          {/* 위쪽 「노트 | 연결 지도」 탭과 같은 밑줄 탭. 밑줄은 머리의 아래 선 바로 위에 앉는다(공용 탭의 기본 -5px 는 40px 줄에서 선 아래로 떠 보인다) */}
          <TabsList variant="line" aria-label="고른 안건 보기" className="gap-5 p-0 group-data-horizontal/tabs:h-10">
            <TabsTrigger value="agenda" disabled={!agenda} className="flex-none px-0 text-[13px] group-data-horizontal/tabs:after:bottom-[-1px]">
              안건
            </TabsTrigger>
            <TabsTrigger value="flow" disabled={!main} className="flex-none px-0 text-[13px] group-data-horizontal/tabs:after:bottom-[-1px]">
              흐름
            </TabsTrigger>
          </TabsList>
          {main ? (
            <Button type="button" size="sm" onClick={onFocusTopic} className="shrink-0 whitespace-nowrap">
              이 줄기 크게 보기
              <ArrowRight aria-hidden data-icon="inline-end" />
            </Button>
          ) : null}
        </div>
        <div className="min-h-0 overflow-y-auto p-4">
          <TabsContent value="agenda">
            {siblings.length > 1 ? (
              <div className="mb-4 flex flex-col gap-2 border-b border-[var(--el-hairline)] pb-4">
                <h4 className="text-xs font-semibold text-[var(--el-muted)]">
                  이 회의에서 이어서 다룬 안건 {siblings.length}개
                </h4>
                <ol className="flex flex-col gap-1">
                  {siblings.map((sibling, at) => (
                    <li key={sibling.agendaId} className="flex items-baseline gap-2">
                      <span className="w-3 shrink-0 text-xs text-[var(--el-muted)] tabular-nums">{at + 1}</span>
                      <button
                        type="button"
                        aria-pressed={sibling.agendaId === agenda?.agendaId}
                        onClick={() => onPick(sibling)}
                        className={cn(
                          "min-w-0 text-left text-[13px] text-[var(--el-ink)] hover:underline",
                          sibling.agendaId === agenda?.agendaId && "font-semibold"
                        )}
                      >
                        {sibling.title}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            {agenda ? (
              <AgendaDetail
                key={agenda.agendaId}
                workspaceId={workspaceId}
                map={map}
                agenda={agenda}
                rowOfAgenda={rowOfAgenda}
                siblings={siblings}
                onPick={onPick}
              />
            ) : null}
          </TabsContent>
          <TabsContent value="flow">
            {main ? (
              <TopicFlow
                key={main.id}
                map={map}
                rows={topicRowsOf}
                main={main}
                picked={selection.agendaId}
                onPick={onPick}
              />
            ) : null}
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  );
}

const MEMBER_NAME: Record<string, string> = {
  DECISION: "결정",
  ACTION_ITEM: "할 일",
  ISSUE: "이슈",
  QUESTION: "질문",
};

/**
 * 고른 안건의 내용. 회의록 요약의 그 안건(한 줄 요약 · 결정·할 일 개수 · 결론 · 남은 질문)과 앞뒤 안건이다. 다음 안건이
 * 둘 이상이면 여기서 갈라진 것이라, 갈래마다 다음 안건의 한 줄 요약을 나란히 둔다.
 */
function AgendaDetail({
  workspaceId,
  map,
  agenda,
  rowOfAgenda,
  siblings,
  onPick,
}: {
  workspaceId: string;
  map: AgendaMap;
  agenda: MapAgenda;
  rowOfAgenda: Map<string, TopicRow>;
  /** 같은 회의·같은 줄기에서 다룬 안건(고른 것 포함). 위 목록에 이미 있는 안건은 앞뒤 안건에 다시 적지 않는다 */
  siblings: MapAgenda[];
  onPick: (agenda: MapAgenda) => void;
}) {
  const meeting = map.meetings.find((candidate) => candidate.noteId === agenda.noteId)!;
  const summaryQuery = useGetMeetingReviewSummary(agenda.noteId);
  const item = okData(summaryQuery.data)?.agendas.find((candidate) => candidate.agendaId === agenda.agendaId);
  // 같은 칸에 든 안건은 위 「이어서 다룬 안건」 목록이 이미 보인다 — 앞뒤 안건에서는 뺀다(같은 안건을 두 번 보이지 않는다)
  const listed = new Set(siblings.length > 1 ? siblings.map((sibling) => sibling.agendaId) : []);
  const previous = map.links
    .filter((link) => link.to === agenda.agendaId)
    .map((link) => map.agendaById.get(link.from)!)
    .filter((candidate) => !listed.has(candidate.agendaId));
  const next = map.links
    .filter((link) => link.from === agenda.agendaId)
    .map((link) => map.agendaById.get(link.to)!)
    .filter((candidate) => !listed.has(candidate.agendaId));
  // 다음 안건들의 회의 요약. 같은 회의는 한 번만 읽는다
  const nextNotes = [...new Set(next.map((candidate) => candidate.noteId))];
  const nextSummaries = useQueries({
    queries: nextNotes.map((noteId) => getGetMeetingReviewSummaryQueryOptions(noteId)),
  });
  const nextItem = (candidate: MapAgenda) =>
    okData(nextSummaries[nextNotes.indexOf(candidate.noteId)]?.data)?.agendas.find(
      (entry) => entry.agendaId === candidate.agendaId
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="pr-6">
        <h3 className="text-[15px] leading-[21px] font-semibold text-balance text-[var(--el-ink)]">{agenda.title}</h3>
        <p className="mt-1 text-xs text-[var(--el-muted)]">
          <span className="whitespace-nowrap tabular-nums">{shortMeetingDate(meeting.startedAt)}</span> ·{" "}
          {meetingHeading(meeting.title)}
        </p>
      </div>

      {summaryQuery.isLoading ? (
        <div aria-label="안건 내용을 불러오는 중" className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="mt-1.5 h-3.5 w-2/5" />
        </div>
      ) : summaryQuery.isError ? (
        <InlineRetry label="안건 내용을 불러오지 못했습니다" onRetry={() => void summaryQuery.refetch()} />
      ) : item ? (
        <AgendaContent item={item} />
      ) : (
        <p className="text-xs text-[var(--el-muted)]">이 안건은 정리된 내용이 없습니다.</p>
      )}

      {previous.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold text-[var(--el-muted)]">이어받은 안건</h4>
          {previous.map((candidate) => (
            <StepButton key={candidate.agendaId} map={map} agenda={candidate} onPick={onPick} />
          ))}
        </div>
      ) : null}

      {next.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold text-[var(--el-muted)]">
            {next.length > 1 ? `여기서 ${next.length}갈래로 나뉨` : "다음 안건"}
          </h4>
          <ul className="flex flex-col gap-2.5">
            {next.map((candidate) => {
              const entry = nextItem(candidate);
              const loading = nextSummaries[nextNotes.indexOf(candidate.noteId)]?.isLoading;
              // 갈래(접혀 있던 쪽)는 옅은 줄, 같은 줄기를 잇는 쪽은 진한 줄
              const branch = rowOfAgenda.get(candidate.agendaId)?.branchOf?.agendaId === agenda.agendaId;
              return (
                <li
                  key={candidate.agendaId}
                  className={cn(
                    "flex flex-col gap-1",
                    next.length > 1 && "border-l-2 pl-2.5",
                    branch ? "border-[var(--el-hairline-strong)]" : "border-[var(--el-ink)]"
                  )}
                >
                  <StepButton map={map} agenda={candidate} onPick={onPick} />
                  {loading ? (
                    <Skeleton className="h-3.5 w-4/5" />
                  ) : entry?.summary ? (
                    <p className="text-xs leading-[18px] text-[var(--el-muted)]">{entry.summary}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <Link
        href={summaryHref(workspaceId, agenda.noteId, agenda.agendaId)}
        onClick={() => track("agenda_map_note_opened", { workspace_id: workspaceId, surface: "panel" })}
        className="inline-flex items-center gap-1 self-start text-xs text-[var(--el-muted)] underline underline-offset-2 hover:text-[var(--el-ink)]"
      >
        회의록에서 보기
        <ArrowUpRight aria-hidden className="size-3.5" />
      </Link>
    </div>
  );
}

function AgendaContent({ item }: { item: MeetingReviewSummaryResponseDataAgendasItem }) {
  const counts = Object.entries(
    item.members.reduce<Record<string, number>>((acc, member) => {
      if (MEMBER_NAME[member.kind]) acc[member.kind] = (acc[member.kind] ?? 0) + 1;
      return acc;
    }, {})
  );
  return (
    <div className="flex flex-col gap-3 text-[13px] leading-5 text-[var(--el-body)]">
      {item.summary ? <p>{item.summary}</p> : null}
      {counts.length > 0 ? (
        <p className="text-xs text-[var(--el-muted)] tabular-nums">
          {counts.map(([kind, count]) => `${MEMBER_NAME[kind]} ${count}`).join(" · ")}
        </p>
      ) : null}
      {item.conclusions.length > 0 ? (
        <TextList title="결론" lines={item.conclusions.map((entry) => entry.text)} />
      ) : null}
      {item.openItems.length > 0 ? (
        <TextList title="남은 질문" lines={item.openItems.map((entry) => entry.text)} />
      ) : null}
    </div>
  );
}

function TextList({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold text-[var(--el-muted)]">{title}</h4>
      <ul className="flex list-disc flex-col gap-1 pl-4 marker:text-[var(--el-muted-soft)]">
        {lines.map((line, at) => (
          <li key={at}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function StepButton({
  map,
  agenda,
  onPick,
}: {
  map: AgendaMap;
  agenda: MapAgenda;
  onPick: (agenda: MapAgenda) => void;
}) {
  const meeting = map.meetings.find((candidate) => candidate.noteId === agenda.noteId)!;
  return (
    <button
      type="button"
      onClick={() => onPick(agenda)}
      className="flex items-baseline gap-2 text-left text-[13px] text-[var(--el-ink)] hover:underline"
    >
      <span className="shrink-0 text-xs text-[var(--el-muted)] tabular-nums">
        {shortMeetingDate(meeting.startedAt)}
      </span>
      {agenda.title}
    </button>
  );
}

/** 주제의 안건 순서. 갈래는 갈라진 안건 아래에 들여 쓴다. 줄기가 길면 가운데를 접는다 */
function TopicFlow({
  map,
  rows,
  main,
  picked,
  onPick,
}: {
  map: AgendaMap;
  rows: TopicRow[];
  main: TopicRow;
  picked: string | null;
  onPick: (agenda: MapAgenda) => void;
}) {
  const [opened, setOpened] = useState(false);
  const indexOf = (noteId: string) => map.meetings.findIndex((meeting) => meeting.noteId === noteId);
  const stepsOf = (row: TopicRow) =>
    [...row.cells.entries()].sort(([a], [b]) => indexOf(a) - indexOf(b)).flatMap(([, agendas]) => agendas);
  const branchesAt = (agendaId: string) => rows.filter((row) => row.branchOf?.agendaId === agendaId);
  const all = rows.flatMap(stepsOf);
  const notes = [...new Set(all.map((agenda) => agenda.noteId))].sort((a, b) => indexOf(a) - indexOf(b));
  const date = (noteId: string) => shortMeetingDate(map.meetings[indexOf(noteId)].startedAt);

  const list = (row: TopicRow, depth: number) => {
    const steps = stepsOf(row);
    const pickedAt = steps.findIndex((agenda) => agenda.agendaId === picked);
    const fold =
      depth === 0 && !opened && steps.length > LONG_TOPIC && !(pickedAt >= HEAD && pickedAt < steps.length - TAIL);
    const shown = fold ? [...steps.slice(0, HEAD), null, ...steps.slice(-TAIL)] : steps;
    return (
      <ol
        className={cn(
          "flex flex-col",
          depth > 0 && "mt-1.5 ml-[3px] border-l border-dashed border-[var(--el-hairline-strong)] pl-3"
        )}
      >
        {shown.map((agenda) =>
          agenda ? (
            <li key={agenda.agendaId} className="flex flex-col pb-2">
              <div className="flex items-baseline gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 translate-y-[1px] rounded-full border-[1.5px] border-[var(--el-ink)]",
                    agenda.agendaId === picked ? "bg-[var(--el-ink)]" : "bg-[var(--el-surface-card)]"
                  )}
                />
                <span className="shrink-0 text-xs text-[var(--el-muted)] tabular-nums">{date(agenda.noteId)}</span>
                <button
                  type="button"
                  aria-pressed={agenda.agendaId === picked}
                  onClick={() => onPick(agenda)}
                  className={cn(
                    "min-w-0 text-left text-[13px] text-[var(--el-ink)] hover:underline",
                    agenda.agendaId === picked && "font-semibold"
                  )}
                >
                  {agenda.title}
                </button>
              </div>
              {branchesAt(agenda.agendaId).map((branch) => (
                <div key={branch.id}>{list(branch, depth + 1)}</div>
              ))}
            </li>
          ) : (
            <li key="folded" className="pb-2 pl-4">
              <button
                type="button"
                onClick={() => setOpened(true)}
                className="text-xs text-[var(--el-muted)] underline underline-offset-2 hover:text-[var(--el-ink)]"
              >
                안건 {steps.length - HEAD - TAIL}개 더 보기
              </button>
            </li>
          )
        )}
      </ol>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="pr-6">
        <h3 className="text-[15px] leading-[21px] font-semibold text-balance text-[var(--el-ink)]">
          {stepsOf(main).at(-1)!.title}
        </h3>
        <p className="mt-1 text-xs text-[var(--el-muted)] tabular-nums">
          안건 {all.length} · 회의 {notes.length}개 · {date(notes[0])} → {date(notes.at(-1)!)}
          {rows.length > 1 ? ` · 갈래 ${rows.length - 1}` : ""}
        </p>
      </div>
      {list(main, 0)}
    </div>
  );
}
