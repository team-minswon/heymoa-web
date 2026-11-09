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

/** 초대 수락 실패 코드 → `workspace.invite.errors` 키. */
const ERROR_KEY = {
  INVITATION_NOT_FOUND: "notFound",
  INVITATION_EXPIRED: "expired",
  INVITATION_NOT_PENDING: "notPending",
  INVITATION_EMAIL_MISMATCH: "emailMismatch",
} as const;

/**
 * 초대 이메일 링크의 목적지. 로그인돼 있으면 토큰으로 즉시 수락하고 워크스페이스로 이동한다 —
 * 링크 클릭이 곧 수락 의사라는 계약(APP-148). 미로그인이면 returnTo에 토큰을 보존한 채
 * 구글 로그인으로 보낸다.
 */
export function InviteLanding({ token }: { token: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const acceptByToken = useAcceptInvitationByToken({
    mutation: { meta: { suppressErrorToast: true } },
  });
  // StrictMode 이중 이펙트·리렌더에도 수락은 한 번만 쏜다
  const fired = useRef(false);
  // mutate(vars, { onSuccess })의 per-call 콜백은 StrictMode 리마운트에서 옵저버와 함께
  // 유실된다 — 결과는 옵저버에 안 묶이는 mutateAsync 프라미스로 받고 로컬 상태에 담는다
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
          // 합류했으니 사이드바 워크스페이스 목록도 새 워크스페이스를 알아야 한다
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

  // checking(인증 확인) 또는 수락 진행 중 — 페이지 전체 스피너 대신 카드 안에서 알린다
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
