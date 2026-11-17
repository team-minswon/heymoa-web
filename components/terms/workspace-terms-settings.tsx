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

const workspaceTermsScope = (workspaceId: string) =>
  `terms:workspace:${workspaceId}`;

function useWorkspaceTerms(workspaceId: string) {
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

function useWorkspaceTermDictionary(workspaceId: string) {
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
      if (!data) throw new Error(t("addFailed"));
      return {
        ...data,
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
