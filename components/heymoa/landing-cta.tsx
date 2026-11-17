"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { AuthModal } from "@/components/auth/auth-modal";
import { useAuth } from "@/components/auth/auth-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";
import { track } from "@/lib/analytics/track";
import { useGetWorkspaces } from "@/lib/api/generated/workspaces/workspaces";
import { cn } from "@/lib/utils";
import { pickWorkspaceId } from "@/lib/workspaces/last-workspace";

export const WELCOME_PARAM = "welcome";

export const MARKETING_PILL = "h-12 rounded-full px-6 text-[15px]";

export function LandingCta({
  label,
  className,
  openOnWelcome = false,
  tooltip,
  member,
  pricingPlan,
}: {
  label: string;
  className?: string;
  openOnWelcome?: boolean;
  tooltip?: ReactNode;
  member?: { label: string; to: "checkout" };
  pricingPlan?: "free" | "pro";
}) {
  const t = useTranslations("landing.cta");
  const { status } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const tooltipId = useId();
  const isAuthenticated = status === "authenticated";
  const workspacesQuery = useGetWorkspaces({
    query: { enabled: isAuthenticated, staleTime: 5 * 60 * 1000 },
  });
  const envelope =
    workspacesQuery.data?.status === 200 ? workspacesQuery.data.data : undefined;
  const workspaces = envelope?.success ? (envelope.data.workspaces ?? []) : [];
  const workspaceId = pickWorkspaceId(workspaces);
  const hasNoWorkspace = workspacesQuery.isSuccess && !workspaceId;
  const onPricingClick = pricingPlan
    ? () =>
        track("pricing_cta_clicked", {
          plan: pricingPlan,
          auth: isAuthenticated ? "member" : "anonymous",
        })
    : undefined;

  useEffect(() => {
    if (!openOnWelcome || !hasNoWorkspace) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has(WELCOME_PARAM)) return;
    url.searchParams.delete(WELCOME_PARAM);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCreateOpen(true);
  }, [openOnWelcome, hasNoWorkspace]);

  if (isAuthenticated) {
    if (workspacesQuery.isPending) {
      return (
        <Button
          type="button"
          loading
          disabled
          className={cn(MARKETING_PILL, className)}
        >
          {member?.label ?? t("dashboard")}
          <ArrowRight className="size-4" />
        </Button>
      );
    }
    if (!workspaceId && workspacesQuery.isError) {
      return (
        <Button
          type="button"
          loading={workspacesQuery.isFetching}
          disabled={workspacesQuery.isFetching}
          aria-label={t("retryLabel")}
          onClick={() => void workspacesQuery.refetch()}
          className={cn(MARKETING_PILL, className)}
        >
          {t("retry")}
        </Button>
      );
    }
    if (!workspaceId) {
      return (
        <>
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            className={cn(MARKETING_PILL, className)}
          >
            {t("createWorkspace")}
            <Plus className="size-4" />
          </Button>
          <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
        </>
      );
    }
    return (
      <LinkButton
        href={
          member?.to === "checkout"
            ? `/billing/checkout/${workspaceId}`
            : `/w/${workspaceId}`
        }
        prefetch={member?.to === "checkout" ? false : undefined}
        onClick={onPricingClick}
        className={cn(MARKETING_PILL, className)}
      >
        {member?.label ?? t("dashboard")}
        <ArrowRight className="size-4" />
      </LinkButton>
    );
  }

  if (status === "checking") {
    return (
      <Button type="button" loading disabled className={cn(MARKETING_PILL, className)}>
        {label}
        <ArrowRight className="size-4" />
      </Button>
    );
  }

  const button = (
    <Button type="button" aria-describedby={tooltip ? tooltipId : undefined} onClick={onPricingClick} className={cn(MARKETING_PILL, className)}>
      {label}
      <ArrowRight className="size-4" />
    </Button>
  );
  if (!tooltip) return <AuthModal>{button}</AuthModal>;

  return (
    <TooltipProvider>
      <Tooltip>
        <AuthModal>
          <TooltipTrigger render={button} />
        </AuthModal>
        <TooltipContent id={tooltipId} role="tooltip" side="bottom" align="end" sideOffset={8} className="block text-center leading-5">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
