"use client";

import { TermEditor, TermEditorSkeleton } from "@/components/terms/term-editor";
import {
  useWorkspaceTerms,
  workspaceTermsScope,
} from "@/components/terms/workspace-terms-settings";
import { DataBoundary } from "@/components/ui/data-boundary";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { HelpTip } from "@/components/ui/help-tip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  addProjectTerm,
  deleteProjectTerm,
  getAddProjectTermMutationKey,
  getDeleteProjectTermMutationKey,
  getGetProjectTermsQueryKey,
  useGetProjectTermsSuspense,
} from "@/lib/api/generated/project-terms/project-terms";
import type { ProjectResponseData } from "@/lib/api/generated/models";
import { getGetWorkspaceTermsQueryKey } from "@/lib/api/generated/workspace-terms/workspace-terms";
import {
  normalizeTerm,
  termOfResponse,
  termQueryOptions,
} from "@/lib/terms/term-list";
import {
  isDictionaryBusy,
  useTermDictionary,
} from "@/lib/terms/use-term-dictionary";

const PROJECT_TERMS_HELP =
  "이 프로젝트의 회의에서만 참고해요. 워크스페이스 용어 사전의 용어도 함께 쓰여요.";

function ProjectTermsBody({
  workspaceId,
  projectId,
  onOpenWorkspaceTerms,
}: {
  workspaceId: string;
  projectId: string;
  onOpenWorkspaceTerms: () => void;
}) {
  // 워크스페이스 사전은 창을 열 때 한 번 받아 둔다 — 입력 중 중복 알림은 이것만 본다(입력마다 서버를 부르지 않는다).
  const workspace = useWorkspaceTerms(workspaceId);
  const scopeId = `terms:project:${projectId}`;
  const response = useGetProjectTermsSuspense(workspaceId, projectId, {
    query: termQueryOptions(() => isDictionaryBusy(scopeId)),
  }).data;
  const data =
    response.status === 200 && response.data.success
      ? response.data.data
      : undefined;
  const dictionary = useTermDictionary({
    scopeId,
    queryKey: getGetProjectTermsQueryKey(workspaceId, projectId),
    addKey: getAddProjectTermMutationKey(),
    removeKey: getDeleteProjectTermMutationKey(),
    addTerm: async (term) =>
      termOfResponse(await addProjectTerm(workspaceId, projectId, { term })),
    removeTerm: (termId) => deleteProjectTerm(workspaceId, projectId, termId),
    // 「워크스페이스에 이미 있다」(409)면 입력 중 중복 판단에 쓰는 워크스페이스 사전이 낡은 것이다
    conflictRefetch: [
      {
        scopeId: workspaceTermsScope(workspaceId),
        queryKey: getGetWorkspaceTermsQueryKey(workspaceId),
      },
    ],
  });
  if (!data) throw new Error("용어 사전을 불러오지 못했습니다.");

  const workspaceKeys = new Set(
    workspace.terms.map((item) => normalizeTerm(item.term))
  );
  const inWorkspace = (term: string) => workspaceKeys.has(normalizeTerm(term));

  return (
    <div className="flex min-h-0 flex-col">
      <WorkspaceLine
        count={workspace.terms.length}
        onOpen={onOpenWorkspaceTerms}
      />
      <TermEditor
        inputId="project-term-input"
        terms={data.terms}
        limit={data.limit}
        onAdd={dictionary.add}
        onRemove={dictionary.remove}
        blockedReason={(term) =>
          inWorkspace(term) ? "워크스페이스 용어 사전에 이미 있어요" : null
        }
        isDimmed={(item) => item.inWorkspace === true || inWorkspace(item.term)}
        dimmedNote={(count) => `${count}개는 워크스페이스 사전에도 있어요`}
        scrollList
      />
    </div>
  );
}

/** 두 사전이 함께 쓰인다는 것을 창 위쪽 한 줄로 말한다. */
function WorkspaceLine({
  count,
  onOpen,
}: {
  count: number | null;
  onOpen: () => void;
}) {
  return (
    <div className="mb-4 flex min-h-5 flex-wrap items-center gap-x-1.5 text-xs leading-5 text-[var(--el-muted)]">
      <span>
        {count === null ? (
          <>
            워크스페이스 용어{" "}
            <Skeleton className="inline-block h-3 w-3.5 rounded-chip align-[-1px]" />
            개도 함께 쓰여요
          </>
        ) : count > 0 ? (
          `워크스페이스 용어 ${count}개도 함께 쓰여요`
        ) : (
          "워크스페이스 용어 사전은 아직 비어 있어요"
        )}
      </span>
      <span aria-hidden>·</span>
      <button
        type="button"
        onClick={onOpen}
        className="cursor-pointer font-medium text-[var(--el-ink)] underline underline-offset-2 hover:text-[var(--el-body)]"
      >
        워크스페이스 사전 보기
      </button>
    </div>
  );
}

/**
 * 프로젝트 메뉴 › 「용어 사전」 창 (APP-1189). 프로젝트 정보 화면이 없어 창으로 연다.
 *
 * 워크스페이스에 이미 있는 용어는 입력하는 동안 막고, 그래도 겹친 칩(나중에 워크스페이스에 같은 용어가 생긴 경우)은
 * 지우지 않고 점선으로 옅게 둔다 — 보낼 때 서버가 하나로 합친다.
 */
export function ProjectTermsDialog({
  workspaceId,
  project,
  onOpenChange,
  onOpenWorkspaceTerms,
}: {
  workspaceId: string;
  project: ProjectResponseData | null;
  onOpenChange: (open: boolean) => void;
  onOpenWorkspaceTerms: () => void;
}) {
  return (
    <Dialog open={project !== null} onOpenChange={onOpenChange}>
      {project !== null && (
        <DialogContent className="flex max-h-[min(640px,calc(100dvh-2rem))] flex-col gap-0 p-6 sm:max-w-lg">
          <DialogTitle className="flex min-w-0 items-center gap-1.5 pr-8 text-panel-title font-medium leading-tight">
            <span className="min-w-0 truncate">「{project.name}」</span>
            <span className="shrink-0">용어 사전</span>
            <HelpTip label="프로젝트 용어 사전">{PROJECT_TERMS_HELP}</HelpTip>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {PROJECT_TERMS_HELP}
          </DialogDescription>
          {/* 칩이 많아도 창이 화면을 넘지 않게 칩 목록만 스크롤한다 — 입력란은 늘 보인다. */}
          <div className="mt-2 flex min-h-0 flex-col">
            <DataBoundary
              fallback={
                <TermEditorSkeleton>
                  <WorkspaceLine count={null} onOpen={onOpenWorkspaceTerms} />
                </TermEditorSkeleton>
              }
              errorLabel="용어 사전을 불러오지 못했습니다"
              resetKeys={["project-terms", project.projectId]}
            >
              <ProjectTermsBody
                workspaceId={workspaceId}
                projectId={project.projectId}
                onOpenWorkspaceTerms={onOpenWorkspaceTerms}
              />
            </DataBoundary>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
