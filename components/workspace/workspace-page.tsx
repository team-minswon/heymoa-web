"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { AudioLines, Check, Folder, Plus, SearchX } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineRetry } from "@/components/ui/inline-retry";
import {
  MeetingsTable,
  MeetingsTableSkeleton,
} from "@/components/workspace/meetings-table";
import {
  ControlChip,
  EmptyState,
  FilterBar,
  PageBody,
  PageContent,
  PageHead,
  SearchField,
  SegmentedTabs,
} from "@/components/workspace/page-chrome";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import type { NoteSummary } from "@/lib/api/generated/models";
import {
  getGetNotesQueryOptions,
  type getNotesResponse,
  useGetNotes,
} from "@/lib/api/generated/notes/notes";
import { isMeetingActive } from "@/lib/notes/meeting-state";
import { useCreateMeeting } from "@/lib/workspace/use-create-meeting";
import { usePinnedNow } from "@/lib/workspace/use-pinned-now";

type StatusFilter = "all" | "scheduled" | "live" | "ended";

// 필터는 표의 「상태」 칸과 같은 어휘를 쓴다. 다른 말을 쓰면 눌러 놓고 무엇이 걸러졌는지 모른다.
const STATUS_FILTERS = [
  { key: "all", label: "전체" },
  { key: "scheduled", label: "예정" },
  { key: "live", label: "기록 중" },
  { key: "ended", label: "종료됨" },
] as const satisfies readonly { key: StatusFilter; label: string }[];

const STATUS_MATCH: Record<StatusFilter, (note: NoteSummary) => boolean> = {
  all: () => true,
  scheduled: (note) => note.meetingStatus === "NOT_STARTED",
  live: (note) => note.meetingStatus === "IN_PROGRESS",
  // 「중지됨」은 따로 탭이 없다 — 끝난 것도 아니고 도는 것도 아니라 종료됨 쪽에 둔다.
  ended: (note) =>
    note.meetingStatus === "ENDED" || note.meetingStatus === "PAUSED",
};

export const ACTIVE_NOTE_LIST_POLL_MS = 10_000;
export const INACTIVE_NOTE_LIST_POLL_MS = 30_000;

export function noteListRefetchInterval(
  notes: NoteSummary[] | undefined
): number {
  return notes?.some(isMeetingActive)
    ? ACTIVE_NOTE_LIST_POLL_MS
    : INACTIVE_NOTE_LIST_POLL_MS;
}

function notesFromResponse(
  response: getNotesResponse | undefined
): NoteSummary[] | undefined {
  return response?.status === 200 && response.data.success
    ? response.data.data.notes
    : undefined;
}

export function WorkspacePage({ workspaceId }: { workspaceId: string }) {
  const { selectedProjectId, projects, isWorkspacePending, isWorkspaceError } =
    useWorkspaceShell();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const now = usePinnedNow();

  const selectedProject = projects.find(
    (project) => project.projectId === selectedProjectId
  );
  const singleNotesQuery = useGetNotes(selectedProjectId ?? "", undefined, {
    query: {
      enabled: selectedProjectId !== null,
      refetchInterval: (q) =>
        noteListRefetchInterval(notesFromResponse(q.state.data)),
    },
  });
  const allNotesQueries = useQueries({
    queries: selectedProjectId
      ? []
      : projects.map((project) =>
          getGetNotesQueryOptions(project.projectId, undefined, {
            query: {
              refetchInterval: (q) =>
                noteListRefetchInterval(notesFromResponse(q.state.data)),
            },
          })
        ),
    combine: (results) => ({
      notes: results.flatMap((result) =>
        result.data?.status === 200 && result.data.data.success
          ? (result.data.data.data.notes ?? [])
          : []
      ),
      isPending: results.some((result) => result.isPending),
      isError: results.some((result) => result.isError),
      refetch: () => results.forEach((result) => void result.refetch()),
    }),
  });
  const selectedNotes =
    singleNotesQuery.data?.status === 200 && singleNotesQuery.data.data.success
      ? (singleNotesQuery.data.data.data.notes ?? [])
      : [];
  const notes: NoteSummary[] = selectedProjectId
    ? selectedNotes
    : allNotesQueries.notes;

  const projectNames = useMemo(
    () => new Map(projects.map((p) => [p.projectId, p.name])),
    [projects]
  );

  const needle = query.trim().toLowerCase();
  const visibleNotes = useMemo(
    () =>
      notes
        .filter(STATUS_MATCH[status])
        .filter(
          (note) => !projectFilter || note.projectId === projectFilter
        )
        // 제목·프로젝트·참석자로 찾는다 — 셋 다 「그 회의」를 떠올리는 실마리다.
        .filter((note) =>
          needle
            ? note.title.toLowerCase().includes(needle) ||
              (projectNames.get(note.projectId) ?? "")
                .toLowerCase()
                .includes(needle) ||
              note.participants.some((p) =>
                p.name.toLowerCase().includes(needle)
              )
            : true
        ),
    [notes, status, projectFilter, needle, projectNames]
  );

  const isPending = selectedProjectId
    ? singleNotesQuery.isPending
    : isWorkspacePending || allNotesQueries.isPending;
  const isError = selectedProjectId
    ? singleNotesQuery.isError
    : isWorkspaceError || allNotesQueries.isError;

  const retry = () => {
    if (selectedProjectId) {
      void singleNotesQuery.refetch();
      return;
    }
    allNotesQueries.refetch();
  };

  const scheduledCount = notes.filter(
    (note) => note.meetingStatus === "NOT_STARTED"
  ).length;
  const liveCount = notes.filter(
    (note) => note.meetingStatus === "IN_PROGRESS"
  ).length;
  const summary = [
    `회의 ${notes.length}건`,
    scheduledCount > 0 ? `예정 ${scheduledCount}건` : null,
    liveCount > 0 ? `기록 중 ${liveCount}건` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const activeProjectName = projectFilter
    ? (projectNames.get(projectFilter) ?? "프로젝트")
    : "프로젝트 전체";

  return (
    <PageBody>
      <PageHead
        title={selectedProject?.name ?? "모든 회의"}
        description={isPending ? "불러오는 중" : summary}
        actions={
          <>
            <SearchField
              label="회의 찾기"
              placeholder="제목 · 프로젝트 · 참석자로 찾기"
              value={query}
              onChange={setQuery}
            />
            <NewMeetingButton workspaceId={workspaceId} />
          </>
        }
      />

      <FilterBar>
        <SegmentedTabs
          label="회의 상태 필터"
          value={status}
          options={STATUS_FILTERS}
          onChange={setStatus}
        />
        {/* 프로젝트 하나만 보고 있으면 사이드바가 이미 그것을 말한다 — 같은 걸 두 번 묻지 않는다. */}
        {selectedProjectId ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <ControlChip
                  icon={Folder}
                  label={activeProjectName}
                  active={projectFilter !== null}
                />
              }
            />
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem
                onClick={() => setProjectFilter(null)}
                className="justify-between rounded-control py-2 text-sm"
              >
                프로젝트 전체
                {projectFilter === null ? <Check className="size-3.5" /> : null}
              </DropdownMenuItem>
              {projects.map((project) => (
                <DropdownMenuItem
                  key={project.projectId}
                  onClick={() => setProjectFilter(project.projectId)}
                  className="justify-between rounded-control py-2 text-sm"
                >
                  <span className="truncate">{project.name}</span>
                  {projectFilter === project.projectId ? (
                    <Check className="size-3.5 shrink-0" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </FilterBar>

      <PageContent>
        {isPending ? (
          <MeetingsTableSkeleton />
        ) : isError ? (
          <InlineRetry
            label="회의를 불러오지 못했습니다"
            onRetry={retry}
          />
        ) : visibleNotes.length === 0 ? (
          <NoMeetings hasNotes={notes.length > 0} workspaceId={workspaceId} />
        ) : (
          <MeetingsTable
            workspaceId={workspaceId}
            notes={visibleNotes}
            projectNames={projectNames}
            now={now}
          />
        )}
      </PageContent>
    </PageBody>
  );
}

function NoMeetings({
  hasNotes,
  workspaceId,
}: {
  hasNotes: boolean;
  workspaceId: string;
}) {
  return (
    <EmptyState
      icon={hasNotes ? SearchX : AudioLines}
      title={hasNotes ? "조건에 맞는 회의가 없습니다" : "첫 회의를 기록해 보세요"}
      description={
        hasNotes
          ? "필터나 검색어를 바꿔 보세요."
          : "회의를 시작하면 발화와 결정이 시간순으로 여기에 쌓입니다."
      }
      action={hasNotes ? null : <NewMeetingButton workspaceId={workspaceId} />}
    />
  );
}

function NewMeetingButton({ workspaceId }: { workspaceId: string }) {
  const create = useCreateMeeting(workspaceId);
  return (
    <button
      type="button"
      disabled={create.disabled || create.isPending}
      onClick={() => void create.createMeeting()}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-control bg-[var(--el-primary)] px-3.5 text-[13px] font-medium text-[var(--el-on-primary)] transition-colors hover:bg-[var(--el-primary-active)] disabled:opacity-50"
    >
      <Plus className="size-3.5" />
      새 회의
    </button>
  );
}
