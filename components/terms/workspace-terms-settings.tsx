"use client";

import { useTranslations } from "next-intl";

import { SettingsHeader } from "@/components/settings/settings-layout";
import { TermEditor, TermEditorSkeleton } from "@/components/terms/term-editor";
import { DataBoundary } from "@/components/ui/data-boundary";
import { HelpTip } from "@/components/ui/help-tip";
import {
  addWorkspaceTerm,
  addWorkspaceTerms,
  deleteWorkspaceTerm,
  getAddWorkspaceTermMutationKey,
  getDeleteWorkspaceTermMutationKey,
  getGetWorkspaceTermsQueryKey,
  useGetWorkspaceTermsSuspense,
} from "@/lib/api/generated/workspace-terms/workspace-terms";
import {
  termOfResponse,
  termQueryOptions,
  type RejectReason,
} from "@/lib/terms/term-list";
import {
  isDictionaryBusy,
  useTermDictionary,
  useTermProgress,
  type BatchResult,
} from "@/lib/terms/use-term-dictionary";

export const workspaceTermsScope = (workspaceId: string) =>
  `terms:workspace:${workspaceId}`;

/** 워크스페이스 용어 사전을 읽는다. */
export function useWorkspaceTerms(workspaceId: string) {
  const t = useTranslations("settings.terms");
  const response = useGetWorkspaceTermsSuspense(workspaceId, {
    query: termQueryOptions(() =>
      isDictionaryBusy(workspaceTermsScope(workspaceId))
    ),
  }).data;
  const data =
    response.status === 200 && response.data.success
      ? response.data.data
      : undefined;
  if (!data) throw new Error(t("loadFailed"));
  return data;
}

export function useWorkspaceTermDictionary(workspaceId: string) {
  const t = useTranslations("settings.terms");
  return useTermDictionary({
    scopeId: workspaceTermsScope(workspaceId),
    queryKey: getGetWorkspaceTermsQueryKey(workspaceId),
    addKey: getAddWorkspaceTermMutationKey(),
    removeKey: getDeleteWorkspaceTermMutationKey(),
    addOne: async (term) =>
      termOfResponse(
        await addWorkspaceTerm(workspaceId, { term }),
        t("addFailed")
      ),
    addBatch: async (terms): Promise<BatchResult> => {
      const response = await addWorkspaceTerms(workspaceId, { terms });
      const data =
        response.status === 200 && response.data.success
          ? response.data.data
          : undefined;
      // 전역 토스트가 이 문구를 그대로 띄운다(`errorMessageOf`).
      if (!data) throw new Error(t("addFailed"));
      return {
        ...data,
        // 계약은 문자열로만 알려 준다 — 값 집합은 LIMIT · TOO_LONG · BLANK(server APP-1226)
        rejected: data.rejected.map((item) => ({
          term: item.term,
          reason: item.reason as RejectReason,
        })),
      };
    },
    removeTerm: (termId) => deleteWorkspaceTerm(workspaceId, termId),
  });
}

function WorkspaceTermsEditor({ workspaceId }: { workspaceId: string }) {
  const { terms, limit } = useWorkspaceTerms(workspaceId);
  const dictionary = useWorkspaceTermDictionary(workspaceId);
  const progress = useTermProgress(workspaceTermsScope(workspaceId));
  return (
    <TermEditor
      inputId="workspace-term-input"
      terms={terms}
      limit={limit}
      onAddMany={dictionary.addMany}
      onRemove={dictionary.remove}
      progress={progress}
    />
  );
}

/**
 * 설정의 「용어 사전」 탭 (APP-1189 · APP-1227). 사전은 워크스페이스 하나다. 설명은 제목 옆 ?에 두고 본문은 입력 카드와
 * 칩 목록이 바로 보이게 한다. 편집은 멤버 전원이다.
 */
export function WorkspaceTermsSettings({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const t = useTranslations("settings.terms");
  return (
    <div className="mx-auto w-full max-w-[720px]">
      <SettingsHeader
        title={
          <>
            {t("title")}
            <HelpTip label={t("title")}>{t("help")}</HelpTip>
          </>
        }
      />
      <DataBoundary
        fallback={<TermEditorSkeleton />}
        errorLabel={t("loadFailed")}
        resetKeys={["workspace-terms", workspaceId]}
      >
        <WorkspaceTermsEditor workspaceId={workspaceId} />
      </DataBoundary>
    </div>
  );
}
