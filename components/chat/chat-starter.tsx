"use client";

import {
  FileText,
  Globe,
  ListChecks,
  Plug,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useGetWorkspaceIntegrations } from "@/lib/api/generated/workspace-integration/workspace-integration";

type Starter = {
  key: "notes" | "tasks" | "tools" | "web";
  Icon: LucideIcon;
  /** 에이전트가 하는 일. 이 화면이 알려 줄 것은 문장보다 이쪽이다 */
  title: string;
  /** 무엇을 하는지, 바꾸는 일이면 어떻게 확인받는지 */
  hint: string;
  question: string;
};

/**
 * 에이전트가 실제로 하는 일 넷. 예시 질문은 그 일을 한 번에 시켜 볼 수 있는 한 문장이다.
 * 목록은 ai 의 도구에서 왔다 — 회의록 읽기, 할 일 쓰기(승인 카드), 연동 도구(Linear), 웹 검색.
 */
export const STARTERS: readonly Starter[] = [
  {
    key: "notes",
    Icon: FileText,
    title: "회의록에서 찾기",
    hint: "회의에서 정한 것과 남은 일을 찾아 정리해요.",
    question: "지난 회의에서 정한 것만 정리해줘",
  },
  {
    key: "tasks",
    Icon: ListChecks,
    title: "할 일 만들기",
    hint: "할 일을 만들고 고쳐요. 바꾸기 전에 먼저 물어봐요.",
    question: "남은 액션 아이템을 할 일로 만들어줘",
  },
  {
    key: "tools",
    Icon: Plug,
    title: "외부 도구로 잇기",
    hint: "연동한 Linear에 이슈를 만들어요.",
    question: "논의된 이슈를 Linear 이슈로 만들어줘",
  },
  {
    key: "web",
    Icon: Globe,
    title: "웹에서 찾기",
    hint: "회의에 없는 내용은 웹에서 찾아와요.",
    question: "회의에서 언급된 도구의 최신 버전을 웹에서 찾아줘",
  },
];

/**
 * 이 워크스페이스에 Linear 가 연동돼 있나. **모르면 `null`** 이다 — 조회 중이거나 실패했을 때 「연동 안 됨」으로
 * 읽으면 연동된 사람에게 연동하라고 한다. 모를 때는 평소처럼 보낸다.
 */
function useLinearConnected(workspaceId: string) {
  const response = useGetWorkspaceIntegrations(workspaceId).data;
  if (response?.status !== 200 || !response.data.success) return null;
  const linear = response.data.data?.integrations?.find(
    (row) => row.provider === "LINEAR"
  );
  return linear ? linear.connected : null;
}

/** 예시 한 줄. `kind` 는 계측(`chat_example_clicked`)이 받는 값이다. */
export type ChatExample = {
  kind: "context" | Starter["key"];
  Icon: LucideIcon;
  /** 화면에 서는 한 줄이자 입력창에 채우는 질문이다. */
  question: string;
};

/**
 * 보여 줄 예시 서너 줄. 회의록 안에서 열었으면 그 회의 예시가 첫 줄이다(칩이 이미 붙어 있어 「이 회의」로 말한다). 연동 도구 예시는
 * Linear 가 연동됐다고 **확인된** 때만 넣는다 — 안 된 사람에게 못 하는 일을 권하지 않는다. 모르면 웹 예시를 쓴다.
 */
export function chatExamples(
  contextTitle: string | null,
  linearConnected: boolean | null
): ChatExample[] {
  const pick = (key: Starter["key"]): ChatExample => {
    const starter = STARTERS.find((each) => each.key === key)!;
    return { kind: key, Icon: starter.Icon, question: starter.question };
  };
  const examples: ChatExample[] = [];
  if (contextTitle) {
    examples.push({
      kind: "context",
      Icon: FileText,
      question: "이 회의에서 정한 것과 남은 일을 정리해줘",
    });
  } else {
    examples.push(pick("notes"));
  }
  examples.push(pick("tasks"));
  if (linearConnected === true) examples.push(pick("tools"));
  examples.push(pick("web"));
  return examples;
}

/**
 * 빈 대화 화면. 위쪽에 인사 한 줄과 할 수 있는 일 한 문장, 그 아래 예시 질문 서너 줄이다. 예시를 누르면 **입력창을 채우기만**
 * 한다 — 고쳐 묻거나 범위를 바꾼 뒤 보낼 수 있다. 바로 보내면 의도와 다른 질문이 한 턴을 쓴다.
 *
 * 연동 안내 줄은 두지 않는다(사용자 지시) — 연동 도구 예시는 연동이 확인된 때만 선다. [disabled] 는 답을 만드는 중이거나 승인·불러오기를 기다리는 때다.
 */
export function ChatStarter({
  workspaceId,
  contextTitle,
  disabled,
  onPick,
}: {
  workspaceId: string;
  /** 회의록 화면에서 열어 그 회의록이 범위로 붙어 있으면 그 제목. */
  contextTitle: string | null;
  disabled: boolean;
  /** 예시를 골랐다. 부르는 쪽이 입력창을 채운다. */
  onPick: (example: ChatExample) => void;
}) {
  const linearConnected = useLinearConnected(workspaceId);
  const examples = chatExamples(contextTitle, linearConnected);

  return (
    <div data-testid="chat-starter" className="flex flex-1 flex-col gap-5 pt-2">
      <div className="space-y-1.5">
        <h2 className="text-[17px] font-medium text-[var(--el-ink)]">
          무엇을 도와드릴까요?
        </h2>
        <p className="text-[13px] leading-relaxed text-[var(--el-muted)]">
          {contextTitle
            ? `「${contextTitle}」 회의록을 보고 답해요. 할 일·이슈도 만들고, 바꾸는 일은 먼저 물어봐요.`
            : "회의록을 찾아 근거와 함께 답해요. 할 일·이슈도 만들고, 바꾸는 일은 먼저 물어봐요."}
        </p>
      </div>

      <ul aria-label="예시 질문" className="-mx-2 flex flex-col gap-0.5">
        {examples.map((example) => (
          <li key={example.kind}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(example)}
              className="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-block px-2 py-2 text-left text-sm text-[var(--el-body)] outline-none transition-colors pointer-coarse:min-h-12 hover:bg-[var(--el-canvas-soft)] hover:text-[var(--el-ink)] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <example.Icon
                aria-hidden
                className={cn(
                  "size-4 shrink-0",
                  example.kind === "context"
                    ? "text-[var(--el-scope-note)]"
                    : "text-[var(--el-muted)]"
                )}
              />
              <span className="min-w-0 flex-1">{example.question}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
