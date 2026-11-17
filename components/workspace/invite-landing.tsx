"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Home, LogIn, MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useAuth } from "@/components/auth/auth-provider";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import { useAcceptInvitationByToken } from "@/lib/api/generated/workspace-invitations/workspace-invitations";
import { getGetWorkspacesQueryKey } from "@/lib/api/generated/workspaces/workspaces";
import { CenteredCard } from "@/components/layout/centered-card";
import { buildGoogleOAuthUrl } from "@/lib/auth/paths";
import { InAppLoginGate } from "@/components/auth/in-app-login-gate";

const ERROR_KEY = {
  INVITATION_NOT_FOUND: "notFound",
  INVITATION_EXPIRED: "expired",
  INVITATION_NOT_PENDING: "notPending",
  INVITATION_EMAIL_MISMATCH: "emailMismatch",
} as const;

export function InviteLanding({ token }: { token: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const acceptByToken = useAcceptInvitationByToken({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const fired = useRef(false);
  const [acceptError, setAcceptError] = useState<unknown>(null);

  useEffect(() => {
    if (!token || status !== "authenticated" || fired.current) {
      return;
    }
    fired.current = true;
    acceptByToken
      .mutateAsync({ data: { token } })
      .then((response) => {
        if (response.status === 200 && response.data.success) {
          void queryClient.invalidateQueries({
            queryKey: getGetWorkspacesQueryKey(),
          });
          router.replace(`/w/${response.data.data.workspaceId}`);
        }
      })
      .catch((error: unknown) => {
        setAcceptError(error);
      });
  }, [token, status, acceptByToken, queryClient, router]);

  return (
    <main className="flex flex-1 items-center justify-center bg-[var(--el-canvas)] p-4 text-[var(--el-ink)]">
      <InviteCard token={token} status={status} error={acceptError} />
    </main>
  );
}

function InviteCard({
  token,
  status,
  error,
}: {
  token: string | null;
  status: "checking" | "authenticated" | "anonymous";
  error: unknown;
}) {
  const t = useTranslations("workspace.invite");
  const locale = useLocale();
  if (!token) {
    return (
      <ErrorCard
        title={t("errors.notFound.title")}
        description={t("missingToken")}
      />
    );
  }

  if (status === "anonymous") {
    return (
      <CenteredCard icon={<MailCheck className="size-5" aria-hidden />}>
        <h1 className="text-2xl font-light tracking-[-0.01em]">
          {t("anonymous.title")}
        </h1>
        <p className="mt-2 text-base text-[var(--el-muted)]">
          {t("anonymous.description")}
        </p>
        <InAppLoginGate returnTo={`/invite?token=${encodeURIComponent(token)}`}>
          <a
            href={buildGoogleOAuthUrl(
              `/invite?token=${encodeURIComponent(token)}`, locale
            )}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--el-ink)] px-7 py-3.5 text-base font-medium text-white"
          >
            <LogIn className="size-4" aria-hidden />
            {t("anonymous.continueWithGoogle")}
          </a>
        </InAppLoginGate>
      </CenteredCard>
    );
  }

  if (error) {
    const code = errorCodeOf(error);
    if (code === "ALREADY_WORKSPACE_MEMBER") {
      return (
        <CenteredCard icon={<MailCheck className="size-5" aria-hidden />}>
          <h1 className="text-2xl font-light tracking-[-0.01em]">
            {t("alreadyMember.title")}
          </h1>
          <p className="mt-2 text-base text-[var(--el-muted)]">
            {t("alreadyMember.description")}
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--el-ink)] px-7 py-3.5 text-base font-medium text-white"
          >
            <Home className="size-4" aria-hidden />
            {t("home")}
          </Link>
        </CenteredCard>
      );
    }
    const key =
      code && code in ERROR_KEY
        ? ERROR_KEY[code as keyof typeof ERROR_KEY]
        : undefined;
    return (
      <ErrorCard
        title={key ? t(`errors.${key}.title`) : t("acceptFailed.title")}
        description={
          key
            ? t(`errors.${key}.description`)
            : errorMessageOf(error, t("acceptFailed.description"))
        }
      />
    );
  }

  return (
    <CenteredCard icon={<MailCheck className="size-5" aria-hidden />}>
      <h1 className="text-2xl font-light tracking-[-0.01em]">
        {t("checking.title")}
      </h1>
      <p className="mt-2 text-base text-[var(--el-muted)]">
        {t("checking.description")}
      </p>
    </CenteredCard>
  );
}

function ErrorCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const t = useTranslations("workspace.invite");
  return (
    <CenteredCard icon={<AlertTriangle className="size-5" aria-hidden />}>
      <h1 className="text-2xl font-light tracking-[-0.01em]">{title}</h1>
      <p className="mt-2 text-base text-[var(--el-muted)]">{description}</p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--el-hairline)] px-7 py-3.5 text-base font-medium"
      >
        <Home className="size-4" aria-hidden />
        {t("home")}
      </Link>
    </CenteredCard>
  );
}
