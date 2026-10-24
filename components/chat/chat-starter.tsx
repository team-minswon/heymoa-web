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
  /** 에이전트가 하는 일. 이 화면이 알려 줄 것은 문장보다 이쪽이다 */
  title: string;
  /** 무엇을 하는지, 바꾸는 일이면 어떻게 확인받는지 */
  hint: string;
};

/**
 * 에이전트가 실제로 하는 일 넷(런처 안내가 읽는다). 목록은 ai 의 도구에서 왔다 — 회의록 읽기, 할 일 쓰기(승인 카드),
 * 연동 도구(Linear), 웹 검색.
 */
export const STARTERS: readonly Starter[] = [
  {
    key: "notes",
    Icon: FileText,
    title: "회의록에서 찾기",
    hint: "회의에서 정한 것과 남은 일을 찾아 정리해요.",
  },
  {
    key: "tasks",
    Icon: ListChecks,
    title: "할 일 만들기",
    hint: "할 일을 만들고 고쳐요. 바꾸기 전에 먼저 물어봐요.",
  },
  {
    key: "tools",
    Icon: Plug,
    title: "외부 도구로 잇기",
    hint: "연동한 Linear에 이슈를 만들어요.",
  },
  {
    key: "web",
    Icon: Globe,
    title: "웹에서 찾기",
    hint: "회의에 없는 내용은 웹에서 찾아와요.",
  },
];

/** 빈 대화가 놓인 자리. `first` 는 기록한 회의가 아직 없는 워크스페이스다. 계측(`chat_example_clicked.state`)도 이 값을 받는다. */
export type StarterState = "first" | "workspace" | "note";

/** 예시 칩 하나. `kind`·`state` 는 계측이 받는 값이다(문장·회의록 id·제목은 싣지 않는다). */
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
  /** 칩에 서는 짧은 이름. */
  label: string;
  /** 고르면 입력창에 채우는 문장. */
  question: string;
  /** 이 질문이 기대는 회의록. 고르면 입력창에 범위 칩으로 함께 붙는다. */
  scope?: ScopeChip;
};

type Note = { noteId: string; title: string };

/**
 * 예시를 고를 재료. 모르는 값은 `null` 이다 — 모를 때 「없다」로 읽으면 있는 사람에게 처음 안내를 하거나 할 수 있는
 * 일을 뺀다.
 * - `context`: 회의록 화면에서 열어 그 회의록이 범위로 붙어 있다
 * - `hasActionItems`: 그 회의 검토본에 액션 아이템이 있나
 * - `recorded`: 이 워크스페이스에 시작한 회의가 있나 · `recent`: 가장 최근 회의
 * - `hasProject`: 할 일은 프로젝트에 만들어진다(ai `heymoa_create_task`) — 프로젝트가 없으면 할 일 예시를 권하지 않는다
 */
export type StarterFacts = {
  context: Note | null;
  hasActionItems: boolean | null;
  recorded: boolean | null;
  recent: Note | null;
  hasProject: boolean | null;
};

export function starterState(facts: StarterFacts): StarterState {
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

/**
 * 보여 줄 예시 칩. 칩은 우리가 잘하는 일 — 결정·바뀐 결정·남은 할 일을 근거와 함께 찾기 — 의 짧은 이름이고, 고르면 긴 문장이
 * 입력창에 찬다. 모두 ai 도구로 할 수 있는 일이다: 결정의 현재 값·이력(`proposals_search`·`proposal_open`), 할 일
 * (`workspace_search_tasks`·`heymoa_create_task`), 저장 요약(`meeting_summary`), 웹(`web_search`, 사용자가 직접 요구할 때).
 *
 * - 시작한 회의가 없으면 회의록 없이도 되는 일(웹, 프로젝트가 있으면 할 일 만들기)만 권한다
 * - 할 일로 만들기는 그 회의에 액션 아이템이 있다고 **확인된** 때만 넣고, 아니면 웹 찾기가 그 자리에 선다
 * - 「HeyMoa로 무엇을 할 수 있어?」는 넣지 않는다 — 에이전트는 회의 근거와 도구 결과로만 답해 제품 사용법을 답할 자료가 없다
 */
export function chatExamples(
  facts: StarterFacts,
  t: ReturnType<typeof useTranslations<"common.agentChat.starter">>
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

/** 기록한 회의가 있나와 가장 최근 회의. 목록 화면·「시작하기」와 같은 첫 쪽 캐시를 읽는다. 회의록 화면에서는 읽지 않는다. */
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
  // 목록은 최근 순이다. 시작하지 않은 노트는 물을 내용이 없다. 녹음 시각(`meetingStartedAt`)이 아니라 상태로 본다 —
  // 녹음 시각이 비어 있어도 끝난 회의는 물을 내용이 있다
  const recent = page.notes.find(
    (note) => note.meetingStatus !== "NOT_STARTED"
  );
  return {
    recorded: recent !== undefined || page.hasMore,
    recent: recent ? { noteId: recent.noteId, title: recent.title } : null,
  };
}

/** 그 회의 검토본에 액션 아이템이 있나. 검토본이 없거나(분석 전) 못 읽었으면 `null` 이다. */
function useHasActionItems(noteId: string | null) {
  const response = useGetMeetingReview(noteId ?? "", {
    query: { enabled: Boolean(noteId), retry: false },
  }).data;
  if (response?.status !== 200 || !response.data.success) return null;
  // 프로젝트에 넣기로 켰는지(`included`)와 상관없이 회의에 나온 액션 아이템이면 할 일로 만들 거리다
  return response.data.data.items.some((item) => item.kind === "ACTION_ITEM");
}

/**
 * 빈 대화 화면. 가운데에 아이콘·인사·설명 한두 줄, 그 아래 짧은 이름의 예시 칩(2×2, 좁으면 한 줄에 하나)이다. 시작한 회의가
 * 없으면 설명 대신 「첫 회의를 기록하면…」과 [새 회의 기록] 이 선다. 칩을 누르면 긴 문장으로 **입력창을 채우기만** 한다 — 고쳐
 * 묻거나 범위를 바꾼 뒤 보낼 수 있다. 바로 보내면 의도와 다른 질문이 한 턴을 쓴다.
 *
 * 연동 안내 줄은 두지 않는다(사용자 지시). [disabled] 는 답을 만드는 중이거나 승인·불러오기를 기다리는 때다.
 */
export function ChatStarter({
  workspaceId,
  context,
  disabled,
  onPick,
}: {
  workspaceId: string;
  /** 회의록 화면에서 열어 그 회의록이 범위로 붙어 있으면 그 회의록. */
  context: Note | null;
  disabled: boolean;
  /** 예시를 골랐다. 부르는 쪽이 입력창을 채운다. */
  onPick: (example: ChatExample) => void;
}) {
  const t = useTranslations("common.agentChat.starter");
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
          // 두 줄 둘씩(2×2). 좁으면 한 줄에 하나, 홀수면 남은 칩이 가운데 선다
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
