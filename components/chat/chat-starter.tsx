"use client";

import {
  FileText,
  Globe,
  History,
  ListChecks,
  MessageCircle,
  NotebookText,
  Plug,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useRequestNewMeeting } from "@/components/workspace/workspace-app-shell";
import { useGetProjects } from "@/lib/api/generated/projects/projects";
import { useGetMeetingReview } from "@/lib/api/generated/meeting-review/meeting-review";
import type { ScopeChip } from "@/lib/chat/scope-chip";
import { useNoteListPages } from "@/lib/workspace/use-note-list-pages";

type Starter = {
  key: "notes" | "tasks" | "tools" | "web";
  Icon: LucideIcon;
};

export const STARTERS: readonly Starter[] = [
  { key: "notes", Icon: FileText },
  { key: "tasks", Icon: ListChecks },
  { key: "tools", Icon: Plug },
  { key: "web", Icon: Globe },
];

type StarterState = "first" | "workspace" | "note";

export type ChatExample = {
  kind:
    | "decisions"
    | "changes"
    | "open_tasks"
    | "summary"
    | "action_items"
    | "new_task"
    | "web";
  state: StarterState;
  Icon: LucideIcon;
  label: string;
  question: string;
  scope?: ScopeChip;
};

type Note = { noteId: string; title: string };

type StarterFacts = {
  context: Note | null;
  hasActionItems: boolean | null;
  recorded: boolean | null;
  recent: Note | null;
  hasProject: boolean | null;
};

function starterState(facts: StarterFacts): StarterState {
  if (facts.context) return "note";
  return facts.recorded === false ? "first" : "workspace";
}

type MessageKey =
  | "decisions"
  | "changes"
  | "openTasks"
  | "summary"
  | "summaryRecent"
  | "noteDecisions"
  | "noteSummary"
  | "noteChanges"
  | "actionItems"
  | "web"
  | "webFirst"
  | "newTask";

function chatExamples(
  facts: StarterFacts,
  t: ReturnType<typeof useTranslations<"chat.starter">>
): ChatExample[] {
  const state = starterState(facts);
  const chip = (
    kind: ChatExample["kind"],
    Icon: LucideIcon,
    key: MessageKey,
    scope?: ScopeChip
  ): ChatExample => ({
    kind,
    state,
    Icon,
    label: t(`examples.${key}.label`),
    question: t(
      `examples.${key}.question`,
      scope ? { title: scope.title } : undefined
    ),
    ...(scope ? { scope } : {}),
  });

  if (state === "first")
    return [
      chip("web", Globe, "webFirst"),
      ...(facts.hasProject === true
        ? [chip("new_task", ListChecks, "newTask")]
        : []),
    ];

  if (state === "note")
    return [
      chip("decisions", FileText, "noteDecisions"),
      chip("summary", NotebookText, "noteSummary"),
      chip("changes", History, "noteChanges"),
      facts.hasActionItems === true
        ? chip("action_items", ListChecks, "actionItems")
        : chip("web", Globe, "web"),
    ];

  const recent = facts.recent;
  return [
    chip("decisions", FileText, "decisions"),
    chip("changes", History, "changes"),
    chip("open_tasks", ListChecks, "openTasks"),
    recent
      ? chip("summary", NotebookText, "summaryRecent", {
          kind: "note",
          id: recent.noteId,
          title: recent.title,
        })
      : chip("summary", NotebookText, "summary"),
  ];
}

const NO_POLLING = () => 0;

function useRecordedMeetings(workspaceId: string, enabled: boolean) {
  const query = useNoteListPages({
    scope: { kind: "workspace", workspaceId },
    pages: 1,
    enabled,
    refetchInterval: NO_POLLING,
  });
  const page =
    !query.isPlaceholderData &&
    query.data?.status === 200 &&
    query.data.data.success
      ? query.data.data.data
      : null;
  if (!page) return { recorded: null, recent: null };
  const recent = page.notes.find(
    (note) => note.meetingStatus !== "NOT_STARTED"
  );
  return {
    recorded: recent !== undefined || page.hasMore,
    recent: recent ? { noteId: recent.noteId, title: recent.title } : null,
  };
}

function useHasActionItems(noteId: string | null) {
  const response = useGetMeetingReview(noteId ?? "", {
    query: { enabled: Boolean(noteId), retry: false },
  }).data;
  if (response?.status !== 200 || !response.data.success) return null;
  return response.data.data.items.some((item) => item.kind === "ACTION_ITEM");
}

export function ChatStarter({
  workspaceId,
  context,
  disabled,
  onPick,
}: {
  workspaceId: string;
  context: Note | null;
  disabled: boolean;
  onPick: (example: ChatExample) => void;
}) {
  const t = useTranslations("chat.starter");
  const requestNewMeeting = useRequestNewMeeting();
  const hasActionItems = useHasActionItems(context?.noteId ?? null);
  const { recorded, recent } = useRecordedMeetings(workspaceId, !context);
  const projects = useGetProjects(workspaceId).data;
  const hasProject =
    projects?.status === 200 && projects.data.success
      ? (projects.data.data.projects ?? []).length > 0
      : null;
  const facts = { context, hasActionItems, recorded, recent, hasProject };
  const state = starterState(facts);
  const examples = chatExamples(facts, t);

  return (
    <div
      data-testid="chat-starter"
      className="flex flex-1 flex-col items-center justify-center gap-5 py-6 text-center"
    >
      <div className="flex flex-col items-center gap-2">
        <span className="grid size-9 place-items-center rounded-full bg-[var(--el-canvas-soft)] text-[var(--el-muted)]">
          <MessageCircle aria-hidden className="size-4" />
        </span>
        <h2 className="text-[17px] font-medium text-[var(--el-ink)]">
          {t("greeting")}
        </h2>
        <p className="max-w-[18rem] text-[13px] leading-relaxed text-balance text-[var(--el-muted)]">
          {state === "first"
            ? t("firstMeeting")
            : context
              ? t("introNote", { title: context.title })
              : t("intro")}
        </p>
        {state === "first" && requestNewMeeting ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-1 h-[30px]"
            onClick={requestNewMeeting}
          >
            <Plus aria-hidden />
            {t("newMeeting")}
          </Button>
        ) : null}
      </div>

      <ul
        aria-label={t("examplesLabel")}
        className="flex w-full max-w-[22rem] flex-wrap justify-center gap-2"
      >
        {examples.map((example) => (
          <li
            key={example.kind}
            className="w-full min-[360px]:w-[calc(50%-0.25rem)]"
          >
            <button
              type="button"
              disabled={disabled}
              title={example.question}
              onClick={() => onPick(example)}
              className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-control border border-[var(--el-hairline)] bg-white px-3 py-2 text-[13px] text-[var(--el-body)] outline-none transition-colors pointer-coarse:min-h-12 hover:bg-[var(--el-canvas-soft)] hover:text-[var(--el-ink)] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
            >
              <example.Icon
                aria-hidden
                className="size-4 shrink-0 text-[var(--el-muted)]"
              />
              <span className="min-w-0 truncate">{example.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
