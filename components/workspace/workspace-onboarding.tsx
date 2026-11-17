"use client";

import { AudioLines, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export function WorkspaceOnboarding({
  stage,
  onCreateProject,
  onNewMeeting,
}: {
  stage: "no-project" | "no-note";
  onCreateProject: () => void;
  onNewMeeting: () => void;
}) {
  const t = useTranslations("workspace.onboarding");
  const first = stage === "no-project";
  const keys = first
    ? (["createProject", "createMeeting", "recordAndReview"] as const)
    : (["nameMeeting", "startRecording", "reviewSummary"] as const);
  const steps = keys.map((key) => ({
    key,
    title: t(`steps.${key}.title`),
    detail: t(`steps.${key}.detail`),
  }));

  return (
    <div
      data-testid="workspace-onboarding"
      data-stage={stage}
      className="flex min-h-80 flex-col items-center justify-center rounded-panel border border-dashed border-[var(--el-hairline-strong)] px-6 py-12 text-center"
    >
      <AudioLines className="size-8 text-[var(--el-muted)]" aria-hidden />
      <h2 className="mt-4 text-2xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
        {first ? t("titleNoProject") : t("titleNoNote")}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--el-body)]">
        {first ? t("descriptionNoProject") : t("descriptionNoNote")}
      </p>
      <ol className="mt-7 flex w-full max-w-3xl flex-col gap-3 text-left sm:flex-row">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className="flex-1 rounded-control border border-[var(--el-hairline)] bg-white p-4"
          >
            <span className="text-[11px] font-bold text-[var(--el-muted)]">
              {index + 1}
            </span>
            <p className="mt-1.5 text-[13px] font-semibold text-[var(--el-ink)]">
              {step.title}
            </p>
            <p className="mt-1.5 text-[11px] leading-[1.55] text-[var(--el-muted)]">
              {step.detail}
            </p>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        className="mt-7 rounded-full px-4"
        onClick={first ? onCreateProject : onNewMeeting}
      >
        <Plus className="size-3.5" />
        {first ? t("ctaNoProject") : t("ctaNoNote")}
      </Button>
    </div>
  );
}
