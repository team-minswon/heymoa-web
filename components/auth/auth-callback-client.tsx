"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Home, LogIn } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { getWorkspaces } from "@/lib/api/generated/workspaces/workspaces";
import { getMe } from "@/lib/auth/api";
import { normalizeReturnTo } from "@/lib/auth/paths";

export function AuthCallbackClient({
  urlError,
  returnTo,
}: {
  urlError?: string;
  returnTo?: string;
}) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--el-canvas)] p-4 text-[var(--el-ink)]">
      <CallbackProcessor urlError={urlError} returnTo={returnTo} />
    </main>
  );
}

export function CallbackProcessor({
  urlError,
  returnTo,
}: {
  urlError?: string;
  returnTo?: string;
} = {}) {
  const router = useRouter();
  const { setUser } = useAuth();
  const [errorDetails, setErrorDetails] = useState<{
    title: string;
    description: string;
  } | null>(null);

  useEffect(() => {
    let ignore = false;

    async function checkAuth() {
      if (urlError) {
        if (!ignore) {
          setErrorDetails({
            title: "로그인 거부",
            description: "로그인이 취소되었거나 거부되었습니다.",
          });
        }
        return;
      }

      try {
        const user = await getMe();

        if (!ignore) {
          setUser(user);

          const destination = normalizeReturnTo(returnTo);
          if (destination !== "/") {
            router.replace(destination);
            return;
          }
          const response = await getWorkspaces();
          if (response.status !== 200 || !response.data.success) {
            throw new Error("WORKSPACE_LIST_FAILED");
          }
          const items = response.data.data.workspaces ?? [];
          const selected = items.find((item) => item.isDefault) ?? items[0];
          if (!selected) {
            setErrorDetails({
              title: "워크스페이스가 필요합니다",
              description:
                "새 워크스페이스를 만든 뒤 회의 기록을 시작해 주세요.",
            });
            return;
          }
          if (!items.some((item) => item.isDefault)) {
            console.error("DEFAULT_WORKSPACE_MISSING", {
              workspaceIds: items.map((item) => item.workspaceId),
            });
          }
          router.replace(`/w/${selected.workspaceId}`);
        }
      } catch (error) {
        if (!ignore) {
          console.error("Auth check failed:", error);
          setErrorDetails({
            title: "로그인에 실패했습니다",
            description: "인증 정보를 가져오지 못했습니다. 다시 시도해 주세요.",
          });
        }
      }
    }

    void checkAuth();

    return () => {
      ignore = true;
    };
  }, [returnTo, router, setUser, urlError]);

  if (errorDetails) {
    return (
      <div className="w-full max-w-md rounded-3xl border border-[var(--el-hairline)] bg-white p-8 text-center shadow-[0_16px_48px_rgba(12,10,9,0.08)]">
        <AlertTriangle className="mx-auto mb-5 size-10 text-[var(--el-error)]" />
        <h1 className="font-serif text-3xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
          {errorDetails.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--el-muted)]">
          {errorDetails.description}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/?login=true"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[var(--el-primary)] text-sm font-medium text-white transition hover:bg-[var(--el-primary-active)]"
          >
            <LogIn className="size-4" />
            다시 로그인
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[var(--el-hairline-strong)] bg-white text-sm font-medium text-[var(--el-ink)] transition hover:bg-[var(--el-canvas-soft)]"
          >
            <Home className="size-4" />
            홈으로 이동
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center">
      <div className="mb-5 size-8 animate-spin rounded-full border-2 border-[var(--el-ink)] border-t-transparent" />
      <p className="font-serif text-2xl font-light text-[var(--el-ink)]">
        로그인 처리 중...
      </p>
    </div>
  );
}
