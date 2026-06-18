"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

export default function AuthCallbackPage() {
  const { refresh } = useAuth();
  const router = useRouter();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const handleCallback = async () => {
      try {
        await refresh();
        router.replace("/");
      } catch (error) {
        console.error("Authentication failed during callback:", error);
        router.replace("/auth/error");
      }
    };

    handleCallback();
  }, [refresh, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-radial from-zinc-900 via-zinc-950 to-black p-4 text-white">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-violet-600/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-indigo-500/10 opacity-75" />
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-zinc-700 border-t-indigo-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-100">안전하게 로그인 중</h2>
          <p className="mt-1 text-sm text-zinc-500">인증 정보를 확인하고 있습니다...</p>
        </div>
      </div>
    </div>
  );
}
