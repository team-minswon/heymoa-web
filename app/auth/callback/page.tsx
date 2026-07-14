"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Home, LogIn } from "lucide-react";

import { Providers } from "@/app/providers";
import { useAuth } from "@/components/auth/auth-provider";
import { getMe } from "@/lib/auth/api";
import { normalizeReturnTo } from "@/lib/auth/paths";
import { getWorkspaces } from "@/lib/api/generated/workspaces/workspaces";

export default function AuthCallback() {
  return (
    <Providers initialUser={null}>
      <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--clay-canvas)] p-4 text-[var(--clay-primary)]">
        <CallbackProcessor />
      </main>
    </Providers>
  );
}

export function CallbackProcessor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();
  const [errorDetails, setErrorDetails] = useState<{
    title: string;
    description: string;
  } | null>(null);

  useEffect(() => {
    let ignore = false;

    async function checkAuth() {
      const urlError = searchParams.get("error");
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

          const returnToRaw = searchParams.get("return_to");
          const destination = normalizeReturnTo(returnToRaw);
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
  }, [router, searchParams, setUser]);

  if (errorDetails) {
    return (
      <div className="text-center w-full max-w-sm rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6">
        <AlertTriangle className="size-12 mx-auto text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-[var(--clay-primary)]">
          {errorDetails.title}
        </h1>
        <p className="mt-2 text-sm text-[var(--clay-body)]">
          {errorDetails.description}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/?login=true"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--clay-primary)] text-sm font-semibold text-white transition hover:bg-[var(--clay-brand-teal)]"
          >
            <LogIn className="size-4" />
            다시 로그인
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-canvas)] text-sm font-semibold text-[var(--clay-primary)] transition hover:bg-[var(--clay-surface-soft)]"
          >
            <Home className="size-4" />
            홈으로 이동
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <div className="size-8 animate-spin rounded-full border-4 border-[var(--clay-primary)] border-t-transparent mb-4" />
      <p className="text-sm font-medium text-[var(--clay-primary)]">
        로그인 처리 중...
      </p>
    </div>
  );
}
