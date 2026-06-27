"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { Providers } from "@/app/providers";
import { useAuth } from "@/components/auth/auth-provider";
import { StatusPanel } from "@/components/realillust/status-panel";
import { getMe } from "@/lib/auth/api";
import { normalizeReturnTo } from "@/lib/auth/paths";

function AuthCallbackLoadingState() {
  return (
    <main className="flex min-h-screen items-center bg-[var(--clay-canvas)] px-4 py-12 text-[var(--clay-primary)]">
      <StatusPanel
        icon={LoaderCircle}
        iconClassName="animate-spin"
        label="Auth"
        title="로그인 처리 중"
        description="Google 인증 결과를 확인하고 있습니다."
      />
    </main>
  );
}

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

  return <AuthCallbackLoadingState />;
}

export default function AuthCallbackPage() {
  return (
    <Providers initialUser={null}>
      <Suspense fallback={<AuthCallbackLoadingState />}>
        <AuthCallbackContent />
      </Suspense>
    </Providers>
  );
}
