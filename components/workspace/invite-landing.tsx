"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Home, LogIn, MailCheck } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import { useAcceptInvitationByToken } from "@/lib/api/generated/workspace-invitations/workspace-invitations";
import { getGetWorkspacesQueryKey } from "@/lib/api/generated/workspaces/workspaces";
import { buildGoogleOAuthUrl } from "@/lib/auth/paths";

const ERROR_COPY: Record<string, { title: string; description: string }> = {
  INVITATION_NOT_FOUND: {
    title: "유효하지 않은 초대 링크입니다",
    description: "링크가 잘못되었거나 삭제된 초대입니다. 초대 메일의 링크를 다시 확인해 주세요.",
  },
  INVITATION_EXPIRED: {
    title: "초대가 만료되었습니다",
    description: "초대 링크는 1일 동안만 유효합니다. 워크스페이스 관리자에게 다시 초대를 요청해 주세요.",
  },
  INVITATION_NOT_PENDING: {
    title: "이미 처리된 초대입니다",
    description: "이 초대는 이미 수락되었거나 취소되었습니다. 관리자에게 새 초대를 요청해 주세요.",
  },
  INVITATION_EMAIL_MISMATCH: {
    title: "이 초대는 다른 이메일 계정용입니다",
    description: "초대받은 이메일과 지금 로그인한 계정이 다릅니다. 초대받은 계정으로 다시 로그인해 주세요.",
  },
};

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
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--el-canvas)] p-4 text-[var(--el-ink)]">
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
  if (!token) {
    return (
      <ErrorCard
        title="유효하지 않은 초대 링크입니다"
        description="링크가 잘못되었거나 잘려 있습니다. 초대 메일의 링크를 다시 확인해 주세요."
      />
    );
  }

  if (status === "anonymous") {
    return (
      <Card icon={<MailCheck className="size-5" aria-hidden />}>
        <h1 className="font-serif text-xl font-light tracking-[-0.01em]">
          워크스페이스 초대가 도착했어요
        </h1>
        <p className="mt-2 text-sm text-[var(--el-muted)]">
          로그인하면 초대를 수락하고 바로 워크스페이스에 합류합니다.
        </p>
        <a
          href={buildGoogleOAuthUrl(`/invite?token=${encodeURIComponent(token)}`)}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--el-ink)] px-6 py-3 text-sm font-medium text-white"
        >
          <LogIn className="size-4" aria-hidden />
          Google로 계속하기
        </a>
      </Card>
    );
  }

  if (error) {
    const code = errorCodeOf(error);
    if (code === "ALREADY_WORKSPACE_MEMBER") {
      return (
        <Card icon={<MailCheck className="size-5" aria-hidden />}>
          <h1 className="font-serif text-xl font-light tracking-[-0.01em]">
            이미 이 워크스페이스의 멤버예요
          </h1>
          <p className="mt-2 text-sm text-[var(--el-muted)]">
            초대를 다시 수락할 필요가 없습니다. 워크스페이스에서 계속하세요.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--el-ink)] px-6 py-3 text-sm font-medium text-white"
          >
            <Home className="size-4" aria-hidden />
            홈으로
          </Link>
        </Card>
      );
    }
    const copy = code ? ERROR_COPY[code] : undefined;
    return (
      <ErrorCard
        title={copy?.title ?? "초대를 수락하지 못했습니다"}
        description={
          copy?.description ?? errorMessageOf(error, "잠시 후 다시 시도해 주세요.")
        }
      />
    );
  }

  // checking(인증 확인) 또는 수락 진행 중 — 페이지 전체 스피너 대신 카드 안에서 알린다
  return (
    <Card icon={<MailCheck className="size-5" aria-hidden />}>
      <h1 className="font-serif text-xl font-light tracking-[-0.01em]">
        초대를 확인하고 있어요
      </h1>
      <p className="mt-2 text-sm text-[var(--el-muted)]">
        잠시만요 — 수락이 끝나면 워크스페이스로 이동합니다.
      </p>
    </Card>
  );
}

function Card({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="w-full max-w-[420px] rounded-2xl border border-[var(--el-hairline)] bg-white p-8 text-center shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-[var(--el-hairline)]">
        {icon}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ErrorCard({ title, description }: { title: string; description: string }) {
  return (
    <Card icon={<AlertTriangle className="size-5" aria-hidden />}>
      <h1 className="font-serif text-xl font-light tracking-[-0.01em]">{title}</h1>
      <p className="mt-2 text-sm text-[var(--el-muted)]">{description}</p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--el-hairline)] px-6 py-3 text-sm font-medium"
      >
        <Home className="size-4" aria-hidden />
        홈으로
      </Link>
    </Card>
  );
}
