"use client";

import {
  FileText,
  Globe,
  ListChecks,
  Plug,
  type LucideIcon,
} from "lucide-react";

import { useOpenSettings } from "@/components/workspace/workspace-app-shell";
import { useGetWorkspaceIntegrations } from "@/lib/api/generated/workspace-integration/workspace-integration";

type Starter = {
  key: string;
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

/**
 * 빈 대화 화면. 가운데에 서서 에이전트가 하는 일을 카드로 보여 주고, 누르면 바로 보낸다.
 * [disabled] 는 답을 만드는 중이거나 승인·불러오기를 기다리는 때다 — 그때 보내면 요청이 겹치거나 거절된다.
 */
export function ChatStarter({
  workspaceId,
  scopeTitles,
  disabled,
  onAsk,
}: {
  workspaceId: string;
  /** 지금 붙어 있는 범위 칩의 이름. 비면 범위가 없다 */
  scopeTitles: readonly string[];
  disabled: boolean;
  onAsk: (question: string) => void;
}) {
  const linearConnected = useLinearConnected(workspaceId);
  const openSettings = useOpenSettings();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6 text-center">
      <div className="space-y-1.5">
        <h2 className="text-xl text-[var(--el-ink)]">무엇을 도와드릴까요?</h2>
        <p className="mx-auto max-w-[19rem] text-xs leading-relaxed text-[var(--el-muted)]">
          {scopeTitles.length > 0
            ? `${scopeTitles.join(", ")}에 대해 물어봐요.`
            : "@로 프로젝트·회의록을 고르면 그 범위로 물어봐요."}
        </p>
      </div>

      <div className="grid w-full max-w-[22rem] gap-2 text-left">
        {STARTERS.map(({ key, Icon, title, hint, question }) => {
          // 연동이 없다고 **확인된** 때만 연동으로 보낸다. 설정을 못 여는 곳이면 그대로 보낸다.
          const connect =
            key === "tools" &&
            linearConnected === false &&
            openSettings !== null;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() =>
                connect ? openSettings("integrations") : onAsk(question)
              }
              className="group flex items-start gap-3 rounded-block text-left border border-[var(--el-hairline)] bg-[var(--el-surface-card)] p-3 transition-colors hover:bg-[var(--el-canvas-soft)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--el-surface-card)]"
            >
              <Icon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--el-ink)]">
                  {title}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--el-muted)]">
                  {connect
                    ? "Linear 연동이 필요해요. 설정에서 연동할 수 있어요."
                    : hint}
                </span>
                <span className="mt-1.5 block text-[13px] text-[var(--el-body)]">
                  {connect ? "연동하기" : `“${question}”`}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
