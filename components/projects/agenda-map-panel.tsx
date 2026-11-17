"use client";

import { track } from "@/lib/analytics/track";
import { useState } from "react";
import { useTranslations } from "next-intl";
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

export type Selection = {
  rowId: string | null;
  agendaId: string | null;
} | null;
export type Tab = "agenda" | "flow";

export const summaryHref = (workspaceId: string, noteId: string, agendaId?: string) =>
  `/w/${workspaceId}/notes/${noteId}?view=full&tab=summary${agendaId ? `#summary-agenda-${agendaId}` : ""}`;

const LONG_TOPIC = 7;
const HEAD = 2;
const TAIL = 3;

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
  siblings: MapAgenda[];
  tab: Tab;
  onTab: (next: Tab) => void;
  onPick: (agenda: MapAgenda) => void;
  onClose: () => void;
  onFocusTopic: () => void;
}) {
  const t = useTranslations("workspace.agendaMap");
  const tActions = useTranslations("common.actions");
  const agenda = selection.agendaId ? map.agendaById.get(selection.agendaId) : undefined;
  const topic = selection.rowId ? topicOf.get(selection.rowId) : undefined;
  const topicRowsOf = topic ? rows.filter((row) => topicOf.get(row.id) === topic) : [];
  const main = topicRowsOf.find((row) => !row.branchOf);

  return (
    <aside
      aria-label={t("panel.label")}
      className="relative flex min-w-0 flex-col rounded-block border border-[var(--el-hairline)] bg-[var(--el-surface-card)] lg:sticky lg:top-4 lg:max-h-[calc(100vh-120px)] lg:self-start"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={tActions("close")}
        title={tActions("close")}
        onClick={onClose}
        className="absolute top-1.5 right-2 z-10 text-[var(--el-muted)]"
      >
        <X aria-hidden className="size-4" />
      </Button>
      <Tabs value={tab} onValueChange={(value) => onTab(value as Tab)} className="min-h-0 gap-0">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--el-hairline)] pr-14 pl-4">
          <TabsList variant="line" aria-label={t("panel.tabs")} className="gap-5 p-0 group-data-horizontal/tabs:h-10">
            <TabsTrigger value="agenda" disabled={!agenda} className="flex-none px-0 text-[13px] group-data-horizontal/tabs:after:bottom-[-1px]">
              {t("panel.agendaTab")}
            </TabsTrigger>
            <TabsTrigger value="flow" disabled={!main} className="flex-none px-0 text-[13px] group-data-horizontal/tabs:after:bottom-[-1px]">
              {t("panel.flowTab")}
            </TabsTrigger>
          </TabsList>
          {main ? (
            <Button type="button" size="sm" onClick={onFocusTopic} className="shrink-0 whitespace-nowrap">
              {t("panel.focusTopic")}
              <ArrowRight aria-hidden data-icon="inline-end" />
            </Button>
          ) : null}
        </div>
        <div className="min-h-0 overflow-y-auto p-4">
          <TabsContent value="agenda">
            {siblings.length > 1 ? (
              <div className="mb-4 flex flex-col gap-2 border-b border-[var(--el-hairline)] pb-4">
                <h4 className="text-xs font-semibold text-[var(--el-muted)]">
                  {t("panel.siblings", { count: siblings.length })}
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

export const MEMBER_KEY: Record<string, "decision" | "actionItem" | "issue" | "question"> = {
  DECISION: "decision",
  ACTION_ITEM: "actionItem",
  ISSUE: "issue",
  QUESTION: "question",
};

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
  siblings: MapAgenda[];
  onPick: (agenda: MapAgenda) => void;
}) {
  const t = useTranslations("workspace.agendaMap");
  const meeting = map.meetings.find((candidate) => candidate.noteId === agenda.noteId)!;
  const summaryQuery = useGetMeetingReviewSummary(agenda.noteId);
  const item = okData(summaryQuery.data)?.agendas.find((candidate) => candidate.agendaId === agenda.agendaId);
  const listed = new Set(siblings.length > 1 ? siblings.map((sibling) => sibling.agendaId) : []);
  const previous = map.links
    .filter((link) => link.to === agenda.agendaId)
    .map((link) => map.agendaById.get(link.from)!)
    .filter((candidate) => !listed.has(candidate.agendaId));
  const next = map.links
    .filter((link) => link.from === agenda.agendaId)
    .map((link) => map.agendaById.get(link.to)!)
    .filter((candidate) => !listed.has(candidate.agendaId));
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
        <div aria-label={t("detail.loading")} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="mt-1.5 h-3.5 w-2/5" />
        </div>
      ) : summaryQuery.isError ? (
        <InlineRetry label={t("detail.loadFailed")} onRetry={() => void summaryQuery.refetch()} />
      ) : item ? (
        <AgendaContent item={item} />
      ) : (
        <p className="text-xs text-[var(--el-muted)]">{t("detail.empty")}</p>
      )}

      {previous.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold text-[var(--el-muted)]">{t("detail.previous")}</h4>
          {previous.map((candidate) => (
            <StepButton key={candidate.agendaId} map={map} agenda={candidate} onPick={onPick} />
          ))}
        </div>
      ) : null}

      {next.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold text-[var(--el-muted)]">
            {next.length > 1 ? t("detail.splits", { count: next.length }) : t("detail.next")}
          </h4>
          <ul className="flex flex-col gap-2.5">
            {next.map((candidate) => {
              const entry = nextItem(candidate);
              const loading = nextSummaries[nextNotes.indexOf(candidate.noteId)]?.isLoading;
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
        {t("viewInNotes")}
        <ArrowUpRight aria-hidden className="size-3.5" />
      </Link>
    </div>
  );
}

function AgendaContent({ item }: { item: MeetingReviewSummaryResponseDataAgendasItem }) {
  const t = useTranslations("workspace.agendaMap");
  const counts = Object.entries(
    item.members.reduce<Record<string, number>>((acc, member) => {
      if (MEMBER_KEY[member.kind]) acc[member.kind] = (acc[member.kind] ?? 0) + 1;
      return acc;
    }, {})
  );
  return (
    <div className="flex flex-col gap-3 text-[13px] leading-5 text-[var(--el-body)]">
      {item.summary ? <p>{item.summary}</p> : null}
      {counts.length > 0 ? (
        <p className="text-xs text-[var(--el-muted)] tabular-nums">
          {counts.map(([kind, count]) => t(`members.${MEMBER_KEY[kind]}`, { count })).join(" · ")}
        </p>
      ) : null}
      {item.conclusions.length > 0 ? (
        <TextList title={t("detail.conclusions")} lines={item.conclusions.map((entry) => entry.text)} />
      ) : null}
      {item.openItems.length > 0 ? (
        <TextList title={t("detail.openItems")} lines={item.openItems.map((entry) => entry.text)} />
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
  const t = useTranslations("workspace.agendaMap");
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
                {t("flow.showMore", { count: steps.length - HEAD - TAIL })}
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
          {t("flow.meta", { agendas: all.length, meetings: notes.length })} · {date(notes[0])} → {date(notes.at(-1)!)}
          {rows.length > 1 ? ` · ${t("flow.branches", { count: rows.length - 1 })}` : ""}
        </p>
      </div>
      {list(main, 0)}
    </div>
  );
}
