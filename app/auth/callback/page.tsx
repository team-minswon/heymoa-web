"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { getMe } from "@/lib/auth/api";
import { normalizeReturnTo } from "@/lib/auth/paths";

function AuthCallbackContent() {
  const { setUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) {
      return;
    }

    initialized.current = true;

    const returnTo = normalizeReturnTo(searchParams.get("returnTo"));

    const handleCallback = async () => {
      try {
        const user = await getMe();
        setUser(user);
        router.replace(returnTo);
      } catch {
        setUser(null);
        router.replace("/");
      }
    };

    void handleCallback();
  }, [router, searchParams, setUser]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--cg-cream)] p-4 text-[var(--cg-ink)]">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-lg border border-black/10 bg-white p-8 text-center shadow-sm">
        <div className="size-10 animate-spin rounded-full border-2 border-black/10 border-t-[var(--cg-green)]" />
        <div>
          <h1 className="text-lg font-semibold">로그인 처리 중</h1>
          <p className="mt-2 text-sm text-black/58">
            인증 정보를 확인하고 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--cg-cream)] text-[var(--cg-ink)]">
          로그인 처리 중
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
