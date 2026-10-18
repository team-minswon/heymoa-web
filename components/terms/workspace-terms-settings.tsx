"use client";

import { TermEditor, TermEditorSkeleton } from "@/components/terms/term-editor";
import { DataBoundary } from "@/components/ui/data-boundary";
import { HelpTip } from "@/components/ui/help-tip";
import {
  addWorkspaceTerm,
  deleteWorkspaceTerm,
  getAddWorkspaceTermMutationKey,
  getDeleteWorkspaceTermMutationKey,
  getGetWorkspaceTermsQueryKey,
  useGetWorkspaceTermsSuspense,
} from "@/lib/api/generated/workspace-terms/workspace-terms";
import { termOfResponse, termQueryOptions } from "@/lib/terms/term-list";
import {
  isDictionaryBusy,
  useTermDictionary,
} from "@/lib/terms/use-term-dictionary";

export const WORKSPACE_TERMS_HELP =
  "받아쓰기가 자주 틀리는 제품명·사내 용어·영어 약어를 적어 두면, 이 워크스페이스의 모든 회의에서 받아 적을 때 참고해요. 흔한 단어는 넣지 않아도 돼요.";

export const workspaceTermsScope = (workspaceId: string) =>
  `terms:workspace:${workspaceId}`;

/** 워크스페이스 용어 사전을 읽는다. 설정 탭과 프로젝트 창(중복 알림)이 같은 캐시를 본다. */
export function useWorkspaceTerms(workspaceId: string) {
  const response = useGetWorkspaceTermsSuspense(workspaceId, {
    query: termQueryOptions(() =>
      isDictionaryBusy(workspaceTermsScope(workspaceId))
    ),
  }).data;
  const data =
    response.status === 200 && response.data.success
      ? response.data.data
      : undefined;
  if (!data) throw new Error("용어 사전을 불러오지 못했습니다.");
  return data;
}

export function useWorkspaceTermDictionary(workspaceId: string) {
  return useTermDictionary({
    scopeId: workspaceTermsScope(workspaceId),
    queryKey: getGetWorkspaceTermsQueryKey(workspaceId),
    addKey: getAddWorkspaceTermMutationKey(),
    removeKey: getDeleteWorkspaceTermMutationKey(),
    addTerm: async (term) =>
      termOfResponse(await addWorkspaceTerm(workspaceId, { term })),
    removeTerm: (termId) => deleteWorkspaceTerm(workspaceId, termId),
  });
}

function WorkspaceTermsEditor({ workspaceId }: { workspaceId: string }) {
  const { terms, limit } = useWorkspaceTerms(workspaceId);
  const dictionary = useWorkspaceTermDictionary(workspaceId);
  return (
    <TermEditor
      inputId="workspace-term-input"
      terms={terms}
      limit={limit}
      onAdd={dictionary.add}
      onRemove={dictionary.remove}
    />
  );
}

/**
 * 설정의 「용어 사전」 탭 (APP-1189). 설명은 제목 옆 ?에 두고 본문은 칩 목록이 바로 보이게 한다. 편집은 멤버 전원이다.
 */
export function WorkspaceTermsSettings({
  workspaceId,
}: {
  workspaceId: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[720px]">
      <header className="mb-8">
        <h2 className="flex items-center gap-1.5 text-3xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
          용어 사전
          <HelpTip label="용어 사전">{WORKSPACE_TERMS_HELP}</HelpTip>
        </h2>
      </header>
      <DataBoundary
        fallback={<TermEditorSkeleton />}
        errorLabel="용어 사전을 불러오지 못했습니다"
        resetKeys={["workspace-terms", workspaceId]}
      >
        <WorkspaceTermsEditor workspaceId={workspaceId} />
      </DataBoundary>
    </div>
  );
}
